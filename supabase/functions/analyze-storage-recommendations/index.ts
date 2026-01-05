import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Storage pricing per GB/month by provider (USD)
const STORAGE_PRICES: Record<string, number> = {
  'aws': 0.08,
  'gcp': 0.04,
  'azure': 0.038,
  'digitalocean': 0.10,
  'magalu': 0.05,
  'on-premises': 0.02,
  'other': 0.06,
};

// Calculate percentile
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, index)];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization');
    }

    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const body = await req.json();
    const { cluster_id } = body;

    if (!cluster_id) {
      throw new Error('cluster_id is required');
    }

    // Create admin client for data operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user owns this cluster
    const { data: cluster, error: clusterError } = await supabaseAdmin
      .from('clusters')
      .select('id, name, provider')
      .eq('id', cluster_id)
      .eq('user_id', user.id)
      .single();

    if (clusterError || !cluster) {
      throw new Error('Cluster not found or access denied');
    }

    console.log(`📊 Analyzing storage for cluster ${cluster.name} (${cluster_id})`);

    // Get current PVCs
    const { data: currentPVCs, error: pvcError } = await supabaseAdmin
      .from('pvcs')
      .select('*')
      .eq('cluster_id', cluster_id);

    if (pvcError) {
      console.error('Error fetching PVCs:', pvcError);
      throw new Error('Failed to fetch PVCs');
    }

    if (!currentPVCs || currentPVCs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No PVCs found for analysis',
          recommendations: [],
          pvcs_analyzed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get historical usage (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: history, error: historyError } = await supabaseAdmin
      .from('pvc_usage_history')
      .select('*')
      .eq('cluster_id', cluster_id)
      .gte('recorded_at', sevenDaysAgo)
      .order('recorded_at', { ascending: true });

    if (historyError) {
      console.error('Error fetching history:', historyError);
    }

    // Calculate statistics per PVC
    interface PVCStat {
      pvc: any;
      usagePoints: number[];
      avgUsage: number;
      maxUsage: number;
      p95Usage: number;
      dataPoints: number;
    }

    const pvcStats: Record<string, PVCStat> = {};

    // Initialize with current PVCs
    for (const pvc of currentPVCs) {
      const key = `${pvc.namespace}/${pvc.name}`;
      const currentUsagePercent = pvc.requested_bytes > 0
        ? (pvc.used_bytes / pvc.requested_bytes) * 100
        : 0;

      pvcStats[key] = {
        pvc,
        usagePoints: [currentUsagePercent],
        avgUsage: currentUsagePercent,
        maxUsage: currentUsagePercent,
        p95Usage: currentUsagePercent,
        dataPoints: 1,
      };
    }

    // Add historical data
    if (history && history.length > 0) {
      for (const record of history) {
        // Find the matching PVC
        const matchingPVC = currentPVCs.find(p => p.id === record.pvc_id);
        if (matchingPVC) {
          const key = `${matchingPVC.namespace}/${matchingPVC.name}`;
          if (pvcStats[key]) {
            pvcStats[key].usagePoints.push(record.usage_percentage);
            pvcStats[key].dataPoints++;
          }
        }
      }

      // Calculate final statistics
      for (const key in pvcStats) {
        const stat = pvcStats[key];
        const sorted = [...stat.usagePoints].sort((a, b) => a - b);
        stat.avgUsage = sorted.reduce((a, b) => a + b, 0) / sorted.length;
        stat.maxUsage = sorted[sorted.length - 1];
        stat.p95Usage = percentile(stat.usagePoints, 95);
      }
    }

    // Prepare data for AI analysis
    const analysisData = Object.entries(pvcStats).map(([key, stat]) => ({
      name: stat.pvc.name,
      namespace: stat.pvc.namespace,
      requested_gb: (stat.pvc.requested_bytes / (1024**3)).toFixed(2),
      used_gb: (stat.pvc.used_bytes / (1024**3)).toFixed(2),
      avg_usage_percent: stat.avgUsage.toFixed(1),
      max_usage_percent: stat.maxUsage.toFixed(1),
      p95_usage_percent: stat.p95Usage.toFixed(1),
      data_points: stat.dataPoints,
      storage_class: stat.pvc.storage_class,
    }));

    console.log(`📈 Prepared analysis data for ${analysisData.length} PVCs`);

    const pricePerGB = STORAGE_PRICES[cluster.provider?.toLowerCase()] || STORAGE_PRICES['other'];

    const systemPrompt = `Voce e um especialista em otimizacao de storage Kubernetes. Analise o uso de PVCs e recomende rightsizing.

Para cada PVC, determine:
1. Se uso e consistentemente BAIXO (<30% avg E <50% max): Recomende DOWNSIZE
2. Se uso e consistentemente ALTO (>80% avg OU >90% max): Recomende UPSIZE
3. Se uso e ZERO por periodo estendido: Recomende DELETE
4. Outros casos: Recomende MAINTAIN

Calcule tamanho recomendado:
- Para DOWNSIZE: recomendado = ceil(max_usage_gb * 1.3) - adicionar 30% de buffer de seguranca
- Para UPSIZE: recomendado = ceil(atual * 1.5) - aumentar 50%
- Para MAINTAIN: manter tamanho atual
- Para DELETE: recomendado = 0

Prioridade:
- critical: uso > 95% ou economia > $10/mes
- high: uso > 85% ou economia > $5/mes
- medium: uso < 20% ou economia > $2/mes
- low: outros casos

Provider: ${cluster.provider}
Preco por GB/mes: $${pricePerGB}

Retorne JSON puro (sem markdown):
{
  "recommendations": [
    {
      "pvc_name": "nome",
      "namespace": "namespace",
      "recommendation_type": "downsize|upsize|maintain|delete",
      "priority": "low|medium|high|critical",
      "current_size_gb": 10.0,
      "recommended_size_gb": 5.0,
      "current_usage_gb": 2.5,
      "avg_usage_percent": 25.0,
      "max_usage_percent": 40.0,
      "p95_usage_percent": 38.0,
      "potential_savings_month": 0.40,
      "reasoning": "Explicacao em portugues do porque desta recomendacao, incluindo padroes de uso e avaliacao de risco"
    }
  ],
  "summary": "Resumo em portugues das economias totais e recomendacoes principais"
}`;

    const geminiMessages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: `Analise estes PVCs e recomende otimizacoes:\n\n${JSON.stringify(analysisData, null, 2)}` }
    ];

    console.log('🤖 Calling Google Gemini for storage analysis...');

    const aiResult = await callGemini(geminiMessages, user.id, "analyze-storage-recommendations");

    let aiContent = aiResult.content;

    // Clean markdown formatting if present
    aiContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let analysisResult;
    try {
      analysisResult = JSON.parse(aiContent);
    } catch (e) {
      console.error('Failed to parse AI response:', aiContent);
      analysisResult = { recommendations: [], summary: 'Falha ao processar resposta da IA' };
    }

    const recommendations = analysisResult.recommendations || [];

    console.log(`🤖 AI generated ${recommendations.length} recommendations (tokens: ${aiResult.inputTokens}/${aiResult.outputTokens}, free tier: ${aiResult.isFreeTier})`);

    // Store recommendations
    if (recommendations.length > 0) {
      // Delete old pending recommendations for this cluster
      const { error: deleteError } = await supabaseAdmin
        .from('storage_recommendations')
        .delete()
        .eq('cluster_id', cluster_id)
        .eq('status', 'pending');

      if (deleteError) {
        console.error('Error deleting old recommendations:', deleteError);
      }

      // Prepare recommendations for insert
      const recsToInsert = recommendations
        .filter((rec: any) => rec.recommendation_type !== 'maintain') // Only store actionable recommendations
        .map((rec: any) => ({
          pvc_name: rec.pvc_name,
          namespace: rec.namespace,
          cluster_id,
          user_id: user.id,
          current_size_gb: parseFloat(rec.current_size_gb) || 0,
          recommended_size_gb: parseFloat(rec.recommended_size_gb) || 0,
          current_usage_gb: parseFloat(rec.current_usage_gb) || 0,
          avg_usage_percent: parseFloat(rec.avg_usage_percent) || 0,
          max_usage_percent: parseFloat(rec.max_usage_percent) || 0,
          p95_usage_percent: parseFloat(rec.p95_usage_percent) || 0,
          recommendation_type: rec.recommendation_type,
          priority: rec.priority || 'medium',
          potential_savings_month: parseFloat(rec.potential_savings_month) || 0,
          ai_reasoning: rec.reasoning || 'Sem justificativa',
          days_analyzed: 7,
          status: 'pending',
        }));

      if (recsToInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('storage_recommendations')
          .insert(recsToInsert);

        if (insertError) {
          console.error('Error storing recommendations:', insertError);
        } else {
          console.log(`✅ Stored ${recsToInsert.length} actionable recommendations`);
        }
      }
    }

    // Calculate total potential savings
    const totalSavings = recommendations
      .filter((r: any) => r.recommendation_type === 'downsize' || r.recommendation_type === 'delete')
      .reduce((sum: number, r: any) => sum + (parseFloat(r.potential_savings_month) || 0), 0);

    console.log(`💰 Total potential monthly savings: $${totalSavings.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        success: true,
        recommendations_count: recommendations.length,
        actionable_count: recommendations.filter((r: any) => r.recommendation_type !== 'maintain').length,
        recommendations,
        summary: analysisResult.summary,
        pvcs_analyzed: analysisData.length,
        total_potential_savings: totalSavings,
        history_data_points: history?.length || 0,
        ai_usage: {
          input_tokens: aiResult.inputTokens,
          output_tokens: aiResult.outputTokens,
          is_free_tier: aiResult.isFreeTier,
          estimated_cost: aiResult.estimatedCost
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-storage-recommendations:', error);

    const statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 :
                       error instanceof Error && error.message.includes('402') ? 402 :
                       error instanceof Error && error.message.includes('429') ? 429 : 500;

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
