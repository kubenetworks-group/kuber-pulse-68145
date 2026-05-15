import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key, x-agent-version',
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

// Hash function using Web Crypto API
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
      console.error('Authentication failed: Missing API key');
      return new Response(JSON.stringify({ error: 'Missing API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyPrefix = agentKey.substring(0, 12);
    console.log(`Get-commands auth attempt with key prefix: ${keyPrefix}...`);

    // Rate limiting: 10 requests per minute
    if (!checkRateLimit(keyPrefix, 10, 60000)) {
      console.warn('Rate limit exceeded for key:', keyPrefix);
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

    // Hash the provided key for authentication
    const providedKeyHash = await hashApiKey(agentKey);
    console.log(`Generated hash: ${providedKeyHash.substring(0, 16)}...`);

    // Try hash-based authentication first, then fallback to plaintext
    let apiKeyData;

    // First, try hash-based authentication
    const { data: hashData, error: hashError } = await supabaseClient
      .from('agent_api_keys')
      .select('cluster_id, is_active')
      .eq('api_key_hash', providedKeyHash)
      .single();

    if (hashData && !hashError) {
      console.log(`Auth successful via hash for cluster: ${hashData.cluster_id}`);
      apiKeyData = hashData;
    } else {
      console.log(`Hash auth failed, trying plaintext. Error: ${hashError?.message}`);
      
      // Fallback: try plaintext (for keys created before hash implementation)
      const { data: plainData, error: plainError } = await supabaseClient
        .from('agent_api_keys')
        .select('cluster_id, is_active')
        .eq('api_key', agentKey)
        .single();

      if (plainData && !plainError) {
        console.log(`Auth successful via plaintext for cluster: ${plainData.cluster_id}`);
        apiKeyData = plainData;
        
        // Migrate to hash
        await supabaseClient
          .from('agent_api_keys')
          .update({ api_key_hash: providedKeyHash })
          .eq('api_key', agentKey);
      } else {
        // Final fallback: try prefix match (for cases where key was redacted but prefix stored)
        console.log(`Plaintext auth failed, trying prefix match`);
        const { data: prefixData, error: prefixError } = await supabaseClient
          .from('agent_api_keys')
          .select('cluster_id, is_active')
          .eq('api_key_prefix', keyPrefix + '...')
          .single();

        if (prefixData && !prefixError) {
          console.log(`Auth successful via prefix for cluster: ${prefixData.cluster_id}`);
          apiKeyData = prefixData;
          
          // Update the hash and key for future auth
          await supabaseClient
            .from('agent_api_keys')
            .update({ 
              api_key_hash: providedKeyHash,
              api_key: agentKey // Restore the key
            })
            .eq('api_key_prefix', keyPrefix + '...');
        }
      }
    }

    if (!apiKeyData || !apiKeyData.is_active) {
      console.error(`Authentication failed: No valid key found. Key prefix: ${keyPrefix}, Hash: ${providedKeyHash.substring(0, 16)}...`);
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { cluster_id } = apiKeyData;
    const agentVersion = req.headers.get('x-agent-version') || 'unknown';

    // Update heartbeat — this is the primary liveness signal so the system knows the agent is online
    // even when sendMetrics fails transiently (large payload, network blip, etc.)
    await supabaseClient
      .from('agent_api_keys')
      .update({ last_seen: new Date().toISOString() })
      .eq('cluster_id', cluster_id);

    // Fetch current cluster status so we can decide whether to bump it
    const { data: currentCluster } = await supabaseClient
      .from('clusters')
      .select('status')
      .eq('id', cluster_id)
      .single();

    // If the cluster is stuck in pending_agent or disconnected, the agent heartbeat is
    // proof it is alive → promote to 'connecting' immediately so the UI reflects this.
    // The full 'healthy'/'warning' status will be set by agent-receive-metrics once metrics arrive.
    const staleBefore = ['pending_agent', 'disconnected'];
    const heartbeatStatus = staleBefore.includes(currentCluster?.status ?? '')
      ? { status: 'connecting' }
      : {};

    await supabaseClient
      .from('clusters')
      .update({
        agent_last_seen_at: new Date().toISOString(),
        ...(agentVersion !== 'unknown' ? { agent_version: agentVersion } : {}),
        ...heartbeatStatus,
      })
      .eq('id', cluster_id);

    if (heartbeatStatus.status) {
      console.log(`Cluster ${cluster_id}: status bumped ${currentCluster?.status} → connecting (agent heartbeat)`);
    }

    // Delete commands stuck >10 min (sent or pending) — unresolvable, clean up
    // to avoid blocking the queue without needing an external broker (RabbitMQ etc).
    const deleteThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: deletedStale } = await supabaseClient
      .from('agent_commands')
      .delete()
      .eq('cluster_id', cluster_id)
      .in('status', ['sent', 'pending'])
      .lt('created_at', deleteThreshold)
      .select('id, command_type');

    if (deletedStale && deletedStale.length > 0) {
      console.log(`🗑️  Deleted ${deletedStale.length} stuck commands (>30 min): ${deletedStale.map((c: any) => c.command_type).join(', ')}`);
    }

    // Reset stale 'sent' commands (sent >5 min ago but never completed) back to pending
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabaseClient
      .from('agent_commands')
      .update({ status: 'pending', executed_at: null })
      .eq('cluster_id', cluster_id)
      .eq('status', 'sent')
      .lt('executed_at', staleThreshold);

    // Get pending commands for this cluster (includes just-reset stale ones)
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
