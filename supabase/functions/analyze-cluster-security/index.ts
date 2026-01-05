import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { callGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to decode JWT and extract user ID
function getUserIdFromToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
}

serve(async (req) => {
  console.log('analyze-cluster-security called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const userId = getUserIdFromToken(authHeader);
    
    if (!userId) {
      console.log('No user ID found in token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('User authenticated from JWT:', userId);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { cluster_id } = body;

    if (!cluster_id) {
      return new Response(JSON.stringify({ error: 'Missing cluster_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user owns this cluster
    const { data: cluster, error: clusterError } = await supabaseAdmin
      .from('clusters')
      .select('*')
      .eq('id', cluster_id)
      .eq('user_id', userId)
      .single();

    if (clusterError || !cluster) {
      return new Response(JSON.stringify({ error: 'Cluster not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch security metrics
    const { data: securityMetric } = await supabaseAdmin
      .from('agent_metrics')
      .select('metric_data')
      .eq('cluster_id', cluster_id)
      .eq('metric_type', 'security')
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const securityData = securityMetric?.metric_data as any || null;
    console.log('Security data from agent:', securityData ? 'available' : 'not available');

    // DETERMINISTIC ANALYSIS
    const calculateDeterministicAnalysis = (data: any) => {
      if (!data) {
        return {
          has_rbac: false,
          has_network_policies: false,
          has_pod_security: false,
          has_secrets_encryption: false,
          has_resource_limits: false,
        };
      }

      const has_rbac = (data.rbac?.cluster_roles_count > 0 || data.rbac?.roles_count > 0) && 
                       (data.rbac?.cluster_role_bindings_count > 0 || data.rbac?.role_bindings_count > 0);
      const has_network_policies = (data.network_policies?.total_count || 0) > 0;
      const totalPods = data.pod_security?.total_pods || 0;
      const podsWithContext = data.pod_security?.pods_with_security_context || 0;
      const podsWithLimits = data.pod_security?.pods_with_resource_limits || 0;
      const securityContextPercentage = totalPods > 0 ? (podsWithContext / totalPods) * 100 : 0;
      const has_pod_security = securityContextPercentage >= 50;
      const has_secrets_encryption = (data.secrets?.total_count || 0) > 0;
      const resourceLimitsPercentage = data.pod_security?.resource_limits_percentage || 
        (totalPods > 0 ? (podsWithLimits / totalPods) * 100 : 0);
      const has_resource_limits = resourceLimitsPercentage >= 50;

      return { has_rbac, has_network_policies, has_pod_security, has_secrets_encryption, has_resource_limits };
    };

    const deterministicFlags = calculateDeterministicAnalysis(securityData);

    // Calculate security score
    const calculateSecurityScore = (flags: typeof deterministicFlags) => {
      let score = 0;
      if (flags.has_rbac) score += 25;
      if (flags.has_network_policies) score += 20;
      if (flags.has_pod_security) score += 20;
      if (flags.has_secrets_encryption) score += 15;
      if (flags.has_resource_limits) score += 20;
      return Math.min(100, Math.max(0, score));
    };

    const securityScore = calculateSecurityScore(deterministicFlags);
    const overallStatus = securityScore >= 80 ? 'passed' : securityScore >= 50 ? 'warning' : 'failed';

    console.log('Deterministic analysis:', { ...deterministicFlags, securityScore, overallStatus });

    // Prepare prompt for AI
    const prompt = `Você é um especialista em segurança Kubernetes. Analise os dados e forneça recomendações.

Cluster: ${cluster.name} (${cluster.provider}, ${cluster.environment})
Nodes: ${cluster.nodes || 0} | Pods: ${cluster.pods || 0}

=== ANÁLISE DETERMINÍSTICA ===
- has_rbac: ${deterministicFlags.has_rbac}
- has_network_policies: ${deterministicFlags.has_network_policies}
- has_pod_security: ${deterministicFlags.has_pod_security}
- has_secrets_encryption: ${deterministicFlags.has_secrets_encryption}
- has_resource_limits: ${deterministicFlags.has_resource_limits}
- security_score: ${securityScore}
- overall_status: ${overallStatus}

${securityData ? `
=== DADOS DO CLUSTER ===
RBAC: ${JSON.stringify(securityData.rbac || {})}
Network Policies: ${JSON.stringify(securityData.network_policies || {})}
Pod Security: ${JSON.stringify(securityData.pod_security || {})}
Secrets: ${JSON.stringify(securityData.secrets || {})}
` : 'Dados de segurança não disponíveis.'}

Retorne JSON (sem markdown):
{
  "rbac_details": { "status": "configured|partial|missing", "issues": ["..."], "recommendations": ["..."] },
  "network_policy_details": { "status": "...", "issues": ["..."], "recommendations": ["..."] },
  "pod_security_details": { "status": "...", "issues": ["..."], "recommendations": ["..."] },
  "secrets_details": { "status": "...", "issues": ["..."], "recommendations": ["..."] },
  "resource_limits_details": { "status": "...", "issues": ["..."], "recommendations": ["..."] },
  "recommendations": ["top 5-7 recomendacoes prioritarias"],
  "summary": "Resumo executivo em portugues"
}`;

    console.log('🤖 Calling Google Gemini for security analysis...');

    const geminiMessages = [
      { role: "system" as const, content: 'Você é um especialista em segurança Kubernetes. Analise clusters e retorne avaliações estruturadas em português.' },
      { role: "user" as const, content: prompt }
    ];

    const aiResult = await callGemini(geminiMessages, userId, "analyze-cluster-security");

    let aiContent = aiResult.content;
    aiContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(aiContent);
    } catch (e) {
      console.error('Failed to parse AI response:', aiContent);
      // Fallback with basic analysis
      aiAnalysis = {
        rbac_details: {
          status: deterministicFlags.has_rbac ? 'configured' : 'missing',
          issues: deterministicFlags.has_rbac ? ['RBAC configurado'] : ['RBAC não detectado'],
          recommendations: ['Revisar permissões regularmente']
        },
        network_policy_details: {
          status: deterministicFlags.has_network_policies ? 'configured' : 'missing',
          issues: deterministicFlags.has_network_policies ? ['NetworkPolicies ativas'] : ['Sem NetworkPolicies'],
          recommendations: ['Implementar políticas de isolamento']
        },
        pod_security_details: {
          status: deterministicFlags.has_pod_security ? 'configured' : 'partial',
          issues: ['Verificar security context dos pods'],
          recommendations: ['Implementar Pod Security Standards']
        },
        secrets_details: {
          status: deterministicFlags.has_secrets_encryption ? 'configured' : 'missing',
          issues: ['Verificar criptografia de secrets'],
          recommendations: ['Usar external secrets']
        },
        resource_limits_details: {
          status: deterministicFlags.has_resource_limits ? 'configured' : 'partial',
          issues: ['Verificar limites de recursos'],
          recommendations: ['Definir LimitRange por namespace']
        },
        recommendations: ['Revisar configurações de segurança periodicamente'],
        summary: `Cluster com score de segurança ${securityScore}/100.`
      };
    }

    console.log(`🤖 Security analysis complete (tokens: ${aiResult.inputTokens}/${aiResult.outputTokens}, free tier: ${aiResult.isFreeTier})`);

    // Build final analysis
    const analysis = {
      has_rbac: deterministicFlags.has_rbac,
      rbac_details: { ...aiAnalysis.rbac_details, status: deterministicFlags.has_rbac ? 'configured' : 'missing' },
      has_network_policies: deterministicFlags.has_network_policies,
      network_policy_details: { ...aiAnalysis.network_policy_details, status: deterministicFlags.has_network_policies ? 'configured' : 'missing' },
      has_pod_security: deterministicFlags.has_pod_security,
      pod_security_details: { ...aiAnalysis.pod_security_details, status: deterministicFlags.has_pod_security ? 'configured' : 'partial' },
      has_secrets_encryption: deterministicFlags.has_secrets_encryption,
      secrets_details: { ...aiAnalysis.secrets_details, status: deterministicFlags.has_secrets_encryption ? 'configured' : 'missing' },
      has_resource_limits: deterministicFlags.has_resource_limits,
      resource_limits_details: { ...aiAnalysis.resource_limits_details, status: deterministicFlags.has_resource_limits ? 'configured' : 'partial' },
      security_score: securityScore,
      overall_status: overallStatus,
      recommendations: aiAnalysis.recommendations || [],
      summary: aiAnalysis.summary || 'Análise de segurança concluída.'
    };

    // Save to database
    const { data: scanResult, error: insertError } = await supabaseAdmin
      .from('cluster_security_scans')
      .insert({
        cluster_id,
        user_id: userId,
        has_rbac: analysis.has_rbac,
        rbac_details: analysis.rbac_details,
        has_network_policies: analysis.has_network_policies,
        network_policy_details: analysis.network_policy_details,
        has_pod_security: analysis.has_pod_security,
        pod_security_details: analysis.pod_security_details,
        has_secrets_encryption: analysis.has_secrets_encryption,
        secrets_details: analysis.secrets_details,
        has_resource_limits: analysis.has_resource_limits,
        resource_limits_details: analysis.resource_limits_details,
        security_score: analysis.security_score,
        recommendations: analysis.recommendations,
        status: analysis.overall_status,
        ai_analysis: { summary: analysis.summary, raw: analysis }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving security scan:', insertError);
      throw insertError;
    }

    console.log('Security scan saved:', scanResult.id);

    return new Response(JSON.stringify({
      ...analysis,
      scan_id: scanResult.id,
      ai_usage: {
        input_tokens: aiResult.inputTokens,
        output_tokens: aiResult.outputTokens,
        is_free_tier: aiResult.isFreeTier,
        estimated_cost: aiResult.estimatedCost
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-cluster-security:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
