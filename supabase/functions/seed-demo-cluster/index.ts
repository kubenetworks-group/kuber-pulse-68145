import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildDemoAgentMetrics(clusterId: string) {
  const now = new Date().toISOString();

  const nodesCpuCapacity  = 4000; // 4 cores per node in millicores
  const nodesMemCapacity  = 16 * 1024 * 1024 * 1024; // 16 GB per node

  const nodesData = {
    nodes: [
      {
        name: "demo-control-plane",
        status: "Ready",
        osImage: "Ubuntu 22.04.3 LTS",
        kernelVersion: "5.15.0-91-generic",
        containerRuntime: "containerd://1.7.2",
        labels: {
          "kubernetes.io/hostname": "demo-control-plane",
          "node-role.kubernetes.io/control-plane": "true",
          "beta.kubernetes.io/instance-type": "t3.large",
        },
        capacity: { cpu: nodesCpuCapacity, memory: nodesMemCapacity },
        usage:    { cpu: Math.round(nodesCpuCapacity * 0.25), memory: Math.round(nodesMemCapacity * 0.35) },
      },
      {
        name: "demo-worker-1",
        status: "Ready",
        osImage: "Ubuntu 22.04.3 LTS",
        kernelVersion: "5.15.0-91-generic",
        containerRuntime: "containerd://1.7.2",
        labels: {
          "kubernetes.io/hostname": "demo-worker-1",
          "beta.kubernetes.io/instance-type": "t3.xlarge",
        },
        capacity: { cpu: nodesCpuCapacity, memory: nodesMemCapacity },
        usage:    { cpu: Math.round(nodesCpuCapacity * 0.50), memory: Math.round(nodesMemCapacity * 0.65) },
      },
      {
        name: "demo-worker-2",
        status: "Ready",
        osImage: "Ubuntu 22.04.3 LTS",
        kernelVersion: "5.15.0-91-generic",
        containerRuntime: "containerd://1.7.2",
        labels: {
          "kubernetes.io/hostname": "demo-worker-2",
          "beta.kubernetes.io/instance-type": "t3.xlarge",
        },
        capacity: { cpu: nodesCpuCapacity, memory: nodesMemCapacity },
        usage:    { cpu: Math.round(nodesCpuCapacity * 0.45), memory: Math.round(nodesMemCapacity * 0.62) },
      },
    ],
  };

  const podsList = [
    { name: "nginx-deployment-7c8f9d6b-abc",   namespace: "default",    phase: "Running", restarts: 5,  cpu: "180m", memory: "220Mi" },
    { name: "api-service-65b9f-xyz",            namespace: "default",    phase: "Running", restarts: 0,  cpu: "90m",  memory: "150Mi" },
    { name: "coredns-78fcd69978-kube1",         namespace: "kube-system",phase: "Pending", restarts: 0,  cpu: "5m",   memory: "30Mi"  },
    { name: "kube-proxy-d9abc",                 namespace: "kube-system",phase: "Running", restarts: 0,  cpu: "3m",   memory: "20Mi"  },
    { name: "metrics-server-5d9bfbc-1",         namespace: "kube-system",phase: "Running", restarts: 0,  cpu: "15m",  memory: "60Mi"  },
    { name: "prometheus-server-abc123",         namespace: "monitoring", phase: "Running", restarts: 1,  cpu: "250m", memory: "400Mi" },
    { name: "grafana-7f8b9c-def",              namespace: "monitoring", phase: "Running", restarts: 0,  cpu: "50m",  memory: "80Mi"  },
    { name: "payment-svc-crashed-abc",          namespace: "production", phase: "Failed",  restarts: 12, cpu: "0m",   memory: "0Mi"   },
    { name: "auth-service-5c4d-ef1",            namespace: "production", phase: "Running", restarts: 2,  cpu: "120m", memory: "180Mi" },
    { name: "user-service-8a7b-g23",            namespace: "production", phase: "Running", restarts: 0,  cpu: "80m",  memory: "120Mi" },
    { name: "nginx-ingress-ctrl-h45",           namespace: "ingress-nginx", phase: "Running", restarts: 0, cpu: "40m", memory: "90Mi" },
    { name: "cert-manager-i67",                 namespace: "cert-manager", phase: "Running", restarts: 0, cpu: "10m", memory: "40Mi"  },
    { name: "background-worker-j89-abc",        namespace: "default",    phase: "Running", restarts: 3,  cpu: "200m", memory: "300Mi" },
    { name: "scheduler-k01-xyz",               namespace: "default",    phase: "Running", restarts: 1,  cpu: "60m",  memory: "100Mi" },
    { name: "cache-warmer-l23-def",            namespace: "staging",    phase: "Running", restarts: 0,  cpu: "30m",  memory: "50Mi"  },
  ];

  const podsWithContainers = podsList.map(p => ({
    ...p,
    node: p.namespace === "kube-system" ? "demo-control-plane" : "demo-worker-" + randInt(1, 2),
    containers: [{
      name:          p.name.split("-")[0],
      restart_count: p.restarts,
      resources: p.restarts > 8 ? {} : {
        limits:   { cpu: "500m", memory: "512Mi" },
        requests: { cpu: "50m",  memory: "128Mi" },
      },
      readiness_probe: p.restarts > 8 ? undefined : { http_get: { path: "/health", port: 8080 } },
      liveness_probe:  p.restarts > 8 ? undefined : { http_get: { path: "/health", port: 8080 } },
    }],
  }));

  const running = podsWithContainers.filter(p => p.phase === "Running").length;
  const pending = podsWithContainers.filter(p => p.phase === "Pending").length;
  const failed  = podsWithContainers.filter(p => p.phase === "Failed").length;

  const nsMap: Record<string, number> = {};
  for (const pod of podsWithContainers) nsMap[pod.namespace] = (nsMap[pod.namespace] || 0) + 1;

  return [
    {
      cluster_id: clusterId, metric_type: "nodes", collected_at: now,
      metric_data: nodesData,
    },
    {
      cluster_id: clusterId, metric_type: "pods", collected_at: now,
      metric_data: { total: podsWithContainers.length, running, pending, failed },
    },
    {
      cluster_id: clusterId, metric_type: "pod_details", collected_at: now,
      metric_data: { pods: podsWithContainers },
    },
    {
      cluster_id: clusterId, metric_type: "services", collected_at: now,
      metric_data: {
        services: [
          { name: "kubernetes",       namespace: "default",       type: "ClusterIP",    cluster_ip: "10.96.0.1",   external_ip: null,           ports: "443/TCP" },
          { name: "api-service",      namespace: "default",       type: "LoadBalancer", cluster_ip: "10.96.10.5",  external_ip: "34.120.45.67",  ports: "80:30080/TCP,443:30443/TCP" },
          { name: "auth-service",     namespace: "production",    type: "ClusterIP",    cluster_ip: "10.96.20.11", external_ip: null,           ports: "8080/TCP" },
          { name: "prometheus-server",namespace: "monitoring",    type: "ClusterIP",    cluster_ip: "10.96.30.5",  external_ip: null,           ports: "9090/TCP" },
          { name: "grafana",          namespace: "monitoring",    type: "NodePort",     cluster_ip: "10.96.30.10", external_ip: null,           ports: "3000:30300/TCP" },
          { name: "nginx-ingress",    namespace: "ingress-nginx", type: "LoadBalancer", cluster_ip: "10.96.40.1",  external_ip: "34.120.50.100", ports: "80:30080/TCP,443:30443/TCP" },
          { name: "kube-dns",         namespace: "kube-system",   type: "ClusterIP",    cluster_ip: "10.96.0.10",  external_ip: null,           ports: "53/UDP,53/TCP" },
        ],
      },
    },
    {
      cluster_id: clusterId, metric_type: "ingresses", collected_at: now,
      metric_data: {
        ingresses: [
          {
            name: "api-ingress", namespace: "default",
            hosts: ["api.demo-k8s.example.com", "www.demo-k8s.example.com"],
            tls: true, class_name: "nginx",
            rules: [
              { host: "api.demo-k8s.example.com", paths: ["/api", "/graphql"] },
              { host: "www.demo-k8s.example.com", paths: ["/"] },
            ],
          },
        ],
      },
    },
    {
      cluster_id: clusterId, metric_type: "namespace_usage", collected_at: now,
      metric_data: {
        namespaces: Object.entries(nsMap).map(([ns, count]) => ({
          namespace:      ns,
          cpu_percent:    randInt(10, 70),
          memory_percent: randInt(15, 75),
          pod_count:      count,
        })),
      },
    },
    {
      cluster_id: clusterId, metric_type: "events", collected_at: now,
      metric_data: {
        events: [
          { type: "Warning", reason: "OOMKilling",  message: "Container payment-svc exceeded memory limit", namespace: "production",  involved_object: { kind: "Pod", name: "payment-svc-crashed-abc", namespace: "production" },  last_time: new Date(Date.now() - 15 * 60000).toISOString() },
          { type: "Warning", reason: "BackOff",     message: "Back-off restarting failed container",        namespace: "production",  involved_object: { kind: "Pod", name: "payment-svc-crashed-abc", namespace: "production" },  last_time: new Date(Date.now() - 12 * 60000).toISOString() },
          { type: "Warning", reason: "Unhealthy",   message: "Readiness probe failed: connection refused",  namespace: "default",     involved_object: { kind: "Pod", name: "nginx-deployment-7c8f9d6b-abc", namespace: "default" }, last_time: new Date(Date.now() - 20 * 60000).toISOString() },
          { type: "Normal",  reason: "Pulled",      message: "Successfully pulled image nginx:1.25",        namespace: "default",     involved_object: { kind: "Pod", name: "nginx-deployment-7c8f9d6b-abc", namespace: "default" }, last_time: new Date(Date.now() - 45 * 60000).toISOString() },
          { type: "Normal",  reason: "Scheduled",   message: "Successfully assigned to demo-worker-1",     namespace: "default",     involved_object: { kind: "Pod", name: "api-service-65b9f-xyz", namespace: "default" },         last_time: new Date(Date.now() - 60 * 60000).toISOString() },
        ],
      },
    },
    {
      cluster_id: clusterId, metric_type: "security", collected_at: now,
      metric_data: {
        pod_security: {
          total_pods: podsWithContainers.length,
          pods_with_resource_limits: podsWithContainers.filter(p => p.containers[0]?.resources?.limits).length,
          pods_without_resource_limits: podsWithContainers.filter(p => !p.containers[0]?.resources?.limits).length,
          pods_with_probes: podsWithContainers.filter(p => p.containers[0]?.readiness_probe).length,
          privileged_pods: 0,
          pods_as_root: 1,
        },
        network_policies: { total_namespaces: 5, covered_namespaces: 2, coverage_percent: 40 },
        ingress_controller: { detected: true, type: "nginx", namespace: "ingress-nginx", has_required_rbac: false },
        rbac: { cluster_admin_bindings: 2, service_accounts_with_full_access: 1 },
      },
    },
  ];
}

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

    // Insert demo agent_metrics so cluster detail pages show data
    const demoMetrics = buildDemoAgentMetrics(cluster.id);
    const { error: metricsError } = await supabaseClient
      .from('agent_metrics')
      .insert(demoMetrics);

    if (metricsError) {
      console.error('Error creating demo agent_metrics:', metricsError);
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
