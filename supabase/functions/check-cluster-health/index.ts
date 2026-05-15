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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting cluster health check...');

    // Get all clusters
    const { data: clusters, error: clustersError } = await supabaseClient
      .from('clusters')
      .select('id, name, status, user_id');

    if (clustersError) {
      console.error('Error fetching clusters:', clustersError);
      throw clustersError;
    }

    console.log(`Checking health for ${clusters?.length || 0} clusters`);

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const results = [];

    for (const cluster of clusters || []) {
      try {
        // Check for recent metrics
        const { data: recentMetrics, error: metricsError } = await supabaseClient
          .from('agent_metrics')
          .select('metric_type, collected_at')
          .eq('cluster_id', cluster.id)
          .gte('collected_at', fiveMinutesAgo)
          .order('collected_at', { ascending: false });

        if (metricsError) {
          console.error(`Error fetching metrics for cluster ${cluster.name}:`, metricsError);
          continue;
        }

        // Determina o status do cluster com base nas métricas recentes
        let newStatus = 'disconnected'; // status válido para "sem métricas"
        let hasBasicMetrics = false;
        let hasEssentialMetrics = false;

        if (recentMetrics && recentMetrics.length > 0) {
          const metricTypes = new Set(recentMetrics.map(m => m.metric_type));

          // Métricas básicas: cpu, memory, pods
          hasBasicMetrics = ['cpu', 'memory', 'pods'].some(type => metricTypes.has(type));

          // Métricas essenciais: pod_details e events
          hasEssentialMetrics = ['pod_details', 'events'].every(type => metricTypes.has(type));

          if (hasBasicMetrics && hasEssentialMetrics) {
            newStatus = 'healthy';
          } else if (hasBasicMetrics) {
            newStatus = 'warning'; // tem básicas mas faltam pod_details ou events
          } else {
            newStatus = 'disconnected';
          }
        }

        // Atualiza o status apenas se mudou
        if (newStatus !== cluster.status) {
          const { error: updateError } = await supabaseClient
            .from('clusters')
            .update({
              status: newStatus,
              last_sync: new Date().toISOString()
            })
            .eq('id', cluster.id);

          if (updateError) {
            console.error(`Erro ao atualizar status do cluster ${cluster.name}:`, updateError);
          } else {
            console.log(`Cluster ${cluster.name} atualizado: ${cluster.status} → ${newStatus}`);

            // Notificação quando cluster fica sem conexão
            if (newStatus === 'disconnected' && !['disconnected', 'connecting', 'pending_agent'].includes(cluster.status)) {
              await supabaseClient
                .from('notifications')
                .insert({
                  user_id: cluster.user_id,
                  title: 'Cluster Desconectado',
                  message: `O cluster "${cluster.name}" não enviou métricas nos últimos 5 minutos e está desconectado.`,
                  type: 'warning',
                  related_entity_type: 'cluster',
                  related_entity_id: cluster.id,
                });
            }

            // Notificação quando dados estão incompletos
            if (newStatus === 'warning' && cluster.status === 'healthy') {
              await supabaseClient
                .from('notifications')
                .insert({
                  user_id: cluster.user_id,
                  title: 'Dados Incompletos do Cluster',
                  message: `O cluster "${cluster.name}" está enviando métricas básicas, mas faltam detalhes de pods ou eventos. Verifique a configuração do agent.`,
                  type: 'info',
                  related_entity_type: 'cluster',
                  related_entity_id: cluster.id,
                });
            }
          }
        }

        results.push({
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          old_status: cluster.status,
          new_status: newStatus,
          has_basic_metrics: hasBasicMetrics,
          has_essential_metrics: hasEssentialMetrics,
          metrics_count: recentMetrics.length,
        });
      } catch (error) {
        console.error(`Error processing cluster ${cluster.name}:`, error);
      }
    }

    console.log('Cluster health check completed:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        clusters_checked: clusters?.length || 0,
        results 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Health check failed:', error);
    return new Response(
      JSON.stringify({ error: 'Health check failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
