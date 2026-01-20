import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WEEKLY-REPORT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clusterId, userId } = await req.json();
    
    if (!clusterId || !userId) {
      throw new Error("clusterId and userId are required");
    }

    logStep("Starting weekly report generation", { clusterId, userId });

    // Calculate week range (Monday to Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - diffToMonday - 7); // Last week's Monday
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    logStep("Week range calculated", { 
      weekStart: weekStart.toISOString(), 
      weekEnd: weekEnd.toISOString() 
    });

    // Get cluster info
    const { data: cluster, error: clusterError } = await supabase
      .from("clusters")
      .select("*")
      .eq("id", clusterId)
      .single();

    if (clusterError || !cluster) {
      throw new Error(`Cluster not found: ${clusterError?.message}`);
    }

    logStep("Cluster fetched", { name: cluster.name, status: cluster.status });

    // Get storage info from PVCs
    const { data: pvcs } = await supabase
      .from("pvcs")
      .select("requested_bytes, used_bytes")
      .eq("cluster_id", clusterId);

    const totalStorageBytes = pvcs?.reduce((acc, pvc) => acc + (pvc.requested_bytes || 0), 0) || 0;
    const usedStorageBytes = pvcs?.reduce((acc, pvc) => acc + (pvc.used_bytes || 0), 0) || 0;
    const totalStorageGb = totalStorageBytes / (1024 * 1024 * 1024);
    const usedStorageGb = usedStorageBytes / (1024 * 1024 * 1024);

    logStep("Storage calculated", { totalStorageGb, usedStorageGb });

    // Get incidents from the week
    const { data: incidents } = await supabase
      .from("ai_incidents")
      .select("*")
      .eq("cluster_id", clusterId)
      .gte("created_at", weekStart.toISOString())
      .lte("created_at", weekEnd.toISOString());

    const totalIncidents = incidents?.length || 0;
    const criticalIncidents = incidents?.filter(i => i.severity === "critical").length || 0;
    const warningIncidents = incidents?.filter(i => i.severity === "warning" || i.severity === "medium").length || 0;
    const resolvedIncidents = incidents?.filter(i => i.resolved_at !== null).length || 0;

    logStep("Incidents counted", { totalIncidents, criticalIncidents, resolvedIncidents });

    // Get agent actions from the week
    const { data: agentActions } = await supabase
      .from("auto_heal_actions_log")
      .select("*")
      .eq("cluster_id", clusterId)
      .gte("created_at", weekStart.toISOString())
      .lte("created_at", weekEnd.toISOString());

    const totalAgentActions = agentActions?.length || 0;
    const autoHealsApplied = agentActions?.filter(a => a.status === "completed").length || 0;
    const podsRestarted = agentActions?.filter(a => a.action_type === "restart_pod").length || 0;
    const resourceLimitsApplied = agentActions?.filter(a => a.action_type === "apply_resource_limits").length || 0;

    logStep("Agent actions counted", { totalAgentActions, autoHealsApplied, podsRestarted });

    // Get latest security scan for recommendations
    const { data: securityScan } = await supabase
      .from("cluster_security_scans")
      .select("*")
      .eq("cluster_id", clusterId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Build recommendations and critical issues
    const recommendations: string[] = [];
    const criticalIssues: any[] = [];

    // Check for critical incidents
    if (criticalIncidents > 0) {
      criticalIssues.push({
        type: "incidents",
        count: criticalIncidents,
        message: `${criticalIncidents} incidente(s) crítico(s) detectado(s) esta semana`
      });
    }

    // Check cluster health
    let healthScore = 100;
    let clusterStatus = "healthy";

    if (cluster.status !== "connected") {
      healthScore -= 30;
      clusterStatus = cluster.status;
      criticalIssues.push({
        type: "connection",
        message: `Cluster não está conectado (status: ${cluster.status})`
      });
    }

    if ((cluster.cpu_usage || 0) > 80) {
      healthScore -= 15;
      recommendations.push("CPU usage está acima de 80%. Considere escalar horizontalmente.");
    }

    if ((cluster.memory_usage || 0) > 80) {
      healthScore -= 15;
      recommendations.push("Memória está acima de 80%. Monitore e considere adicionar mais recursos.");
    }

    if (totalStorageGb > 0 && (usedStorageGb / totalStorageGb) > 0.8) {
      healthScore -= 10;
      recommendations.push("Storage está acima de 80% de utilização. Considere expandir ou limpar dados antigos.");
    }

    if (securityScan?.recommendations) {
      recommendations.push(...(securityScan.recommendations as string[]).slice(0, 3));
    }

    if (criticalIncidents > 0 && resolvedIncidents < criticalIncidents) {
      recommendations.push("Existem incidentes críticos não resolvidos. Verifique imediatamente.");
    }

    // Get pod health from latest metrics
    const { data: latestMetrics } = await supabase
      .from("agent_metrics")
      .select("metric_data")
      .eq("cluster_id", clusterId)
      .eq("metric_type", "pods")
      .order("collected_at", { ascending: false })
      .limit(1)
      .single();

    let podsHealthy = 0;
    let podsUnhealthy = 0;
    const podsList = latestMetrics?.metric_data?.pods || [];
    
    if (Array.isArray(podsList)) {
      podsHealthy = podsList.filter((p: any) => p.status === "Running" && p.ready).length;
      podsUnhealthy = podsList.filter((p: any) => p.status !== "Running" || !p.ready).length;
    }

    // Generate AI summary using Lovable AI
    let aiSummary = "";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (lovableApiKey) {
      try {
        const summaryPrompt = `Você é um assistente de DevOps. Gere um resumo executivo em português de um relatório semanal de cluster Kubernetes com as seguintes métricas:

- Cluster: ${cluster.name}
- Status: ${clusterStatus}
- Score de Saúde: ${healthScore}/100
- Storage Total: ${totalStorageGb.toFixed(2)} GB
- Storage Usado: ${usedStorageGb.toFixed(2)} GB
- Nodes: ${cluster.nodes || 0}
- Pods: ${cluster.pods || 0} (${podsHealthy} saudáveis, ${podsUnhealthy} com problemas)
- CPU: ${cluster.cpu_usage || 0}%
- Memória: ${cluster.memory_usage || 0}%
- Incidentes: ${totalIncidents} (${criticalIncidents} críticos, ${resolvedIncidents} resolvidos)
- Ações do Agente: ${totalAgentActions} (${podsRestarted} pods reiniciados, ${resourceLimitsApplied} limites de recursos aplicados)

Escreva um resumo conciso (máximo 3 parágrafos) destacando:
1. Estado geral do cluster
2. Problemas principais da semana
3. Ações recomendadas

Seja direto e técnico.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Você é um especialista em Kubernetes e DevOps." },
              { role: "user", content: summaryPrompt }
            ],
            max_tokens: 500,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiSummary = aiData.choices?.[0]?.message?.content || "";
          logStep("AI summary generated");
        }
      } catch (aiError) {
        console.error("Error generating AI summary:", aiError);
      }
    }

    // Insert or update weekly report
    const reportData = {
      user_id: userId,
      cluster_id: clusterId,
      report_date: new Date().toISOString().split('T')[0],
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      total_storage_gb: totalStorageGb,
      storage_used_gb: usedStorageGb,
      storage_available_gb: totalStorageGb - usedStorageGb,
      cluster_health_score: Math.max(0, healthScore),
      cluster_status: clusterStatus,
      nodes_count: cluster.nodes || 0,
      pods_count: cluster.pods || 0,
      pods_healthy: podsHealthy,
      pods_unhealthy: podsUnhealthy,
      total_incidents: totalIncidents,
      critical_incidents: criticalIncidents,
      warning_incidents: warningIncidents,
      resolved_incidents: resolvedIncidents,
      total_agent_actions: totalAgentActions,
      auto_heals_applied: autoHealsApplied,
      pods_restarted: podsRestarted,
      resource_limits_applied: resourceLimitsApplied,
      recommendations: recommendations,
      critical_issues: criticalIssues,
      ai_summary: aiSummary,
      is_read: false,
    };

    const { data: report, error: insertError } = await supabase
      .from("weekly_reports")
      .upsert(reportData, { onConflict: 'user_id,cluster_id,week_start' })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save report: ${insertError.message}`);
    }

    logStep("Report saved successfully", { reportId: report.id });

    // Create notification for the user
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title: "📊 Relatório Semanal Disponível",
        message: `O relatório semanal do cluster ${cluster.name} está pronto. Clique para visualizar.`,
        type: "report",
        related_entity_type: "weekly_report",
        related_entity_id: report.id,
      });

    logStep("Notification created");

    return new Response(JSON.stringify({ 
      success: true, 
      report: report 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error generating weekly report:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
