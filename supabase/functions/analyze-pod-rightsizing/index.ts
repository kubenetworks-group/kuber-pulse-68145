import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cost rates per core-hour / GiB-hour (USD)
const CPU_HOUR_RATE = 0.048;
const RAM_GIB_HOUR_RATE = 0.006;
const HOURS_PER_MONTH = 730;

// Parse Kubernetes CPU value to millicores
function parseCPUToMillicores(val: string | number | undefined): number {
  if (val === undefined || val === null || val === '') return 0;
  const s = String(val).trim();
  if (s.endsWith('m')) return parseFloat(s) || 0;
  return (parseFloat(s) || 0) * 1000;
}

// Parse Kubernetes memory value to bytes
function parseMemoryToBytes(val: string | number | undefined): number {
  if (val === undefined || val === null || val === '') return 0;
  const s = String(val).trim();
  const units: Record<string, number> = {
    Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4,
    K: 1000, M: 1000 ** 2, G: 1000 ** 3, T: 1000 ** 4,
  };
  for (const [suffix, mult] of Object.entries(units)) {
    if (s.endsWith(suffix)) return (parseFloat(s) || 0) * mult;
  }
  return parseFloat(s) || 0;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const { cluster_id } = body;
    if (!cluster_id) throw new Error('cluster_id is required');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: cluster, error: clusterError } = await supabaseAdmin
      .from('clusters')
      .select('id, name, provider')
      .eq('id', cluster_id)
      .eq('user_id', user.id)
      .single();

    if (clusterError || !cluster) throw new Error('Cluster not found or access denied');

    console.log(`📊 Analyzing pod rightsizing for cluster ${cluster.name} (${cluster_id})`);

    // Fetch last 7 days of pod_details metrics
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: metricsRows, error: metricsError } = await supabaseAdmin
      .from('agent_metrics')
      .select('metric_data, collected_at')
      .eq('cluster_id', cluster_id)
      .eq('metric_type', 'pod_details')
      .gte('collected_at', sevenDaysAgo)
      .order('collected_at', { ascending: true });

    if (metricsError) throw new Error('Failed to fetch pod metrics');

    if (!metricsRows || metricsRows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pod data found for analysis', recommendations: [], pods_analyzed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate per pod key: namespace/name/container
    interface PodStat {
      podName: string;
      namespace: string;
      containerName: string;
      cpuUsagePoints: number[];      // millicores
      memUsagePoints: number[];      // bytes
      cpuRequestMc: number;          // millicores
      cpuLimitMc: number;
      memRequestBytes: number;
      memLimitBytes: number;
      hasRequests: boolean;
      hasLimits: boolean;
      dataPoints: number;
    }

    const podStats: Record<string, PodStat> = {};

    for (const row of metricsRows) {
      const pods: any[] = Array.isArray(row.metric_data) ? row.metric_data : (row.metric_data?.pods ?? []);
      for (const pod of pods) {
        const containers: any[] = pod.containers ?? [{ name: pod.container_name ?? 'main' }];
        for (const container of containers) {
          const key = `${pod.namespace}/${pod.name}/${container.name ?? 'main'}`;
          const cpuUsageMc = parseCPUToMillicores(container.cpu_usage ?? pod.cpu_usage_cores);
          const memUsageBytes = parseMemoryToBytes(container.memory_usage ?? pod.memory_usage_bytes);
          const cpuReqMc = parseCPUToMillicores(container.resources?.requests?.cpu ?? pod.resource_requests?.cpu);
          const cpuLimMc = parseCPUToMillicores(container.resources?.limits?.cpu ?? pod.resource_limits?.cpu);
          const memReqBytes = parseMemoryToBytes(container.resources?.requests?.memory ?? pod.resource_requests?.memory);
          const memLimBytes = parseMemoryToBytes(container.resources?.limits?.memory ?? pod.resource_limits?.memory);

          if (!podStats[key]) {
            podStats[key] = {
              podName: pod.name,
              namespace: pod.namespace,
              containerName: container.name ?? 'main',
              cpuUsagePoints: [],
              memUsagePoints: [],
              cpuRequestMc: cpuReqMc,
              cpuLimitMc: cpuLimMc,
              memRequestBytes: memReqBytes,
              memLimitBytes: memLimBytes,
              hasRequests: cpuReqMc > 0 || memReqBytes > 0,
              hasLimits: cpuLimMc > 0 || memLimBytes > 0,
              dataPoints: 0,
            };
          }
          if (cpuUsageMc > 0) podStats[key].cpuUsagePoints.push(cpuUsageMc);
          if (memUsageBytes > 0) podStats[key].memUsagePoints.push(memUsageBytes);
          podStats[key].dataPoints++;
        }
      }
    }

    // Filter: only pods with enough data and with requests defined
    const SYSTEM_NAMESPACES = ['kube-system', 'kube-public', 'kube-node-lease', 'cert-manager', 'monitoring'];
    const eligiblePods = Object.values(podStats).filter(p =>
      p.dataPoints >= 3 &&
      !SYSTEM_NAMESPACES.includes(p.namespace) &&
      (p.cpuUsagePoints.length > 0 || p.memUsagePoints.length > 0)
    );

    if (eligiblePods.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Insufficient data for rightsizing analysis', recommendations: [], pods_analyzed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build analysis summary for Gemini (limit to 40 pods to stay within token budget)
    const analysisData = eligiblePods.slice(0, 40).map(p => {
      const cpuAvg = p.cpuUsagePoints.length > 0 ? p.cpuUsagePoints.reduce((a, b) => a + b) / p.cpuUsagePoints.length : 0;
      const cpuMax = p.cpuUsagePoints.length > 0 ? Math.max(...p.cpuUsagePoints) : 0;
      const cpuP95 = percentile(p.cpuUsagePoints, 95);
      const memAvg = p.memUsagePoints.length > 0 ? p.memUsagePoints.reduce((a, b) => a + b) / p.memUsagePoints.length : 0;
      const memMax = p.memUsagePoints.length > 0 ? Math.max(...p.memUsagePoints) : 0;
      const memP95 = percentile(p.memUsagePoints, 95);

      const cpuUsePct = p.cpuRequestMc > 0 ? (cpuAvg / p.cpuRequestMc) * 100 : null;
      const memUsePct = p.memRequestBytes > 0 ? (memAvg / p.memRequestBytes) * 100 : null;

      return {
        pod: p.podName,
        namespace: p.namespace,
        container: p.containerName,
        cpu_request_mc: Math.round(p.cpuRequestMc),
        cpu_limit_mc: Math.round(p.cpuLimitMc),
        cpu_avg_mc: Math.round(cpuAvg),
        cpu_max_mc: Math.round(cpuMax),
        cpu_p95_mc: Math.round(cpuP95),
        cpu_use_pct: cpuUsePct !== null ? parseFloat(cpuUsePct.toFixed(1)) : null,
        mem_request_mib: parseFloat((p.memRequestBytes / (1024 ** 2)).toFixed(1)),
        mem_limit_mib: parseFloat((p.memLimitBytes / (1024 ** 2)).toFixed(1)),
        mem_avg_mib: parseFloat((memAvg / (1024 ** 2)).toFixed(1)),
        mem_max_mib: parseFloat((memMax / (1024 ** 2)).toFixed(1)),
        mem_p95_mib: parseFloat((memP95 / (1024 ** 2)).toFixed(1)),
        mem_use_pct: memUsePct !== null ? parseFloat(memUsePct.toFixed(1)) : null,
        has_requests: p.hasRequests,
        has_limits: p.hasLimits,
        data_points: p.dataPoints,
      };
    });

    console.log(`📈 Prepared analysis for ${analysisData.length} pods`);

    const systemPrompt = `Voce e um especialista em rightsizing de containers Kubernetes. Analise o uso de CPU e memoria dos pods e recomende ajustes nos resource requests e limits.

Para cada pod/container, determine:
1. ADD_REQUESTS: sem requests definidos (has_requests=false) → sempre criar recomendacao, prioridade high
2. ADD_LIMITS: tem requests mas sem limits (has_limits=false) → sempre criar recomendacao, prioridade high
3. DOWNSIZE_CPU: cpu_use_pct < 30% (avg) E < 50% (max) → recomende request = cpu_p95_mc * 1.3 (30% buffer)
4. UPSIZE_CPU: cpu_use_pct > 80% (avg) OU > 90% (max) → recomende request = cpu_avg_mc * 1.3
5. DOWNSIZE_MEM: mem_use_pct < 30% (avg) E < 50% (max) → recomende request = mem_p95_mib * 1.2
6. UPSIZE_MEM: mem_use_pct > 80% (avg) OU > 90% (max) → recomende request = mem_avg_mib * 1.3

Prioridade:
- critical: sem limits OU uso cpu/mem > 95% OU economia > $10/mes
- high: sem requests OU uso > 85% OU economia > $5/mes
- medium: uso < 20% OU economia > $2/mes
- low: outros casos

Calcule economia mensal para DOWNSIZE:
- CPU: (request_atual_mc - request_recomendado_mc) / 1000 * ${CPU_HOUR_RATE} * ${HOURS_PER_MONTH}
- MEM: (request_atual_mib - request_recomendado_mib) / 1024 * ${RAM_GIB_HOUR_RATE} * ${HOURS_PER_MONTH}

Gere recomendacoes SOMENTE para casos com acao clara. Se o uso for adequado (30-80%), nao recomende nada para aquele recurso.
Limite: no maximo 20 recomendacoes, priorizando criticas e de maior economia.

Retorne JSON puro (sem markdown):
{
  "recommendations": [
    {
      "pod_name": "nome-do-pod",
      "namespace": "namespace",
      "container_name": "nome-do-container",
      "recommendation_type": "downsize_cpu|upsize_cpu|downsize_mem|upsize_mem|add_limits|add_requests",
      "resource_type": "cpu|memory|both",
      "priority": "low|medium|high|critical",
      "current_request_cpu": "200m",
      "recommended_request_cpu": "80m",
      "current_limit_cpu": "500m",
      "current_request_mem": "256Mi",
      "recommended_request_mem": "128Mi",
      "current_limit_mem": "512Mi",
      "avg_usage_percent": 15.0,
      "max_usage_percent": 28.0,
      "p95_usage_percent": 22.0,
      "potential_savings_month": 2.50,
      "reasoning": "Explicacao em portugues: padrao de uso, por que esta recomendacao e beneficios esperados"
    }
  ],
  "summary": "Resumo das recomendacoes e economia potencial total"
}`;

    const geminiMessages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: `Analise estes pods e recomende rightsizing:\n\n${JSON.stringify(analysisData, null, 2)}` }
    ];

    console.log('🤖 Calling Google Gemini for pod rightsizing analysis...');
    const aiResult = await callGemini(geminiMessages, user.id, "analyze-pod-rightsizing");

    let aiContent = aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let analysisResult: any;
    try {
      analysisResult = JSON.parse(aiContent);
    } catch (e) {
      console.error('Failed to parse AI response:', aiContent);
      analysisResult = { recommendations: [], summary: 'Falha ao processar resposta da IA' };
    }

    const recommendations = analysisResult.recommendations || [];
    console.log(`🤖 AI generated ${recommendations.length} recommendations`);

    if (recommendations.length > 0) {
      // Remove old pending recommendations for this cluster
      await supabaseAdmin
        .from('pod_rightsizing_recommendations')
        .delete()
        .eq('cluster_id', cluster_id)
        .eq('status', 'pending');

      const recsToInsert = recommendations.map((rec: any) => ({
        pod_name: rec.pod_name,
        namespace: rec.namespace,
        container_name: rec.container_name ?? 'main',
        cluster_id,
        user_id: user.id,
        recommendation_type: rec.recommendation_type,
        resource_type: rec.resource_type ?? 'cpu',
        priority: rec.priority ?? 'medium',
        current_request_cpu: rec.current_request_cpu ?? null,
        recommended_request_cpu: rec.recommended_request_cpu ?? null,
        current_limit_cpu: rec.current_limit_cpu ?? null,
        current_request_mem: rec.current_request_mem ?? null,
        recommended_request_mem: rec.recommended_request_mem ?? null,
        current_limit_mem: rec.current_limit_mem ?? null,
        avg_usage_percent: parseFloat(rec.avg_usage_percent) || 0,
        max_usage_percent: parseFloat(rec.max_usage_percent) || 0,
        p95_usage_percent: parseFloat(rec.p95_usage_percent) || 0,
        potential_savings_month: parseFloat(rec.potential_savings_month) || 0,
        ai_reasoning: rec.reasoning ?? 'Sem justificativa',
        status: 'pending',
      }));

      const { error: insertError } = await supabaseAdmin
        .from('pod_rightsizing_recommendations')
        .insert(recsToInsert);

      if (insertError) {
        console.error('Error storing recommendations:', insertError);
      } else {
        console.log(`✅ Stored ${recsToInsert.length} pod rightsizing recommendations`);
      }
    }

    const totalSavings = recommendations
      .filter((r: any) => r.recommendation_type?.startsWith('downsize'))
      .reduce((sum: number, r: any) => sum + (parseFloat(r.potential_savings_month) || 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        recommendations_count: recommendations.length,
        recommendations,
        summary: analysisResult.summary,
        pods_analyzed: analysisData.length,
        total_potential_savings: totalSavings,
        ai_usage: {
          input_tokens: aiResult.inputTokens,
          output_tokens: aiResult.outputTokens,
          is_free_tier: aiResult.isFreeTier,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-pod-rightsizing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('Limite de requisições');
    const isPaymentError = errorMessage.includes('402') || errorMessage.includes('Payment required');
    const statusCode = errorMessage === 'Unauthorized' ? 401 : isPaymentError ? 402 : isRateLimitError ? 429 : 500;

    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
