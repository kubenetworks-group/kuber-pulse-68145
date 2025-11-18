import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

// Validation schemas
const MetricDataSchema = z.record(z.unknown()).refine(
  (data) => JSON.stringify(data).length < 10000,
  { message: 'Metric data too large (max 10KB)' }
);

const MetricSchema = z.object({
  type: z.string().max(50),
  data: MetricDataSchema,
  collected_at: z.string().datetime().optional(),
});

const MetricsPayloadSchema = z.object({
  metrics: z.array(MetricSchema).min(1).max(100),
});

// Rate limiting map (in-memory)
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const requests = (rateLimiter.get(key) || []).filter(
    timestamp => now - timestamp < windowMs
  );
  
  if (requests.length >= maxRequests) {
    return false; // Rate limited
  }
  
  requests.push(now);
  rateLimiter.set(key, requests);
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const agentKey = req.headers.get('x-agent-key');
    
    if (!agentKey) {
      console.error('Authentication failed');
      return new Response(JSON.stringify({ error: 'Missing API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting: 4 requests per minute
    if (!checkRateLimit(agentKey, 4, 60000)) {
      console.warn('Rate limit exceeded');
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '4',
          'X-RateLimit-Window': '60s',
        },
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
      console.error('Authentication failed');
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

    // Parse and validate request body
    const body = await req.json();
    const validationResult = MetricsPayloadSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Validation failed');
      return new Response(JSON.stringify({ 
        error: 'Invalid metrics format',
        details: validationResult.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { metrics } = validationResult.data;

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
      console.error('Database error occurred');
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

    console.log(`Received ${metrics.length} metrics successfully`);

    return new Response(
      JSON.stringify({ success: true, received: metrics.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Request processing failed');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
