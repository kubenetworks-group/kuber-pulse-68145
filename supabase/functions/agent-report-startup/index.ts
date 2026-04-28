import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key, x-agent-version',
};

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const agentKey = req.headers.get('x-agent-key');
    if (!agentKey) {
      return new Response(JSON.stringify({ error: 'Missing x-agent-key header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate agent
    const providedKeyHash = await hashApiKey(agentKey);

    let apiKeyData;
    const { data: hashData } = await supabase
      .from('agent_api_keys')
      .select('cluster_id, is_active, id')
      .eq('api_key_hash', providedKeyHash)
      .single();

    if (hashData) {
      apiKeyData = hashData;
    } else {
      const { data: plainData } = await supabase
        .from('agent_api_keys')
        .select('cluster_id, is_active, id')
        .eq('api_key', agentKey)
        .single();
      apiKeyData = plainData;
    }

    if (!apiKeyData || !apiKeyData.is_active) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { cluster_id } = apiKeyData;

    // Parse startup payload from agent
    const body = await req.json();
    const {
      agent_version = 'unknown',
      pod_name = '',
      start_time = new Date().toISOString(),
      restart_count = 0,
      exit_code = 0,
      restart_reason = 'unknown',
      last_finished_at = null,
      previous_logs = '',
    } = body;

    console.log(`Agent startup reported: cluster=${cluster_id} pod=${pod_name} restart_count=${restart_count} reason=${restart_reason}`);

    // First start — not a restart, just log silently and return
    if (restart_count === 0) {
      console.log(`First start for cluster ${cluster_id}, no restart event to log`);
      return new Response(JSON.stringify({ success: true, event: 'first_start' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get cluster user_id for the log entry
    const { data: clusterData } = await supabase
      .from('clusters')
      .select('user_id')
      .eq('id', cluster_id)
      .single();

    if (!clusterData) {
      return new Response(JSON.stringify({ error: 'Cluster not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine the trigger and solution
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: recentUpdateLog } = await supabase
      .from('auto_heal_actions_log')
      .select('id, action_type, action_details')
      .eq('cluster_id', cluster_id)
      .in('action_type', ['agent_auto_update', 'agent_update'])
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let triggeredBy = 'unknown';
    let triggerReason = 'Reinicialização do agente';
    let solutionApplied = 'Pod reiniciado automaticamente pelo Kubernetes';

    if (recentUpdateLog) {
      triggeredBy = 'auto_update';
      triggerReason = 'Atualização automática do agente';
      solutionApplied = `Agente atualizado para ${agent_version}`;
    } else if (restart_reason === 'OOMKilled' || exit_code === 137) {
      triggeredBy = 'oom';
      triggerReason = 'OOMKilled — pod encerrado por excesso de uso de memória';
      solutionApplied = 'Pod reiniciado pelo Kubernetes. Considere aumentar o limite de memória do deployment kodo-agent.';
    } else if (exit_code !== 0) {
      triggeredBy = 'crash';
      triggerReason = `Erro de execução (exit code: ${exit_code}${restart_reason !== 'unknown' ? `, reason: ${restart_reason}` : ''})`;
      solutionApplied = 'Pod reiniciado automaticamente pelo Kubernetes. Verifique os logs anteriores para identificar a causa.';
    } else {
      triggeredBy = 'manual';
      triggerReason = 'Reinicialização manual ou rollout do deployment';
      solutionApplied = 'Pod reiniciado com sucesso.';
    }

    // Insert restart event into auto_heal_actions_log
    const { error: insertError } = await supabase
      .from('auto_heal_actions_log')
      .insert({
        cluster_id,
        user_id: clusterData.user_id,
        action_type: 'agent_restart',
        trigger_reason: triggerReason,
        action_details: {
          restart_count,
          exit_code,
          restart_reason,
          agent_version,
          pod_name,
          start_time,
          last_finished_at,
          solution_applied: solutionApplied,
          triggered_by: triggeredBy,
          previous_logs: previous_logs ? previous_logs.substring(0, 5000) : '',
        },
        status: 'completed',
        started_at: last_finished_at || start_time,
        completed_at: start_time,
      });

    if (insertError) {
      console.error('Failed to insert restart event:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to log restart event' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If this restart was caused by an update, mark the update log as completed
    if (recentUpdateLog) {
      await supabase
        .from('auto_heal_actions_log')
        .update({
          status: 'completed',
          completed_at: start_time,
          result: {
            new_version: agent_version,
            pod_name,
            restarted_at: start_time,
          },
        })
        .eq('id', recentUpdateLog.id);

      // Clear the update_available flag on the cluster
      await supabase
        .from('clusters')
        .update({ agent_update_available: false, agent_update_message: null })
        .eq('id', cluster_id);
    }

    console.log(`Restart event logged for cluster ${cluster_id}: ${triggeredBy} — ${triggerReason}`);

    // Fire-and-forget: trigger AI analysis after restart (non-blocking)
    // Skip for normal auto-update restarts (no crash to analyze)
    if (triggeredBy !== 'auto_update' || exit_code !== 0) {
      EdgeRuntime.waitUntil(
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-analyze-anomalies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            cluster_id,
            user_id: clusterData.user_id,
          }),
        }).then(r => console.log(`AI analysis triggered after restart: HTTP ${r.status}`))
          .catch(e => console.error('Failed to trigger AI analysis:', e))
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        event: 'restart_logged',
        triggered_by: triggeredBy,
        solution_applied: solutionApplied,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error processing startup report:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
