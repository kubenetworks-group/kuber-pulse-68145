import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { cluster_id, report_date } = await req.json();

    // If no cluster_id, generate reports for all clusters
    let clusters: any[] = [];
    
    if (cluster_id) {
      const { data: cluster } = await supabase
        .from('clusters')
        .select('id, user_id, name')
        .eq('id', cluster_id)
        .single();
      if (cluster) clusters = [cluster];
    } else {
      const { data: allClusters } = await supabase
        .from('clusters')
        .select('id, user_id, name')
        .in('status', ['healthy', 'warning', 'connected']);
      clusters = allClusters || [];
    }

    const targetDate = report_date || new Date().toISOString().split('T')[0];
    const startOfDay = `${targetDate}T00:00:00Z`;
    const endOfDay = `${targetDate}T23:59:59Z`;

    const results: any[] = [];

    for (const cluster of clusters) {
      // Get all audit logs for this cluster on this date
      const { data: auditLogs } = await supabase
        .from('pod_restart_audit')
        .select('*')
        .eq('cluster_id', cluster.id)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });

      if (!auditLogs || auditLogs.length === 0) {
        console.log(`No restart audit logs for cluster ${cluster.name} on ${targetDate}`);
        continue;
      }

      // Calculate metrics
      const uniquePods = new Set(auditLogs.map(l => `${l.namespace}/${l.pod_name}`));
      const uniqueNamespaces = new Set(auditLogs.map(l => l.namespace));

      // Group by reason
      const reasonCounts: Record<string, number> = {};
      for (const log of auditLogs) {
        const reason = log.restart_reason || 'Unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }

      const topReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Group by pod
      const podSummary: Record<string, any> = {};
      for (const log of auditLogs) {
        const key = `${log.namespace}/${log.pod_name}`;
        if (!podSummary[key]) {
          podSummary[key] = {
            pod_name: log.pod_name,
            namespace: log.namespace,
            restart_count: 0,
            reasons: [],
            exit_codes: [],
            last_restart: log.created_at,
            has_logs: false,
          };
        }
        podSummary[key].restart_count++;
        if (!podSummary[key].reasons.includes(log.restart_reason)) {
          podSummary[key].reasons.push(log.restart_reason);
        }
        if (log.exit_code !== null && !podSummary[key].exit_codes.includes(log.exit_code)) {
          podSummary[key].exit_codes.push(log.exit_code);
        }
        if (log.container_logs) {
          podSummary[key].has_logs = true;
        }
      }

      const podsSummaryArray = Object.values(podSummary)
        .sort((a: any, b: any) => b.restart_count - a.restart_count)
        .slice(0, 20);

      // Generate AI summary if available
      let aiAnalysis = null;
      try {
        const summaryPrompt = `Analise os seguintes dados de restarts de pods em um cluster Kubernetes e forneça um resumo executivo em português:

Total de restarts: ${auditLogs.length}
Pods afetados: ${uniquePods.size}
Namespaces afetados: ${Array.from(uniqueNamespaces).join(', ')}

Top motivos de restart:
${topReasons.map(r => `- ${r.reason}: ${r.count} vezes`).join('\n')}

Pods com mais restarts:
${podsSummaryArray.slice(0, 5).map((p: any) => `- ${p.namespace}/${p.pod_name}: ${p.restart_count} restarts (${p.reasons.join(', ')})`).join('\n')}

Forneça:
1. Um resumo executivo (2-3 frases)
2. Principais problemas identificados
3. Recomendações de ação`;

        // Simple analysis without AI to avoid quota issues
        aiAnalysis = `Resumo: Foram registrados ${auditLogs.length} restarts em ${uniquePods.size} pods no dia ${targetDate}. ` +
          `Os principais motivos foram: ${topReasons.slice(0, 3).map(r => r.reason).join(', ')}. ` +
          `Recomendação: Investigar pods com maior frequência de restarts e verificar logs armazenados para diagnóstico detalhado.`;
      } catch (e) {
        console.log('AI analysis skipped:', e);
      }

      // Upsert the daily report
      const { data: report, error: upsertError } = await supabase
        .from('pod_restart_daily_reports')
        .upsert({
          cluster_id: cluster.id,
          user_id: cluster.user_id,
          report_date: targetDate,
          total_restarts: auditLogs.length,
          pods_affected: uniquePods.size,
          namespaces_affected: Array.from(uniqueNamespaces),
          top_restart_reasons: topReasons,
          pods_summary: podsSummaryArray,
          ai_analysis: aiAnalysis,
        }, {
          onConflict: 'cluster_id,report_date',
        })
        .select()
        .single();

      if (upsertError) {
        console.error(`Failed to create report for cluster ${cluster.id}:`, upsertError);
        continue;
      }

      results.push({
        cluster_id: cluster.id,
        cluster_name: cluster.name,
        report_date: targetDate,
        total_restarts: auditLogs.length,
        pods_affected: uniquePods.size,
        report_id: report?.id,
      });

      // Create notification for user
      if (auditLogs.length > 0) {
        await supabase
          .from('notifications')
          .insert({
            user_id: cluster.user_id,
            title: '📊 Relatório de Restarts',
            message: `Cluster ${cluster.name}: ${auditLogs.length} restarts em ${uniquePods.size} pods no dia ${targetDate}.`,
            type: 'info',
            related_entity_type: 'cluster',
            related_entity_id: cluster.id,
          });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reports_generated: results.length,
        reports: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
