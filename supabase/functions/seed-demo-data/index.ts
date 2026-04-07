import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 3600_000).toISOString();
}
function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000).toISOString();
}

// ─── Node metrics generator ──────────────────────────────────────────────────

function generateNodes(
  clusterName: string,
  provider: string,
  nodeCount: number,
  cpuUsagePct: number,
  memUsagePct: number
) {
  const instanceTypes: Record<string, string[]> = {
    aws:          ["t3.large", "t3.xlarge", "m5.xlarge", "m5.2xlarge"],
    gcp:          ["n1-standard-4", "n1-standard-8", "e2-standard-4"],
    azure:        ["Standard_D4s_v3", "Standard_D8s_v3", "Standard_B4ms"],
    digitalocean: ["s-4vcpu-8gb", "s-8vcpu-16gb"],
    magalu:       ["mg1.medium", "mg1.large"],
  };
  const types = instanceTypes[provider] || instanceTypes.aws;
  const cpuPerNode  = pick([4000, 6000, 8000]);
  const memPerNode  = pick([8, 16, 32]) * 1024 * 1024 * 1024;

  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    const isControl = i === 0;
    const name = isControl
      ? `${clusterName}-control-plane`
      : `${clusterName}-worker-${i}`;
    const cpuUsageFactor = cpuUsagePct / 100 * rand(0.7, 1.3);
    const memUsageFactor = memUsagePct / 100 * rand(0.7, 1.3);
    const cpuUsage    = Math.round(cpuPerNode * Math.min(cpuUsageFactor, 0.98));
    const memoryUsage = Math.round(memPerNode * Math.min(memUsageFactor, 0.98));
    const labels: Record<string, string> = {
      "kubernetes.io/hostname": name,
      "beta.kubernetes.io/instance-type": pick(types),
      "topology.kubernetes.io/region": clusterName.split("-").slice(-2).join("-"),
    };
    if (isControl) labels["node-role.kubernetes.io/control-plane"] = "true";
    nodes.push({
      name,
      status: "Ready",
      osImage: "Ubuntu 22.04.3 LTS",
      kernelVersion: "5.15.0-91-generic",
      containerRuntime: "containerd://1.7.2",
      labels,
      capacity: { cpu: cpuPerNode, memory: memPerNode },
      usage:    { cpu: cpuUsage,    memory: memoryUsage },
    });
  }
  return { nodes };
}

// ─── Pod list generator ──────────────────────────────────────────────────────

const APP_NAMES = [
  "api-gateway", "auth-service", "payment-service", "user-service",
  "notification-service", "search-service", "recommendation-engine",
  "analytics-worker", "report-generator", "webhook-dispatcher",
  "cache-warmer", "data-pipeline", "ml-inference", "image-processor",
  "email-worker", "scheduler", "audit-logger", "config-manager",
];

const SYSTEM_PODS = [
  { name: "coredns",           namespace: "kube-system"   },
  { name: "kube-proxy",        namespace: "kube-system"   },
  { name: "metrics-server",    namespace: "kube-system"   },
  { name: "prometheus-server", namespace: "monitoring"    },
  { name: "grafana",           namespace: "monitoring"    },
  { name: "loki",              namespace: "monitoring"    },
  { name: "nginx-ingress",     namespace: "ingress-nginx" },
  { name: "cert-manager",      namespace: "cert-manager"  },
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h).toString(36).slice(0, 6);
}

function generatePods(
  clusterName: string,
  totalPods: number,
  cpuUsagePct: number,
  memUsagePct: number
) {
  const pods: any[] = [];
  const namespaces = ["default", "production", "staging", "backend", "frontend"];
  const sysPodCount = Math.min(8, Math.floor(totalPods * 0.15));

  for (let i = 0; i < sysPodCount; i++) {
    const sp = SYSTEM_PODS[i % SYSTEM_PODS.length];
    const restarts = i < 2 ? randInt(0, 3) : 0;
    pods.push({
      name: `${sp.name}-${hash(clusterName + i)}`,
      namespace: sp.namespace,
      phase: "Running",
      status: "Running",
      restarts,
      node: `${clusterName}-worker-${randInt(1, 3)}`,
      cpu: `${randInt(10, 200)}m`,
      memory: `${randInt(64, 512)}Mi`,
      containers: [{
        name: sp.name,
        restart_count: restarts,
        resources: {
          limits:   { cpu: "500m", memory: "512Mi" },
          requests: { cpu: "50m",  memory: "128Mi" },
        },
        readiness_probe: { http_get: { path: "/healthz", port: 8080 } },
        liveness_probe:  { http_get: { path: "/healthz", port: 8080 } },
      }],
    });
  }

  const appPodCount = totalPods - sysPodCount;
  const statusWeights = cpuUsagePct > 80
    ? ["Running","Running","Running","Running","Pending","Failed"]
    : ["Running","Running","Running","Running","Running","Pending"];

  for (let i = 0; i < appPodCount; i++) {
    const app  = APP_NAMES[i % APP_NAMES.length];
    const ns   = namespaces[i % namespaces.length];
    const phase = pick(statusWeights);
    const restarts = phase === "Failed" ? randInt(5, 20) : phase === "Pending" ? 0 : randInt(0, 4);
    const cpuMilli = Math.round(cpuUsagePct / 100 * rand(10, 300));
    const memMi    = Math.round(memUsagePct / 100 * rand(50, 500));
    const missingLimits = Math.random() < 0.2;
    const missingProbes = Math.random() < 0.25;
    pods.push({
      name: `${app}-${hash(clusterName + i)}-${hash(ns + i)}`,
      namespace: ns,
      phase,
      status: phase,
      restarts,
      node: `${clusterName}-worker-${randInt(1, 3)}`,
      cpu: `${cpuMilli}m`,
      memory: `${memMi}Mi`,
      containers: [{
        name: app,
        restart_count: restarts,
        resources: missingLimits ? {} : {
          limits:   { cpu: "1000m",  memory: "1Gi" },
          requests: { cpu: `${Math.max(10, cpuMilli - 50)}m`, memory: `${Math.max(32, memMi - 100)}Mi` },
        },
        readiness_probe: missingProbes ? undefined : { http_get: { path: "/health", port: 8080 } },
        liveness_probe:  missingProbes ? undefined : { http_get: { path: "/health", port: 8080 } },
      }],
    });
  }

  const running = pods.filter(p => p.phase === "Running").length;
  const pending = pods.filter(p => p.phase === "Pending").length;
  const failed  = pods.filter(p => p.phase === "Failed").length;

  return {
    pods_summary: { total: pods.length, running, pending, failed },
    pods_detail:  pods,
  };
}

// ─── Services generator ──────────────────────────────────────────────────────

function generateServices(clusterName: string, environment: string) {
  const baseServices = [
    { name: "api-gateway",        type: "LoadBalancer", port: "80:30080/TCP,443:30443/TCP" },
    { name: "auth-service",       type: "ClusterIP",    port: "8080/TCP" },
    { name: "payment-service",    type: "ClusterIP",    port: "8080/TCP" },
    { name: "user-service",       type: "ClusterIP",    port: "8080/TCP" },
    { name: "notification-svc",   type: "ClusterIP",    port: "8080/TCP" },
    { name: "prometheus-server",  type: "ClusterIP",    port: "9090/TCP" },
    { name: "grafana",            type: "NodePort",     port: "3000:30300/TCP" },
    { name: "nginx-ingress",      type: "LoadBalancer", port: "80:30080/TCP,443:30443/TCP" },
    { name: "kubernetes",         type: "ClusterIP",    port: "443/TCP" },
    { name: "kube-dns",           type: "ClusterIP",    port: "53/UDP,53/TCP" },
  ];
  const namespaces: Record<string, string> = {
    "api-gateway":       environment === "production" ? "production" : "default",
    "auth-service":      environment === "production" ? "production" : "default",
    "payment-service":   "production",
    "user-service":      "backend",
    "notification-svc":  "backend",
    "prometheus-server": "monitoring",
    "grafana":           "monitoring",
    "nginx-ingress":     "ingress-nginx",
    "kubernetes":        "default",
    "kube-dns":          "kube-system",
  };
  return {
    services: baseServices.map(svc => ({
      name: svc.name,
      namespace: namespaces[svc.name] || "default",
      type: svc.type,
      cluster_ip: `10.${randInt(96, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
      external_ip: svc.type === "LoadBalancer"
        ? `${randInt(34, 52)}.${randInt(100, 200)}.${randInt(0, 255)}.${randInt(1, 254)}`
        : null,
      ports: svc.port,
    })),
  };
}

// ─── Ingress generator ───────────────────────────────────────────────────────

function generateIngresses(clusterName: string, _provider: string) {
  const domain = `${clusterName}.example.com`;
  return {
    ingresses: [
      {
        name: "api-ingress",
        namespace: "production",
        hosts: [`api.${domain}`, `www.${domain}`],
        tls: true,
        class_name: "nginx",
        rules: [
          { host: `api.${domain}`,  paths: ["/api", "/graphql"] },
          { host: `www.${domain}`,  paths: ["/"] },
        ],
      },
      {
        name: "grafana-ingress",
        namespace: "monitoring",
        hosts: [`grafana.${domain}`],
        tls: true,
        class_name: "nginx",
        rules: [{ host: `grafana.${domain}`, paths: ["/"] }],
      },
    ],
  };
}

// ─── Namespace usage generator ───────────────────────────────────────────────

function generateNamespaceUsage(pods: any[]) {
  const nsMap: Record<string, number> = {};
  for (const pod of pods) nsMap[pod.namespace] = (nsMap[pod.namespace] || 0) + 1;
  return {
    namespaces: Object.entries(nsMap).map(([ns, count]) => ({
      namespace:      ns,
      cpu_percent:    randInt(10, 80),
      memory_percent: randInt(15, 85),
      pod_count:      count,
    })),
  };
}

// ─── Events generator ────────────────────────────────────────────────────────

function generateEvents(pods: any[]) {
  const warningPods  = pods.filter(p => p.restarts > 5 || p.phase === "Failed");
  const normalEvents = [
    { reason: "Pulled",    message: "Successfully pulled image" },
    { reason: "Created",   message: "Created container" },
    { reason: "Started",   message: "Started container" },
    { reason: "Scheduled", message: "Successfully assigned to node" },
  ];
  const warningEvents = [
    { reason: "OOMKilling",       message: "Container exceeded memory limit, killed" },
    { reason: "BackOff",          message: "Back-off restarting failed container" },
    { reason: "FailedScheduling", message: "Insufficient resources on node" },
    { reason: "Unhealthy",        message: "Readiness probe failed: connection refused" },
  ];

  const events: any[] = [];
  const now = Date.now();

  for (let i = 0; i < 10; i++) {
    const ev  = pick(normalEvents);
    const pod = pick(pods);
    events.push({
      type: "Normal",
      reason: ev.reason,
      message: ev.message,
      namespace: pod.namespace,
      involved_object: { kind: "Pod", name: pod.name, namespace: pod.namespace },
      last_time: new Date(now - randInt(0, 3600) * 1000).toISOString(),
    });
  }

  for (const pod of warningPods.slice(0, 5)) {
    const ev = pick(warningEvents);
    events.push({
      type: "Warning",
      reason: ev.reason,
      message: ev.message,
      namespace: pod.namespace,
      involved_object: { kind: "Pod", name: pod.name, namespace: pod.namespace },
      last_time: new Date(now - randInt(0, 1800) * 1000).toISOString(),
    });
  }

  return { events };
}

// ─── Security metrics generator ─────────────────────────────────────────────

function generateSecurity(pods: any[], environment: string) {
  const total     = pods.length;
  const withLim   = pods.filter(p => p.containers?.[0]?.resources?.limits).length;
  const withProbes = pods.filter(p => p.containers?.[0]?.readiness_probe).length;
  const coveragePct = environment === "production" ? randInt(65, 90) : randInt(30, 65);

  return {
    pod_security: {
      total_pods: total,
      pods_with_resource_limits: withLim,
      pods_without_resource_limits: total - withLim,
      pods_with_probes: withProbes,
      privileged_pods: randInt(0, 3),
      pods_as_root: randInt(0, 5),
    },
    network_policies: {
      total_namespaces: 6,
      covered_namespaces: Math.round(6 * coveragePct / 100),
      coverage_percent: coveragePct,
    },
    ingress_controller: {
      detected: true,
      type: "nginx",
      namespace: "ingress-nginx",
      has_required_rbac: environment === "production",
    },
    rbac: {
      cluster_admin_bindings: randInt(1, 3),
      service_accounts_with_full_access: randInt(0, 2),
    },
  };
}

// ─── Security threats generator ──────────────────────────────────────────────

function generateSecurityThreats(clusterId: string, userId: string, environment: string, clusterName: string) {
  const threats = [];

  const threatTemplates = [
    {
      threat_type: "suspicious_process",
      severity: "high",
      title: "Processo suspeito detectado em pod de produção",
      description: `Processo 'nmap' detectado em container da namespace production no cluster ${clusterName}. Possível reconhecimento de rede interno.`,
      ai_analysis: {
        threat_score: 0.82,
        confidence: 0.88,
        indicators: ["Ferramenta de port scan em container de produção", "Varredura de rede interna detectada"],
        recommendation: "Isolar container imediatamente e investigar comprometimento da imagem",
      },
      ai_recommendation: "Remover pod suspeito, analisar imagem Docker para backdoors e revisar permissões do ServiceAccount.",
      remediation_steps: ["Remover pod suspeito", "Analisar imagem Docker para backdoors", "Revisar permissões do ServiceAccount"],
      is_attack: false,
    },
    {
      threat_type: "privilege_escalation",
      severity: environment === "production" ? "critical" : "high",
      title: "Tentativa de escalação de privilégio detectada",
      description: `Container no cluster ${clusterName} tentou executar sudo e acessar /etc/passwd. Indica tentativa de escalação de privilégio.`,
      ai_analysis: {
        threat_score: 0.91,
        confidence: 0.94,
        indicators: ["Comando sudo em container", "Acesso a arquivos de sistema críticos", "Container executando como root"],
        recommendation: "Encerrar pod imediatamente e adicionar políticas de segurança PSP/PSA",
      },
      ai_recommendation: "Terminar pod comprometido imediatamente e aplicar PodSecurityPolicy restrictiva.",
      remediation_steps: ["Terminar pod comprometido", "Aplicar PodSecurityPolicy restrictiva", "Auditar RBAC do namespace"],
      is_attack: true,
    },
    {
      threat_type: "unauthorized_access",
      severity: "medium",
      title: "Acesso não autorizado à API do Kubernetes",
      description: `Múltiplas tentativas de acesso à API do Kubernetes com token inválido detectadas no cluster ${clusterName}.`,
      ai_analysis: {
        threat_score: 0.65,
        confidence: 0.79,
        indicators: ["401 Unauthorized em /api/v1/pods", `${randInt(50, 200)} tentativas em 5 minutos`, "IP não autorizado"],
        recommendation: "Bloquear IP de origem e revisar RBAC",
      },
      ai_recommendation: "Bloquear IP de origem e rotacionar tokens de service accounts comprometidos.",
      remediation_steps: ["Adicionar IP à blocklist do ingress", "Rotacionar tokens de service accounts", "Habilitar audit logging"],
      is_attack: false,
    },
    {
      threat_type: "crypto_mining",
      severity: "critical",
      title: "Mineração de criptomoeda detectada",
      description: `Alto uso de CPU (>95%) com padrão de rede característico de pool de mineração identificado no cluster ${clusterName}.`,
      ai_analysis: {
        threat_score: 0.97,
        confidence: 0.96,
        indicators: ["CPU 97% por 45+ minutos", "Conexão com pool de mineração", "Processo xmrig identificado"],
        recommendation: "Eliminar pod imediatamente. Cluster comprometido requer auditoria completa.",
      },
      ai_recommendation: "Terminar todos os pods suspeitos e fazer varredura completa das imagens Docker.",
      remediation_steps: ["Terminar todos os pods suspeitos", "Isolar namespace", "Fazer varredura completa das imagens", "Rotacionar todos os secrets"],
      is_attack: true,
    },
    {
      threat_type: "data_exfiltration",
      severity: "high",
      title: "Possível exfiltração de dados detectada",
      description: `Transferência de dados anormalmente alta para IP externo desconhecido. 45GB transferidos em 2 horas no cluster ${clusterName}.`,
      ai_analysis: {
        threat_score: 0.78,
        confidence: 0.83,
        indicators: ["45GB transferidos externamente em 2h", "Destino IP não está em whitelist", "Horário fora do padrão (3h AM)"],
        recommendation: "Bloquear tráfego egress do pod e investigar dados transmitidos.",
      },
      ai_recommendation: "Aplicar NetworkPolicy para bloquear egress e notificar equipe de segurança imediatamente.",
      remediation_steps: ["Aplicar NetworkPolicy para bloquear egress", "Analisar logs de transferência", "Notificar equipe de segurança"],
      is_attack: true,
    },
  ];

  const count = environment === "production" ? 4 : environment === "staging" ? 2 : 1;
  const selected = threatTemplates.slice(0, count);

  for (let i = 0; i < selected.length; i++) {
    const t = selected[i];
    const isResolved = i > 1;
    threats.push({
      cluster_id: clusterId,
      user_id: userId,
      threat_type: t.threat_type,
      severity: t.severity,
      status: isResolved ? "mitigated" : i === 0 ? "active" : "investigating",
      title: t.title,
      description: t.description,
      ai_analysis: t.ai_analysis,
      ai_recommendation: t.ai_recommendation,
      remediation_steps: t.remediation_steps,
      is_attack: t.is_attack,
      auto_remediated: isResolved,
      acknowledged: isResolved,
      created_at: minutesAgo(randInt(30, 480)),
    });
  }

  return threats;
}

// ─── Agent anomalies generator ───────────────────────────────────────────────

function generateAgentAnomalies(clusterId: string, userId: string, cpuUsagePct: number, memUsagePct: number) {
  const anomalies = [];
  const now = Date.now();

  if (cpuUsagePct > 70) {
    anomalies.push({
      cluster_id: clusterId,
      user_id: userId,
      anomaly_type: "high_cpu",
      severity: cpuUsagePct > 85 ? "critical" : "high",
      description: `CPU usage at ${cpuUsagePct.toFixed(1)}% — sustained above threshold for 15+ minutes`,
      ai_analysis: {
        root_cause: "Elasticsearch bulk indexing consuming excess CPU resources during peak hours",
        confidence: 0.87,
        affected_nodes: randInt(2, 5),
        pattern: "recurring_peak",
      },
      recommendation: "Scale horizontally by adding 2 nodes or reschedule batch jobs to off-peak hours",
      auto_heal_applied: cpuUsagePct > 85,
      resolved: cpuUsagePct < 80,
      created_at: new Date(now - randInt(20, 120) * 60_000).toISOString(),
      resolved_at: cpuUsagePct < 80 ? new Date(now - randInt(5, 20) * 60_000).toISOString() : null,
    });
  }

  if (memUsagePct > 75) {
    anomalies.push({
      cluster_id: clusterId,
      user_id: userId,
      anomaly_type: "high_memory",
      severity: memUsagePct > 90 ? "critical" : "high",
      description: `Memory usage at ${memUsagePct.toFixed(1)}% — OOM killer risk detected`,
      ai_analysis: {
        root_cause: "Memory leak in nginx-ingress controller v1.9.4 — known issue in this version",
        confidence: 0.91,
        affected_pods: randInt(3, 8),
        leak_rate_mb_per_hour: randInt(50, 200),
      },
      recommendation: "Restart nginx-ingress pods and upgrade to v1.9.5 which contains the memory leak fix",
      auto_heal_applied: memUsagePct > 90,
      resolved: false,
      created_at: new Date(now - randInt(10, 60) * 60_000).toISOString(),
      resolved_at: null,
    });
  }

  // Pod restart anomaly
  anomalies.push({
    cluster_id: clusterId,
    user_id: userId,
    anomaly_type: "pod_restart_loop",
    severity: "medium",
    description: `payment-service pod restarted ${randInt(8, 25)} times in last hour`,
    ai_analysis: {
      root_cause: "Database connection pool exhausted — max connections reached in PostgreSQL",
      confidence: 0.84,
      restart_count: randInt(8, 25),
      crash_reason: "OOMKilled",
    },
    recommendation: "Increase connection pool size and add memory limits. Consider PgBouncer for connection pooling.",
    auto_heal_applied: false,
    resolved: false,
    created_at: new Date(now - randInt(30, 90) * 60_000).toISOString(),
    resolved_at: null,
  });

  return anomalies;
}

// ─── Build all agent_metrics for a cluster ──────────────────────────────────

function buildAgentMetrics(cluster: any) {
  const now = new Date().toISOString();
  const nodesData   = generateNodes(cluster.name, cluster.provider, cluster.nodes, cluster.cpu_usage, cluster.memory_usage);
  const podResult   = generatePods(cluster.name, cluster.pods, cluster.cpu_usage, cluster.memory_usage);
  const servicesData  = generateServices(cluster.name, cluster.environment);
  const ingressesData = generateIngresses(cluster.name, cluster.provider);
  const nsUsageData   = generateNamespaceUsage(podResult.pods_detail);
  const eventsData    = generateEvents(podResult.pods_detail);
  const securityData  = generateSecurity(podResult.pods_detail, cluster.environment);

  return [
    { cluster_id: cluster.id, metric_type: "nodes",           metric_data: nodesData,                      collected_at: now },
    { cluster_id: cluster.id, metric_type: "pods",            metric_data: podResult.pods_summary,          collected_at: now },
    { cluster_id: cluster.id, metric_type: "pod_details",     metric_data: { pods: podResult.pods_detail }, collected_at: now },
    { cluster_id: cluster.id, metric_type: "services",        metric_data: servicesData,                    collected_at: now },
    { cluster_id: cluster.id, metric_type: "ingresses",       metric_data: ingressesData,                   collected_at: now },
    { cluster_id: cluster.id, metric_type: "namespace_usage", metric_data: nsUsageData,                     collected_at: now },
    { cluster_id: cluster.id, metric_type: "events",          metric_data: eventsData,                      collected_at: now },
    { cluster_id: cluster.id, metric_type: "security",        metric_data: securityData,                    collected_at: now },
  ];
}

// ─── Historical cost data (daily entries for past 60 days) ──────────────────

function generateHistoricalCosts(cluster: any, userId: string) {
  const entries = [];
  const baseMonthly = cluster.monthly_cost;
  const computePct  = 0.65;
  const storagePct  = 0.25;
  const networkPct  = 0.10;

  // Generate daily entries for past 60 days so both current and last month are covered
  for (let d = 60; d >= 0; d--) {
    const date = new Date(Date.now() - d * 24 * 3600_000);
    // Add natural variation ±15%
    const variation = 1 + (Math.random() - 0.5) * 0.3;
    // Add weekend dip and weekday bump
    const dayOfWeek = date.getDay();
    const dayFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.85 : 1.05;
    const dailyCost = Number(((baseMonthly / 30) * variation * dayFactor).toFixed(2));

    entries.push({
      user_id: userId,
      cluster_id: cluster.id,
      is_demo: true,
      compute_cost:  Number((dailyCost * computePct).toFixed(2)),
      storage_cost:  Number((dailyCost * storagePct).toFixed(2)),
      network_cost:  Number((dailyCost * networkPct).toFixed(2)),
      total_cost:    dailyCost,
      calculation_date: date.toISOString(),
      period_start:  new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
      period_end:    date.toISOString(),
      pricing_details: {
        provider: cluster.provider,
        region:   cluster.region,
        instance_type: "standard",
        nodes:    cluster.nodes,
        breakdown: {
          compute: Number((dailyCost * computePct).toFixed(2)),
          storage: Number((dailyCost * storagePct).toFixed(2)),
          network: Number((dailyCost * networkPct).toFixed(2)),
          total:   dailyCost,
        },
      },
    });
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════════════════
// Main handler
// ════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Cleanup existing demo data ────────────────────────────────────────
    await supabaseClient.from('ai_cost_savings').delete().eq('user_id', user.id).eq('is_demo', true);
    await supabaseClient.from('cost_calculations').delete().eq('user_id', user.id).eq('is_demo', true);
    await supabaseClient.from('ai_incidents').delete().eq('user_id', user.id).eq('is_demo', true);
    await supabaseClient.from('pvcs').delete().eq('user_id', user.id).eq('is_demo', true);

    const { data: existingDemo } = await supabaseClient
      .from('clusters')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_demo', true);

    if (existingDemo && existingDemo.length > 0) {
      const ids = existingDemo.map((c: any) => c.id);
      for (const cid of ids) {
        await supabaseClient.from('agent_api_keys').delete().eq('cluster_id', cid);
        await supabaseClient.from('agent_metrics').delete().eq('cluster_id', cid);
        await supabaseClient.from('storage_recommendations').delete().eq('cluster_id', cid);
        await supabaseClient.from('cluster_validation_results').delete().eq('cluster_id', cid);
        await supabaseClient.from('agent_anomalies').delete().eq('cluster_id', cid);
        await supabaseClient.from('security_threats').delete().eq('cluster_id', cid);
        await supabaseClient.from('scan_history').delete().eq('cluster_id', cid);
      }
    }

    await supabaseClient.from('clusters').delete().eq('user_id', user.id).eq('is_demo', true);

    // ── Define 8 demo clusters ────────────────────────────────────────────
    const now = new Date().toISOString();

    const clusters = [
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'prod-us-east-1',
        cluster_type: 'kubernetes',
        provider: 'aws',
        environment: 'production',
        region: 'us-east-1',
        api_endpoint: 'https://api.prod-us-east-1.k8s.aws',
        status: 'healthy',
        is_demo: true,
        nodes: 8,
        pods: 150,
        cpu_usage: 65.2,
        memory_usage: 72.5,
        storage_used_gb: 450.5,
        storage_total_gb: 1200.0,
        storage_available_gb: 749.5,
        monthly_cost: 2850.00,
        agent_last_seen_at: minutesAgo(2),
        agent_version: '1.4.2',
        last_sync: minutesAgo(2),
        created_at: daysAgo(30),
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'prod-us-west-2',
        cluster_type: 'kubernetes',
        provider: 'aws',
        environment: 'production',
        region: 'us-west-2',
        api_endpoint: 'https://api.prod-us-west-2.k8s.aws',
        status: 'warning',
        is_demo: true,
        nodes: 6,
        pods: 98,
        cpu_usage: 87.8,
        memory_usage: 68.3,
        storage_used_gb: 380.2,
        storage_total_gb: 800.0,
        storage_available_gb: 419.8,
        monthly_cost: 2100.00,
        agent_last_seen_at: minutesAgo(1),
        agent_version: '1.4.2',
        last_sync: minutesAgo(1),
        created_at: daysAgo(45),
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'prod-eu-west-1',
        cluster_type: 'kubernetes',
        provider: 'gcp',
        environment: 'production',
        region: 'europe-west1',
        api_endpoint: 'https://api.prod-eu-west-1.gcp',
        status: 'healthy',
        is_demo: true,
        nodes: 5,
        pods: 76,
        cpu_usage: 45.5,
        memory_usage: 58.2,
        storage_used_gb: 320.8,
        storage_total_gb: 600.0,
        storage_available_gb: 279.2,
        monthly_cost: 1950.00,
        agent_last_seen_at: minutesAgo(3),
        agent_version: '1.4.2',
        last_sync: minutesAgo(3),
        created_at: daysAgo(60),
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'prod-asia-1',
        cluster_type: 'kubernetes',
        provider: 'gcp',
        environment: 'production',
        region: 'asia-southeast1',
        api_endpoint: 'https://api.prod-asia-1.gcp',
        status: 'critical',
        is_demo: true,
        nodes: 4,
        pods: 45,
        cpu_usage: 62.3,
        memory_usage: 94.7,
        storage_used_gb: 280.5,
        storage_total_gb: 500.0,
        storage_available_gb: 219.5,
        monthly_cost: 1650.00,
        agent_last_seen_at: minutesAgo(1),
        agent_version: '1.4.2',
        last_sync: minutesAgo(1),
        created_at: daysAgo(55),
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'staging-us-1',
        cluster_type: 'kubernetes',
        provider: 'azure',
        environment: 'staging',
        region: 'eastus',
        api_endpoint: 'https://api.staging-us-1.azure',
        status: 'healthy',
        is_demo: true,
        nodes: 3,
        pods: 32,
        cpu_usage: 38.5,
        memory_usage: 42.8,
        storage_used_gb: 180.3,
        storage_total_gb: 400.0,
        storage_available_gb: 219.7,
        monthly_cost: 850.00,
        agent_last_seen_at: minutesAgo(4),
        agent_version: '1.4.1',
        last_sync: minutesAgo(4),
        created_at: daysAgo(20),
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'staging-eu-1',
        cluster_type: 'kubernetes',
        provider: 'digitalocean',
        environment: 'staging',
        region: 'ams3',
        api_endpoint: 'https://api.staging-eu-1.do',
        status: 'warning',
        is_demo: true,
        nodes: 2,
        pods: 28,
        cpu_usage: 42.1,
        memory_usage: 51.5,
        storage_used_gb: 120.5,
        storage_total_gb: 300.0,
        storage_available_gb: 179.5,
        monthly_cost: 450.00,
        agent_last_seen_at: minutesAgo(2),
        agent_version: '1.4.1',
        last_sync: minutesAgo(2),
        created_at: daysAgo(15),
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'dev-us-1',
        cluster_type: 'kubernetes',
        provider: 'magalu',
        environment: 'development',
        region: 'us-central',
        api_endpoint: 'https://api.dev-us-1.magalu',
        status: 'healthy',
        is_demo: true,
        nodes: 2,
        pods: 12,
        cpu_usage: 25.3,
        memory_usage: 32.8,
        storage_used_gb: 85.2,
        storage_total_gb: 200.0,
        storage_available_gb: 114.8,
        monthly_cost: 280.00,
        agent_last_seen_at: minutesAgo(2),
        agent_version: '1.4.2',
        last_sync: minutesAgo(2),
        created_at: daysAgo(10),
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'dev-br-1',
        cluster_type: 'docker',
        provider: 'magalu',
        environment: 'development',
        region: 'br-south',
        api_endpoint: 'https://api.dev-br-1.magalu',
        status: 'warning',
        is_demo: true,
        nodes: 2,
        pods: 18,
        cpu_usage: 52.8,
        memory_usage: 48.5,
        storage_used_gb: 95.8,
        storage_total_gb: 250.0,
        storage_available_gb: 154.2,
        monthly_cost: 320.00,
        agent_last_seen_at: minutesAgo(1),
        agent_version: '1.4.1',
        last_sync: minutesAgo(1),
        created_at: daysAgo(5),
      },
    ];

    const { error: clustersError } = await supabaseClient.from('clusters').insert(clusters);
    if (clustersError) throw clustersError;

    // ── Agent API Keys ────────────────────────────────────────────────────
    const agentKeys = clusters.map(cluster => ({
      user_id: user.id,
      cluster_id: cluster.id,
      name: `agent-${cluster.name}`,
      api_key: `kp_demo_${cluster.id.replace(/-/g, '').slice(0, 32)}`,
      api_key_prefix: `kp_demo_${cluster.name.slice(0, 10)}...`,
      last_seen: cluster.agent_last_seen_at,
      is_active: cluster.status !== 'critical' && cluster.status !== 'disconnected',
    }));
    const { error: agentKeysError } = await supabaseClient.from('agent_api_keys').insert(agentKeys);
    if (agentKeysError) console.error('agent_api_keys error:', agentKeysError);

    // ── Agent metrics ─────────────────────────────────────────────────────
    const allMetrics: any[] = [];
    for (const cluster of clusters) {
      allMetrics.push(...buildAgentMetrics(cluster));
    }
    // Insert one cluster's metrics at a time to avoid payload size limits
    for (let i = 0; i < allMetrics.length; i += 8) {
      const batch = allMetrics.slice(i, i + 8);
      const { error: metricsError } = await supabaseClient.from('agent_metrics').insert(batch);
      if (metricsError) console.error('agent_metrics batch error:', metricsError);
    }

    // ── Security threats ──────────────────────────────────────────────────
    const allThreats: any[] = [];
    for (const cluster of clusters) {
      allThreats.push(...generateSecurityThreats(cluster.id, user.id, cluster.environment, cluster.name));
    }
    const { error: threatsError } = await supabaseClient.from('security_threats').insert(allThreats);
    if (threatsError) console.error('security_threats error:', threatsError);

    // ── Agent anomalies ───────────────────────────────────────────────────
    const allAnomalies: any[] = [];
    for (const cluster of clusters) {
      allAnomalies.push(...generateAgentAnomalies(cluster.id, user.id, cluster.cpu_usage, cluster.memory_usage));
    }
    const { error: anomaliesError } = await supabaseClient.from('agent_anomalies').insert(allAnomalies);
    if (anomaliesError) console.error('agent_anomalies error:', anomaliesError);

    // ── AI incidents ──────────────────────────────────────────────────────
    const incidents = [
      {
        cluster_id: clusters[3].id,
        user_id: user.id,
        is_demo: true,
        incident_type: 'high_memory',
        severity: 'critical',
        title: 'Critical: Memory usage at 94.7% in prod-asia-1',
        description: 'Cluster prod-asia-1 has reached critical memory levels (94.7%). Multiple pods are at risk of being evicted by the kubelet OOM killer.',
        ai_analysis: {
          root_cause: 'Memory leak detected in nginx-ingress controller pods consuming 12GB+ RAM',
          impact: 'High risk of pod evictions and service disruptions. Response times increased by 340ms.',
          recommendation: 'Restart affected pods immediately and investigate memory leak in ingress controller version',
          confidence: 0.92,
        },
        auto_heal_action: 'restart_pod',
        action_taken: true,
        action_result: {
          success: true,
          details: 'Restarted 3 nginx-ingress pods. Memory usage dropped to 68.3%.',
          timestamp: minutesAgo(40),
          execution_time_ms: 2340,
        },
        created_at: minutesAgo(45),
        resolved_at: minutesAgo(40),
      },
      {
        cluster_id: clusters[1].id,
        user_id: user.id,
        is_demo: true,
        incident_type: 'pod_crash',
        severity: 'critical',
        title: 'Critical: Payment API pods crashing in prod-us-west-2',
        description: 'Payment processing API pods are in CrashLoopBackOff state. 15 restart attempts in last 10 minutes.',
        ai_analysis: {
          root_cause: 'Database connection pool exhausted due to connection leak in payment-service v2.1.4',
          impact: 'Payment processing down, affecting 2,500+ transactions/min. Revenue impact estimated at $8,500/hour.',
          recommendation: 'Rollback to payment-service v2.1.3 immediately and increase connection pool size',
          confidence: 0.88,
        },
        auto_heal_action: 'rollback_deployment',
        action_taken: true,
        action_result: {
          success: true,
          details: 'Rolled back payment-service from v2.1.4 to v2.1.3. All 5 pods now healthy.',
          timestamp: minutesAgo(115),
          execution_time_ms: 4200,
        },
        created_at: minutesAgo(120),
        resolved_at: minutesAgo(115),
      },
      {
        cluster_id: clusters[7].id,
        user_id: user.id,
        is_demo: true,
        incident_type: 'deployment_stuck',
        severity: 'critical',
        title: 'Critical: MongoDB deployment stuck in dev-br-1',
        description: 'MongoDB StatefulSet is stuck with 0/3 replicas ready. PersistentVolumeClaims failing to bind.',
        ai_analysis: {
          root_cause: "StorageClass not found. PVC requesting storage class 'fast-ssd' which does not exist in cluster",
          impact: 'All database operations failing. Dev team blocked from testing. 8 developers affected.',
          recommendation: "Update StatefulSet to use existing storage class 'standard' or create missing storage class",
          confidence: 0.95,
        },
        auto_heal_action: null,
        action_taken: false,
        action_result: null,
        created_at: minutesAgo(25),
        resolved_at: null,
      },
      {
        cluster_id: clusters[1].id,
        user_id: user.id,
        is_demo: true,
        incident_type: 'high_cpu',
        severity: 'high',
        title: 'High CPU usage (87.8%) in prod-us-west-2',
        description: 'Sustained high CPU usage detected across all nodes. Average CPU at 87.8% for past 15 minutes.',
        ai_analysis: {
          root_cause: 'Elasticsearch bulk indexing job consuming 6 CPU cores. Job scheduled during peak hours.',
          impact: 'API response times degraded by 230ms. User experience affected for 15k active users.',
          recommendation: 'Scale up cluster by 2 nodes and reschedule bulk indexing to off-peak hours (2-4 AM UTC)',
          confidence: 0.85,
        },
        auto_heal_action: 'scale_up',
        action_taken: true,
        action_result: {
          success: true,
          details: 'Scaled deployment from 6 to 8 nodes. CPU usage stabilized at 68.2%.',
          timestamp: minutesAgo(165),
          execution_time_ms: 180000,
        },
        created_at: minutesAgo(180),
        resolved_at: minutesAgo(165),
      },
      {
        cluster_id: clusters[3].id,
        user_id: user.id,
        is_demo: true,
        incident_type: 'disk_full',
        severity: 'high',
        title: 'Disk usage at 88% in prod-asia-1',
        description: 'Persistent volume /data is 88% full. Logs and temporary files consuming excessive space.',
        ai_analysis: {
          root_cause: 'Application logs not being rotated. 45GB of debug logs accumulated over 2 weeks.',
          impact: 'Disk will be full in 4 hours at current rate. Database writes may fail.',
          recommendation: 'Clear old logs, enable log rotation, and increase PV size from 300GB to 500GB',
          confidence: 0.91,
        },
        auto_heal_action: 'clear_cache',
        action_taken: true,
        action_result: {
          success: true,
          details: 'Deleted logs older than 7 days (38GB freed). Enabled logrotate. Disk usage now at 52%.',
          timestamp: minutesAgo(290),
          execution_time_ms: 8500,
        },
        created_at: minutesAgo(300),
        resolved_at: minutesAgo(290),
      },
      // Additional incidents for more Monitor IA data
      {
        cluster_id: clusters[0].id,
        user_id: user.id,
        is_demo: true,
        incident_type: 'node_not_ready',
        severity: 'high',
        title: 'Node prod-us-east-1-worker-3 not ready',
        description: 'Worker node entered NotReady state after kernel panic. Pods being rescheduled.',
        ai_analysis: {
          root_cause: 'Kernel panic caused by faulty memory module (DIMM B2). Hardware failure.',
          impact: '18 pods rescheduled across remaining nodes. Increased load on other workers.',
          recommendation: 'Replace faulty hardware node. Current workloads are being handled by remaining nodes.',
          confidence: 0.89,
        },
        auto_heal_action: 'cordon_node',
        action_taken: true,
        action_result: {
          success: true,
          details: 'Node cordoned and drained. 18 pods rescheduled successfully to healthy nodes.',
          timestamp: daysAgo(2),
          execution_time_ms: 45000,
        },
        created_at: daysAgo(2),
        resolved_at: daysAgo(2),
      },
      {
        cluster_id: clusters[2].id,
        user_id: user.id,
        is_demo: true,
        incident_type: 'certificate_expiry',
        severity: 'medium',
        title: 'TLS certificate expiring in 7 days — prod-eu-west-1',
        description: 'TLS certificate for api.prod-eu-west-1.example.com expires in 7 days. Auto-renewal failed.',
        ai_analysis: {
          root_cause: "cert-manager failed to renew certificate. Let's Encrypt rate limit reached (50 certs/week).",
          impact: 'API will become unreachable in 7 days without certificate renewal.',
          recommendation: "Wait 24h for rate limit reset then trigger manual renewal with: kubectl cert-manager renew",
          confidence: 0.98,
        },
        auto_heal_action: null,
        action_taken: false,
        action_result: null,
        created_at: daysAgo(1),
        resolved_at: null,
      },
    ];

    const { error: incidentsError } = await supabaseClient.from('ai_incidents').insert(incidents);
    if (incidentsError) throw incidentsError;

    // ── Historical cost calculations (60 days, daily) ─────────────────────
    const allCostEntries: any[] = [];
    for (const cluster of clusters) {
      allCostEntries.push(...generateHistoricalCosts(cluster, user.id));
    }
    // Insert in batches of 200 to avoid payload limits
    for (let i = 0; i < allCostEntries.length; i += 200) {
      const batch = allCostEntries.slice(i, i + 200);
      const { error } = await supabaseClient.from('cost_calculations').insert(batch);
      if (error) console.error('cost_calculations batch error:', error);
    }

    // ── AI savings ────────────────────────────────────────────────────────
    const resolvedIncidents = incidents.filter(inc => inc.action_taken && inc.resolved_at);
    const { data: insertedIncidents } = await supabaseClient
      .from('ai_incidents')
      .select('id, cluster_id')
      .eq('user_id', user.id)
      .eq('is_demo', true);

    const aiSavings = resolvedIncidents.map((inc, index) => {
      const cluster = clusters.find(c => c.id === inc.cluster_id)!;
      const costPerMinute = cluster.monthly_cost / (30 * 24 * 60);
      const incidentRow = insertedIncidents?.find(r => r.cluster_id === inc.cluster_id);
      const downtimeAvoidedMinutes = inc.severity === 'critical' ? 30 : 15;
      const estimatedSavings = Number((downtimeAvoidedMinutes * costPerMinute * 10).toFixed(2));

      return {
        user_id: user.id,
        incident_id: incidentRow?.id || insertedIncidents?.[index]?.id || inc.cluster_id,
        cluster_id: inc.cluster_id,
        is_demo: true,
        downtime_avoided_minutes: downtimeAvoidedMinutes,
        cost_per_minute: Number(costPerMinute.toFixed(4)),
        estimated_savings: estimatedSavings,
        saving_type: 'downtime_prevention',
        calculation_details: {
          severity: inc.severity,
          revenue_multiplier: 10,
          assumption: 'Based on downtime avoided and revenue impact',
        },
      };
    });

    const { error: savingsError } = await supabaseClient.from('ai_cost_savings').insert(aiSavings);
    if (savingsError) throw savingsError;

    // ── PVCs ──────────────────────────────────────────────────────────────
    const storageClasses = ['gp3', 'gp2', 'io1', 'io2', 'standard', 'fast-ssd', 'ssd', 'hdd'];
    const pvcNamespaces  = ['default', 'production', 'staging', 'monitoring', 'logging', 'database'];
    const pvcNames       = ['data', 'logs', 'backups', 'cache', 'uploads', 'temp', 'postgres', 'mongodb', 'elasticsearch', 'redis'];

    const allPvcs: any[] = [];
    clusters.forEach(cluster => {
      const numPvcs = randInt(4, 8);
      for (let i = 0; i < numPvcs; i++) {
        const requestedGb    = pick([10, 20, 50, 100, 200, 500]);
        const requestedBytes = requestedGb * 1024 * 1024 * 1024;
        const usagePct       = Math.random() * 100;
        const usedBytes      = Math.floor(requestedBytes * (usagePct / 100));
        allPvcs.push({
          id: crypto.randomUUID(),
          cluster_id: cluster.id,
          user_id: user.id,
          is_demo: true,
          name: `${pvcNames[i % pvcNames.length]}-${cluster.environment}-${randInt(1, 99)}`,
          namespace: pick(pvcNamespaces),
          storage_class: pick(storageClasses),
          requested_bytes: requestedBytes,
          used_bytes: usedBytes,
          status: Math.random() > 0.9 ? 'pending' : 'bound',
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 3600000).toISOString(),
          last_sync: minutesAgo(randInt(1, 60)),
        });
      }
    });

    const { error: pvcsError } = await supabaseClient.from('pvcs').insert(allPvcs);
    if (pvcsError) throw pvcsError;

    // ── Storage recommendations ───────────────────────────────────────────
    const storageRecs: any[] = [];
    allPvcs.filter((_, idx) => idx % 2 === 0).slice(0, 8).forEach((pvc, index) => {
      const usagePct    = (pvc.used_bytes / pvc.requested_bytes) * 100;
      const requestedGb = pvc.requested_bytes / (1024 ** 3);
      const usedGb      = pvc.used_bytes / (1024 ** 3);

      let recommendationType: string;
      let recommendedSizeGb: number;
      let potentialSavings: number;
      let aiReasoning: string;
      let priority: string;

      if (usagePct < 20) {
        recommendationType = 'downsize';
        recommendedSizeGb  = Math.ceil(usedGb * 1.5);
        potentialSavings   = (requestedGb - recommendedSizeGb) * 0.10;
        aiReasoning        = `Volume usa apenas ${usagePct.toFixed(1)}% dos ${requestedGb}GB. Reduzir para ${recommendedSizeGb}GB economiza $${potentialSavings.toFixed(2)}/mês.`;
        priority           = 'medium';
      } else if (usagePct > 85) {
        recommendationType = 'upsize';
        recommendedSizeGb  = Math.ceil(requestedGb * 1.3);
        potentialSavings   = 0;
        aiReasoning        = `Volume em ${usagePct.toFixed(1)}% de uso. Risco de volume cheio. Aumentar para ${recommendedSizeGb}GB previne falhas.`;
        priority           = usagePct > 95 ? 'critical' : 'high';
      } else if (usagePct < 40) {
        recommendationType = 'downsize';
        recommendedSizeGb  = Math.ceil(usedGb * 2);
        potentialSavings   = (requestedGb - recommendedSizeGb) * 0.10;
        aiReasoning        = `Volume subutilizado (${usagePct.toFixed(1)}%). Ajustar para ${recommendedSizeGb}GB pode economizar $${potentialSavings.toFixed(2)}/mês.`;
        priority           = 'low';
      } else {
        return;
      }

      const recStatus = index < 2 ? 'applied' : index < 4 ? 'accepted' : 'pending';
      storageRecs.push({
        id: crypto.randomUUID(),
        user_id: user.id,
        cluster_id: pvc.cluster_id,
        pvc_name: pvc.name,
        namespace: pvc.namespace,
        recommendation_type: recommendationType,
        current_size_gb: Number(requestedGb.toFixed(2)),
        recommended_size_gb: Number(recommendedSizeGb.toFixed(2)),
        current_usage_gb: Number(usedGb.toFixed(2)),
        avg_usage_percent: Number(usagePct.toFixed(2)),
        max_usage_percent: Number(Math.min(usagePct * 1.1, 100).toFixed(2)),
        p95_usage_percent: Number(Math.min(usagePct * 1.05, 100).toFixed(2)),
        potential_savings_month: Number(Math.max(potentialSavings, 0).toFixed(2)),
        ai_reasoning: aiReasoning,
        ai_confidence: Number((0.80 + Math.random() * 0.15).toFixed(2)),
        priority,
        status: recStatus,
        days_analyzed: 7,
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 3600000).toISOString(),
        applied_at: index < 2 ? minutesAgo(randInt(60, 2880)) : null,
      });
    });

    const { error: recsError } = await supabaseClient.from('storage_recommendations').insert(storageRecs);
    if (recsError) console.error('storage_recommendations error:', recsError);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Demo data created successfully',
        clusters:                clusters.length,
        agent_api_keys:          agentKeys.length,
        agent_metrics:           allMetrics.length,
        security_threats:        allThreats.length,
        agent_anomalies:         allAnomalies.length,
        incidents:               incidents.length,
        cost_calculations:       allCostEntries.length,
        ai_savings:              aiSavings.length,
        pvcs:                    allPvcs.length,
        storage_recommendations: storageRecs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
