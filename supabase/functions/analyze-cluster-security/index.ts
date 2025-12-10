import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('analyze-cluster-security called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Creating Supabase client...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    console.log('Getting user...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) {
      console.error('User error:', userError);
    }
    if (!user) {
      console.log('No user found');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('User authenticated:', user.id);

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

    // Fetch cluster info
    const { data: cluster, error: clusterError } = await supabaseClient
      .from('clusters')
      .select('*')
      .eq('id', cluster_id)
      .single();

    if (clusterError || !cluster) {
      return new Response(JSON.stringify({ error: 'Cluster not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch latest metrics to analyze
    const { data: metrics } = await supabaseClient
      .from('agent_metrics')
      .select('metric_type, metric_data')
      .eq('cluster_id', cluster_id)
      .order('collected_at', { ascending: false })
      .limit(10);

    const metricsContext = metrics?.map(m => ({
      type: m.metric_type,
      sample: JSON.stringify(m.metric_data).substring(0, 500)
    })) || [];

    // Prepare prompt for AI security analysis
    const prompt = `Você é um especialista em segurança Kubernetes. Analise a configuração do cluster e retorne uma avaliação de segurança detalhada.

Informações do Cluster:
- Nome: ${cluster.name}
- Provider: ${cluster.provider}
- Tipo: ${cluster.cluster_type}
- Ambiente: ${cluster.environment}
- Nodes: ${cluster.nodes || 0}
- Pods: ${cluster.pods || 0}

Métricas coletadas:
${metricsContext.map(m => `- ${m.type}: ${m.sample}`).join('\n')}

Analise os seguintes aspectos de segurança:

1. **RBAC (Role-Based Access Control)**
   - Verifique se há roles e rolebindings configurados
   - Analise se o princípio de menor privilégio está sendo aplicado
   
2. **Network Policies**
   - Verifique se existem NetworkPolicies para isolar workloads
   - Analise se há políticas de ingress/egress definidas

3. **Pod Security**
   - Verifique se há Pod Security Standards/Policies
   - Analise se containers rodam como non-root
   - Verifique security contexts

4. **Secrets Management**
   - Verifique se secrets estão encriptados em repouso
   - Analise práticas de gerenciamento de secrets

5. **Resource Limits**
   - Verifique se há limits e requests definidos
   - Analise LimitRanges e ResourceQuotas

Retorne sua análise considerando que este é um cluster ${cluster.environment} em produção.`;

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
    const { data: scanResult, error: insertError } = await supabaseClient
      .from('cluster_security_scans')
      .insert({
        cluster_id,
        user_id: user.id,
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
