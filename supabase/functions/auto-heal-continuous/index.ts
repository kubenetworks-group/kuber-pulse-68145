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

    // ======= CHECK FOR FAILING COMMANDS - PAUSE AUTO-HEAL IF AGENT IS NOT WORKING =======
    // Count failed commands in the last 24 hours for this cluster
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentCommands, error: commandsError } = await supabase
      .from('agent_commands')
      .select('id, status, command_type, created_at, completed_at, result')
      .eq('cluster_id', cluster_id)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });
    
    if (!commandsError && recentCommands && recentCommands.length > 0) {
      const failedCommands = recentCommands.filter(cmd => cmd.status === 'failed');
      const pendingCommands = recentCommands.filter(cmd => cmd.status === 'pending' || cmd.status === 'sent');
      const completedCommands = recentCommands.filter(cmd => cmd.status === 'completed');
      
      const failureRate = recentCommands.length > 0 
        ? (failedCommands.length / recentCommands.length) * 100 
        : 0;
      
      // If more than 50% of commands are failing, or there are 5+ consecutive failures
      // AND there are pending commands stuck - pause auto-heal
      const consecutiveFailures = failedCommands.slice(0, 5).length;
      const hasStuckCommands = pendingCommands.filter(cmd => {
        const createdAt = new Date(cmd.created_at);
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        return createdAt < thirtyMinutesAgo;
      }).length > 0;
      
      const shouldPause = (failureRate >= 50 && failedCommands.length >= 3) || 
                          (consecutiveFailures >= 5) ||
                          (hasStuckCommands && pendingCommands.length >= 3);
      
      if (shouldPause && !force) {
        console.log(`⚠️ Auto-heal paused for cluster ${cluster_id}: ${failedCommands.length} failed, ${pendingCommands.length} pending, failure rate: ${failureRate.toFixed(1)}%`);
        
        // Check if agent needs update
        const needsUpdate = cluster.agent_update_available === true;
        
        // Update cluster to indicate auto-heal is paused
        await supabase
          .from('clusters')
          .update({
            agent_update_message: needsUpdate 
              ? 'Auto-heal pausado: comandos falhando. Atualize o agente para continuar.'
              : 'Auto-heal pausado: comandos não estão sendo executados. Verifique a conectividade do agente.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', cluster_id);
        
        // Create notification for user
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: 'Auto-heal pausado',
            message: needsUpdate 
              ? `O auto-heal do cluster ${cluster.name} foi pausado porque os comandos estão falhando. Atualize o agente para continuar.`
              : `O auto-heal do cluster ${cluster.name} foi pausado porque ${failedCommands.length} comandos falharam nas últimas 24h. Verifique o agente.`,
            type: 'warning',
            related_entity_type: 'cluster',
            related_entity_id: cluster_id,
          });
        
        return new Response(
          JSON.stringify({ 
            message: 'Auto-heal paused due to high command failure rate',
            skipped: true,
            reason: 'agent_commands_failing',
            stats: {
              failed: failedCommands.length,
              pending: pendingCommands.length,
              completed: completedCommands.length,
              failure_rate: failureRate.toFixed(1) + '%',
              needs_agent_update: needsUpdate,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // ======= END FAILING COMMANDS CHECK =======

    const actionsExecuted: any[] = [];
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const configuredThreshold = settings?.severity_threshold || 'high';
    // 'all' means act on every severity level (thresholdIndex = 0 = lowest)
    const thresholdIndex = configuredThreshold === 'all' ? 0 : severityOrder.indexOf(configuredThreshold);

    // ======= DEDUPLICATION: Fetch recent pending/sent commands to avoid duplicates =======
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentPendingCommands } = await supabase
      .from('agent_commands')
      .select('id, command_type, command_params, status, created_at')
      .eq('cluster_id', cluster_id)
      .in('status', ['pending', 'sent', 'executing'])
      .gte('created_at', oneHourAgo);
    
    // Build a set of resource keys that already have pending commands
    const pendingResourceKeys = new Set<string>();
    for (const cmd of recentPendingCommands || []) {
      const params = cmd.command_params as any;
      // Create a unique key for the resource being acted upon
      let resourceKey = '';
      if (params?.pod_name && params?.namespace) {
        resourceKey = `pod:${params.namespace}/${params.pod_name}`;
      } else if (params?.deployment_name && params?.namespace) {
        resourceKey = `deployment:${params.namespace}/${params.deployment_name}`;
      }
      if (resourceKey) {
        pendingResourceKeys.add(resourceKey);
        console.log(`⏳ Resource already has pending command: ${resourceKey} (${cmd.command_type})`);
      }
    }
    
    // Helper function to check if a resource already has a pending command
    const hasPendingCommand = (type: 'pod' | 'deployment', namespace: string, name: string): boolean => {
      const key = `${type}:${namespace}/${name}`;
      return pendingResourceKeys.has(key);
    };
    
    // Helper to add to pending set after creating command
    const markAsPending = (type: 'pod' | 'deployment', namespace: string, name: string) => {
      pendingResourceKeys.add(`${type}:${namespace}/${name}`);
    };
    // ======= END DEDUPLICATION =======

    // System namespaces that should be skipped (infrastructure components, CNI, etc.)
    // Define early so it can be used in both anomalies and pod issues sections
    const systemNamespaces = [
      'kube-system', 'kube-public', 'kube-node-lease',
      'calico-system', 'calico-apiserver', 'tigera-operator',
      'cilium', 'cilium-system',
      'istio-system', 'istio-operator',
      'linkerd', 'linkerd-viz',
      'metallb-system', 'ingress-nginx', 'cert-manager',
      'monitoring', 'prometheus', 'grafana',
      'lens-metrics', // Lens IDE monitoring stack — system-managed
      'flux-system', 'argocd', 'argo',
      'velero', 'external-secrets', 'sealed-secrets',
      'gatekeeper-system', 'kyverno',
      'cattle-system', 'cattle-global-data', 'cattle-global-nt', 'cattle-capi-system', // Rancher
      'kodo', 'kodo-agent', // Agent namespace — NEVER auto-restart, manual only
      'local-path-storage', 'default',
    ];

    // Determine what to apply based on settings
    // When force=true, it means "run now" but still respect the individual settings
    // Only if NO settings exist yet, force=true will apply all fixes
    const shouldApplyAnomalies = settings?.auto_apply_anomalies ?? false;
    const shouldApplySecurity = settings?.auto_apply_security ?? false;
    
    // If force is used but user has configured settings, respect those settings
    // If force is used and no settings configured yet, default to both true for initial run
    const applyAnomalies = force && !settings ? true : shouldApplyAnomalies;
    const applySecurity = force && !settings ? true : shouldApplySecurity;

    console.log(`Auto-heal config: anomalies=${applyAnomalies}, security/resources=${applySecurity}, force=${force}, pending_commands=${pendingResourceKeys.size}`);

    // 1. Check and fix anomalies
    if (applyAnomalies) {
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

        // Extract namespace early to check if it's a system namespace
        const autoHealParams = anomaly.ai_analysis?.auto_heal_params || {};
        const affectedPods = anomaly.ai_analysis?.affected_pods || [];
        let namespace = autoHealParams.namespace || 'default';

        // Try to get namespace from affected_pods if not in params
        if (affectedPods.length > 0) {
          const firstPod = affectedPods[0];
          if (typeof firstPod === 'string' && firstPod.includes('/')) {
            namespace = firstPod.split('/')[0];
          }
        }

        // Skip system namespaces to avoid breaking infrastructure
        if (systemNamespaces.includes(namespace)) {
          console.log(`Skipping anomaly ${anomaly.id} - system namespace: ${namespace}`);
          // Mark as resolved with note
          await supabase
            .from('agent_anomalies')
            .update({
              resolved: true,
              resolved_at: new Date().toISOString(),
              recommendation: `Skipped auto-heal: ${namespace} is a protected system namespace`,
            })
            .eq('id', anomaly.id);
          continue;
        }

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

          // Valid command types that the agent understands
        const validCommandTypes = ['restart_pod', 'delete_pod', 'scale_deployment', 'update_deployment_image', 'update_deployment_resources'];

        switch (anomaly.anomaly_type) {
            case 'pod_restart_loop':
            case 'crash_loop_backoff':
            case 'pod_restart':
            case 'pod_crash':
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
              // Helper function to validate Docker image name format
              const isValidDockerImage = (image: string): boolean => {
                if (!image || typeof image !== 'string') return false;
                // Check for placeholder text (common AI mistakes)
                const placeholders = ['corrigir', 'fix', 'update', 'change', '<', '>', 'placeholder', 'example', 'sua_', 'your_', 'imagem', 'image_name'];
                const lowerImage = image.toLowerCase();
                if (placeholders.some(p => lowerImage.includes(p))) return false;
                // Must have valid format: name:tag or registry/name:tag
                // Valid chars: lowercase letters, numbers, dots, underscores, hyphens, forward slashes
                const imageRegex = /^[a-z0-9][a-z0-9._\-\/]*[a-z0-9]?(:[a-z0-9][a-z0-9._\-]*)?$/i;
                return imageRegex.test(image);
              };

              // Use AI-suggested action if available (e.g., update_deployment_image)
              const aiSuggestedAction = anomaly.ai_analysis?.auto_heal;
              const suggestedImage = autoHealParams.new_image;
              
              if (aiSuggestedAction === 'update_deployment_image' && suggestedImage && isValidDockerImage(suggestedImage)) {
                healAction = 'update_deployment_image';
                healParams = {
                  deployment_name: autoHealParams.deployment_name || podName.replace(/-[a-z0-9]+-[a-z0-9]+$/, ''),
                  namespace: autoHealParams.namespace || namespace,
                  // IMPORTANT: agent previously required container_name; when missing we pass "" and let the agent infer (old_image/single container)
                  container_name: autoHealParams.container_name || '',
                  new_image: suggestedImage,
                  old_image: autoHealParams.old_image,
                };
                console.log(
                  `🐳 Will update image for ${healParams.deployment_name} (container=${healParams.container_name || 'auto'}) from ${healParams.old_image} to ${healParams.new_image}`
                );
              } else {
                // Invalid image or placeholder detected - fallback to pod restart
                if (suggestedImage) {
                  console.log(`⚠️ Invalid image detected: "${suggestedImage}" - falling back to pod restart`);
                }
                healAction = 'restart_pod';
                healParams = {
                  pod_name: podName,
                  namespace: namespace,
                  reason: 'auto_heal_image_pull_error',
                };
              }
              break;
            default:
              // Get action from AI analysis, ensuring it's a valid command type
              const aiSuggestedHeal = anomaly.ai_analysis?.auto_heal;
              // Validate that the action is a valid command type (not null, "null", empty, etc.)
              if (aiSuggestedHeal && typeof aiSuggestedHeal === 'string' &&
                  aiSuggestedHeal !== 'null' && validCommandTypes.includes(aiSuggestedHeal)) {
                healAction = aiSuggestedHeal;
              } else {
                // Fallback to restart_pod if invalid or missing
                healAction = 'restart_pod';
                console.log(`⚠️ Invalid or missing auto_heal action: "${aiSuggestedHeal}", using restart_pod`);
              }
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

          // Final validation of healAction
          if (!validCommandTypes.includes(healAction)) {
            console.log(`⚠️ Skipping anomaly ${anomaly.id} - invalid heal action: ${healAction}`);
            continue;
          }

          // ======= DEDUPLICATION CHECK =======
          const resourceType = healParams.deployment_name ? 'deployment' : 'pod';
          const resourceName = healParams.deployment_name || healParams.pod_name;
          const resourceNs = healParams.namespace || 'default';
          
          if (hasPendingCommand(resourceType, resourceNs, resourceName)) {
            console.log(`⏭️ Skipping anomaly ${anomaly.id} - already has pending command for ${resourceType}:${resourceNs}/${resourceName}`);
            // Mark anomaly as having auto-heal applied to avoid re-processing
            await supabase
              .from('agent_anomalies')
              .update({ auto_heal_applied: true })
              .eq('id', anomaly.id);
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

          // Mark resource as pending to avoid duplicates in same run
          markAsPending(resourceType, resourceNs, resourceName);

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

    // 2. Get latest pod metrics (used by both anomalies and security checks)
    const { data: latestMetrics } = await supabase
      .from('agent_metrics')
      .select('metric_data')
      .eq('cluster_id', cluster_id)
      .eq('metric_type', 'pod_details')
      .order('collected_at', { ascending: false })
      .limit(1)
      .single();

    const podDetails = latestMetrics?.metric_data?.pods || [];

    // 3. Check and fix pods with issues (controlled by auto_apply_anomalies)
    // This includes: CrashLoopBackOff, ImagePullBackOff, recent restarts, stuck pods
    if (applyAnomalies) {
      // Threshold for considering restarts as problematic (lowered from 3 to 1 to catch recent issues)
      const restartThreshold = (settings?.severity_threshold === 'all' || settings?.severity_threshold === 'low') ? 1 :
                                settings?.severity_threshold === 'medium' ? 2 : 3;
      
      // Find pods that are NOT Ready, in CrashLoopBackOff, or have restart issues
      const podsWithIssues = podDetails.filter((pod: any) => {
        // Skip system namespaces
        if (systemNamespaces.includes(pod.namespace)) {
          return false;
        }

        // Check for CrashLoopBackOff or ImagePullBackOff
        const hasBackOff = pod.containers?.some((c: any) =>
          c.state?.status === 'waiting' &&
          (c.state?.reason === 'CrashLoopBackOff' || c.state?.reason === 'ImagePullBackOff')
        );

        // Check for restart count based on severity threshold
        const restartCount = pod.restarts || pod.total_restarts || 0;
        const hasRestarts = restartCount >= restartThreshold;

        // Check if pod is not ready but should be running
        const isStuck = pod.phase === 'Running' && pod.ready === false;

        return hasBackOff || hasRestarts || isStuck;
      });

      // Also include pods with recent restarts that are running OK (to clear/reset them)
      // This catches pods that had issues but recovered - we restart them to stabilize
      const podsWithRecentRestarts = podDetails.filter((pod: any) => {
        const restartCount = pod.restarts || pod.total_restarts || 0;
        
        // Check if any container had a recent termination (last 2 hours)
        const hasRecentTermination = pod.containers?.some((c: any) => {
          if (c.last_state?.finished_at) {
            const finishedAt = new Date(c.last_state.finished_at);
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            return finishedAt > twoHoursAgo;
          }
          return false;
        });
        
        return (pod.phase === 'Running' || pod.status === 'Running') &&
               pod.ready === true &&
               restartCount >= restartThreshold &&
               hasRecentTermination &&
               !systemNamespaces.includes(pod.namespace);
      });

      // Combine and deduplicate
      const podsToRestart = [...podsWithIssues];
      for (const pod of podsWithRecentRestarts) {
        if (!podsToRestart.some(p => p.name === pod.name && p.namespace === pod.namespace)) {
          podsToRestart.push(pod);
        }
      }
      
      console.log(`🔍 Found ${podsWithIssues.length} pods with issues, ${podsWithRecentRestarts.length} with recent restarts (threshold: ${restartThreshold})`);
      console.log(`📋 Total pods to restart: ${podsToRestart.length}`);

      for (const pod of podsToRestart) {
        // ======= DEDUPLICATION CHECK =======
        if (hasPendingCommand('pod', pod.namespace, pod.name)) {
          console.log(`⏭️ Skipping pod ${pod.namespace}/${pod.name} - already has pending command`);
          continue;
        }

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
          const healReason = hasBackOff ? 'auto_heal_backoff' : isNotReady ? 'auto_heal_not_ready' : 'auto_heal_restarts';

          // ── Insert audit record BEFORE restarting so there's always context ──
          // episode_key uses restart_count+1 to avoid collision with the capture from
          // agent-receive-metrics (which keys on the current restart_count).
          const episodeKey = `${pod.namespace}/${pod.name}/${restartCount}_autoheal`;
          const { data: auditRecord } = await supabase
            .from('pod_restart_audit')
            .upsert({
              cluster_id,
              user_id: userId,
              pod_name:       pod.name,
              namespace:      pod.namespace,
              restart_reason: healReason,
              restart_count:  restartCount,
              analysis_summary: triggerReason,
              source:         'auto_heal',
              episode_key:    episodeKey,
              previous_state: { has_backoff: hasBackOff, is_not_ready: isNotReady },
            }, { onConflict: 'cluster_id,episode_key', ignoreDuplicates: true })
            .select('id')
            .maybeSingle();

          // Also queue get_pod_logs (current logs, not previous) so we can see WHY it misbehaves
          if (auditRecord?.id) {
            await supabase.from('agent_commands').insert({
              cluster_id,
              user_id: userId,
              command_type: 'get_pod_logs',
              command_params: {
                pod_name:       pod.name,
                namespace:      pod.namespace,
                tail_lines:     150,
                previous:       false,
                episode_key:    episodeKey,
                restart_reason: healReason,
                restart_count:  restartCount,
                user_id:        userId,
                trigger:        'auto_restart_capture',
              },
              status: 'pending',
            });
          }

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
                reason: healReason,
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

          // Mark as pending to avoid duplicates
          markAsPending('pod', pod.namespace, pod.name);

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
    }

    // 4. Check and fix resource-related issues (CPU/Memory limits)
    // NOTE: This is controlled by auto_apply_security - only applies resource adjustments
    if (applySecurity) {
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
          // Skip system namespaces (using the constant defined above)
          if (systemNamespaces.includes(pod.namespace)) {
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

          // ======= DEDUPLICATION CHECK =======
          if (hasPendingCommand('deployment', pod.namespace, deploymentName)) {
            console.log(`⏭️ Skipping resource limits for ${pod.namespace}/${deploymentName} - already has pending command`);
            continue;
          }

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

            // Mark as pending to avoid duplicates
            markAsPending('deployment', pod.namespace, deploymentName);

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

        // ======= DEDUPLICATION CHECK for security threats =======
        const affectedNs = threat.affected_resources?.[0]?.namespace || 'default';
        const affectedName = threat.affected_resources?.[0]?.name || '';
        if (affectedName && hasPendingCommand('deployment', affectedNs, affectedName)) {
          console.log(`⏭️ Skipping security threat ${threat.id} - already has pending command for ${affectedNs}/${affectedName}`);
          continue;
        }

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
