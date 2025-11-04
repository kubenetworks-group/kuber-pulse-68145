import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cluster_id } = await req.json();

    if (!cluster_id) {
      return new Response(JSON.stringify({ error: "cluster_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch PVCs for the cluster
    const { data: pvcs, error: pvcsError } = await supabaseClient
      .from("pvcs")
      .select("*")
      .eq("cluster_id", cluster_id)
      .eq("user_id", user.id);

    if (pvcsError) throw pvcsError;

    if (!pvcs || pvcs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No PVCs found for analysis" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const recommendations = [];

    for (const pvc of pvcs) {
      const requestedGb = pvc.requested_bytes / (1024 ** 3);
      const usedGb = pvc.used_bytes / (1024 ** 3);
      const usagePercent = (usedGb / requestedGb) * 100;

      let recommendation = null;

      // Underutilized - less than 20% usage
      if (usagePercent < 20 && requestedGb > 10) {
        const recommendedGb = Math.max(usedGb * 1.5, 5); // 50% buffer, minimum 5GB
        const savings = (requestedGb - recommendedGb) * 0.10; // $0.10 per GB/month estimate

        recommendation = {
          pvc_id: pvc.id,
          cluster_id: cluster_id,
          user_id: user.id,
          recommendation_type: "resize_down",
          current_size_gb: requestedGb,
          recommended_size_gb: recommendedGb,
          potential_savings: savings,
          usage_percentage: usagePercent,
          days_analyzed: 7,
          reasoning: `PVC "${pvc.name}" uses only ${usagePercent.toFixed(1)}% of provisioned space (${usedGb.toFixed(1)}GB of ${requestedGb.toFixed(1)}GB). Recommend reducing to ${recommendedGb.toFixed(1)}GB with 50% buffer for potential monthly savings of $${savings.toFixed(2)}.`,
          status: "pending",
        };
      }
      // Overutilized - more than 85% usage
      else if (usagePercent > 85) {
        const recommendedGb = requestedGb * 1.5; // 50% increase

        recommendation = {
          pvc_id: pvc.id,
          cluster_id: cluster_id,
          user_id: user.id,
          recommendation_type: "resize_up",
          current_size_gb: requestedGb,
          recommended_size_gb: recommendedGb,
          potential_savings: 0,
          usage_percentage: usagePercent,
          days_analyzed: 7,
          reasoning: `PVC "${pvc.name}" is ${usagePercent.toFixed(1)}% full (${usedGb.toFixed(1)}GB of ${requestedGb.toFixed(1)}GB). Risk of volume full. Recommend increasing to ${recommendedGb.toFixed(1)}GB to prevent pod failures.`,
          status: "pending",
        };
      }
      // Moderately underutilized - 20-40% usage
      else if (usagePercent >= 20 && usagePercent < 40 && requestedGb > 50) {
        recommendation = {
          pvc_id: pvc.id,
          cluster_id: cluster_id,
          user_id: user.id,
          recommendation_type: "underutilized",
          current_size_gb: requestedGb,
          recommended_size_gb: requestedGb,
          potential_savings: 0,
          usage_percentage: usagePercent,
          days_analyzed: 7,
          reasoning: `PVC "${pvc.name}" shows moderate utilization at ${usagePercent.toFixed(1)}% (${usedGb.toFixed(1)}GB of ${requestedGb.toFixed(1)}GB). Monitor usage trends over time for potential optimization.`,
          status: "pending",
        };
      }

      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Delete old pending recommendations for this cluster
    await supabaseClient
      .from("storage_recommendations")
      .delete()
      .eq("cluster_id", cluster_id)
      .eq("user_id", user.id)
      .eq("status", "pending");

    // Insert new recommendations
    if (recommendations.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("storage_recommendations")
        .insert(recommendations);

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        message: "Analysis complete",
        recommendations_count: recommendations.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error analyzing storage:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
