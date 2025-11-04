import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const agentKey = req.headers.get('x-agent-key');
    
    if (!agentKey) {
      console.error('Missing agent key');
      return new Response(JSON.stringify({ error: 'Missing API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate API key
    const { data: apiKeyData, error: keyError } = await supabaseClient
      .from('agent_api_keys')
      .select('cluster_id, is_active')
      .eq('api_key', agentKey)
      .single();

    if (keyError || !apiKeyData || !apiKeyData.is_active) {
      console.error('Invalid or inactive API key:', keyError);
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { command_id, status, result } = await req.json();

    if (!command_id || !status) {
      throw new Error('command_id and status are required');
    }

    // Update command status
    const updateData: any = {
      status,
      completed_at: new Date().toISOString(),
    };

    if (result) {
      updateData.result = result;
    }

    const { error: updateError } = await supabaseClient
      .from('agent_commands')
      .update(updateData)
      .eq('id', command_id)
      .eq('cluster_id', apiKeyData.cluster_id);

    if (updateError) {
      console.error('Error updating command:', updateError);
      throw new Error('Failed to update command');
    }

    console.log(`Updated command ${command_id} to status ${status}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in agent-update-command:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
