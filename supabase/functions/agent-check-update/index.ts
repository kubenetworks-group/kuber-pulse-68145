import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key, x-agent-version',
};

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

    // Hash the agent key to find the cluster
    const encoder = new TextEncoder();
    const data = encoder.encode(agentKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Find cluster by hashed key
    const { data: cluster, error: clusterError } = await supabase
      .from('clusters')
      .select('id, name, agent_version')
      .eq('agent_key_hash', hashedKey)
      .single();

    if (clusterError || !cluster) {
      return new Response(
        JSON.stringify({ error: 'Invalid agent key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update cluster with current agent version and last seen
    await supabase
      .from('clusters')
      .update({
        agent_version: agentVersion,
        agent_last_seen_at: new Date().toISOString(),
      })
      .eq('id', cluster.id);

    // Get latest version
    const { data: latestVersion } = await supabase
      .from('agent_versions')
      .select('*')
      .eq('is_latest', true)
      .single();

    // Compare versions
    const compareVersions = (v1: string, v2: string): number => {
      const normalize = (v: string) => v.replace(/^v/, '').split('.').map(Number);
      const [major1, minor1, patch1] = normalize(v1);
      const [major2, minor2, patch2] = normalize(v2);

      if (major1 !== major2) return major1 - major2;
      if (minor1 !== minor2) return minor1 - minor2;
      return patch1 - patch2;
    };

    const needsUpdate = latestVersion && agentVersion !== 'unknown' &&
      compareVersions(agentVersion, latestVersion.version) < 0;

    // Update cluster with update availability
    if (needsUpdate) {
      await supabase
        .from('clusters')
        .update({
          agent_update_available: true,
          agent_update_message: latestVersion.release_notes,
        })
        .eq('id', cluster.id);
    } else {
      await supabase
        .from('clusters')
        .update({
          agent_update_available: false,
          agent_update_message: null,
        })
        .eq('id', cluster.id);
    }

    return new Response(
      JSON.stringify({
        current_version: agentVersion,
        latest_version: latestVersion?.version || agentVersion,
        update_available: needsUpdate,
        is_required: latestVersion?.is_required || false,
        release_notes: needsUpdate ? latestVersion?.release_notes : null,
        release_type: needsUpdate ? latestVersion?.release_type : null,
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
