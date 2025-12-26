import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
};

/**
 * Publish a new agent version and optionally trigger updates for all clusters.
 *
 * This endpoint should be called after pushing a new image to the registry.
 *
 * Request body:
 * {
 *   "version": "v0.0.52",
 *   "release_notes": "Bug fixes and improvements",
 *   "release_type": "patch", // major, minor, patch, hotfix
 *   "is_required": false,    // If true, forces update
 *   "trigger_updates": true  // If true, immediately sends update commands to all clusters
 * }
 *
 * Example curl:
 * curl -X POST https://your-project.supabase.co/functions/v1/agent-publish-version \
 *   -H "Content-Type: application/json" \
 *   -H "x-admin-key: your-admin-key" \
 *   -d '{"version": "v0.0.52", "release_notes": "Bug fixes", "trigger_updates": true}'
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Simple admin key authentication
    const adminKey = req.headers.get('x-admin-key');
    const expectedKey = Deno.env.get('ADMIN_API_KEY');

    if (!adminKey || adminKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Provide valid x-admin-key header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      version,
      release_notes = '',
      release_type = 'patch',
      is_required = false,
      trigger_updates = true,
    } = body;

    if (!version) {
      return new Response(
        JSON.stringify({ error: 'Version is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate version format
    if (!/^v?\d+\.\d+\.\d+$/.test(version)) {
      return new Response(
        JSON.stringify({ error: 'Invalid version format. Use semver like v0.0.52 or 0.0.52' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize version to have 'v' prefix
    const normalizedVersion = version.startsWith('v') ? version : `v${version}`;

    console.log(`Publishing new version: ${normalizedVersion}`);

    // Set all existing versions to not latest
    await supabase
      .from('agent_versions')
      .update({ is_latest: false })
      .neq('version', normalizedVersion);

    // Insert or update the new version
    const { data: newVersion, error: insertError } = await supabase
      .from('agent_versions')
      .upsert({
        version: normalizedVersion,
        release_notes,
        release_type,
        is_required,
        is_latest: true,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'version',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert version:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to register version', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Version ${normalizedVersion} registered successfully`);

    let updateResults = null;

    // Trigger updates if requested
    if (trigger_updates) {
      console.log('Triggering updates for all outdated clusters...');

      // Call the trigger-updates function internally
      const triggerResponse = await fetch(`${supabaseUrl}/functions/v1/agent-trigger-updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      });

      if (triggerResponse.ok) {
        updateResults = await triggerResponse.json();
        console.log('Update trigger results:', updateResults);
      } else {
        console.error('Failed to trigger updates:', await triggerResponse.text());
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: newVersion,
        message: `Version ${normalizedVersion} published successfully`,
        updates_triggered: trigger_updates,
        update_results: updateResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error publishing version:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
