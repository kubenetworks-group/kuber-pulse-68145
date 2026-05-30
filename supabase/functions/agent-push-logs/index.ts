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

    const providedKeyHash = await hashApiKey(agentKey);
    let apiKeyData;

    const { data: hashData } = await supabase
      .from('agent_api_keys')
      .select('cluster_id, is_active')
      .eq('api_key_hash', providedKeyHash)
      .single();

    if (hashData) {
      apiKeyData = hashData;
    } else {
      const { data: plainData } = await supabase
        .from('agent_api_keys')
        .select('cluster_id, is_active')
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
    const body = await req.json();
    const {
      pod_name = '',
      pod_namespace = 'kodo',
      pod_phase = 'Unknown',
      container_name = 'agent',
      container_state = 'unknown',
      container_restart_count = 0,
      log_lines = '',
    } = body;

    await supabase.from('agent_logs').insert({
      cluster_id,
      pod_name,
      pod_namespace,
      pod_phase,
      container_name,
      container_state,
      container_restart_count,
      log_lines: log_lines.substring(0, 10000),
      collected_at: new Date().toISOString(),
    });

    // Retain only the last 20 snapshots per cluster
    const { data: oldEntries } = await supabase
      .from('agent_logs')
      .select('id')
      .eq('cluster_id', cluster_id)
      .order('collected_at', { ascending: false })
      .range(20, 9999);

    if (oldEntries && oldEntries.length > 0) {
      await supabase
        .from('agent_logs')
        .delete()
        .in('id', oldEntries.map((e: { id: string }) => e.id));
    }

    // Update cluster quick-status columns
    await supabase
      .from('clusters')
      .update({
        agent_pod_name: pod_name || null,
        agent_pod_namespace: pod_namespace,
        agent_pod_phase: pod_phase,
        agent_container_restart_count: container_restart_count,
      })
      .eq('id', cluster_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error pushing agent logs:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
