import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

// Validation schema
const UpdateCommandSchema = z.object({
  command_id: z.string().uuid(),
  status: z.enum(['sent', 'executing', 'completed', 'failed']),
  result: z.record(z.unknown()).optional().refine(
    (data) => !data || JSON.stringify(data).length < 50000,
    { message: 'Result data too large (max 50KB)' }
  ),
});

// Rate limiting
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const requests = (rateLimiter.get(key) || []).filter(
    timestamp => now - timestamp < windowMs
  );
  
  if (requests.length >= maxRequests) {
    return false;
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

    // Rate limiting: 10 requests per minute
    if (!checkRateLimit(agentKey, 10, 60000)) {
      console.warn('Rate limit exceeded');
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Window': '60s',
        },
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
      console.error('Authentication failed');
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = UpdateCommandSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Validation failed');
      return new Response(JSON.stringify({ 
        error: 'Invalid request format',
        details: validationResult.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { command_id, status, result } = validationResult.data;

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
      console.error('Database error occurred');
      return new Response(JSON.stringify({ error: 'Failed to update command' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Command updated successfully`);

    return new Response(
      JSON.stringify({ success: true }),
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
