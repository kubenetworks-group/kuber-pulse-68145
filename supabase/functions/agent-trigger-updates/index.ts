import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge function to trigger automatic updates for all outdated agent clusters.
 *
 * Flow:
 * 1. Get the latest version from agent_versions table
 * 2. Find all clusters running older versions
 * 3. Send self_update command to each cluster
 * 4. The agent will perform a rollout restart, pulling the :latest image
 *
 * This should be called:
 * - After publishing a new agent version
 * - Via a cron job to ensure all clusters stay updated
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the latest version
    const { data: latestVersion, error: versionError } = await supabase
      .from('agent_versions')
      .select('*')
      .eq('is_latest', true)
      .single();

    if (versionError || !latestVersion) {
      return new Response(
        JSON.stringify({ error: 'No latest version found', details: versionError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Latest version: ${latestVersion.version}`);

    // Find all clusters with outdated agents
    // Only consider clusters that have reported a version (agent_version is not null)
    // and haven't been seen in more than 5 minutes ago (to avoid updating inactive clusters)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: outdatedClusters, error: clustersError } = await supabase
      .from('clusters')
      .select('id, name, user_id, agent_version, agent_last_seen_at')
      .not('agent_version', 'is', null)
      .neq('agent_version', latestVersion.version)
      .gte('agent_last_seen_at', fiveMinutesAgo);

    if (clustersError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch clusters', details: clustersError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!outdatedClusters || outdatedClusters.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'All active clusters are up to date',
          latest_version: latestVersion.version,
          clusters_checked: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${outdatedClusters.length} outdated clusters`);

    const results = [];

    for (const cluster of outdatedClusters) {
      console.log(`Processing cluster: ${cluster.name} (${cluster.id}) - current: ${cluster.agent_version}`);

      // Check if there's already a pending update command for this cluster
      const { data: existingCommand } = await supabase
        .from('agent_commands')
        .select('id')
        .eq('cluster_id', cluster.id)
        .eq('command_type', 'self_update')
        .eq('status', 'pending')
        .single();

      if (existingCommand) {
        console.log(`Cluster ${cluster.name} already has a pending update command`);
        results.push({
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          status: 'skipped',
          reason: 'pending_command_exists'
        });
        continue;
      }

      // Create the self_update command
      const { error: commandError } = await supabase
        .from('agent_commands')
        .insert({
          cluster_id: cluster.id,
          user_id: cluster.user_id,
          command_type: 'self_update',
          command_params: {
            namespace: 'kodo',
            deployment_name: 'kodo-agent',
            // Note: we don't specify new_image because the deployment uses :latest
            // The rollout restart will pull the latest image
            trigger: 'auto_update',
            from_version: cluster.agent_version,
            to_version: latestVersion.version,
          },
          status: 'pending',
        });

      if (commandError) {
        console.error(`Failed to create command for cluster ${cluster.name}:`, commandError);
        results.push({
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          status: 'error',
          error: commandError.message
        });
        continue;
      }

      // Log the action
      await supabase
        .from('auto_heal_actions_log')
        .insert({
          cluster_id: cluster.id,
          user_id: cluster.user_id,
          action_type: 'agent_auto_update',
          trigger_reason: `Auto-updating agent from ${cluster.agent_version} to ${latestVersion.version}`,
          action_details: {
            current_version: cluster.agent_version,
            target_version: latestVersion.version,
            release_type: latestVersion.release_type,
            is_required: latestVersion.is_required,
          },
          status: 'pending',
        });

      // Mark cluster as having an update available
      await supabase
        .from('clusters')
        .update({
          agent_update_available: true,
          agent_update_message: `Auto-updating to ${latestVersion.version}: ${latestVersion.release_notes || 'Bug fixes and improvements'}`,
        })
        .eq('id', cluster.id);

      results.push({
        cluster_id: cluster.id,
        cluster_name: cluster.name,
        from_version: cluster.agent_version,
        to_version: latestVersion.version,
        status: 'update_triggered'
      });

      console.log(`Update command sent for cluster ${cluster.name}`);
    }

    const summary = {
      latest_version: latestVersion.version,
      total_outdated: outdatedClusters.length,
      updates_triggered: results.filter(r => r.status === 'update_triggered').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
      results
    };

    console.log('Update trigger summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error triggering updates:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
