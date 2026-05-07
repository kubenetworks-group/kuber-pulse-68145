import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const userId = user.id;

    // Get user's clusters
    const { data: clusters, error: clustersError } = await supabase
      .from('clusters')
      .select('id, monthly_cost')
      .eq('user_id', userId);

    if (clustersError) throw clustersError;

    if (!clusters || clusters.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No clusters found. Please create clusters first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete old demo savings for this user
    await supabase.from('ai_cost_savings').delete().eq('user_id', userId).eq('is_demo', true);

    // Ensure each cluster has at least one incident to satisfy FK constraint
    const clusterIncidentMap: Record<string, string[]> = {};

    for (const cluster of clusters) {
      const { data: existingIncidents } = await supabase
        .from('ai_incidents')
        .select('id')
        .eq('cluster_id', cluster.id)
        .eq('user_id', userId)
        .limit(3);

      let incidentIds = existingIncidents?.map((i: any) => i.id) || [];

      // Create demo incidents if none found for this cluster
      if (incidentIds.length === 0) {
        const incidentTemplates = [
          {
            cluster_id: cluster.id, user_id: userId, is_demo: true,
            incident_type: 'pod_crash_loop', severity: 'high',
            title: 'Pod em CrashLoopBackOff',
            description: 'Pod reiniciando continuamente',
            ai_analysis: { root_cause: 'Configuração incorreta', confidence: 0.95 },
            auto_heal_action: 'Aplicar patch de configuração',
            action_taken: true,
            action_result: { status: 'success' },
            resolved_at: new Date().toISOString(),
          },
          {
            cluster_id: cluster.id, user_id: userId, is_demo: true,
            incident_type: 'resource_exhaustion', severity: 'medium',
            title: 'Uso excessivo de CPU detectado',
            description: 'Container consumindo acima do limite',
            ai_analysis: { root_cause: 'Requests/limits mal configurados', confidence: 0.88 },
            auto_heal_action: 'Ajustar recursos do pod',
            action_taken: true,
            action_result: { status: 'success' },
            resolved_at: new Date().toISOString(),
          },
          {
            cluster_id: cluster.id, user_id: userId, is_demo: true,
            incident_type: 'memory_leak', severity: 'critical',
            title: 'Memory Leak Detectado',
            description: 'Aplicação com vazamento de memória',
            ai_analysis: { root_cause: 'Memory leak no código', confidence: 0.92 },
            auto_heal_action: 'Reiniciar pod com memory leak',
            action_taken: true,
            action_result: { status: 'success' },
            resolved_at: new Date().toISOString(),
          },
        ];

        const { data: created, error: incErr } = await supabase
          .from('ai_incidents')
          .insert(incidentTemplates)
          .select('id');

        if (incErr) {
          console.error(`Failed to create incidents for cluster ${cluster.id}:`, incErr);
          continue; // skip this cluster
        }
        incidentIds = created?.map((i: any) => i.id) || [];
      }

      clusterIncidentMap[cluster.id] = incidentIds;
    }

    // Generate savings for all clusters across last 6 months
    const savingsToInsert: any[] = [];
    const now = new Date();

    for (const cluster of clusters) {
      const incidentIds = clusterIncidentMap[cluster.id];
      if (!incidentIds || incidentIds.length === 0) continue;

      const baseMonthlyCost = Number(cluster.monthly_cost) || rand(500, 5000);
      const baseSavingsPct = rand(0.08, 0.15); // 8-15% of monthly cost

      for (let monthsBack = 5; monthsBack >= 0; monthsBack--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
        const monthStart = monthDate.getTime();

        const variation = 1 + (Math.random() - 0.5) * 0.4;
        const totalMonthlySavings = baseMonthlyCost * baseSavingsPct * variation;

        const downtimePct = rand(0.5, 0.6);
        const resourcePct = rand(0.25, 0.35);
        const scalePct = 1 - downtimePct - resourcePct;

        const downtimeSaving = Number((totalMonthlySavings * downtimePct).toFixed(2));
        const resourceSaving = Number((totalMonthlySavings * resourcePct).toFixed(2));
        const scaleSaving = Number((totalMonthlySavings * scalePct).toFixed(2));

        const costPerMinute = Number((baseMonthlyCost / (30 * 24 * 60)).toFixed(4));
        const dayOffset = randInt(1, 20);

        // Pick incident IDs (round-robin from available incidents)
        const incId1 = incidentIds[0 % incidentIds.length];
        const incId2 = incidentIds[1 % incidentIds.length];
        const incId3 = incidentIds[2 % incidentIds.length];

        savingsToInsert.push({
          user_id: userId, cluster_id: cluster.id, is_demo: true,
          incident_id: incId1,
          saving_type: 'downtime_prevention',
          estimated_savings: downtimeSaving,
          cost_per_minute: costPerMinute,
          downtime_avoided_minutes: Math.max(1, Math.round(downtimeSaving / (costPerMinute * 10))),
          calculation_details: {
            method: 'historical',
            assumption: 'Auto-heal actions prevented cluster downtime',
          },
          created_at: new Date(monthStart + dayOffset * 24 * 3600_000).toISOString(),
        });

        savingsToInsert.push({
          user_id: userId, cluster_id: cluster.id, is_demo: true,
          incident_id: incId2,
          saving_type: 'resource_optimization',
          estimated_savings: resourceSaving,
          cost_per_minute: costPerMinute,
          downtime_avoided_minutes: 0,
          calculation_details: {
            method: 'historical',
            old_monthly_cost: Number((baseMonthlyCost * 1.3).toFixed(2)),
            new_monthly_cost: Number((baseMonthlyCost * 1.3 - resourceSaving).toFixed(2)),
            assumption: 'Right-sizing pods and removing idle resources',
          },
          created_at: new Date(monthStart + (dayOffset + 3) * 24 * 3600_000).toISOString(),
        });

        savingsToInsert.push({
          user_id: userId, cluster_id: cluster.id, is_demo: true,
          incident_id: incId3,
          saving_type: 'scale_optimization',
          estimated_savings: scaleSaving,
          cost_per_minute: costPerMinute,
          downtime_avoided_minutes: 0,
          calculation_details: {
            method: 'historical',
            replicas_reduced: randInt(1, 4),
            cost_per_replica: Number((scaleSaving / Math.max(1, randInt(1, 4))).toFixed(2)),
            assumption: 'Predictive auto-scaling reduced over-provisioning',
          },
          created_at: new Date(monthStart + (dayOffset + 6) * 24 * 3600_000).toISOString(),
        });
      }
    }

    // Insert all savings in batches
    let totalInserted = 0;
    for (let i = 0; i < savingsToInsert.length; i += 200) {
      const batch = savingsToInsert.slice(i, i + 200);
      const { error: savingsError } = await supabase
        .from('ai_cost_savings')
        .insert(batch);

      if (savingsError) {
        console.error('Error inserting savings batch:', savingsError);
      } else {
        totalInserted += batch.length;
      }
    }

    // Create notification
    await supabase.from('notifications').insert({
      user_id: userId,
      title: '💰 Dados de Economia Gerados',
      message: `Adicionados ${totalInserted} registros de economia com IA no banco de dados.`,
      type: 'success',
    });

    return new Response(
      JSON.stringify({
        success: true,
        savings_created: totalInserted,
        clusters_processed: Object.keys(clusterIncidentMap).length,
        message: `Successfully created ${totalInserted} AI savings records across 6 months`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in seed-ai-savings:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
