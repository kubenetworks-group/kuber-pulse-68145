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
    const storageClassMigrations = [];

    // Storage class pricing (per GB/month)
    const storageClassPricing: Record<string, number> = {
      'gp3': 0.08,
      'gp2': 0.10,
      'io1': 0.125,
      'io2': 0.125,
      'st1': 0.045,
      'sc1': 0.015,
      'standard': 0.10, // Default for unknown classes
    };

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

      // Analyze storage class optimization
      const currentClass = pvc.storage_class || 'standard';
      const currentPrice = storageClassPricing[currentClass] || storageClassPricing['standard'];
      const currentCost = requestedGb * currentPrice;

      // Simulate IOPS usage (in production, this would come from metrics)
      const simulatedIops = Math.floor(Math.random() * 5000);

      let recommendedClass = currentClass;
      let usagePattern = 'balanced';
      let migrationReasoning = '';

      // Low usage pattern - recommend cheaper storage
      if (usagePercent < 30 && simulatedIops < 1000) {
        if (currentClass === 'io1' || currentClass === 'io2' || currentClass === 'gp2') {
          recommendedClass = 'gp3';
          usagePattern = 'low_iops';
          migrationReasoning = `Low IOPS usage (${simulatedIops} avg) and ${usagePercent.toFixed(1)}% utilization. gp3 provides sufficient performance at lower cost.`;
        } else if (currentClass === 'gp3' && usagePercent < 20) {
          recommendedClass = 'st1';
          usagePattern = 'sequential_access';
          migrationReasoning = `Very low utilization (${usagePercent.toFixed(1)}%) with sequential access pattern. st1 optimized for throughput workloads.`;
        }
      }
      // Very low usage - cold storage
      else if (usagePercent < 15 && simulatedIops < 500) {
        if (currentClass !== 'sc1') {
          recommendedClass = 'sc1';
          usagePattern = 'cold_storage';
          migrationReasoning = `Infrequent access pattern (${simulatedIops} IOPS) and minimal usage (${usagePercent.toFixed(1)}%). sc1 ideal for cold storage.`;
        }
      }
      // High IOPS but using gp2
      else if (simulatedIops > 3000 && currentClass === 'gp2') {
        recommendedClass = 'gp3';
        usagePattern = 'high_iops';
        migrationReasoning = `High IOPS usage (${simulatedIops} avg). Migrate to gp3 for better performance and lower cost than gp2.`;
      }
      // Legacy gp2 to gp3 migration
      else if (currentClass === 'gp2') {
        recommendedClass = 'gp3';
        usagePattern = 'general_purpose';
        migrationReasoning = `gp3 offers 20% cost savings over gp2 with equivalent or better performance for most workloads.`;
      }

      // Only add migration recommendation if there's a better class
      if (recommendedClass !== currentClass) {
        const recommendedPrice = storageClassPricing[recommendedClass];
        const recommendedCost = requestedGb * recommendedPrice;
        const savings = currentCost - recommendedCost;

        if (savings > 1) { // Only recommend if savings > $1/month
          storageClassMigrations.push({
            pvc_id: pvc.id,
            pvc_name: pvc.name,
            current_class: currentClass,
            recommended_class: recommendedClass,
            current_cost: currentCost,
            recommended_cost: recommendedCost,
            savings: savings,
            usage_pattern: usagePattern,
            iops_usage: simulatedIops,
            reasoning: migrationReasoning,
          });
        }
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
        storage_class_migrations: storageClassMigrations,
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
