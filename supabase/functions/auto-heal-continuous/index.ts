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

          switch (anomaly.anomaly_type) {
            case 'pod_restart_loop':
            case 'crash_loop_backoff':
              healAction = 'restart_pod';
              healParams = anomaly.ai_analysis?.auto_heal_params || {};
              break;
            case 'high_resource_usage':
            case 'resource_exhaustion':
              healAction = 'scale_deployment';
              healParams = { replicas: 2 };
              break;
            case 'image_pull_error':
              healAction = 'update_image';
              healParams = anomaly.ai_analysis?.auto_heal_params || {};
              break;
            default:
              healAction = anomaly.ai_analysis?.auto_heal || 'restart_pod';
              healParams = anomaly.ai_analysis?.auto_heal_params || {};
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

    // 2. Check and fix security threats
    if (settings?.auto_apply_security || force) {
      const { data: threats } = await supabase
        .from('security_threats')
        .select('*')
        .eq('cluster_id', cluster_id)
        .eq('status', 'active')
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
            action_type: 'security_fix',
            trigger_reason: threat.title,
            trigger_entity_id: threat.id,
            trigger_entity_type: 'security_threat',
            action_details: {
              threat_type: threat.threat_type,
              severity: threat.severity,
              remediation_steps: threat.remediation_steps,
            },
            status: 'executing',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        try {
          // Determine security fix based on threat type
          let fixCommand = '';
          let fixParams: any = {};

          switch (threat.threat_type) {
            case 'missing_network_policy':
              fixCommand = 'create_network_policy';
              fixParams = {
                namespace: threat.affected_resources?.[0]?.namespace || 'default',
                policy_type: 'deny-all-ingress',
              };
              break;
            case 'missing_resource_limits':
              fixCommand = 'apply_resource_limits';
              fixParams = {
                namespace: threat.affected_resources?.[0]?.namespace || 'default',
                cpu_limit: '500m',
                memory_limit: '512Mi',
              };
              break;
            case 'overly_permissive_rbac':
              fixCommand = 'restrict_rbac';
              fixParams = {
                namespace: threat.affected_resources?.[0]?.namespace || 'default',
              };
              break;
            case 'missing_pod_security':
              fixCommand = 'apply_pod_security';
              fixParams = {
                namespace: threat.affected_resources?.[0]?.namespace || 'default',
                level: 'restricted',
              };
              break;
            default:
              fixCommand = 'security_audit';
              fixParams = { threat_id: threat.id };
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
            type: 'security_fix',
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
            type: 'security_fix',
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
