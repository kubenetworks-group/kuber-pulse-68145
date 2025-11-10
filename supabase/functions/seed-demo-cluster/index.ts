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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create demo organization
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .insert({
        user_id: user.id,
        company_name: 'Empresa Demo Ltda',
        cnpj: '12.345.678/0001-90',
        onboarding_completed: false,
      })
      .select()
      .single();

    if (orgError && orgError.code !== '23505') { // Ignore duplicate key error
      console.error('Error creating organization:', orgError);
    }

    // Create demo cluster with test configuration
    const demoConfig = {
      apiVersion: "v1",
      kind: "Config",
      clusters: [
        {
          name: "demo-cluster",
          cluster: {
            server: "https://demo-k8s.example.com:6443",
            "certificate-authority-data": "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURCVENDQWUyZ0F3SUJBZ0lJRGVtbw=="
          }
        }
      ],
      contexts: [
        {
          name: "demo-context",
          context: {
            cluster: "demo-cluster",
            user: "demo-user"
          }
        }
      ],
      "current-context": "demo-context",
      users: [
        {
          name: "demo-user",
          user: {
            token: "demo-token-12345"
          }
        }
      ]
    };

    const { data: cluster, error: clusterError } = await supabaseClient
      .from('clusters')
      .insert({
        user_id: user.id,
        name: 'Cluster de Teste AWS',
        cluster_type: 'kubernetes',
        provider: 'aws',
        environment: 'development',
        region: 'us-east-1',
        api_endpoint: 'https://demo-k8s.example.com:6443',
        config_file: JSON.stringify(demoConfig),
        status: 'connecting',
        nodes: 3,
        pods: 15,
        cpu_usage: 45.5,
        memory_usage: 62.3,
        storage_used_gb: 120,
        storage_total_gb: 500,
        storage_available_gb: 380,
        monthly_cost: 450.00,
      })
      .select()
      .single();

    if (clusterError) {
      console.error('Error creating cluster:', clusterError);
      return new Response(JSON.stringify({ error: clusterError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create validation result
    const { error: validationError } = await supabaseClient
      .from('cluster_validation_results')
      .insert({
        cluster_id: cluster.id,
        has_storage: true,
        has_monitoring: true,
        has_ingress: false,
        available_features: {
          storage: ['ebs', 'efs'],
          monitoring: ['cloudwatch', 'prometheus'],
          ingress: []
        },
        validation_status: 'completed',
        recommendations: 'Cluster configurado com storage EBS e EFS. Recomenda-se adicionar um ingress controller como nginx-ingress ou AWS Load Balancer Controller para expor aplicações.'
      });

    if (validationError) {
      console.error('Error creating validation:', validationError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cluster: cluster,
        message: 'Cluster de teste criado com sucesso! Você pode usar este cluster para testar o fluxo de onboarding.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in seed-demo-cluster:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
