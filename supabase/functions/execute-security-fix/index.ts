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

    // Log the action
    const { data: actionLog } = await supabase
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

    // Determine the fix command based on fix_type
    let commandType = '';
    let commandParams: any = {};

    switch (fix_type) {
      case 'create_network_policy':
        commandType = 'create_network_policy';
        commandParams = {
          namespace: threat.affected_resources?.[0]?.namespace || 'default',
          policy_name: `deny-ingress-${Date.now()}`,
          policy_type: 'deny-all-ingress',
        };
        break;

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
      // Update action log with error
      await supabase
        .from('auto_heal_actions_log')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: commandError.message,
        })
        .eq('id', actionLog?.id);

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

    // Update action log
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
      .eq('id', actionLog?.id);

    // Create notification
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
