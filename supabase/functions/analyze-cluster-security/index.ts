import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
    
    // Decode the payload (second part)
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
    // Extract user ID from the validated JWT (verify_jwt = true ensures it's valid)
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

    // Use service role key for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    const { cluster_id } = body;

    if (!cluster_id) {
      console.log('Missing cluster_id');
      return new Response(JSON.stringify({ error: 'Missing cluster_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch cluster info - verify user owns this cluster
    const { data: cluster, error: clusterError } = await supabaseAdmin
      .from('clusters')
      .select('*')
      .eq('id', cluster_id)
      .eq('user_id', userId)
      .single();

    if (clusterError || !cluster) {
      console.log('Cluster not found or not owned by user:', clusterError);
      return new Response(JSON.stringify({ error: 'Cluster not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch latest metrics to analyze
    const { data: metrics } = await supabaseAdmin
      .from('agent_metrics')
      .select('metric_type, metric_data')
      .eq('cluster_id', cluster_id)
      .order('collected_at', { ascending: false })
      .limit(10);

    const metricsContext = metrics?.map(m => ({
      type: m.metric_type,
      sample: JSON.stringify(m.metric_data).substring(0, 500)
    })) || [];

    // Buscar dados de segurança coletados pelo agente
    const { data: securityMetric } = await supabaseAdmin
      .from('agent_metrics')
      .select('metric_data')
      .eq('cluster_id', cluster_id)
      .eq('metric_type', 'security')
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const securityData = securityMetric?.metric_data as any || null;
    console.log('Security data from agent:', securityData ? JSON.stringify(securityData) : 'Not available');

    // Format network policies info with namespace details
    const formatNetworkPolicies = (npData: any) => {
      if (!npData) return 'Dados não disponíveis';
      const totalCount = npData.total_count || 0;
      const namespacesWithPolicies = npData.namespaces_with_policies || 0;
      const hasNetPolicies = npData.has_network_policies || false;
      
      return `Total de NetworkPolicies: ${totalCount}
Namespaces com políticas: ${namespacesWithPolicies}
NetworkPolicies configuradas: ${hasNetPolicies ? 'SIM' : 'NÃO'}
IMPORTANTE: ${totalCount > 0 
  ? `Existem ${totalCount} NetworkPolicies distribuídas em ${namespacesWithPolicies} namespace(s). Isso significa que o cluster TEM políticas de rede configuradas.`
  : 'Nenhuma NetworkPolicy encontrada em nenhum namespace.'}`;
    };

    // Prepare prompt for AI security analysis with real data
    const prompt = `Você é um especialista em segurança Kubernetes. Analise os dados REAIS coletados do cluster.

IMPORTANTE: Os dados foram coletados de TODOS os namespaces do cluster. Analise considerando o cluster inteiro.

Cluster: ${cluster.name} (${cluster.provider}, ${cluster.environment})
Nodes: ${cluster.nodes || 0} | Pods: ${cluster.pods || 0}

${securityData ? `
=== DADOS REAIS DO CLUSTER (COLETADOS DE TODOS OS NAMESPACES) ===

📋 RBAC (Role-Based Access Control):
- Cluster Roles: ${securityData.rbac?.cluster_roles_count || 0}
- Cluster Role Bindings: ${securityData.rbac?.cluster_role_bindings_count || 0}
- Roles (todos namespaces): ${securityData.rbac?.roles_count || 0}
- Role Bindings (todos namespaces): ${securityData.rbac?.role_bindings_count || 0}
- RBAC configurado: ${securityData.rbac?.has_rbac ? 'SIM' : 'NÃO'}

🔒 NETWORK POLICIES (Coletadas de TODOS os namespaces):
${formatNetworkPolicies(securityData.network_policies)}

🔐 SECRETS (Coletados de TODOS os namespaces):
- Total de Secrets: ${securityData.secrets?.total_count || 0}
- Tipos de Secrets: ${JSON.stringify(securityData.secrets?.types || {})}
- Secrets existem: ${securityData.secrets?.has_secrets ? 'SIM' : 'NÃO'}

📊 RESOURCE QUOTAS (Todos namespaces):
- Total: ${securityData.resource_quotas?.total_count || 0}
- Configurados: ${securityData.resource_quotas?.has_quotas ? 'SIM' : 'NÃO'}

📏 LIMIT RANGES (Todos namespaces):
- Total: ${securityData.limit_ranges?.total_count || 0}
- Configurados: ${securityData.limit_ranges?.has_limit_ranges ? 'SIM' : 'NÃO'}

🛡️ POD SECURITY (Análise de todos os pods):
- Pods com Security Context: ${securityData.pod_security?.pods_with_security_context || 0}
- Pods rodando como non-root: ${securityData.pod_security?.pods_running_as_non_root || 0}
- Pods com Resource Limits: ${securityData.pod_security?.pods_with_resource_limits || 0}
- Containers privilegiados: ${securityData.pod_security?.privileged_containers || 0}
- Total de Pods analisados: ${securityData.pod_security?.total_pods || 0}
` : `
ATENÇÃO: Dados de segurança não disponíveis. O agente pode não estar instalado ou atualizado.
Métricas disponíveis:
${metricsContext.map(m => `- ${m.type}: ${m.sample}`).join('\n')}
`}

Baseado nesses dados${securityData ? ' REAIS' : ''}, avalie:
1. RBAC - está configurado adequadamente? (verifique cluster roles e bindings)
2. NetworkPolicies - SE total_count > 0, EXISTEM políticas de rede! Avalie se a cobertura é adequada.
3. Pod Security - containers têm security context e limits?
4. Secrets - existem secrets configurados? (verifique tipos)
5. Resource Limits - pods têm limits definidos?

CRITÉRIO IMPORTANTE PARA NETWORK POLICIES:
- Se total_count > 0, marque has_network_policies como TRUE
- Se namespaces_with_policies > 0, as políticas existem e estão sendo usadas
- Avalie se a cobertura é parcial (poucos namespaces) ou completa

Retorne a análise com scores baseados nos dados${securityData ? ' reais' : ''} acima.
Considere que este é um cluster ${cluster.environment}.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Calling Lovable AI for security analysis...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em segurança Kubernetes. Analise clusters e retorne avaliações de segurança estruturadas. Sempre responda em português.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'security_analysis',
              description: 'Retorna análise de segurança do cluster Kubernetes',
              parameters: {
                type: 'object',
                properties: {
                  has_rbac: { 
                    type: 'boolean',
                    description: 'Se RBAC está configurado adequadamente'
                  },
                  rbac_details: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['configured', 'partial', 'missing'] },
                      issues: { type: 'array', items: { type: 'string' } },
                      recommendations: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  has_network_policies: { 
                    type: 'boolean',
                    description: 'Se NetworkPolicies estão configuradas'
                  },
                  network_policy_details: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['configured', 'partial', 'missing'] },
                      issues: { type: 'array', items: { type: 'string' } },
                      recommendations: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  has_pod_security: { 
                    type: 'boolean',
                    description: 'Se Pod Security está configurado'
                  },
                  pod_security_details: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['configured', 'partial', 'missing'] },
                      issues: { type: 'array', items: { type: 'string' } },
                      recommendations: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  has_secrets_encryption: { 
                    type: 'boolean',
                    description: 'Se secrets estão encriptados'
                  },
                  secrets_details: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['configured', 'partial', 'missing'] },
                      issues: { type: 'array', items: { type: 'string' } },
                      recommendations: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  has_resource_limits: { 
                    type: 'boolean',
                    description: 'Se resource limits estão definidos'
                  },
                  resource_limits_details: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['configured', 'partial', 'missing'] },
                      issues: { type: 'array', items: { type: 'string' } },
                      recommendations: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  security_score: {
                    type: 'integer',
                    description: 'Score de segurança de 0 a 100'
                  },
                  overall_status: {
                    type: 'string',
                    enum: ['passed', 'warning', 'failed'],
                    description: 'Status geral da análise'
                  },
                  recommendations: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Lista de recomendações prioritárias'
                  },
                  summary: {
                    type: 'string',
                    description: 'Resumo executivo da análise'
                  }
                },
                required: ['has_rbac', 'has_network_policies', 'has_pod_security', 'has_secrets_encryption', 'has_resource_limits', 'security_score', 'overall_status', 'recommendations', 'summary']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'security_analysis' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add funds to your account.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI analysis failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received:', JSON.stringify(aiData).substring(0, 500));

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let analysis;
    if (toolCall?.function?.arguments) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback analysis
      analysis = {
        has_rbac: false,
        rbac_details: { status: 'missing', issues: ['Não foi possível verificar RBAC'], recommendations: ['Configure RBAC no cluster'] },
        has_network_policies: false,
        network_policy_details: { status: 'missing', issues: ['NetworkPolicies não detectadas'], recommendations: ['Implemente NetworkPolicies'] },
        has_pod_security: false,
        pod_security_details: { status: 'missing', issues: ['Pod Security não configurado'], recommendations: ['Configure Pod Security Standards'] },
        has_secrets_encryption: false,
        secrets_details: { status: 'missing', issues: ['Encriptação de secrets não verificada'], recommendations: ['Habilite encryption at rest'] },
        has_resource_limits: false,
        resource_limits_details: { status: 'missing', issues: ['Resource limits não definidos'], recommendations: ['Defina limits e requests para pods'] },
        security_score: 20,
        overall_status: 'warning',
        recommendations: ['Execute uma análise completa com o agente instalado'],
        summary: 'Análise preliminar. Instale o agente Kuberpulse para uma análise completa de segurança.'
      };
    }

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
      scan_id: scanResult.id
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
