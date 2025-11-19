import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

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

    // Get pending commands for this cluster
    const { data: commands, error: commandsError } = await supabaseClient
      .from('agent_commands')
      .select('*')
      .eq('cluster_id', cluster_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (commandsError) {
      console.error('Database error occurred');
      return new Response(JSON.stringify({ error: 'Failed to fetch commands' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark commands as sent
    if (commands && commands.length > 0) {
      const commandIds = commands.map(c => c.id);
      await supabaseClient
        .from('agent_commands')
        .update({
          status: 'sent',
          executed_at: new Date().toISOString()
        })
        .in('id', commandIds);
    }

    console.log(`Sent ${commands?.length || 0} commands successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        commands: commands || [],
      }),
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
