import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Delete demo data in correct order (foreign key dependencies)
    const { count: savingsCount } = await supabaseClient
      .from('ai_cost_savings')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_demo', true);

    const { count: costsCount } = await supabaseClient
      .from('cost_calculations')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_demo', true);

    const { count: incidentsCount } = await supabaseClient
      .from('ai_incidents')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_demo', true);

    const { count: pvcsCount } = await supabaseClient
      .from('pvcs')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_demo', true);

    // Delete related data for demo clusters
    const { data: demoClusters } = await supabaseClient
      .from('clusters')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_demo', true);

    if (demoClusters && demoClusters.length > 0) {
      const clusterIds = demoClusters.map(c => c.id);
      
      for (const clusterId of clusterIds) {
        await supabaseClient.from('cluster_events').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('cluster_validation_results').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('agent_api_keys').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('agent_anomalies').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('agent_commands').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('agent_metrics').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('alert_rules').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('alert_instances').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('webhook_configs').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('auto_heal_settings').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('auto_heal_actions_log').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('cluster_security_scans').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('persistent_volumes').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('loadbalancer_services').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('loadbalancer_traffic_logs').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('scan_history').delete().eq('cluster_id', clusterId);
        await supabaseClient.from('weekly_reports').delete().eq('cluster_id', clusterId);
      }
    }

    const { count: clustersCount } = await supabaseClient
      .from('clusters')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_demo', true);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dados demo removidos com sucesso',
        deleted: {
          clusters: clustersCount || 0,
          incidents: incidentsCount || 0,
          costs: costsCount || 0,
          savings: savingsCount || 0,
          pvcs: pvcsCount || 0,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
