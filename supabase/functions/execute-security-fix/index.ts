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

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cluster_id, threat_id, fix_type } = await req.json();

    if (!cluster_id || !threat_id || !fix_type) {
      return new Response(
        JSON.stringify({ error: 'cluster_id, threat_id, and fix_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the threat
    const { data: threat, error: threatError } = await supabase
      .from('security_threats')
      .select('*')
      .eq('id', threat_id)
      .eq('user_id', user.id)
      .single();

    if (threatError || !threat) {
      return new Response(
        JSON.stringify({ error: 'Threat not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the action (non-fatal — table may not exist in all environments)
    let actionLog: { id?: string } | null = null;
    try {
      const { data } = await supabase
        .from('auto_heal_actions_log')
        .insert({
          cluster_id,
          user_id: user.id,
          action_type: 'security_fix',
          trigger_reason: `Manual fix for: ${threat.title}`,
          trigger_entity_id: threat_id,
          trigger_entity_type: 'security_threat',
          action_details: {
            fix_type,
            threat_type: threat.threat_type,
            severity: threat.severity,
          },
          status: 'executing',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      actionLog = data;
    } catch (_logErr) {
      // Audit log is best-effort; don't fail the fix if it can't be written
      console.warn('Could not write to auto_heal_actions_log:', _logErr);
    }

    // Determine the fix command based on fix_type
    let commandType = '';
    let commandParams: any = {};

    switch (fix_type) {
      case 'create_network_policy': {
        const targetNamespace = threat.affected_resources?.[0]?.namespace || 'default';
        const policyName = `kodo-deny-ingress-${Date.now()}`;
        commandType = 'apply_manifests';
        commandParams = {
          manifests: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ${policyName}
  namespace: ${targetNamespace}
  labels:
    managed-by: kodo-auto-heal
spec:
  podSelector: {}
  policyTypes:
  - Ingress`,
          description: `Auto-created deny-all-ingress NetworkPolicy for namespace ${targetNamespace}`,
        };
        break;
      }

      case 'apply_resource_limits':
        commandType = 'update_deployment_resources';
        commandParams = {
          namespace: threat.affected_resources?.[0]?.namespace || 'default',
          deployment_name: threat.affected_resources?.[0]?.name,
          container_name: threat.affected_resources?.[0]?.container || '',
          cpu_request: '100m',
          cpu_limit: '500m',
          memory_request: '128Mi',
          memory_limit: '512Mi',
        };
        break;

      case 'restrict_rbac':
        commandType = 'restrict_rbac';
        commandParams = {
          namespace: threat.affected_resources?.[0]?.namespace || 'default',
          role_name: threat.affected_resources?.[0]?.name,
          action: 'restrict',
        };
        break;

      case 'apply_pod_security':
        commandType = 'apply_pod_security';
        commandParams = {
          namespace: threat.affected_resources?.[0]?.namespace || 'default',
          level: 'restricted',
          enforce: true,
        };
        break;

      case 'enable_secrets_encryption':
        commandType = 'enable_secrets_encryption';
        commandParams = {
          namespace: threat.affected_resources?.[0]?.namespace || 'default',
        };
        break;

      case 'implement_all':
        // For implementing all recommendations
        commandType = 'security_audit_fix';
        commandParams = {
          threat_id,
          remediation_steps: threat.remediation_steps || [],
        };
        break;

      case 'block_attacker_ip': {
        // Block a specific attacker IP via NetworkPolicy (allow-all-except-attacker).
        // Requires source_ip in the threat record.
        const attackerIP =
          threat.source_ip ||
          (threat.evidence as any)?.source_ip ||
          (threat.raw_data as any)?.source_ip;
        if (!attackerIP) {
          return new Response(
            JSON.stringify({ error: 'No source_ip found in threat — cannot block attacker IP' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        commandType = 'block_attacker_ip';
        commandParams = {
          namespace: threat.namespace || threat.affected_resources?.[0]?.namespace || 'default',
          attacker_ip: attackerIP,
          pod_labels: (threat.evidence as any)?.pod_labels || {},
          external_traffic_policy: (threat.evidence as any)?.external_traffic_policy || 'Cluster',
          threat_id,
          trigger: 'manual_fix',
        };
        break;
      }

      case 'auto_fix': {
        // Map threat_type to the appropriate command
        const threatTypeToCommand: Record<string, { type: string; params: any }> = {
          privilege_escalation: {
            type: 'restrict_rbac',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              role_name: threat.affected_resources?.[0]?.name,
              action: 'restrict',
            },
          },
          privileged_container: {
            type: 'apply_pod_security',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              level: 'restricted',
              enforce: true,
            },
          },
          host_network: {
            type: 'apply_pod_security',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              level: 'baseline',
              enforce: true,
            },
          },
          host_pid: {
            type: 'apply_pod_security',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              level: 'baseline',
              enforce: true,
            },
          },
          missing_security_context: {
            type: 'apply_pod_security',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              level: 'restricted',
              enforce: true,
            },
          },
          writable_root_filesystem: {
            type: 'apply_pod_security',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              level: 'restricted',
              enforce: true,
            },
          },
          // Container running as root — enforce non-root via pod security
          suspicious_process: {
            type: 'apply_pod_security',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              level: 'restricted',
              enforce: true,
              run_as_non_root: true,
            },
          },
          root_container: {
            type: 'apply_pod_security',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              level: 'restricted',
              enforce: true,
              run_as_non_root: true,
            },
          },
          container_as_root: {
            type: 'apply_pod_security',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              level: 'restricted',
              enforce: true,
              run_as_non_root: true,
            },
          },
          run_as_root: {
            type: 'apply_pod_security',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              level: 'restricted',
              enforce: true,
              run_as_non_root: true,
            },
          },
          // Network anomalies — isolate with deny-all ingress policy
          suspicious_network: {
            type: 'create_network_policy',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              policy_name: `kodo-isolate-${Date.now()}`,
              policy_type: 'deny-all-ingress',
            },
          },
          // Overprivileged RBAC — restrict the role
          excessive_rbac: {
            type: 'restrict_rbac',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              role_name: threat.affected_resources?.[0]?.name,
              action: 'restrict',
            },
          },
          overprivileged_rbac: {
            type: 'restrict_rbac',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              role_name: threat.affected_resources?.[0]?.name,
              action: 'restrict',
            },
          },
          // Resource abuse / crypto mining — apply resource limits
          resource_abuse: {
            type: 'update_deployment_resources',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              deployment_name: threat.affected_resources?.[0]?.name,
              container_name: threat.affected_resources?.[0]?.container || '',
              cpu_limit: '200m',
              memory_limit: '256Mi',
            },
          },
          crypto_mining: {
            type: 'update_deployment_resources',
            params: {
              namespace: threat.affected_resources?.[0]?.namespace || 'default',
              deployment_name: threat.affected_resources?.[0]?.name,
              container_name: threat.affected_resources?.[0]?.container || '',
              cpu_limit: '100m',
              memory_limit: '128Mi',
            },
          },
        };

        // HTTP attack types — auto-fix via IP blocking
        const httpAttackTypes = ['shell_injection', 'sql_injection', 'path_traversal', 'brute_force', 'port_scan'];
        if (httpAttackTypes.includes(threat.threat_type)) {
          const attackerIP =
            threat.source_ip ||
            (threat.evidence as any)?.source_ip ||
            (threat.raw_data as any)?.source_ip;
          if (attackerIP) {
            commandType = 'block_attacker_ip';
            commandParams = {
              namespace: threat.namespace || threat.affected_resources?.[0]?.namespace || 'default',
              attacker_ip: attackerIP,
              pod_labels: (threat.evidence as any)?.pod_labels || {},
              external_traffic_policy: (threat.evidence as any)?.external_traffic_policy || 'Cluster',
              threat_id,
              trigger: 'auto_fix',
            };
            break;
          }
        }

        const mapped = threatTypeToCommand[threat.threat_type];
        if (!mapped) {
          return new Response(
            JSON.stringify({ error: `No auto_fix mapping for threat type: ${threat.threat_type}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        commandType = mapped.type;
        commandParams = mapped.params;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown fix type: ${fix_type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Create the command for the agent
    const { data: command, error: commandError } = await supabase
      .from('agent_commands')
      .insert({
        cluster_id,
        user_id: user.id,
        command_type: commandType,
        command_params: commandParams,
        status: 'pending',
      })
      .select()
      .single();

    if (commandError) {
      // Update action log with error (non-fatal)
      if (actionLog?.id) {
        try {
          await supabase
            .from('auto_heal_actions_log')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: commandError.message,
            })
            .eq('id', actionLog.id);
        } catch (_) { /* best-effort */ }
      }
      throw commandError;
    }

    // Update the threat status
    await supabase
      .from('security_threats')
      .update({
        status: 'mitigated',
        remediated_at: new Date().toISOString(),
        remediation_result: {
          fix_type,
          command_id: command.id,
          applied_at: new Date().toISOString(),
        },
      })
      .eq('id', threat_id);

    // Update action log (non-fatal)
    if (actionLog?.id) {
      try {
        await supabase
          .from('auto_heal_actions_log')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result: {
              command_id: command.id,
              command_type: commandType,
              params: commandParams,
            },
          })
          .eq('id', actionLog.id);
      } catch (_) { /* best-effort */ }
    }

    // Create notification (non-fatal)
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: '🔧 Correção de Segurança Aplicada',
          message: `Correção "${fix_type}" foi enviada para o cluster`,
          type: 'success',
          related_entity_type: 'security_threat',
          related_entity_id: threat_id,
        });
    } catch (_) { /* best-effort */ }

    return new Response(
      JSON.stringify({
        success: true,
        command_id: command.id,
        command_type: commandType,
        message: 'Security fix command sent to agent',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Execute security fix error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
