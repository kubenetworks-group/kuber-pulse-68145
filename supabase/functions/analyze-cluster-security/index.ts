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

    // DETERMINISTIC ANALYSIS - Calculate boolean flags based on actual data with fixed thresholds
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

      // RBAC: Consider configured if has cluster roles and role bindings
      const has_rbac = (data.rbac?.cluster_roles_count > 0 || data.rbac?.roles_count > 0) && 
                       (data.rbac?.cluster_role_bindings_count > 0 || data.rbac?.role_bindings_count > 0);

      // Network Policies: Consider configured if total_count > 0
      const has_network_policies = (data.network_policies?.total_count || 0) > 0;

      // Pod Security: Consider configured if >50% of pods have security context AND resource limits
      const totalPods = data.pod_security?.total_pods || 0;
      const podsWithContext = data.pod_security?.pods_with_security_context || 0;
      const podsWithLimits = data.pod_security?.pods_with_resource_limits || 0;
      const securityContextPercentage = totalPods > 0 ? (podsWithContext / totalPods) * 100 : 0;
      const has_pod_security = securityContextPercentage >= 50;

      // Secrets: Consider configured if secrets exist
      const has_secrets_encryption = (data.secrets?.total_count || 0) > 0;

      // Resource Limits: Consider configured if >50% of pods have limits
      const resourceLimitsPercentage = data.pod_security?.resource_limits_percentage || 
        (totalPods > 0 ? (podsWithLimits / totalPods) * 100 : 0);
      const has_resource_limits = resourceLimitsPercentage >= 50;

      return {
        has_rbac,
        has_network_policies,
        has_pod_security,
        has_secrets_encryption,
        has_resource_limits,
      };
    };

    const deterministicFlags = calculateDeterministicAnalysis(securityData);
    console.log('Deterministic analysis flags:', JSON.stringify(deterministicFlags));

    // Calculate security score deterministically
    const calculateSecurityScore = (flags: typeof deterministicFlags, data: any) => {
      let score = 0;
      
      // RBAC: 25 points
      if (flags.has_rbac) score += 25;
      
      // Network Policies: 20 points
      if (flags.has_network_policies) score += 20;
      
      // Pod Security: 20 points
      if (flags.has_pod_security) score += 20;
      
      // Secrets: 15 points
      if (flags.has_secrets_encryption) score += 15;
      
      // Resource Limits: 20 points
      if (flags.has_resource_limits) score += 20;
      
      return Math.min(100, Math.max(0, score));
    };

    const securityScore = calculateSecurityScore(deterministicFlags, securityData);
    const overallStatus = securityScore >= 80 ? 'passed' : securityScore >= 50 ? 'warning' : 'failed';

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

    // Format ingress controller info
    const formatIngressController = (icData: any) => {
      if (!icData || !icData.detected) return 'Nenhum Ingress Controller detectado';
      
      return `Tipo: ${icData.type || 'desconhecido'}
Detectado: ${icData.detected ? 'SIM' : 'NÃO'}
Namespace: ${icData.namespace || 'N/A'}
Deployment: ${icData.deployment_name || 'N/A'}
Service Account: ${icData.service_account || 'N/A'}
Versão/Imagem: ${icData.version || 'N/A'}
RBAC configurado: ${icData.has_rbac ? 'SIM' : 'NÃO'}
${icData.rbac_details?.cluster_role ? `ClusterRole: ${icData.rbac_details.cluster_role}` : ''}
${icData.rbac_details?.cluster_role_binding ? `ClusterRoleBinding: ${icData.rbac_details.cluster_role_binding}` : ''}
${icData.rbac_details?.missing_permissions?.length > 0 ? `⚠️ Permissões faltando: ${icData.rbac_details.missing_permissions.join(', ')}` : '✅ Todas as permissões necessárias estão configuradas'}
${icData.rbac_details?.warnings?.length > 0 ? `⚠️ Avisos: ${icData.rbac_details.warnings.join(', ')}` : ''}`;
    };

    // Prepare prompt for AI - only for recommendations and details, not boolean flags
    const prompt = `Você é um especialista em segurança Kubernetes. Os dados abaixo foram analisados e os status já foram determinados.

IMPORTANTE: NÃO ALTERE os valores booleanos já definidos. Forneça SEMPRE detalhes completos, issues e recomendações para CADA área, mesmo quando está configurado corretamente.

Cluster: ${cluster.name} (${cluster.provider}, ${cluster.environment})
Nodes: ${cluster.nodes || 0} | Pods: ${cluster.pods || 0}

=== ANÁLISE DETERMINÍSTICA (JÁ CALCULADA - NÃO ALTERAR) ===
- has_rbac: ${deterministicFlags.has_rbac}
- has_network_policies: ${deterministicFlags.has_network_policies}
- has_pod_security: ${deterministicFlags.has_pod_security}
- has_secrets_encryption: ${deterministicFlags.has_secrets_encryption}
- has_resource_limits: ${deterministicFlags.has_resource_limits}
- security_score: ${securityScore}
- overall_status: ${overallStatus}

${securityData ? `
=== DADOS BRUTOS DO CLUSTER ===

📋 RBAC:
- Cluster Roles: ${securityData.rbac?.cluster_roles_count || 0}
- Cluster Role Bindings: ${securityData.rbac?.cluster_role_bindings_count || 0}
- Roles: ${securityData.rbac?.roles_count || 0}
- Role Bindings: ${securityData.rbac?.role_bindings_count || 0}
${securityData.rbac?.service_accounts ? `- Service Accounts: ${JSON.stringify(securityData.rbac.service_accounts)}` : ''}

🌐 INGRESS CONTROLLER:
${formatIngressController(securityData.ingress_controller)}

🔒 NETWORK POLICIES:
${formatNetworkPolicies(securityData.network_policies)}
${securityData.network_policies?.policies ? `- Políticas existentes: ${JSON.stringify(securityData.network_policies.policies)}` : ''}

🛡️ POD SECURITY:
- Total de Pods: ${securityData.pod_security?.total_pods || 0}
- Pods com Security Context: ${securityData.pod_security?.pods_with_security_context || 0}/${securityData.pod_security?.total_pods || 0} (${securityData.pod_security?.total_pods > 0 ? Math.round((securityData.pod_security?.pods_with_security_context / securityData.pod_security?.total_pods) * 100) : 0}%)
- Pods com Resource Limits: ${securityData.pod_security?.pods_with_resource_limits || 0}/${securityData.pod_security?.total_pods || 0} (${securityData.pod_security?.total_pods > 0 ? Math.round((securityData.pod_security?.pods_with_resource_limits / securityData.pod_security?.total_pods) * 100) : 0}%)
- Containers privilegiados: ${securityData.pod_security?.privileged_containers || 0}
- Pods rodando como root: ${securityData.pod_security?.pods_running_as_root || 0}
- Pods com host network: ${securityData.pod_security?.pods_with_host_network || 0}
- Pods com host PID: ${securityData.pod_security?.pods_with_host_pid || 0}

🔐 SECRETS:
- Total de Secrets: ${securityData.secrets?.total_count || 0}
- Tipos de secrets: ${securityData.secrets?.types ? JSON.stringify(securityData.secrets.types) : 'N/A'}
` : 'Dados de segurança não disponíveis do agente. Instale o agente para análise completa.'}

=== INSTRUÇÕES PARA A RESPOSTA ===

Para CADA área de segurança, forneça:

1. **rbac_details**:
   - issues: Liste o que está configurado (ex: "X ClusterRoles configurados", "Y RoleBindings ativos") E pontos de atenção
   - recommendations: Boas práticas para melhorar (ex: "Revisar permissões excessivas", "Implementar least privilege")

2. **network_policy_details**:
   - issues: Descreva a situação atual (ex: "X NetworkPolicies em Y namespaces") E gaps encontrados
   - recommendations: Melhorias sugeridas (ex: "Implementar default deny", "Adicionar egress policies")

3. **pod_security_details**:
   - issues: Status atual (ex: "X% dos pods tem security context") E problemas encontrados
   - recommendations: Ações para melhorar (ex: "Remover containers privilegiados", "Implementar readOnlyRootFilesystem")

4. **secrets_details**:
   - issues: Situação atual dos secrets E pontos de atenção
   - recommendations: Melhorias (ex: "Usar external secrets", "Rotacionar secrets regularmente")

5. **resource_limits_details**:
   - issues: Status atual (ex: "X% dos pods tem limits definidos") E problemas
   - recommendations: Ações (ex: "Definir LimitRange por namespace", "Ajustar requests vs limits")

6. **recommendations**: Lista de 5-7 recomendações prioritárias gerais, ordenadas por importância

7. **summary**: Resumo executivo de 2-3 frases sobre a postura de segurança do cluster

IMPORTANTE:
- SEMPRE forneça pelo menos 2 items em issues e 2 em recommendations para CADA área
- Mesmo quando algo está OK, mencione o que está bom E o que pode melhorar
- Use EXATAMENTE os valores booleanos e scores já definidos acima
- Responda em português`;

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
    
    let aiAnalysis;
    if (toolCall?.function?.arguments) {
      aiAnalysis = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback com informações baseadas nos dados determinísticos
      const rbacCount = securityData?.rbac?.cluster_roles_count || 0;
      const npCount = securityData?.network_policies?.total_count || 0;
      const totalPods = securityData?.pod_security?.total_pods || 0;
      const podsWithContext = securityData?.pod_security?.pods_with_security_context || 0;
      const podsWithLimits = securityData?.pod_security?.pods_with_resource_limits || 0;
      const secretsCount = securityData?.secrets?.total_count || 0;

      aiAnalysis = {
        rbac_details: {
          status: deterministicFlags.has_rbac ? 'configured' : 'missing',
          issues: deterministicFlags.has_rbac
            ? [`${rbacCount} ClusterRoles configurados`, `RBAC está ativo no cluster`]
            : ['RBAC não detectado ou não configurado', 'Sem controle de acesso baseado em roles'],
          recommendations: [
            'Revisar permissões de ClusterRoles periodicamente',
            'Implementar princípio de least privilege',
            'Auditar role bindings regularmente'
          ]
        },
        network_policy_details: {
          status: deterministicFlags.has_network_policies ? 'configured' : 'missing',
          issues: deterministicFlags.has_network_policies
            ? [`${npCount} NetworkPolicies configuradas`, 'Isolamento de rede ativo']
            : ['Nenhuma NetworkPolicy encontrada', 'Pods podem se comunicar livremente'],
          recommendations: [
            'Implementar default deny para ingress e egress',
            'Criar políticas específicas por namespace',
            'Documentar fluxos de rede permitidos'
          ]
        },
        pod_security_details: {
          status: deterministicFlags.has_pod_security ? 'configured' : 'partial',
          issues: [
            `${podsWithContext}/${totalPods} pods com Security Context (${totalPods > 0 ? Math.round((podsWithContext/totalPods)*100) : 0}%)`,
            `${securityData?.pod_security?.privileged_containers || 0} containers privilegiados detectados`
          ],
          recommendations: [
            'Remover containers privilegiados quando possível',
            'Implementar readOnlyRootFilesystem',
            'Definir runAsNonRoot para todos os pods'
          ]
        },
        secrets_details: {
          status: deterministicFlags.has_secrets_encryption ? 'configured' : 'missing',
          issues: deterministicFlags.has_secrets_encryption
            ? [`${secretsCount} secrets armazenados no cluster`, 'Secrets configurados']
            : ['Nenhum secret encontrado', 'Verificar configuração de secrets'],
          recommendations: [
            'Usar external secrets operator para secrets sensíveis',
            'Implementar rotação automática de secrets',
            'Habilitar encryption at rest para secrets'
          ]
        },
        resource_limits_details: {
          status: deterministicFlags.has_resource_limits ? 'configured' : 'partial',
          issues: [
            `${podsWithLimits}/${totalPods} pods com Resource Limits (${totalPods > 0 ? Math.round((podsWithLimits/totalPods)*100) : 0}%)`,
            deterministicFlags.has_resource_limits ? 'Limites de recursos configurados' : 'Muitos pods sem limites definidos'
          ],
          recommendations: [
            'Definir LimitRange em todos os namespaces',
            'Configurar ResourceQuotas por namespace',
            'Ajustar requests e limits baseado em métricas reais'
          ]
        },
        recommendations: [
          'Revisar e auditar configurações de RBAC',
          'Implementar NetworkPolicies em todos os namespaces',
          'Remover containers privilegiados',
          'Configurar Pod Security Standards',
          'Definir resource limits para todos os pods',
          'Implementar rotação de secrets',
          'Habilitar audit logging'
        ],
        summary: `Cluster com score de segurança ${securityScore}/100. ${
          securityScore >= 80 ? 'Boa postura de segurança com pequenas melhorias recomendadas.' :
          securityScore >= 50 ? 'Postura de segurança moderada. Algumas áreas precisam de atenção.' :
          'Postura de segurança precisa de melhorias significativas.'
        }`
      };
    }

    // OVERRIDE AI boolean values with deterministic values - this ensures consistency
    const analysis = {
      has_rbac: deterministicFlags.has_rbac,
      rbac_details: {
        ...aiAnalysis.rbac_details,
        status: deterministicFlags.has_rbac ? 'configured' : 'missing'
      },
      has_network_policies: deterministicFlags.has_network_policies,
      network_policy_details: {
        ...aiAnalysis.network_policy_details,
        status: deterministicFlags.has_network_policies ? 'configured' : 'missing'
      },
      has_pod_security: deterministicFlags.has_pod_security,
      pod_security_details: {
        ...aiAnalysis.pod_security_details,
        status: deterministicFlags.has_pod_security ? 'configured' : 'partial'
      },
      has_secrets_encryption: deterministicFlags.has_secrets_encryption,
      secrets_details: {
        ...aiAnalysis.secrets_details,
        status: deterministicFlags.has_secrets_encryption ? 'configured' : 'missing'
      },
      has_resource_limits: deterministicFlags.has_resource_limits,
      resource_limits_details: {
        ...aiAnalysis.resource_limits_details,
        status: deterministicFlags.has_resource_limits ? 'configured' : 'partial'
      },
      security_score: securityScore,
      overall_status: overallStatus,
      recommendations: aiAnalysis.recommendations || [],
      summary: aiAnalysis.summary || 'Análise de segurança concluída.'
    };

    console.log('Final analysis with deterministic flags:', JSON.stringify({
      has_rbac: analysis.has_rbac,
      has_network_policies: analysis.has_network_policies,
      has_pod_security: analysis.has_pod_security,
      has_secrets_encryption: analysis.has_secrets_encryption,
      has_resource_limits: analysis.has_resource_limits,
      security_score: analysis.security_score,
      overall_status: analysis.overall_status
    }));

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
