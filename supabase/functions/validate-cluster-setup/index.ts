import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { cluster_id, config } = await req.json();

    if (!cluster_id || !config) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare prompt for AI analysis
    const prompt = `Você é um especialista em Kubernetes e infraestrutura cloud. Analise a configuração fornecida e determine:

1. Se o cluster tem storage configurado (PersistentVolumes, StorageClasses)
2. Se tem sistema de monitoramento (Prometheus, Grafana, etc)
3. Se tem Ingress Controller configurado
4. Quais funcionalidades estão disponíveis

Configuração do cluster:
Provider: ${config.provider}
Cluster Type: ${config.cluster_type}
Kubeconfig: ${config.kubeconfig ? 'Fornecido' : 'Não fornecido'}
Endpoint: ${config.api_endpoint}

Retorne sua análise em formato JSON com:
{
  "has_storage": boolean,
  "has_monitoring": boolean,
  "has_ingress": boolean,
  "available_features": string[],
  "recommendations": string,
  "validation_status": "success" | "warning" | "error"
}`;

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Call OpenAI for analysis
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise de clusters Kubernetes. Sempre responda em JSON válido.'
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
              name: 'analyze_cluster',
              description: 'Analisa a configuração do cluster e retorna as capacidades detectadas',
              parameters: {
                type: 'object',
                properties: {
                  has_storage: { type: 'boolean' },
                  has_monitoring: { type: 'boolean' },
                  has_ingress: { type: 'boolean' },
                  available_features: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  recommendations: { type: 'string' },
                  validation_status: {
                    type: 'string',
                    enum: ['success', 'warning', 'error']
                  }
                },
                required: ['has_storage', 'has_monitoring', 'has_ingress', 'available_features', 'recommendations', 'validation_status'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_cluster' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 401) {
        throw new Error('Invalid OpenAI API key.');
      }
      if (aiResponse.status === 402 || aiResponse.status === 403) {
        throw new Error('Insufficient OpenAI credits. Please add funds to your account.');
      }
      
      throw new Error(`Failed to analyze cluster: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    const analysis = toolCall ? JSON.parse(toolCall.function.arguments) : {
      has_storage: false,
      has_monitoring: false,
      has_ingress: false,
      available_features: ['basic-compute'],
      recommendations: 'Não foi possível analisar completamente o cluster. Configure storage e monitoramento para funcionalidades avançadas.',
      validation_status: 'warning'
    };

    // Save validation results to database
    const { error: insertError } = await supabaseClient
      .from('cluster_validation_results')
      .insert({
        cluster_id,
        has_storage: analysis.has_storage,
        has_monitoring: analysis.has_monitoring,
        has_ingress: analysis.has_ingress,
        available_features: analysis.available_features,
        recommendations: analysis.recommendations,
        validation_status: analysis.validation_status,
      });

    if (insertError) {
      console.error('Error saving validation results:', insertError);
      throw insertError;
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in validate-cluster-setup:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
