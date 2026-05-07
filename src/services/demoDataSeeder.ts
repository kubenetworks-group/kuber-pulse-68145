import { supabase } from "@/integrations/supabase/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(d: number) { return new Date(Date.now() - d * 24 * 3600_000).toISOString(); }
function minutesAgo(m: number) { return new Date(Date.now() - m * 60_000).toISOString(); }

function hash(s: string) {
  let h = 0;
  for (const c of s) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h).toString(36).slice(0, 6);
}

// ─── Generators ───────────────────────────────────────────────────────────────

function generateNodes(clusterName: string, provider: string, nodeCount: number, cpuUsagePct: number, memUsagePct: number) {
  const instanceTypes: Record<string, string[]> = {
    aws: ["t3.large", "t3.xlarge", "m5.xlarge", "m5.2xlarge"],
    gcp: ["n1-standard-4", "n1-standard-8", "e2-standard-4"],
    azure: ["Standard_D4s_v3", "Standard_D8s_v3", "Standard_B4ms"],
    digitalocean: ["s-4vcpu-8gb", "s-8vcpu-16gb"],
    magalu: ["mg1.medium", "mg1.large"],
  };
  const types = instanceTypes[provider] || instanceTypes.aws;
  const cpuPerNode = pick([4000, 6000, 8000]);
  const memPerNode = pick([8, 16, 32]) * 1024 * 1024 * 1024;
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    const isControl = i === 0;
    const name = isControl ? `${clusterName}-control-plane` : `${clusterName}-worker-${i}`;
    const cpuUsage = Math.round(cpuPerNode * Math.min(cpuUsagePct / 100 * rand(0.7, 1.3), 0.98));
    const memoryUsage = Math.round(memPerNode * Math.min(memUsagePct / 100 * rand(0.7, 1.3), 0.98));
    const labels: Record<string, string> = {
      "kubernetes.io/hostname": name,
      "beta.kubernetes.io/instance-type": pick(types),
      "topology.kubernetes.io/region": clusterName.split("-").slice(-2).join("-"),
    };
    if (isControl) labels["node-role.kubernetes.io/control-plane"] = "true";
    nodes.push({
      name, status: "Ready", osImage: "Ubuntu 22.04.3 LTS",
      kernelVersion: "5.15.0-91-generic", containerRuntime: "containerd://1.7.2",
      labels,
      capacity: { cpu: cpuPerNode, memory: memPerNode },
      usage: { cpu: cpuUsage, memory: memoryUsage },
    });
  }
  return { nodes };
}

const APP_NAMES = [
  "api-gateway", "auth-service", "payment-service", "user-service",
  "notification-service", "search-service", "recommendation-engine",
  "analytics-worker", "report-generator", "webhook-dispatcher",
  "cache-warmer", "data-pipeline", "ml-inference", "image-processor",
  "email-worker", "scheduler", "audit-logger", "config-manager",
];
const SYSTEM_PODS = [
  { name: "coredns", namespace: "kube-system" },
  { name: "kube-proxy", namespace: "kube-system" },
  { name: "metrics-server", namespace: "kube-system" },
  { name: "prometheus-server", namespace: "monitoring" },
  { name: "grafana", namespace: "monitoring" },
  { name: "loki", namespace: "monitoring" },
  { name: "nginx-ingress", namespace: "ingress-nginx" },
  { name: "cert-manager", namespace: "cert-manager" },
];

function generatePods(clusterName: string, totalPods: number, cpuUsagePct: number, memUsagePct: number) {
  const pods: any[] = [];
  const namespaces = ["default", "production", "staging", "backend", "frontend"];
  const sysPodCount = Math.min(8, Math.floor(totalPods * 0.15));

  for (let i = 0; i < sysPodCount; i++) {
    const sp = SYSTEM_PODS[i % SYSTEM_PODS.length];
    const restarts = i < 2 ? randInt(0, 3) : 0;
    pods.push({
      name: `${sp.name}-${hash(clusterName + i)}`, namespace: sp.namespace,
      phase: "Running", status: "Running", restarts,
      node: `${clusterName}-worker-${randInt(1, 3)}`,
      cpu: `${randInt(10, 200)}m`, memory: `${randInt(64, 512)}Mi`,
      containers: [{ name: sp.name, restart_count: restarts,
        resources: { limits: { cpu: "500m", memory: "512Mi" }, requests: { cpu: "50m", memory: "128Mi" } },
        readiness_probe: { http_get: { path: "/healthz", port: 8080 } },
        liveness_probe: { http_get: { path: "/healthz", port: 8080 } },
      }],
    });
  }

  const appPodCount = totalPods - sysPodCount;
  const statusWeights = cpuUsagePct > 80
    ? ["Running", "Running", "Running", "Running", "Pending", "Failed"]
    : ["Running", "Running", "Running", "Running", "Running", "Pending"];

  for (let i = 0; i < appPodCount; i++) {
    const app = APP_NAMES[i % APP_NAMES.length];
    const ns = namespaces[i % namespaces.length];
    const phase = pick(statusWeights);
    const restarts = phase === "Failed" ? randInt(5, 20) : phase === "Pending" ? 0 : randInt(0, 4);
    const cpuMilli = Math.round(cpuUsagePct / 100 * rand(10, 300));
    const memMi = Math.round(memUsagePct / 100 * rand(50, 500));
    const missingLimits = Math.random() < 0.2;
    const missingProbes = Math.random() < 0.25;
    pods.push({
      name: `${app}-${hash(clusterName + i)}-${hash(ns + i)}`, namespace: ns,
      phase, status: phase, restarts,
      node: `${clusterName}-worker-${randInt(1, 3)}`,
      cpu: `${cpuMilli}m`, memory: `${memMi}Mi`,
      containers: [{ name: app, restart_count: restarts,
        resources: missingLimits ? {} : {
          limits: { cpu: "1000m", memory: "1Gi" },
          requests: { cpu: `${Math.max(10, cpuMilli - 50)}m`, memory: `${Math.max(32, memMi - 100)}Mi` },
        },
        readiness_probe: missingProbes ? undefined : { http_get: { path: "/health", port: 8080 } },
        liveness_probe: missingProbes ? undefined : { http_get: { path: "/health", port: 8080 } },
      }],
    });
  }

  const running = pods.filter(p => p.phase === "Running").length;
  const pending = pods.filter(p => p.phase === "Pending").length;
  const failed = pods.filter(p => p.phase === "Failed").length;
  return { pods_summary: { total: pods.length, running, pending, failed }, pods_detail: pods };
}

function generateServices(clusterName: string, environment: string) {
  const baseServices = [
    { name: "api-gateway", type: "LoadBalancer", port: "80:30080/TCP,443:30443/TCP" },
    { name: "auth-service", type: "ClusterIP", port: "8080/TCP" },
    { name: "payment-service", type: "ClusterIP", port: "8080/TCP" },
    { name: "user-service", type: "ClusterIP", port: "8080/TCP" },
    { name: "notification-svc", type: "ClusterIP", port: "8080/TCP" },
    { name: "prometheus-server", type: "ClusterIP", port: "9090/TCP" },
    { name: "grafana", type: "NodePort", port: "3000:30300/TCP" },
    { name: "nginx-ingress", type: "LoadBalancer", port: "80:30080/TCP,443:30443/TCP" },
    { name: "kubernetes", type: "ClusterIP", port: "443/TCP" },
    { name: "kube-dns", type: "ClusterIP", port: "53/UDP,53/TCP" },
  ];
  const namespaces: Record<string, string> = {
    "api-gateway": environment === "production" ? "production" : "default",
    "auth-service": environment === "production" ? "production" : "default",
    "payment-service": "production", "user-service": "backend",
    "notification-svc": "backend", "prometheus-server": "monitoring",
    "grafana": "monitoring", "nginx-ingress": "ingress-nginx",
    "kubernetes": "default", "kube-dns": "kube-system",
  };
  return {
    services: baseServices.map(svc => ({
      name: svc.name, namespace: namespaces[svc.name] || "default", type: svc.type,
      cluster_ip: `10.${randInt(96, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
      external_ip: svc.type === "LoadBalancer" ? `${randInt(34, 52)}.${randInt(100, 200)}.${randInt(0, 255)}.${randInt(1, 254)}` : null,
      ports: svc.port,
    })),
  };
}

function generateIngresses(clusterName: string) {
  const domain = `${clusterName}.example.com`;
  return {
    ingresses: [
      { name: "api-ingress", namespace: "production", hosts: [`api.${domain}`, `www.${domain}`], tls: true, class_name: "nginx",
        rules: [{ host: `api.${domain}`, paths: ["/api", "/graphql"] }, { host: `www.${domain}`, paths: ["/"] }] },
      { name: "grafana-ingress", namespace: "monitoring", hosts: [`grafana.${domain}`], tls: true, class_name: "nginx",
        rules: [{ host: `grafana.${domain}`, paths: ["/"] }] },
    ],
  };
}

function generateNamespaceUsage(pods: any[]) {
  const nsMap: Record<string, number> = {};
  for (const pod of pods) nsMap[pod.namespace] = (nsMap[pod.namespace] || 0) + 1;
  return {
    namespaces: Object.entries(nsMap).map(([ns, count]) => ({
      namespace: ns, cpu_percent: randInt(10, 80), memory_percent: randInt(15, 85), pod_count: count,
    })),
  };
}

function generateEvents(pods: any[]) {
  const warningPods = pods.filter(p => p.restarts > 5 || p.phase === "Failed");
  const normalEvents = [
    { reason: "Pulled", message: "Successfully pulled image" },
    { reason: "Created", message: "Created container" },
    { reason: "Started", message: "Started container" },
    { reason: "Scheduled", message: "Successfully assigned to node" },
  ];
  const warningEvents = [
    { reason: "OOMKilling", message: "Container exceeded memory limit, killed" },
    { reason: "BackOff", message: "Back-off restarting failed container" },
    { reason: "FailedScheduling", message: "Insufficient resources on node" },
    { reason: "Unhealthy", message: "Readiness probe failed: connection refused" },
  ];
  const events: any[] = [];
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    const ev = pick(normalEvents); const pod = pick(pods);
    events.push({ type: "Normal", reason: ev.reason, message: ev.message, namespace: pod.namespace,
      involved_object: { kind: "Pod", name: pod.name, namespace: pod.namespace },
      last_time: new Date(now - randInt(0, 3600) * 1000).toISOString() });
  }
  for (const pod of warningPods.slice(0, 5)) {
    const ev = pick(warningEvents);
    events.push({ type: "Warning", reason: ev.reason, message: ev.message, namespace: pod.namespace,
      involved_object: { kind: "Pod", name: pod.name, namespace: pod.namespace },
      last_time: new Date(now - randInt(0, 1800) * 1000).toISOString() });
  }
  return { events };
}

function generateSecurity(pods: any[], environment: string) {
  const total = pods.length;
  const withLim = pods.filter(p => p.containers?.[0]?.resources?.limits).length;
  const withProbes = pods.filter(p => p.containers?.[0]?.readiness_probe).length;
  const coveragePct = environment === "production" ? randInt(65, 90) : randInt(30, 65);
  return {
    pod_security: { total_pods: total, pods_with_resource_limits: withLim,
      pods_without_resource_limits: total - withLim, pods_with_probes: withProbes,
      privileged_pods: randInt(0, 3), pods_as_root: randInt(0, 5) },
    network_policies: { total_namespaces: 6, covered_namespaces: Math.round(6 * coveragePct / 100), coverage_percent: coveragePct },
    ingress_controller: { detected: true, type: "nginx", namespace: "ingress-nginx", has_required_rbac: environment === "production" },
    rbac: { cluster_admin_bindings: randInt(1, 3), service_accounts_with_full_access: randInt(0, 2) },
  };
}

function generateSecurityThreats(clusterId: string, userId: string, environment: string, clusterName: string) {
  const threatTemplates = [
    { threat_type: "suspicious_process", severity: "high",
      title: "Processo suspeito detectado em pod de produção",
      description: `Processo 'nmap' detectado em container da namespace production no cluster ${clusterName}.`,
      ai_analysis: { threat_score: 0.82, confidence: 0.88, indicators: ["Ferramenta de port scan em container de produção"], recommendation: "Isolar container imediatamente" },
      ai_recommendation: "Remover pod suspeito e revisar permissões do ServiceAccount.",
      remediation_steps: ["Remover pod suspeito", "Analisar imagem Docker para backdoors"], is_attack: false },
    { threat_type: "privilege_escalation", severity: environment === "production" ? "critical" : "high",
      title: "Tentativa de escalação de privilégio detectada",
      description: `Container no cluster ${clusterName} tentou executar sudo e acessar /etc/passwd.`,
      ai_analysis: { threat_score: 0.91, confidence: 0.94, indicators: ["Comando sudo em container", "Acesso a /etc/passwd"], recommendation: "Encerrar pod imediatamente" },
      ai_recommendation: "Terminar pod comprometido e aplicar PodSecurityPolicy restrictiva.",
      remediation_steps: ["Terminar pod comprometido", "Aplicar PodSecurityPolicy restrictiva"], is_attack: true },
    { threat_type: "unauthorized_access", severity: "medium",
      title: "Acesso não autorizado à API do Kubernetes",
      description: `Múltiplas tentativas de acesso à API do Kubernetes com token inválido no cluster ${clusterName}.`,
      ai_analysis: { threat_score: 0.65, confidence: 0.79, indicators: ["401 Unauthorized em /api/v1/pods", "IP não autorizado"], recommendation: "Bloquear IP de origem" },
      ai_recommendation: "Bloquear IP de origem e rotacionar tokens comprometidos.",
      remediation_steps: ["Adicionar IP à blocklist", "Rotacionar tokens de service accounts"], is_attack: false },
    { threat_type: "crypto_mining", severity: "critical",
      title: "Mineração de criptomoeda detectada",
      description: `Alto uso de CPU (>95%) com padrão característico de pool de mineração no cluster ${clusterName}.`,
      ai_analysis: { threat_score: 0.97, confidence: 0.96, indicators: ["CPU 97% por 45+ minutos", "Processo xmrig identificado"], recommendation: "Eliminar pod imediatamente" },
      ai_recommendation: "Terminar todos os pods suspeitos e fazer varredura das imagens Docker.",
      remediation_steps: ["Terminar pods suspeitos", "Isolar namespace", "Rotacionar todos os secrets"], is_attack: true },
  ];
  const count = environment === "production" ? 4 : environment === "staging" ? 2 : 1;
  return threatTemplates.slice(0, count).map((t, i) => ({
    cluster_id: clusterId, user_id: userId,
    threat_type: t.threat_type, severity: t.severity,
    status: i > 1 ? "mitigated" : i === 0 ? "active" : "investigating",
    title: t.title, description: t.description,
    ai_analysis: t.ai_analysis, ai_recommendation: t.ai_recommendation,
    remediation_steps: t.remediation_steps, is_attack: t.is_attack,
    auto_remediated: i > 1, acknowledged: i > 1,
    created_at: minutesAgo(randInt(30, 480)),
  }));
}

function generateAgentAnomalies(clusterId: string, userId: string, cpuUsagePct: number, memUsagePct: number) {
  const anomalies: any[] = [];
  const now = Date.now();
  if (cpuUsagePct > 70) {
    anomalies.push({
      cluster_id: clusterId, user_id: userId, anomaly_type: "high_cpu",
      severity: cpuUsagePct > 85 ? "critical" : "high",
      description: `CPU usage at ${cpuUsagePct.toFixed(1)}% — sustained above threshold for 15+ minutes`,
      ai_analysis: { root_cause: "Elasticsearch bulk indexing consuming excess CPU during peak hours", confidence: 0.87, affected_nodes: randInt(2, 5), pattern: "recurring_peak" },
      recommendation: "Scale horizontally by adding 2 nodes or reschedule batch jobs to off-peak hours",
      auto_heal_applied: cpuUsagePct > 85, resolved: cpuUsagePct < 80,
      created_at: new Date(now - randInt(20, 120) * 60_000).toISOString(),
      resolved_at: cpuUsagePct < 80 ? new Date(now - randInt(5, 20) * 60_000).toISOString() : null,
    });
  }
  if (memUsagePct > 75) {
    anomalies.push({
      cluster_id: clusterId, user_id: userId, anomaly_type: "high_memory",
      severity: memUsagePct > 90 ? "critical" : "high",
      description: `Memory usage at ${memUsagePct.toFixed(1)}% — OOM killer risk detected`,
      ai_analysis: { root_cause: "Memory leak in nginx-ingress controller v1.9.4", confidence: 0.91, affected_pods: randInt(3, 8), leak_rate_mb_per_hour: randInt(50, 200) },
      recommendation: "Restart nginx-ingress pods and upgrade to v1.9.5",
      auto_heal_applied: memUsagePct > 90, resolved: false,
      created_at: new Date(now - randInt(10, 60) * 60_000).toISOString(), resolved_at: null,
    });
  }
  anomalies.push({
    cluster_id: clusterId, user_id: userId, anomaly_type: "pod_restart_loop", severity: "medium",
    description: `payment-service pod restarted ${randInt(8, 25)} times in last hour`,
    ai_analysis: { root_cause: "Database connection pool exhausted", confidence: 0.84, restart_count: randInt(8, 25), crash_reason: "OOMKilled" },
    recommendation: "Increase connection pool size and add memory limits.",
    auto_heal_applied: false, resolved: false,
    created_at: new Date(now - randInt(30, 90) * 60_000).toISOString(), resolved_at: null,
  });
  return anomalies;
}

function buildAgentMetrics(cluster: any) {
  const now = new Date().toISOString();
  const nodesData = generateNodes(cluster.name, cluster.provider, cluster.nodes, cluster.cpu_usage, cluster.memory_usage);
  const podResult = generatePods(cluster.name, cluster.pods, cluster.cpu_usage, cluster.memory_usage);
  const servicesData = generateServices(cluster.name, cluster.environment);
  const ingressesData = generateIngresses(cluster.name);
  const nsUsageData = generateNamespaceUsage(podResult.pods_detail);
  const eventsData = generateEvents(podResult.pods_detail);
  const securityData = generateSecurity(podResult.pods_detail, cluster.environment);
  return [
    { cluster_id: cluster.id, metric_type: "nodes", metric_data: nodesData, collected_at: now },
    { cluster_id: cluster.id, metric_type: "pods", metric_data: podResult.pods_summary, collected_at: now },
    { cluster_id: cluster.id, metric_type: "pod_details", metric_data: { pods: podResult.pods_detail }, collected_at: now },
    { cluster_id: cluster.id, metric_type: "services", metric_data: servicesData, collected_at: now },
    { cluster_id: cluster.id, metric_type: "ingresses", metric_data: ingressesData, collected_at: now },
    { cluster_id: cluster.id, metric_type: "namespace_usage", metric_data: nsUsageData, collected_at: now },
    { cluster_id: cluster.id, metric_type: "events", metric_data: eventsData, collected_at: now },
    { cluster_id: cluster.id, metric_type: "security", metric_data: securityData, collected_at: now },
  ];
}

function generateHistoricalCosts(cluster: any, userId: string) {
  const entries = [];
  const baseMonthly = cluster.monthly_cost;
  const computePct = 0.65, storagePct = 0.25, networkPct = 0.10;
  for (let d = 60; d >= 0; d--) {
    const date = new Date(Date.now() - d * 24 * 3600_000);
    const variation = 1 + (Math.random() - 0.5) * 0.3;
    const dayFactor = (date.getDay() === 0 || date.getDay() === 6) ? 0.85 : 1.05;
    const dailyCost = Number(((baseMonthly / 30) * variation * dayFactor).toFixed(2));
    entries.push({
      user_id: userId, cluster_id: cluster.id, is_demo: true,
      compute_cost: Number((dailyCost * computePct).toFixed(2)),
      storage_cost: Number((dailyCost * storagePct).toFixed(2)),
      network_cost: Number((dailyCost * networkPct).toFixed(2)),
      total_cost: dailyCost,
      calculation_date: date.toISOString(),
      period_start: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
      period_end: date.toISOString(),
      pricing_details: { provider: cluster.provider, region: cluster.region, nodes: cluster.nodes,
        breakdown: { compute: Number((dailyCost * computePct).toFixed(2)), storage: Number((dailyCost * storagePct).toFixed(2)), network: Number((dailyCost * networkPct).toFixed(2)), total: dailyCost } },
    });
  }
  return entries;
}

// ─── Main seeder ──────────────────────────────────────────────────────────────

export interface SeedResult {
  clusters: number;
  agent_metrics: number;
  security_threats: number;
  agent_anomalies: number;
  incidents: number;
  cost_calculations: number;
  pvcs: number;
  storage_recommendations: number;
}

export async function seedDemoData(): Promise<SeedResult> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Não autenticado");

  const userId = user.id;

  // ── Cleanup existing demo data ────────────────────────────────────────────
  await supabase.from('ai_cost_savings').delete().eq('user_id', userId).eq('is_demo', true);
  await supabase.from('cost_calculations').delete().eq('user_id', userId).eq('is_demo', true);
  await supabase.from('ai_incidents').delete().eq('user_id', userId).eq('is_demo', true);
  await supabase.from('pvcs').delete().eq('user_id', userId).eq('is_demo', true);

  const { data: existingDemo } = await supabase.from('clusters').select('id').eq('user_id', userId).eq('is_demo', true);
  if (existingDemo && existingDemo.length > 0) {
    const ids = existingDemo.map((c: any) => c.id);
    for (const cid of ids) {
      await supabase.from('agent_api_keys').delete().eq('cluster_id', cid);
      await supabase.from('agent_metrics').delete().eq('cluster_id', cid);
      await supabase.from('storage_recommendations').delete().eq('cluster_id', cid);
      await supabase.from('cluster_validation_results').delete().eq('cluster_id', cid);
      await supabase.from('agent_anomalies').delete().eq('cluster_id', cid);
      await supabase.from('security_threats').delete().eq('cluster_id', cid);
      await supabase.from('scan_history').delete().eq('cluster_id', cid);
    }
  }
  await supabase.from('clusters').delete().eq('user_id', userId).eq('is_demo', true);

  // ── Define 8 demo clusters ────────────────────────────────────────────────
  const clusters = [
    { id: crypto.randomUUID(), user_id: userId, name: 'prod-us-east-1', cluster_type: 'kubernetes', provider: 'aws', environment: 'production', region: 'us-east-1', api_endpoint: 'https://api.prod-us-east-1.k8s.aws', status: 'healthy', is_demo: true, nodes: 8, pods: 150, cpu_usage: 65.2, memory_usage: 72.5, storage_used_gb: 450.5, storage_total_gb: 1200.0, storage_available_gb: 749.5, monthly_cost: 2850.00, agent_last_seen_at: minutesAgo(2), agent_version: '1.4.2', last_sync: minutesAgo(2), created_at: daysAgo(120) },
    { id: crypto.randomUUID(), user_id: userId, name: 'prod-us-west-2', cluster_type: 'kubernetes', provider: 'aws', environment: 'production', region: 'us-west-2', api_endpoint: 'https://api.prod-us-west-2.k8s.aws', status: 'warning', is_demo: true, nodes: 6, pods: 120, cpu_usage: 87.8, memory_usage: 68.3, storage_used_gb: 320.2, storage_total_gb: 800.0, storage_available_gb: 479.8, monthly_cost: 2100.00, agent_last_seen_at: minutesAgo(1), agent_version: '1.4.2', last_sync: minutesAgo(1), created_at: daysAgo(90) },
    { id: crypto.randomUUID(), user_id: userId, name: 'prod-eu-west-1', cluster_type: 'kubernetes', provider: 'gcp', environment: 'production', region: 'europe-west1', api_endpoint: 'https://api.prod-eu-west-1.gcp', status: 'healthy', is_demo: true, nodes: 5, pods: 95, cpu_usage: 45.1, memory_usage: 58.9, storage_used_gb: 180.3, storage_total_gb: 600.0, storage_available_gb: 419.7, monthly_cost: 1750.00, agent_last_seen_at: minutesAgo(3), agent_version: '1.4.1', last_sync: minutesAgo(3), created_at: daysAgo(75) },
    { id: crypto.randomUUID(), user_id: userId, name: 'prod-asia-1', cluster_type: 'kubernetes', provider: 'gcp', environment: 'production', region: 'asia-southeast1', api_endpoint: 'https://api.prod-asia-1.gcp', status: 'critical', is_demo: true, nodes: 4, pods: 45, cpu_usage: 62.3, memory_usage: 94.7, storage_used_gb: 280.5, storage_total_gb: 500.0, storage_available_gb: 219.5, monthly_cost: 1650.00, agent_last_seen_at: minutesAgo(1), agent_version: '1.4.2', last_sync: minutesAgo(1), created_at: daysAgo(55) },
    { id: crypto.randomUUID(), user_id: userId, name: 'staging-us-1', cluster_type: 'kubernetes', provider: 'azure', environment: 'staging', region: 'eastus', api_endpoint: 'https://api.staging-us-1.azure', status: 'healthy', is_demo: true, nodes: 3, pods: 60, cpu_usage: 38.5, memory_usage: 45.2, storage_used_gb: 85.0, storage_total_gb: 300.0, storage_available_gb: 215.0, monthly_cost: 780.00, agent_last_seen_at: minutesAgo(5), agent_version: '1.4.2', last_sync: minutesAgo(5), created_at: daysAgo(45) },
    { id: crypto.randomUUID(), user_id: userId, name: 'staging-eu-1', cluster_type: 'kubernetes', provider: 'digitalocean', environment: 'staging', region: 'ams3', api_endpoint: 'https://api.staging-eu-1.do', status: 'warning', is_demo: true, nodes: 2, pods: 35, cpu_usage: 71.2, memory_usage: 63.8, storage_used_gb: 45.2, storage_total_gb: 150.0, storage_available_gb: 104.8, monthly_cost: 420.00, agent_last_seen_at: minutesAgo(8), agent_version: '1.3.9', last_sync: minutesAgo(8), created_at: daysAgo(30) },
    { id: crypto.randomUUID(), user_id: userId, name: 'dev-us-1', cluster_type: 'kubernetes', provider: 'magalu', environment: 'development', region: 'br-se1', api_endpoint: 'https://api.dev-us-1.magalu', status: 'healthy', is_demo: true, nodes: 2, pods: 25, cpu_usage: 22.1, memory_usage: 35.6, storage_used_gb: 32.1, storage_total_gb: 150.0, storage_available_gb: 117.9, monthly_cost: 280.00, agent_last_seen_at: minutesAgo(15), agent_version: '1.4.0', last_sync: minutesAgo(15), created_at: daysAgo(20) },
    { id: crypto.randomUUID(), user_id: userId, name: 'dev-br-1', cluster_type: 'kubernetes', provider: 'magalu', environment: 'development', region: 'br-ne1', api_endpoint: 'https://api.dev-br-1.magalu', status: 'warning', is_demo: true, nodes: 2, pods: 18, cpu_usage: 55.3, memory_usage: 48.5, storage_used_gb: 95.8, storage_total_gb: 250.0, storage_available_gb: 154.2, monthly_cost: 320.00, agent_last_seen_at: minutesAgo(1), agent_version: '1.4.1', last_sync: minutesAgo(1), created_at: daysAgo(5) },
  ];

  const { error: clustersError } = await supabase.from('clusters').insert(clusters);
  if (clustersError) throw new Error(`Falha ao criar clusters: ${clustersError.message}`);

  // ── Agent API Keys ────────────────────────────────────────────────────────
  const agentKeys = clusters.map(cluster => ({
    user_id: userId, cluster_id: cluster.id,
    name: `agent-${cluster.name}`,
    api_key: `kp_demo_${cluster.id.replace(/-/g, '').slice(0, 32)}`,
    api_key_prefix: `kp_demo_${cluster.name.slice(0, 10)}...`,
    last_seen: cluster.agent_last_seen_at,
    is_active: cluster.status !== 'critical' && cluster.status !== 'disconnected',
  }));
  const { error: agentKeysError } = await supabase.from('agent_api_keys').insert(agentKeys);
  if (agentKeysError) console.error('agent_api_keys error:', agentKeysError);

  // ── Agent metrics (8 per cluster, batched) ────────────────────────────────
  const allMetrics: any[] = [];
  for (const cluster of clusters) allMetrics.push(...buildAgentMetrics(cluster));
  for (let i = 0; i < allMetrics.length; i += 8) {
    const { error } = await supabase.from('agent_metrics').insert(allMetrics.slice(i, i + 8));
    if (error) console.error('agent_metrics batch error:', error);
  }

  // ── Security threats ──────────────────────────────────────────────────────
  const allThreats: any[] = [];
  for (const cluster of clusters) allThreats.push(...generateSecurityThreats(cluster.id, userId, cluster.environment, cluster.name));
  const { error: threatsError } = await supabase.from('security_threats').insert(allThreats);
  if (threatsError) console.error('security_threats error:', threatsError);

  // ── Agent anomalies ───────────────────────────────────────────────────────
  const allAnomalies: any[] = [];
  for (const cluster of clusters) allAnomalies.push(...generateAgentAnomalies(cluster.id, userId, cluster.cpu_usage, cluster.memory_usage));
  const { error: anomaliesError } = await supabase.from('agent_anomalies').insert(allAnomalies);
  if (anomaliesError) console.error('agent_anomalies error:', anomaliesError);

  // ── AI incidents ──────────────────────────────────────────────────────────
  const incidents = [
    { cluster_id: clusters[3].id, user_id: userId, is_demo: true, incident_type: 'high_memory', severity: 'critical', title: 'Critical: Memory usage at 94.7% in prod-asia-1', description: 'Cluster prod-asia-1 has reached critical memory levels (94.7%). Multiple pods are at risk of OOM eviction.', ai_analysis: { root_cause: 'Memory leak in nginx-ingress controller pods consuming 12GB+ RAM', impact: 'High risk of pod evictions and service disruptions', recommendation: 'Restart affected pods immediately', confidence: 0.92 }, auto_heal_action: 'restart_pod', action_taken: true, action_result: { success: true, details: 'Restarted 3 nginx-ingress pods. Memory usage dropped to 68.3%.', timestamp: minutesAgo(40), execution_time_ms: 2340 }, created_at: minutesAgo(45), resolved_at: minutesAgo(40) },
    { cluster_id: clusters[1].id, user_id: userId, is_demo: true, incident_type: 'pod_crash', severity: 'critical', title: 'Critical: Payment API pods crashing in prod-us-west-2', description: 'Payment processing API pods are in CrashLoopBackOff state. 15 restart attempts in last 10 minutes.', ai_analysis: { root_cause: 'Database connection pool exhausted due to connection leak in payment-service v2.1.4', impact: 'Payment processing down, affecting 2,500+ transactions/min', recommendation: 'Rollback to payment-service v2.1.3 immediately', confidence: 0.88 }, auto_heal_action: 'rollback_deployment', action_taken: true, action_result: { success: true, details: 'Rolled back payment-service from v2.1.4 to v2.1.3. All 5 pods now healthy.', timestamp: minutesAgo(115), execution_time_ms: 4200 }, created_at: minutesAgo(120), resolved_at: minutesAgo(115) },
    { cluster_id: clusters[7].id, user_id: userId, is_demo: true, incident_type: 'deployment_stuck', severity: 'critical', title: 'Critical: MongoDB deployment stuck in dev-br-1', description: 'MongoDB StatefulSet is stuck with 0/3 replicas ready. PersistentVolumeClaims failing to bind.', ai_analysis: { root_cause: "StorageClass 'fast-ssd' not found in cluster", impact: 'All database operations failing. 8 developers affected.', recommendation: "Update StatefulSet to use storage class 'standard'", confidence: 0.95 }, auto_heal_action: null, action_taken: false, action_result: null, created_at: minutesAgo(25), resolved_at: null },
    { cluster_id: clusters[1].id, user_id: userId, is_demo: true, incident_type: 'high_cpu', severity: 'high', title: 'High CPU usage (87.8%) in prod-us-west-2', description: 'Sustained high CPU usage detected across all nodes.', ai_analysis: { root_cause: 'Elasticsearch bulk indexing job consuming 6 CPU cores during peak hours', impact: 'API response times degraded by 230ms', recommendation: 'Scale up cluster by 2 nodes', confidence: 0.85 }, auto_heal_action: 'scale_up', action_taken: true, action_result: { success: true, details: 'Scaled from 6 to 8 nodes. CPU stabilized at 68.2%.', timestamp: minutesAgo(165), execution_time_ms: 180000 }, created_at: minutesAgo(180), resolved_at: minutesAgo(165) },
    { cluster_id: clusters[3].id, user_id: userId, is_demo: true, incident_type: 'disk_full', severity: 'high', title: 'Disk usage at 88% in prod-asia-1', description: 'Persistent volume /data is 88% full. Logs consuming excessive space.', ai_analysis: { root_cause: 'Application logs not being rotated. 45GB accumulated over 2 weeks.', impact: 'Disk will be full in 4 hours at current rate', recommendation: 'Clear old logs and enable log rotation', confidence: 0.91 }, auto_heal_action: 'clear_cache', action_taken: true, action_result: { success: true, details: 'Deleted logs older than 7 days (38GB freed). Disk now at 52%.', timestamp: minutesAgo(290), execution_time_ms: 8500 }, created_at: minutesAgo(300), resolved_at: minutesAgo(290) },
    { cluster_id: clusters[0].id, user_id: userId, is_demo: true, incident_type: 'node_not_ready', severity: 'high', title: 'Node prod-us-east-1-worker-3 not ready', description: 'Worker node entered NotReady state after kernel panic.', ai_analysis: { root_cause: 'Kernel panic caused by faulty memory module (DIMM B2)', impact: '18 pods rescheduled across remaining nodes', recommendation: 'Replace faulty hardware node', confidence: 0.89 }, auto_heal_action: 'cordon_node', action_taken: true, action_result: { success: true, details: 'Node cordoned and drained. 18 pods rescheduled successfully.', timestamp: daysAgo(2), execution_time_ms: 45000 }, created_at: daysAgo(2), resolved_at: daysAgo(2) },
    { cluster_id: clusters[2].id, user_id: userId, is_demo: true, incident_type: 'certificate_expiry', severity: 'medium', title: 'TLS certificate expiring in 7 days — prod-eu-west-1', description: 'TLS certificate for api.prod-eu-west-1.example.com expires in 7 days. Auto-renewal failed.', ai_analysis: { root_cause: "cert-manager failed to renew. Let's Encrypt rate limit reached", impact: 'API will become unreachable in 7 days', recommendation: 'Wait 24h for rate limit reset then trigger manual renewal', confidence: 0.98 }, auto_heal_action: null, action_taken: false, action_result: null, created_at: daysAgo(1), resolved_at: null },
  ];

  const { error: incidentsError } = await supabase.from('ai_incidents').insert(incidents);
  if (incidentsError) console.error('ai_incidents error:', incidentsError);

  // ── Historical cost calculations (60 days) ────────────────────────────────
  const allCostEntries: any[] = [];
  for (const cluster of clusters) allCostEntries.push(...generateHistoricalCosts(cluster, userId));
  for (let i = 0; i < allCostEntries.length; i += 200) {
    const { error } = await supabase.from('cost_calculations').insert(allCostEntries.slice(i, i + 200));
    if (error) console.error('cost_calculations batch error:', error);
  }

  // ── AI savings ────────────────────────────────────────────────────────────
  const allAiSavings: any[] = [];

  const { data: insertedIncidents } = await supabase
    .from('ai_incidents').select('id, cluster_id').eq('user_id', userId).eq('is_demo', true);

  // Helper: pick a random incident ID for a given cluster (or any if none found)
  const pickIncidentId = (clusterId: string) => {
    const clusterIncs = insertedIncidents?.filter((r: any) => r.cluster_id === clusterId) || [];
    const pool = clusterIncs.length > 0 ? clusterIncs : (insertedIncidents || []);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)].id;
  };

  // Downtime prevention: based on resolved incidents (current-month entries)
  if (!incidentsError) {
    const resolvedIncidents = incidents.filter(inc => inc.action_taken && inc.resolved_at);
    const downtimeSavings = resolvedIncidents.map((inc, index) => {
      const cluster = clusters.find(c => c.id === inc.cluster_id)!;
      const costPerMinute = cluster.monthly_cost / (30 * 24 * 60);
      const incidentRow = insertedIncidents?.find((r: any) => r.cluster_id === inc.cluster_id);
      const incidentId = incidentRow?.id || insertedIncidents?.[index]?.id;
      const downtimeAvoidedMinutes = inc.severity === 'critical' ? 30 : 15;
      const estimatedSavings = Number((downtimeAvoidedMinutes * costPerMinute * 10).toFixed(2));
      return {
        user_id: userId, incident_id: incidentId,
        cluster_id: inc.cluster_id, is_demo: true,
        downtime_avoided_minutes: downtimeAvoidedMinutes,
        cost_per_minute: Number(costPerMinute.toFixed(4)),
        estimated_savings: estimatedSavings, saving_type: 'downtime_prevention',
        calculation_details: { severity: inc.severity, revenue_multiplier: 10, assumption: 'Based on downtime avoided and revenue impact' },
      };
    }).filter(s => s.incident_id);
    allAiSavings.push(...downtimeSavings);
  }

  // Historical AI savings for all clusters: 3 types across last 6 months
  if (insertedIncidents && insertedIncidents.length > 0) {
    for (const cluster of clusters) {
      const baseSavingsPct = 0.08 + Math.random() * 0.07; // 8-15% of monthly cost
      for (let monthsBack = 5; monthsBack >= 0; monthsBack--) {
        const monthDate = new Date(Date.now());
        monthDate.setMonth(monthDate.getMonth() - monthsBack);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

        const variation = 1 + (Math.random() - 0.5) * 0.4;
        const totalMonthlySavings = cluster.monthly_cost * baseSavingsPct * variation;

        // Split savings across 3 types with realistic proportions
        const downtimePct = 0.5 + Math.random() * 0.1;   // ~50-60%
        const resourcePct = 0.25 + Math.random() * 0.1;  // ~25-35%
        const scalePct = 1 - downtimePct - resourcePct;  // remainder

        const downtimeSaving = Number((totalMonthlySavings * downtimePct).toFixed(2));
        const resourceSaving = Number((totalMonthlySavings * resourcePct).toFixed(2));
        const scaleSaving = Number((totalMonthlySavings * scalePct).toFixed(2));

        const dayOffset = randInt(1, 20);
        const costPerMinute = Number((cluster.monthly_cost / (30 * 24 * 60)).toFixed(4));

        const incId1 = pickIncidentId(cluster.id);
        const incId2 = pickIncidentId(cluster.id);
        const incId3 = pickIncidentId(cluster.id);
        if (!incId1 || !incId2 || !incId3) continue;

        allAiSavings.push({
          user_id: userId, cluster_id: cluster.id, is_demo: true,
          incident_id: incId1,
          downtime_avoided_minutes: Math.max(1, Math.round(downtimeSaving / (costPerMinute * 10))),
          cost_per_minute: costPerMinute,
          estimated_savings: downtimeSaving,
          saving_type: 'downtime_prevention',
          created_at: new Date(monthStart.getTime() + dayOffset * 24 * 3600_000).toISOString(),
          calculation_details: { method: 'historical', assumption: 'Auto-heal actions preventing cluster downtime' },
        });

        allAiSavings.push({
          user_id: userId, cluster_id: cluster.id, is_demo: true,
          incident_id: incId2,
          downtime_avoided_minutes: 0,
          cost_per_minute: costPerMinute,
          estimated_savings: resourceSaving,
          saving_type: 'resource_optimization',
          created_at: new Date(monthStart.getTime() + (dayOffset + 3) * 24 * 3600_000).toISOString(),
          calculation_details: { method: 'historical', optimized_nodes: randInt(1, 3), assumption: 'Right-sizing pods and removing idle resources' },
        });

        allAiSavings.push({
          user_id: userId, cluster_id: cluster.id, is_demo: true,
          incident_id: incId3,
          downtime_avoided_minutes: 0,
          cost_per_minute: costPerMinute,
          estimated_savings: scaleSaving,
          saving_type: 'scale_optimization',
          created_at: new Date(monthStart.getTime() + (dayOffset + 6) * 24 * 3600_000).toISOString(),
          calculation_details: { method: 'historical', assumption: 'Predictive auto-scaling reduced over-provisioning' },
        });
      }
    }
  }

  if (allAiSavings.length > 0) {
    for (let i = 0; i < allAiSavings.length; i += 200) {
      const { error } = await supabase.from('ai_cost_savings').insert(allAiSavings.slice(i, i + 200));
      if (error) console.error('ai_cost_savings batch error:', error);
    }
  }

  // ── PVCs ──────────────────────────────────────────────────────────────────
  const storageClasses = ['gp3', 'gp2', 'io1', 'io2', 'standard', 'fast-ssd', 'ssd', 'hdd'];
  const pvcNamespaces = ['default', 'production', 'staging', 'monitoring', 'logging', 'database'];
  const pvcNames = ['data', 'logs', 'backups', 'cache', 'uploads', 'temp', 'postgres', 'mongodb', 'elasticsearch', 'redis'];
  const allPvcs: any[] = [];
  for (const cluster of clusters) {
    const numPvcs = randInt(4, 8);
    for (let i = 0; i < numPvcs; i++) {
      const requestedGb = pick([10, 20, 50, 100, 200, 500]);
      const requestedBytes = requestedGb * 1024 * 1024 * 1024;
      const usagePct = Math.random() * 100;
      allPvcs.push({
        id: crypto.randomUUID(), cluster_id: cluster.id, user_id: userId, is_demo: true,
        name: `${pvcNames[i % pvcNames.length]}-${cluster.environment}-${randInt(1, 99)}`,
        namespace: pick(pvcNamespaces), storage_class: pick(storageClasses),
        requested_bytes: requestedBytes, used_bytes: Math.floor(requestedBytes * (usagePct / 100)),
        status: Math.random() > 0.9 ? 'pending' : 'bound',
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 3600000).toISOString(),
        last_sync: minutesAgo(randInt(1, 60)),
      });
    }
  }
  const { error: pvcsError } = await supabase.from('pvcs').insert(allPvcs);
  if (pvcsError) console.error('pvcs error:', pvcsError);

  // ── Storage recommendations ───────────────────────────────────────────────
  const storageRecs: any[] = [];
  if (!pvcsError) {
    allPvcs.filter((_, idx) => idx % 2 === 0).slice(0, 8).forEach((pvc, index) => {
      const usagePct = (pvc.used_bytes / pvc.requested_bytes) * 100;
      const requestedGb = pvc.requested_bytes / (1024 ** 3);
      const usedGb = pvc.used_bytes / (1024 ** 3);
      let recommendationType: string, recommendedSizeGb: number, potentialSavings: number, aiReasoning: string, priority: string;
      if (usagePct < 20) {
        recommendationType = 'downsize'; recommendedSizeGb = Math.ceil(usedGb * 1.5);
        potentialSavings = (requestedGb - recommendedSizeGb) * 0.10; priority = 'medium';
        aiReasoning = `Volume usa apenas ${usagePct.toFixed(1)}% dos ${requestedGb.toFixed(0)}GB. Reduzir para ${recommendedSizeGb}GB economiza $${potentialSavings.toFixed(2)}/mês.`;
      } else if (usagePct > 85) {
        recommendationType = 'upsize'; recommendedSizeGb = Math.ceil(requestedGb * 1.3);
        potentialSavings = 0; priority = usagePct > 95 ? 'critical' : 'high';
        aiReasoning = `Volume em ${usagePct.toFixed(1)}% de uso. Risco de volume cheio. Aumentar para ${recommendedSizeGb}GB previne falhas.`;
      } else if (usagePct < 40) {
        recommendationType = 'downsize'; recommendedSizeGb = Math.ceil(usedGb * 2);
        potentialSavings = (requestedGb - recommendedSizeGb) * 0.10; priority = 'low';
        aiReasoning = `Volume subutilizado (${usagePct.toFixed(1)}%). Ajustar para ${recommendedSizeGb}GB pode economizar $${potentialSavings.toFixed(2)}/mês.`;
      } else { return; }
      const recStatus = index < 2 ? 'applied' : index < 4 ? 'accepted' : 'pending';
      storageRecs.push({
        id: crypto.randomUUID(), user_id: userId, cluster_id: pvc.cluster_id,
        pvc_name: pvc.name, namespace: pvc.namespace,
        recommendation_type: recommendationType,
        current_size_gb: Number(requestedGb.toFixed(2)), recommended_size_gb: Number(recommendedSizeGb.toFixed(2)),
        current_usage_gb: Number(usedGb.toFixed(2)), avg_usage_percent: Number(usagePct.toFixed(2)),
        max_usage_percent: Number(Math.min(usagePct * 1.1, 100).toFixed(2)),
        p95_usage_percent: Number(Math.min(usagePct * 1.05, 100).toFixed(2)),
        potential_savings_month: Number(Math.max(potentialSavings, 0).toFixed(2)),
        ai_reasoning: aiReasoning, ai_confidence: Number((0.80 + Math.random() * 0.15).toFixed(2)),
        priority, status: recStatus, days_analyzed: 7,
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 3600000).toISOString(),
        applied_at: index < 2 ? minutesAgo(randInt(60, 2880)) : null,
      });
    });
    if (storageRecs.length > 0) {
      const { error } = await supabase.from('storage_recommendations').insert(storageRecs);
      if (error) console.error('storage_recommendations error:', error);
    }
  }

  return {
    clusters: clusters.length,
    agent_metrics: allMetrics.length,
    security_threats: allThreats.length,
    agent_anomalies: allAnomalies.length,
    incidents: incidents.length,
    cost_calculations: allCostEntries.length,
    pvcs: allPvcs.length,
    storage_recommendations: storageRecs.length,
  };
}

// ─── Generate AI savings (standalone, for existing clusters) ─────────────────

export async function generateAISavings(): Promise<{ savings_created: number; clusters_processed: number }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Não autenticado");
  const userId = user.id;

  // Get all clusters for this user
  const { data: clusters, error: clustersError } = await supabase
    .from('clusters')
    .select('id, monthly_cost')
    .eq('user_id', userId);

  if (clustersError) throw clustersError;
  if (!clusters || clusters.length === 0) throw new Error("Nenhum cluster encontrado. Gere os dados demo primeiro.");

  // Delete existing demo savings
  await supabase.from('ai_cost_savings').delete().eq('user_id', userId).eq('is_demo', true);

  // Ensure each cluster has incidents (needed for FK constraint)
  const clusterIncidentMap: Record<string, string[]> = {};

  for (const cluster of clusters) {
    const { data: existingIncidents } = await supabase
      .from('ai_incidents')
      .select('id')
      .eq('cluster_id', cluster.id)
      .eq('user_id', userId)
      .limit(3);

    let incidentIds = (existingIncidents || []).map((i: any) => i.id);

    if (incidentIds.length === 0) {
      // Create demo incidents for this cluster (values must match DB CHECK constraints)
      const templates = [
        {
          cluster_id: cluster.id, user_id: userId, is_demo: true,
          incident_type: 'pod_crash', severity: 'high',
          title: 'Pod em CrashLoopBackOff',
          description: 'Pod reiniciando continuamente devido a falha de configuração',
          ai_analysis: { root_cause: 'Configuração incorreta de variável de ambiente', confidence: 0.95 },
          auto_heal_action: 'restart_pod',
          action_taken: true, action_result: { status: 'success' },
          resolved_at: new Date().toISOString(),
        },
        {
          cluster_id: cluster.id, user_id: userId, is_demo: true,
          incident_type: 'high_cpu', severity: 'medium',
          title: 'Uso excessivo de CPU detectado',
          description: 'Container consumindo acima do limite configurado',
          ai_analysis: { root_cause: 'Requests/limits mal configurados', confidence: 0.88 },
          auto_heal_action: 'optimize_resources',
          action_taken: true, action_result: { status: 'success' },
          resolved_at: new Date().toISOString(),
        },
        {
          cluster_id: cluster.id, user_id: userId, is_demo: true,
          incident_type: 'high_memory', severity: 'critical',
          title: 'Memory Leak Detectado',
          description: 'Aplicação com vazamento de memória identificado pela IA',
          ai_analysis: { root_cause: 'Memory leak no código da aplicação', confidence: 0.92 },
          auto_heal_action: 'restart_pod',
          action_taken: true, action_result: { status: 'success' },
          resolved_at: new Date().toISOString(),
        },
      ];

      const { data: created, error: incErr } = await supabase
        .from('ai_incidents').insert(templates).select('id');

      if (incErr) {
        throw new Error(`Falha ao criar incidents para o cluster: ${incErr.message}`);
      }
      incidentIds = (created || []).map((i: any) => i.id);
    }

    clusterIncidentMap[cluster.id] = incidentIds;
  }

  // Generate savings across last 6 months (3 types per cluster per month)
  const savingsToInsert: any[] = [];
  const now = new Date();

  for (const cluster of clusters) {
    const incidentIds = clusterIncidentMap[cluster.id];
    if (!incidentIds || incidentIds.length === 0) continue;

    const baseMonthlyCost = Number(cluster.monthly_cost) || rand(500, 5000);
    const baseSavingsPct = rand(0.08, 0.15);

    for (let monthsBack = 5; monthsBack >= 0; monthsBack--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1).getTime();

      const variation = 1 + (Math.random() - 0.5) * 0.4;
      const totalMonthlySavings = baseMonthlyCost * baseSavingsPct * variation;

      const downtimePct = rand(0.50, 0.60);
      const resourcePct = rand(0.25, 0.35);
      const scalePct = 1 - downtimePct - resourcePct;

      const downtimeSaving = Number((totalMonthlySavings * downtimePct).toFixed(2));
      const resourceSaving = Number((totalMonthlySavings * resourcePct).toFixed(2));
      const scaleSaving = Number((totalMonthlySavings * scalePct).toFixed(2));

      const costPerMinute = Number((baseMonthlyCost / (30 * 24 * 60)).toFixed(4));
      const dayOffset = randInt(1, 20);

      const incId1 = incidentIds[0 % incidentIds.length];
      const incId2 = incidentIds[1 % incidentIds.length];
      const incId3 = incidentIds[2 % incidentIds.length];

      savingsToInsert.push({
        user_id: userId, cluster_id: cluster.id, is_demo: true,
        incident_id: incId1, saving_type: 'downtime_prevention',
        estimated_savings: downtimeSaving, cost_per_minute: costPerMinute,
        downtime_avoided_minutes: Math.max(1, Math.round(downtimeSaving / (costPerMinute * 10))),
        calculation_details: { method: 'historical', assumption: 'Auto-heal actions prevented cluster downtime' },
        created_at: new Date(monthStart + dayOffset * 24 * 3600_000).toISOString(),
      });

      savingsToInsert.push({
        user_id: userId, cluster_id: cluster.id, is_demo: true,
        incident_id: incId2, saving_type: 'resource_optimization',
        estimated_savings: resourceSaving, cost_per_minute: costPerMinute,
        downtime_avoided_minutes: 0,
        calculation_details: { method: 'historical', assumption: 'Right-sizing pods and removing idle resources' },
        created_at: new Date(monthStart + (dayOffset + 3) * 24 * 3600_000).toISOString(),
      });

      savingsToInsert.push({
        user_id: userId, cluster_id: cluster.id, is_demo: true,
        incident_id: incId3, saving_type: 'scale_optimization',
        estimated_savings: scaleSaving, cost_per_minute: costPerMinute,
        downtime_avoided_minutes: 0,
        calculation_details: { method: 'historical', assumption: 'Predictive auto-scaling reduced over-provisioning' },
        created_at: new Date(monthStart + (dayOffset + 6) * 24 * 3600_000).toISOString(),
      });
    }
  }

  if (savingsToInsert.length === 0) {
    throw new Error("Nenhum saving gerado — verifique se os clusters possuem incidents válidos.");
  }

  let totalInserted = 0;
  for (let i = 0; i < savingsToInsert.length; i += 200) {
    const { error } = await supabase.from('ai_cost_savings').insert(savingsToInsert.slice(i, i + 200));
    if (error) throw new Error(`Erro ao inserir economias: ${error.message}`);
    totalInserted += Math.min(200, savingsToInsert.length - i);
  }

  return { savings_created: totalInserted, clusters_processed: Object.keys(clusterIncidentMap).length };
}

// ─── Delete demo data ─────────────────────────────────────────────────────────

export async function deleteDemoData(): Promise<{ clusters: number; incidents: number }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Não autenticado");
  const userId = user.id;

  await supabase.from('ai_cost_savings').delete().eq('user_id', userId).eq('is_demo', true);
  await supabase.from('cost_calculations').delete().eq('user_id', userId).eq('is_demo', true);
  await supabase.from('pvcs').delete().eq('user_id', userId).eq('is_demo', true);

  const { data: existingDemo } = await supabase.from('clusters').select('id').eq('user_id', userId).eq('is_demo', true);
  const ids = (existingDemo || []).map((c: any) => c.id);
  for (const cid of ids) {
    await supabase.from('agent_api_keys').delete().eq('cluster_id', cid);
    await supabase.from('agent_metrics').delete().eq('cluster_id', cid);
    await supabase.from('storage_recommendations').delete().eq('cluster_id', cid);
    await supabase.from('cluster_validation_results').delete().eq('cluster_id', cid);
    await supabase.from('agent_anomalies').delete().eq('cluster_id', cid);
    await supabase.from('security_threats').delete().eq('cluster_id', cid);
    await supabase.from('scan_history').delete().eq('cluster_id', cid);
  }

  const { data: deletedIncidents } = await supabase.from('ai_incidents').delete().eq('user_id', userId).eq('is_demo', true).select();
  const { data: deletedClusters } = await supabase.from('clusters').delete().eq('user_id', userId).eq('is_demo', true).select();

  return { clusters: (deletedClusters || []).length, incidents: (deletedIncidents || []).length };
}
