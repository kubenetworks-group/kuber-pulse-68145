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

    // Validate API key and get cluster_id
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

    const { cluster_id } = apiKeyData;

    // Update last_seen
    await supabaseClient
      .from('agent_api_keys')
      .update({ last_seen: new Date().toISOString() })
      .eq('api_key', agentKey);

    const { metrics } = await req.json();
    
    if (!metrics || !Array.isArray(metrics)) {
      console.error('Invalid metrics format');
      return new Response(JSON.stringify({ error: 'Invalid metrics format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert metrics into database
    const metricsToInsert = metrics.map(metric => ({
      cluster_id,
      metric_type: metric.type,
      metric_data: metric.data,
      collected_at: metric.collected_at || new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseClient
      .from('agent_metrics')
      .insert(metricsToInsert);

    if (insertError) {
      console.error('Error inserting metrics:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to store metrics' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update cluster stats based on metrics
    const cpuMetric = metrics.find(m => m.type === 'cpu');
    const memoryMetric = metrics.find(m => m.type === 'memory');
    const podsMetric = metrics.find(m => m.type === 'pods');
    
    if (cpuMetric || memoryMetric || podsMetric) {
      const updateData: any = {
        last_sync: new Date().toISOString()
      };
      
      if (cpuMetric?.data?.usage_percent) updateData.cpu_usage = cpuMetric.data.usage_percent;
      if (memoryMetric?.data?.usage_percent) updateData.memory_usage = memoryMetric.data.usage_percent;
      if (podsMetric?.data?.running) updateData.pods = podsMetric.data.running;
      
      await supabaseClient
        .from('clusters')
        .update(updateData)
        .eq('id', cluster_id);
    }

    console.log(`Received ${metrics.length} metrics from cluster ${cluster_id}`);

    return new Response(
      JSON.stringify({ success: true, received: metrics.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in agent-receive-metrics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
