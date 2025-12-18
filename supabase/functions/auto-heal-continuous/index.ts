import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user or service call
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        console.log('Auth error, proceeding as service call:', authError.message);
      } else {
        userId = user?.id || null;
      }
    }

    const { cluster_id, force = false } = await req.json();

    if (!cluster_id) {
      return new Response(
        JSON.stringify({ error: 'cluster_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get cluster info
    const { data: cluster, error: clusterError } = await supabase
      .from('clusters')
      .select('*')
      .eq('id', cluster_id)
      .single();

    if (clusterError || !cluster) {
      return new Response(
        JSON.stringify({ error: 'Cluster not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    userId = userId || cluster.user_id;

    // Get auto-heal settings
    const { data: settings } = await supabase
      .from('auto_heal_settings')
      .select('*')
      .eq('cluster_id', cluster_id)
      .single();

    // If not forced and auto-heal is not enabled, skip
    if (!force && (!settings || !settings.enabled)) {
      return new Response(
        JSON.stringify({ 
          message: 'Auto-heal is not enabled for this cluster',
          skipped: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const actionsExecuted: any[] = [];
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const thresholdIndex = severityOrder.indexOf(settings?.severity_threshold || 'high');

    // 1. Check and fix anomalies
    if (settings?.auto_apply_anomalies || force) {
      const { data: anomalies } = await supabase
        .from('agent_anomalies')
        .select('*')
        .eq('cluster_id', cluster_id)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);

      for (const anomaly of anomalies || []) {
        const anomalySeverityIndex = severityOrder.indexOf(anomaly.severity);
        
        // Skip if below threshold
        if (anomalySeverityIndex < thresholdIndex && !force) continue;

        // Log the action
        const { data: actionLog } = await supabase
          .from('auto_heal_actions_log')
          .insert({
            cluster_id,
            user_id: userId,
            action_type: 'anomaly_fix',
            trigger_reason: anomaly.description,
            trigger_entity_id: anomaly.id,
            trigger_entity_type: 'anomaly',
            action_details: {
              anomaly_type: anomaly.anomaly_type,
              severity: anomaly.severity,
              recommendation: anomaly.recommendation,
            },
            status: 'executing',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        try {
          // Determine auto-heal action based on anomaly type
          let healAction = '';
          let healParams: any = {};

          // Extract pod info from anomaly data - check multiple locations
          const autoHealParams = anomaly.ai_analysis?.auto_heal_params || {};
          const affectedPods = anomaly.ai_analysis?.affected_pods || [];

          // Try to get pod name from various sources
          let podName = autoHealParams.pod_name || '';
          let namespace = autoHealParams.namespace || 'default';

          // If not in auto_heal_params, try affected_pods (format: "namespace/pod-name")
          if (!podName && affectedPods.length > 0) {
            const firstPod = affectedPods[0];
            if (typeof firstPod === 'string' && firstPod.includes('/')) {
              [namespace, podName] = firstPod.split('/');
            } else if (typeof firstPod === 'string') {
              podName = firstPod;
            }
          }

          // Try to extract from description if still not found
          if (!podName) {
            const descMatch = anomaly.description?.match(/pod[:\s]+([a-z0-9-]+)/i);
            if (descMatch) {
              podName = descMatch[1];
            }
          }

          console.log(`Processing anomaly ${anomaly.id}: type=${anomaly.anomaly_type}, pod=${namespace}/${podName}`);

          switch (anomaly.anomaly_type) {
            case 'pod_restart_loop':
            case 'crash_loop_backoff':
              healAction = 'restart_pod';
              healParams = {
                pod_name: podName,
                namespace: namespace,
                reason: `auto_heal_${anomaly.anomaly_type}`,
              };
              break;
            case 'high_resource_usage':
            case 'resource_exhaustion':
              healAction = 'scale_deployment';
              healParams = {
                deployment_name: podName.replace(/-[a-z0-9]+-[a-z0-9]+$/, ''), // Remove pod suffix
                namespace: namespace,
                replicas: 2
              };
              break;
            case 'oom_killed':
            case 'resource_limit_too_low':
              // Increase memory/CPU limits
              const resourceParams = anomaly.ai_analysis?.auto_heal_params || {};
              healAction = 'update_deployment_resources';
              healParams = {
                deployment_name: resourceParams.deployment_name || podName.replace(/-[a-z0-9]+-[a-z0-9]+$/, ''),
                namespace: resourceParams.namespace || namespace,
                container_name: resourceParams.container_name || podName.split('-')[0],
                memory_limit: resourceParams.memory_limit || '1Gi',
                memory_request: resourceParams.memory_request || '512Mi',
                cpu_limit: resourceParams.cpu_limit || '1000m',
                cpu_request: resourceParams.cpu_request || '500m',
              };
              console.log(`📈 Will update resources for ${healParams.deployment_name}: memory=${healParams.memory_limit}`);
              break;
            case 'image_pull_error':
              // Use AI-suggested action if available (e.g., update_deployment_image)
              const aiSuggestedAction = anomaly.ai_analysis?.auto_heal;
              if (aiSuggestedAction === 'update_deployment_image' && autoHealParams.new_image) {
                healAction = 'update_deployment_image';
                healParams = {
                  deployment_name: autoHealParams.deployment_name || podName.replace(/-[a-z0-9]+-[a-z0-9]+$/, ''),
                  namespace: autoHealParams.namespace || namespace,
                  // IMPORTANT: agent previously required container_name; when missing we pass "" and let the agent infer (old_image/single container)
                  container_name: autoHealParams.container_name || '',
                  new_image: autoHealParams.new_image,
                  old_image: autoHealParams.old_image,
                };
                console.log(
                  `🐳 Will update image for ${healParams.deployment_name} (container=${healParams.container_name || 'auto'}) from ${healParams.old_image} to ${healParams.new_image}`
                );
              } else {
                healAction = 'restart_pod';
                healParams = {
                  pod_name: podName,
                  namespace: namespace,
                  reason: 'auto_heal_image_pull_error',
                };
              }
              break;
            default:
              healAction = anomaly.ai_analysis?.auto_heal || 'restart_pod';
              healParams = {
                pod_name: podName,
                namespace: namespace,
                reason: `auto_heal_${anomaly.anomaly_type}`,
                ...anomaly.ai_analysis?.auto_heal_params,
              };
          }

          // Skip if we don't have pod name
          if (!healParams.pod_name && !healParams.deployment_name) {
            console.log(`Skipping anomaly ${anomaly.id} - no pod/deployment name found`);
            continue;
          }

          // Create command for the agent
          await supabase
            .from('agent_commands')
            .insert({
              cluster_id,
              user_id: userId,
              command_type: healAction,
              command_params: healParams,
              status: 'pending',
            });

          // Mark anomaly as resolved
          await supabase
            .from('agent_anomalies')
            .update({
              resolved: true,
              resolved_at: new Date().toISOString(),
              auto_heal_applied: true,
            })
            .eq('id', anomaly.id);

          // Update action log
          await supabase
            .from('auto_heal_actions_log')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              result: { command_sent: healAction, params: healParams },
            })
            .eq('id', actionLog?.id);

          actionsExecuted.push({
            type: 'anomaly_fix',
            target: anomaly.id,
            action: healAction,
            success: true,
          });
        } catch (error: any) {
          // Update action log with error
          await supabase
            .from('auto_heal_actions_log')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: error.message,
            })
            .eq('id', actionLog?.id);

          actionsExecuted.push({
            type: 'anomaly_fix',
            target: anomaly.id,
            success: false,
            error: error.message,
          });
        }
      }
    }

    // 2. Check and fix resource-related issues (CPU/Memory limits)
    // NOTE: We only auto-apply resource adjustments, NOT RBAC or network policies
    if (settings?.auto_apply_security || force) {
      // Get latest metrics to check for pods with issues
      const { data: latestMetrics } = await supabase
        .from('agent_metrics')
        .select('metric_data')
        .eq('cluster_id', cluster_id)
        .eq('metric_type', 'pod_details')
        .order('collected_at', { ascending: false })
        .limit(1)
        .single();

      const podDetails = latestMetrics?.metric_data?.pods || [];

      // Find pods that are NOT Ready, in CrashLoopBackOff, or have restart issues
      const podsWithIssues = podDetails.filter((pod: any) => {
        // Skip system namespaces
        if (['kube-system', 'kube-public', 'kube-node-lease'].includes(pod.namespace)) {
          return false;
        }

        // Check for CrashLoopBackOff or ImagePullBackOff
        const hasBackOff = pod.containers?.some((c: any) =>
          c.state?.status === 'waiting' &&
          (c.state?.reason === 'CrashLoopBackOff' || c.state?.reason === 'ImagePullBackOff')
        );

        // Check for high restart count
        const hasHighRestarts = (pod.restarts > 3 || pod.total_restarts > 3);

        // Check if pod is not ready but should be running
        const isStuck = pod.phase === 'Running' && pod.ready === false;

        return hasBackOff || hasHighRestarts || isStuck;
      });

      // Also include pods with high restarts that are running OK (clear restart counter)
      const podsWithHighRestarts = podDetails.filter((pod: any) =>
        (pod.phase === 'Running' || pod.status === 'Running') &&
        pod.ready === true &&
        (pod.restarts > 3 || pod.total_restarts > 3) &&
        !['kube-system', 'kube-public', 'kube-node-lease'].includes(pod.namespace)
      );

      // Combine and deduplicate
      const podsToRestart = [...podsWithIssues];
      for (const pod of podsWithHighRestarts) {
        if (!podsToRestart.some(p => p.name === pod.name && p.namespace === pod.namespace)) {
          podsToRestart.push(pod);
        }
      }

      for (const pod of podsToRestart) {
        const restartCount = pod.restarts || pod.total_restarts || 0;
        const hasBackOff = pod.containers?.some((c: any) =>
          c.state?.status === 'waiting' &&
          (c.state?.reason === 'CrashLoopBackOff' || c.state?.reason === 'ImagePullBackOff')
        );
        const isNotReady = pod.phase === 'Running' && pod.ready === false;

        let triggerReason = `Pod ${pod.name} has ${restartCount} restarts`;
        if (hasBackOff) {
          triggerReason = `Pod ${pod.name} is in CrashLoopBackOff or ImagePullBackOff`;
        } else if (isNotReady) {
          triggerReason = `Pod ${pod.name} is stuck in not-ready state`;
        }

        // Log the action
        const { data: actionLog } = await supabase
          .from('auto_heal_actions_log')
          .insert({
            cluster_id,
            user_id: userId,
            action_type: 'restart_pod',
            trigger_reason: triggerReason,
            trigger_entity_id: null,
            trigger_entity_type: 'pod',
            action_details: {
              pod_name: pod.name,
              namespace: pod.namespace,
              restart_count: restartCount,
              has_backoff: hasBackOff,
              is_not_ready: isNotReady,
              reason: 'Auto-heal pod restart',
            },
            status: 'executing',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        try {
          // Create restart command for the agent
          await supabase
            .from('agent_commands')
            .insert({
              cluster_id,
              user_id: userId,
              command_type: 'restart_pod',
              command_params: {
                pod_name: pod.name,
                namespace: pod.namespace,
                reason: hasBackOff ? 'auto_heal_backoff' : isNotReady ? 'auto_heal_not_ready' : 'auto_heal_restarts',
              },
              status: 'pending',
            });

          // Update action log
          await supabase
            .from('auto_heal_actions_log')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              result: {
                command_sent: 'restart_pod',
                params: { pod_name: pod.name, namespace: pod.namespace },
                message: 'Pod restart command sent to agent'
              },
            })
            .eq('id', actionLog?.id);

          actionsExecuted.push({
            type: 'restart_pod',
            target: `${pod.namespace}/${pod.name}`,
            action: 'restart_pod',
            restart_count: restartCount,
            reason: triggerReason,
            success: true,
          });

          console.log(`Scheduled restart for pod ${pod.namespace}/${pod.name} - ${triggerReason}`);
        } catch (error: any) {
          // Update action log with error
          await supabase
            .from('auto_heal_actions_log')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: error.message,
            })
            .eq('id', actionLog?.id);

          actionsExecuted.push({
            type: 'restart_pod',
            target: `${pod.namespace}/${pod.name}`,
            success: false,
            error: error.message,
          });
        }
      }

      // Check security metrics for pods without resource limits
      const { data: securityMetrics } = await supabase
        .from('agent_metrics')
        .select('metric_data')
        .eq('cluster_id', cluster_id)
        .eq('metric_type', 'security')
        .order('collected_at', { ascending: false })
        .limit(1)
        .single();

      const podSecurityData = securityMetrics?.metric_data?.pod_security || {};
      const totalPods = podSecurityData.total_pods || 0;
      const podsWithLimits = podSecurityData.pods_with_resource_limits || 0;
      const limitPercentage = podSecurityData.resource_limits_percentage || 0;

      console.log(`Resource limits: ${podsWithLimits}/${totalPods} pods (${limitPercentage.toFixed(1)}%)`);

      // If less than 50% of pods have resource limits, find and fix them
      if (totalPods > 0 && limitPercentage < 50) {
        // Find pods without resource limits from pod_details
        const podsWithoutLimits = podDetails.filter((pod: any) => {
          // Skip system namespaces
          if (['kube-system', 'kube-public', 'kube-node-lease'].includes(pod.namespace)) {
            return false;
          }

          // Check if any container lacks resource limits
          return pod.containers?.some((c: any) => {
            const resources = c.resources || {};
            return !resources.limits || Object.keys(resources.limits).length === 0;
          });
        }).slice(0, 5); // Limit to 5 pods per run to avoid overwhelming

        for (const pod of podsWithoutLimits) {
          // Get deployment name from pod (usually pod name without the random suffix)
          const podNameParts = pod.name.split('-');
          podNameParts.pop(); // Remove random suffix
          podNameParts.pop(); // Remove replica hash
          const deploymentName = podNameParts.join('-');

          if (!deploymentName) continue;

          const containerName = pod.containers?.[0]?.name;
          if (!containerName) continue;

          // Log the action
          const { data: actionLog } = await supabase
            .from('auto_heal_actions_log')
            .insert({
              cluster_id,
              user_id: userId,
              action_type: 'apply_resource_limits',
              trigger_reason: `Pod ${pod.name} lacks resource limits`,
              trigger_entity_id: null,
              trigger_entity_type: 'pod',
              action_details: {
                pod_name: pod.name,
                deployment_name: deploymentName,
                namespace: pod.namespace,
                container_name: containerName,
                reason: 'Auto-apply resource limits',
              },
              status: 'executing',
              started_at: new Date().toISOString(),
            })
            .select()
            .single();

          try {
            // Create command to update deployment resources
            await supabase
              .from('agent_commands')
              .insert({
                cluster_id,
                user_id: userId,
                command_type: 'update_deployment_resources',
                command_params: {
                  deployment_name: deploymentName,
                  namespace: pod.namespace,
                  container_name: containerName,
                  cpu_request: '100m',
                  cpu_limit: '500m',
                  memory_request: '128Mi',
                  memory_limit: '512Mi',
                },
                status: 'pending',
              });

            // Update action log
            await supabase
              .from('auto_heal_actions_log')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                result: {
                  command_sent: 'update_deployment_resources',
                  deployment: deploymentName,
                  namespace: pod.namespace,
                  message: 'Resource limits will be applied'
                },
              })
              .eq('id', actionLog?.id);

            actionsExecuted.push({
              type: 'apply_resource_limits',
              target: `${pod.namespace}/${deploymentName}`,
              action: 'update_deployment_resources',
              success: true,
            });

            console.log(`Applied resource limits to ${pod.namespace}/${deploymentName}`);
          } catch (error: any) {
            await supabase
              .from('auto_heal_actions_log')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: error.message,
              })
              .eq('id', actionLog?.id);

            actionsExecuted.push({
              type: 'apply_resource_limits',
              target: `${pod.namespace}/${deploymentName}`,
              success: false,
              error: error.message,
            });
          }
        }
      }

      // Handle resource limit issues from security_threats table (legacy)
      const { data: threats } = await supabase
        .from('security_threats')
        .select('*')
        .eq('cluster_id', cluster_id)
        .eq('status', 'active')
        .in('threat_type', ['missing_resource_limits', 'resource_exhaustion', 'high_resource_usage'])
        .order('created_at', { ascending: false })
        .limit(10);

      for (const threat of threats || []) {
        const threatSeverityIndex = severityOrder.indexOf(threat.severity);

        // Skip if below threshold
        if (threatSeverityIndex < thresholdIndex && !force) continue;

        // Log the action
        const { data: actionLog } = await supabase
          .from('auto_heal_actions_log')
          .insert({
            cluster_id,
            user_id: userId,
            action_type: 'resource_adjustment',
            trigger_reason: threat.title,
            trigger_entity_id: threat.id,
            trigger_entity_type: 'security_threat',
            action_details: {
              threat_type: threat.threat_type,
              severity: threat.severity,
              affected_resources: threat.affected_resources,
            },
            status: 'executing',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        try {
          // Only handle resource-related fixes
          let fixCommand = '';
          let fixParams: any = {};

          if (threat.threat_type === 'missing_resource_limits') {
            fixCommand = 'update_deployment_resources';
            fixParams = {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              deployment_name: threat.affected_resources?.[0]?.name || '',
              container_name: threat.affected_resources?.[0]?.container || '',
              cpu_limit: '500m',
              cpu_request: '100m',
              memory_limit: '512Mi',
              memory_request: '128Mi',
            };
          } else {
            // Skip non-resource threats
            await supabase
              .from('auto_heal_actions_log')
              .update({
                status: 'skipped',
                completed_at: new Date().toISOString(),
                result: { message: 'Non-resource threat - requires manual review' },
              })
              .eq('id', actionLog?.id);
            continue;
          }

          // Create command for the agent
          await supabase
            .from('agent_commands')
            .insert({
              cluster_id,
              user_id: userId,
              command_type: fixCommand,
              command_params: fixParams,
              status: 'pending',
            });

          // Update threat status
          await supabase
            .from('security_threats')
            .update({
              status: 'mitigated',
              auto_remediated: true,
              remediated_at: new Date().toISOString(),
              remediation_result: { command_sent: fixCommand, params: fixParams },
            })
            .eq('id', threat.id);

          // Update action log
          await supabase
            .from('auto_heal_actions_log')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              result: { command_sent: fixCommand, params: fixParams },
            })
            .eq('id', actionLog?.id);

          actionsExecuted.push({
            type: 'resource_adjustment',
            target: threat.id,
            action: fixCommand,
            success: true,
          });
        } catch (error: any) {
          // Update action log with error
          await supabase
            .from('auto_heal_actions_log')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: error.message,
            })
            .eq('id', actionLog?.id);

          actionsExecuted.push({
            type: 'resource_adjustment',
            target: threat.id,
            success: false,
            error: error.message,
          });
        }
      }
    }

    // Create notification if actions were taken
    if (actionsExecuted.length > 0) {
      const successCount = actionsExecuted.filter(a => a.success).length;
      const failCount = actionsExecuted.filter(a => !a.success).length;

      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: '🤖 Auto-Cura Executada',
          message: `${successCount} correção(ões) aplicada(s) automaticamente${failCount > 0 ? `, ${failCount} falha(s)` : ''}`,
          type: failCount > 0 ? 'warning' : 'success',
          related_entity_type: 'cluster',
          related_entity_id: cluster_id,
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        actions_executed: actionsExecuted.length,
        actions: actionsExecuted,
        settings: {
          enabled: settings?.enabled,
          auto_apply_security: settings?.auto_apply_security,
          auto_apply_anomalies: settings?.auto_apply_anomalies,
          severity_threshold: settings?.severity_threshold,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Auto-heal continuous error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
