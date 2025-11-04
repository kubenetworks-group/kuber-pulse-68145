import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { cluster_id, name } = await req.json();

    if (!cluster_id || !name) {
      throw new Error('cluster_id and name are required');
    }

    // Verify cluster belongs to user
    const { data: cluster, error: clusterError } = await supabaseClient
      .from('clusters')
      .select('id')
      .eq('id', cluster_id)
      .eq('user_id', user.id)
      .single();

    if (clusterError || !cluster) {
      throw new Error('Cluster not found or unauthorized');
    }

    // Generate secure API key
    const apiKey = `kp_${crypto.randomUUID().replace(/-/g, '')}`;

    // Insert API key
    const { data: apiKeyData, error: insertError } = await supabaseClient
      .from('agent_api_keys')
      .insert({
        user_id: user.id,
        cluster_id,
        api_key: apiKey,
        name,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating API key:', insertError);
      throw new Error('Failed to create API key');
    }

    console.log(`Generated API key for cluster ${cluster_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        api_key: apiKeyData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in agent-generate-key:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
