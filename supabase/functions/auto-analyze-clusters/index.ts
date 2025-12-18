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
    console.log('🔄 Starting automatic cluster analysis and auto-heal...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active clusters with their auto-heal settings
    const { data: clusters, error: clustersError } = await supabaseClient
      .from('clusters')
      .select(`
        id, 
        name, 
        user_id, 
        status,
        auto_heal_settings (
          enabled,
          scan_interval_minutes
        )
      `)
      .eq('status', 'healthy')
      .not('user_id', 'is', null);

    if (clustersError) {
      console.error('Error fetching clusters:', clustersError);
      throw clustersError;
    }

    if (!clusters || clusters.length === 0) {
      console.log('No active clusters to analyze');
      return new Response(JSON.stringify({ 
        message: 'No active clusters found',
        analyzed: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Found ${clusters.length} clusters to analyze`);

    // Analyze and heal each cluster
    const results = await Promise.allSettled(
      clusters.map(async (cluster) => {
        console.log(`\n🔍 Analyzing cluster: ${cluster.name} (${cluster.id})`);
        
        let anomaliesFound = 0;
        let healActionsExecuted = 0;
        
        try {
          // Step 1: Analyze for anomalies (pass user_id for service role calls)
          const { data: analysisData, error: analysisError } = await supabaseClient.functions.invoke('agent-analyze-anomalies', {
            body: { cluster_id: cluster.id, user_id: cluster.user_id }
          });

          if (analysisError) {
            console.error(`❌ Error analyzing cluster ${cluster.id}:`, analysisError);
          } else {
            anomaliesFound = analysisData?.anomalies_found || 0;
            console.log(`📈 Cluster ${cluster.name}: found ${anomaliesFound} anomalies`);
          }

          // Step 2: Check if auto-heal is enabled and trigger it
          const autoHealSettings = cluster.auto_heal_settings as any;
          const isAutoHealEnabled = Array.isArray(autoHealSettings) 
            ? autoHealSettings[0]?.enabled 
            : autoHealSettings?.enabled;

          if (isAutoHealEnabled) {
            console.log(`🔧 Auto-heal enabled for ${cluster.name}, triggering healing...`);
            
            const { data: healData, error: healError } = await supabaseClient.functions.invoke('auto-heal-continuous', {
              body: { cluster_id: cluster.id }
            });

            if (healError) {
              console.error(`❌ Error healing cluster ${cluster.id}:`, healError);
            } else {
              healActionsExecuted = healData?.actions_count || 0;
              console.log(`✅ Cluster ${cluster.name}: executed ${healActionsExecuted} heal actions`);
            }
          } else {
            console.log(`⏸️ Auto-heal disabled for ${cluster.name}, skipping healing`);
          }

          return { 
            cluster_id: cluster.id, 
            cluster_name: cluster.name,
            success: true, 
            anomalies_found: anomaliesFound,
            heal_actions_executed: healActionsExecuted,
            auto_heal_enabled: isAutoHealEnabled || false
          };
        } catch (err) {
          console.error(`❌ Exception processing cluster ${cluster.id}:`, err);
          return { 
            cluster_id: cluster.id, 
            cluster_name: cluster.name,
            success: false, 
            error: err instanceof Error ? err.message : 'Unknown error' 
          };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    const totalAnomalies = results
      .filter(r => r.status === 'fulfilled')
      .reduce((sum, r) => sum + ((r.value as any).anomalies_found || 0), 0);
    const totalHealActions = results
      .filter(r => r.status === 'fulfilled')
      .reduce((sum, r) => sum + ((r.value as any).heal_actions_executed || 0), 0);

    console.log(`\n📊 Summary: ${successful} clusters processed, ${failed} failed`);
    console.log(`🔍 Total anomalies found: ${totalAnomalies}`);
    console.log(`🔧 Total heal actions executed: ${totalHealActions}`);

    return new Response(JSON.stringify({
      message: 'Automatic analysis and healing completed',
      clusters_analyzed: successful,
      clusters_failed: failed,
      total_anomalies_found: totalAnomalies,
      total_heal_actions: totalHealActions,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Failed' })
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in auto-analyze-clusters:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
