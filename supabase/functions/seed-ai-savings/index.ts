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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's clusters
    const { data: clusters, error: clustersError } = await supabase
      .from('clusters')
      .select('id')
      .eq('user_id', user.id);

    if (clustersError) throw clustersError;

    if (!clusters || clusters.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No clusters found. Please create clusters first.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get or create incidents for each cluster
    const savingsToInsert = [];
    let totalIncidents = 0;

    for (const cluster of clusters) {
      // Check existing incidents
      const { data: existingIncidents } = await supabase
        .from('ai_incidents')
        .select('id')
        .eq('cluster_id', cluster.id)
        .eq('user_id', user.id);

      let incidentIds = existingIncidents?.map(i => i.id) || [];

      // Create incidents if none exist
      if (incidentIds.length === 0) {
        const incidentsToCreate = [
          {
            cluster_id: cluster.id,
            user_id: user.id,
            incident_type: 'pod_crash_loop',
            severity: 'high',
            title: 'Pod em CrashLoopBackOff',
            description: 'Pod reiniciando continuamente devido a falha de configuração',
            ai_analysis: {
              root_cause: 'Configuração incorreta de variável de ambiente',
              impact: 'Serviço parcialmente indisponível',
              recommendation: 'Corrigir variável DATABASE_URL',
              confidence: 0.95
            },
            auto_heal_action: 'Aplicar patch de configuração',
            action_taken: true,
            action_result: { status: 'success', applied_at: new Date().toISOString() },
            resolved_at: new Date().toISOString()
          },
          {
            cluster_id: cluster.id,
            user_id: user.id,
            incident_type: 'resource_exhaustion',
            severity: 'medium',
            title: 'Uso excessivo de CPU',
            description: 'Container consumindo mais CPU que o limite configurado',
            ai_analysis: {
              root_cause: 'Requests/limits mal configurados',
              impact: 'Performance degradada',
              recommendation: 'Ajustar resource requests e limits',
              confidence: 0.88
            },
            auto_heal_action: 'Ajustar recursos do pod',
            action_taken: true,
            action_result: { status: 'success', old_cpu: '100m', new_cpu: '500m' },
            resolved_at: new Date().toISOString()
          },
          {
            cluster_id: cluster.id,
            user_id: user.id,
            incident_type: 'memory_leak',
            severity: 'critical',
            title: 'Memory Leak Detectado',
            description: 'Aplicação com vazamento de memória',
            ai_analysis: {
              root_cause: 'Memory leak no código da aplicação',
              impact: 'Risco de OOMKilled',
              recommendation: 'Reiniciar pod e investigar aplicação',
              confidence: 0.92
            },
            auto_heal_action: 'Reiniciar pod com memory leak',
            action_taken: true,
            action_result: { status: 'success', pod_restarted: true },
            resolved_at: new Date().toISOString()
          }
        ];

        const { data: createdIncidents, error: incidentsError } = await supabase
          .from('ai_incidents')
          .insert(incidentsToCreate)
          .select('id');

        if (incidentsError) {
          console.error('Error creating incidents:', incidentsError);
        } else {
          incidentIds = createdIncidents?.map(i => i.id) || [];
          totalIncidents += incidentIds.length;
        }
      }

      // Create savings for each incident
      for (const incidentId of incidentIds) {
        const savingTypes = [
          {
            type: 'downtime_prevention',
            downtime: 120,
            costPerMinute: 15.5
          },
          {
            type: 'resource_optimization',
            downtime: 0,
            costPerMinute: 0
          },
          {
            type: 'scale_optimization',
            downtime: 0,
            costPerMinute: 0
          }
        ];

        const randomSaving = savingTypes[Math.floor(Math.random() * savingTypes.length)];
        
        let estimatedSavings = 0;
        let calculationDetails = {};

        if (randomSaving.type === 'downtime_prevention') {
          estimatedSavings = randomSaving.downtime * randomSaving.costPerMinute;
          calculationDetails = {
            method: 'downtime_cost',
            downtime_minutes: randomSaving.downtime,
            cost_per_minute: randomSaving.costPerMinute
          };
        } else if (randomSaving.type === 'resource_optimization') {
          const oldCost = Math.random() * 500 + 100;
          const newCost = oldCost * 0.7;
          estimatedSavings = oldCost - newCost;
          calculationDetails = {
            method: 'resource_comparison',
            old_monthly_cost: oldCost,
            new_monthly_cost: newCost
          };
        } else {
          const reducedReplicas = Math.floor(Math.random() * 5) + 1;
          estimatedSavings = reducedReplicas * 50;
          calculationDetails = {
            method: 'scale_optimization',
            replicas_reduced: reducedReplicas,
            cost_per_replica: 50
          };
        }

        savingsToInsert.push({
          incident_id: incidentId,
          cluster_id: cluster.id,
          user_id: user.id,
          saving_type: randomSaving.type,
          estimated_savings: estimatedSavings,
          cost_per_minute: randomSaving.costPerMinute,
          downtime_avoided_minutes: randomSaving.downtime,
          calculation_details: calculationDetails,
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
        });
      }
    }

    // Insert all savings
    if (savingsToInsert.length > 0) {
      const { error: savingsError } = await supabase
        .from('ai_cost_savings')
        .insert(savingsToInsert);

      if (savingsError) {
        console.error('Error inserting savings:', savingsError);
        throw savingsError;
      }
    }

    // Create notification
    await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        title: '💰 Dados de Economia Gerados',
        message: `Adicionados ${savingsToInsert.length} registros de economia com IA no banco de dados.`,
        type: 'success'
      });

    return new Response(
      JSON.stringify({
        success: true,
        savings_created: savingsToInsert.length,
        incidents_created: totalIncidents,
        message: `Successfully created ${savingsToInsert.length} AI savings records`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in seed-ai-savings:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});