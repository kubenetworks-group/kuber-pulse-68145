import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Agent authentication via x-agent-key
    const agentKey = req.headers.get('x-agent-key');
    
    if (!agentKey) {
      return new Response(JSON.stringify({ error: 'Missing API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash function
    const hashApiKey = async (apiKey: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const providedKeyHash = await hashApiKey(agentKey);

    // Authenticate agent
    let apiKeyData;
    const { data: hashData } = await supabase
      .from('agent_api_keys')
      .select('cluster_id, user_id, is_active')
      .eq('api_key_hash', providedKeyHash)
      .single();

    if (hashData) {
      apiKeyData = hashData;
    } else {
      // Fallback to plaintext
      const { data: plainData } = await supabase
        .from('agent_api_keys')
        .select('cluster_id, user_id, is_active')
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

    const body = await req.json();
    const { 
      pod_name, 
      namespace, 
      container_name,
      logs,
      exit_code,
      terminated_at,
      restart_reason,
      restart_count,
      previous_state,
      command_id
    } = body;

    if (!pod_name || !namespace) {
      return new Response(JSON.stringify({ error: 'pod_name and namespace are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store the audit log
    const { data: auditLog, error: insertError } = await supabase
      .from('pod_restart_audit')
      .insert({
        cluster_id: apiKeyData.cluster_id,
        user_id: apiKeyData.user_id,
        pod_name,
        namespace,
        container_name,
        restart_reason: restart_reason || 'Unknown',
        previous_state: previous_state || {},
        container_logs: logs ? (typeof logs === 'string' ? logs : JSON.stringify(logs)) : null,
        container_logs_tail: logs ? (typeof logs === 'string' ? logs.split('\n').length : 100) : 0,
        exit_code,
        terminated_at: terminated_at || null,
        restart_count: restart_count || 0,
        command_id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert audit log:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to store audit log' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Pod restart audit logged: ${namespace}/${pod_name} (reason: ${restart_reason})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        audit_id: auditLog.id,
        message: 'Pod restart audit logged successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
