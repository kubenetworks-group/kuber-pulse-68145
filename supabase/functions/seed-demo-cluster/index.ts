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

    // Create or update demo organization
    const { error: orgError } = await supabaseClient
      .from('organizations')
      .upsert({
        user_id: user.id,
        company_name: 'Empresa Demo Ltda',
        cnpj: '12.345.678/0001-90',
        onboarding_completed: false,
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

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

    // Create demo anomalies
    const demoAnomalies = [
      {
        cluster_id: cluster.id,
        user_id: user.id,
        anomaly_type: 'pod_restart',
        severity: 'high',
        description: 'Pod nginx-deployment-7c8f9d6b-xyz reiniciou 5 vezes nos últimos 15 minutos devido a erros de OOMKilled',
        recommendation: 'Aumente o limite de memória do container de 256Mi para 512Mi no deployment',
        ai_analysis: {
          root_cause: 'Container excedendo limite de memória configurado',
          impact: 'Serviço intermitente, possível perda de requisições durante reinícios',
          confidence: 0.92
        },
        resolved: false,
        auto_heal_applied: false
      },
      {
        cluster_id: cluster.id,
        user_id: user.id,
        anomaly_type: 'high_cpu',
        severity: 'medium',
        description: 'Node worker-1 com uso de CPU acima de 85% nos últimos 30 minutos',
        recommendation: 'Considere adicionar mais réplicas do deployment ou habilitar HPA (Horizontal Pod Autoscaler)',
        ai_analysis: {
          root_cause: 'Carga de trabalho elevada sem auto-scaling configurado',
          impact: 'Possível degradação de performance e latência aumentada',
          confidence: 0.87
        },
        resolved: false,
        auto_heal_applied: false
      },
      {
        cluster_id: cluster.id,
        user_id: user.id,
        anomaly_type: 'image_pull_error',
        severity: 'critical',
        description: 'Pod api-service-abc123 não consegue fazer pull da imagem myregistry.io/api:v2.1.0 - ImagePullBackOff',
        recommendation: 'Verifique se o registry está acessível e se as credenciais do ImagePullSecret estão corretas',
        ai_analysis: {
          root_cause: 'Credenciais de registro expiradas ou imagem não existe',
          impact: 'Deploy bloqueado, novas instâncias não conseguem iniciar',
          confidence: 0.95
        },
        resolved: false,
        auto_heal_applied: false
      }
    ];

    const { error: anomaliesError } = await supabaseClient
      .from('agent_anomalies')
      .insert(demoAnomalies);

    if (anomaliesError) {
      console.error('Error creating demo anomalies:', anomaliesError);
    }

    // Create demo incidents
    const demoIncidents = [
      {
        cluster_id: cluster.id,
        user_id: user.id,
        incident_type: 'pod_restart',
        severity: 'high',
        title: 'POD CRASH: default/nginx-deployment-7c8f9d6b',
        description: 'Container crashando repetidamente por falta de memória (OOMKilled). Afeta disponibilidade do serviço.',
        ai_analysis: {
          root_cause: 'Container está excedendo o limite de memória configurado (256Mi). O processo nginx está consumindo mais memória que o esperado, possivelmente devido a cache ou conexões persistentes.',
          impact: 'Alta disponibilidade comprometida. Usuários podem experimentar erros 502/503 durante os reinícios.',
          recommendation: 'Aumentar o limite de memória do container para 512Mi e configurar requests adequados. Considere também revisar a configuração do nginx para limitar o cache.',
          confidence: 0.92
        },
        auto_heal_action: 'scale_up_resources',
        action_taken: false,
        action_result: null
      },
      {
        cluster_id: cluster.id,
        user_id: user.id,
        incident_type: 'scheduling_issue',
        severity: 'medium',
        title: 'POD PENDING: kube-system/coredns-78fcd69978',
        description: 'Pod do CoreDNS não consegue ser agendado há mais de 10 minutos. DNS do cluster pode estar afetado.',
        ai_analysis: {
          root_cause: 'Recursos insuficientes nos nodes. Todos os nodes estão com alta utilização de CPU ou memória.',
          impact: 'Resolução DNS do cluster degradada. Novos pods podem ter problemas para iniciar.',
          recommendation: 'Adicionar um novo node ao cluster ou aumentar os recursos dos nodes existentes. Alternativamente, reduza o número de réplicas de outros deployments.',
          confidence: 0.88
        },
        auto_heal_action: 'scale_cluster',
        action_taken: false,
        action_result: null
      }
    ];

    const { error: incidentsError } = await supabaseClient
      .from('ai_incidents')
      .insert(demoIncidents);

    if (incidentsError) {
      console.error('Error creating demo incidents:', incidentsError);
    }

    // Create scan history entry
    const { error: scanError } = await supabaseClient
      .from('scan_history')
      .insert({
        cluster_id: cluster.id,
        user_id: user.id,
        anomalies_found: demoAnomalies.length,
        summary: 'Análise automática detectou 3 anomalias: 1 crítica (ImagePullBackOff), 1 alta (OOMKilled) e 1 média (alto uso de CPU). Recomendações de correção foram geradas.',
        anomalies_data: demoAnomalies.map(a => ({
          type: a.anomaly_type,
          severity: a.severity,
          description: a.description
        }))
      });

    if (scanError) {
      console.error('Error creating scan history:', scanError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cluster: cluster,
        message: 'Cluster de teste criado com sucesso! Inclui anomalias e incidentes de exemplo para demonstração.',
        demo_data: {
          anomalies: demoAnomalies.length,
          incidents: demoIncidents.length
        }
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
