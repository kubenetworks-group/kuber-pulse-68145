import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key, x-agent-version',
};

// Current latest agent version - update this when releasing new versions
const LATEST_VERSION = 'v0.0.50';
const RELEASE_NOTES = 'Melhorias de performance e correções de bugs';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get agent key and version from headers
    const agentKey = req.headers.get('x-agent-key');
    const agentVersion = req.headers.get('x-agent-version') || 'unknown';

    if (!agentKey) {
      return new Response(
        JSON.stringify({ error: 'Missing x-agent-key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the agent key using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(agentKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Find API key by hash
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('agent_api_keys')
      .select('cluster_id, is_active')
      .eq('api_key_hash', hashedKey)
      .single();

    if (apiKeyError || !apiKeyData || !apiKeyData.is_active) {
      return new Response(
        JSON.stringify({ error: 'Invalid agent key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_seen on api key
    await supabase
      .from('agent_api_keys')
      .update({ last_seen: new Date().toISOString() })
      .eq('api_key_hash', hashedKey);

    // Compare versions
    const compareVersions = (v1: string, v2: string): number => {
      const normalize = (v: string) => v.replace(/^v/, '').split('.').map(Number);
      const [major1, minor1, patch1] = normalize(v1);
      const [major2, minor2, patch2] = normalize(v2);

      if (major1 !== major2) return major1 - major2;
      if (minor1 !== minor2) return minor1 - minor2;
      return patch1 - patch2;
    };

    const needsUpdate = agentVersion !== 'unknown' &&
      compareVersions(agentVersion, LATEST_VERSION) < 0;

    return new Response(
      JSON.stringify({
        current_version: agentVersion,
        latest_version: LATEST_VERSION,
        update_available: needsUpdate,
        is_required: false,
        release_notes: needsUpdate ? RELEASE_NOTES : null,
        release_type: needsUpdate ? 'patch' : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error checking agent update:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
