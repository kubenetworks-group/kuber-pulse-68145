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
    console.log('Starting automatic cluster analysis...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active clusters
    const { data: clusters, error: clustersError } = await supabaseClient
      .from('clusters')
      .select('id, name, user_id, status')
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

    console.log(`Found ${clusters.length} clusters to analyze`);

    // Analyze each cluster
    const results = await Promise.allSettled(
      clusters.map(async (cluster) => {
        console.log(`Analyzing cluster: ${cluster.name} (${cluster.id})`);
        
        try {
          const { data, error } = await supabaseClient.functions.invoke('agent-analyze-anomalies', {
            body: { cluster_id: cluster.id }
          });

          if (error) {
            console.error(`Error analyzing cluster ${cluster.id}:`, error);
            return { cluster_id: cluster.id, success: false, error: error.message };
          }

          console.log(`Cluster ${cluster.name}: found ${data?.anomalies_found || 0} anomalies`);
          return { 
            cluster_id: cluster.id, 
            cluster_name: cluster.name,
            success: true, 
            anomalies_found: data?.anomalies_found || 0 
          };
        } catch (err) {
          console.error(`Exception analyzing cluster ${cluster.id}:`, err);
          return { 
            cluster_id: cluster.id, 
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
      .reduce((sum, r) => sum + (r.value.anomalies_found || 0), 0);

    console.log(`Analysis complete: ${successful} successful, ${failed} failed, ${totalAnomalies} total anomalies`);

    return new Response(JSON.stringify({
      message: 'Automatic analysis completed',
      clusters_analyzed: successful,
      clusters_failed: failed,
      total_anomalies_found: totalAnomalies,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Failed' })
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in auto-analyze-clusters:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});