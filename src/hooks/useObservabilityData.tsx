import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";

export interface ContainerInfo {
  name: string;
  ready: boolean;
  restart_count: number;
  state: { status: string; reason?: string; exit_code?: number };
  last_state?: { status: string; reason?: string; exit_code?: number };
  image?: string;
  liveness_probe?: boolean;
  readiness_probe?: boolean;
  startup_probe?: boolean;
  resources?: {
    limits?: { cpu?: number; memory?: number };
    requests?: { cpu?: number; memory?: number };
  };
}

export interface PodCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface PodData {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  cpu: string;
  memory: string;
  node: string;
  controlled_by_kind?: string;
  controlled_by_name?: string;
  qos_class?: string;
  labels?: Record<string, string>;
  containers?: ContainerInfo[];
  created_at?: string;
  conditions?: PodCondition[];
}

interface ServiceData {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string | null;
  ports: string;
}

interface IngressData {
  name: string;
  namespace: string;
  hosts: string[];
  tls: boolean;
  rules: { host: string; paths: string[] }[];
  className: string | null;
}

export interface DeploymentData {
  name: string;
  namespace: string;
  desired: number;
  ready: number;
  available: number;
  updated: number;
}

export interface DaemonSetData {
  name: string;
  namespace: string;
  desired: number;
  ready: number;
  available: number;
  updated: number;
}

export interface StatefulSetData {
  name: string;
  namespace: string;
  desired: number;
  ready: number;
  available: number;
  updated: number;
}

export interface JobData {
  name: string;
  namespace: string;
  status: string;
  completions: number;
  failed: number;
  active: number;
}

export interface CronJobData {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  active: number;
  last_schedule: string | null;
}

export interface NetworkPolicyData {
  name: string;
  namespace: string;
  policy_types: string[];
}

interface NamespaceUsage {
  namespace: string;
  cpuPercent: number;
  memoryPercent: number;
  podCount: number;
}

interface AgentStatus {
  name: string;
  installed: boolean;
  namespace: string | null;
}

export const useObservabilityData = () => {
  const { selectedClusterId } = useCluster();
  const [pods, setPods] = useState<PodData[]>([]);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [ingresses, setIngresses] = useState<IngressData[]>([]);
  const [deployments, setDeployments] = useState<DeploymentData[]>([]);
  const [daemonSets, setDaemonSets] = useState<DaemonSetData[]>([]);
  const [statefulSets, setStatefulSets] = useState<StatefulSetData[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJobData[]>([]);
  const [networkPolicies, setNetworkPolicies] = useState<NetworkPolicyData[]>([]);
  const [namespaceUsage, setNamespaceUsage] = useState<NamespaceUsage[]>([]);
  const [hasResourceData, setHasResourceData] = useState(false);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!selectedClusterId) return;
    // Only show full loading spinner on first fetch; background refreshes are silent
    if (!hasDataRef.current) setLoading(true);

    try {
      // Fetch latest metrics from agent_metrics
      const { data: metrics, error } = await supabase
        .from("agent_metrics")
        .select("*")
        .eq("cluster_id", selectedClusterId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching observability metrics:", error);
        setLoading(false);
        return;
      }

      if (!metrics || metrics.length === 0) {
        setLoading(false);
        hasDataRef.current = true;
        return;
      }

      // Find the latest metric of each type
      const latestByType: Record<string, any> = {};
      for (const m of metrics) {
        if (!latestByType[m.metric_type]) {
          latestByType[m.metric_type] = m;
        }
      }

      console.log("[observability] metric types available:", Object.keys(latestByType));

      // Parse pods data
      const podsMetric = latestByType["pod_details"] || latestByType["pods"] || latestByType["pod_status"];
      if (podsMetric) {
        const data = podsMetric.metric_data as any;
        const podList: PodData[] = [];

        const parsePod = (p: any, nsOverride?: string): PodData => ({
          name: p.name || p.pod_name || "unknown",
          namespace: nsOverride || p.namespace || "default",
          status: p.status || p.phase || "Unknown",
          restarts: p.restarts || p.restart_count || p.total_restarts || 0,
          cpu: p.cpu || p.cpu_usage || "0m",
          memory: p.memory || p.memory_usage || "0Mi",
          node: p.node || p.node_name || "",
          controlled_by_kind: p.controlled_by_kind || "",
          controlled_by_name: p.controlled_by_name || "",
          qos_class: p.qos_class || "",
          labels: p.labels || {},
          containers: Array.isArray(p.containers) ? p.containers : [],
          created_at: p.created_at || "",
          conditions: Array.isArray(p.conditions) ? p.conditions : [],
        });

        if (data?.pods && Array.isArray(data.pods)) {
          for (const p of data.pods) podList.push(parsePod(p));
        } else if (data?.namespaces && typeof data.namespaces === "object") {
          for (const [ns, nsData] of Object.entries(data.namespaces as Record<string, any>)) {
            if (nsData?.pods && Array.isArray(nsData.pods)) {
              for (const p of nsData.pods) podList.push(parsePod(p, ns));
            }
          }
        }
        setPods(podList);
        setLastSync(podsMetric.collected_at);
      }

      // Parse services data
      // Primary: "services" or "service_list" metric — has full detail
      // Fallback: "namespace_resources" — has service names per namespace
      const svcMetric = latestByType["services"] || latestByType["service_list"];
      const svcList: ServiceData[] = [];

      const parsePorts = (s: any): string => {
        if (Array.isArray(s.ports)) {
          return s.ports
            .map((p: any) => {
              const proto = (p.protocol || "TCP").toLowerCase();
              return p.node_port
                ? `${p.port}:${p.node_port}/${proto}`
                : `${p.port}/${proto}`;
            })
            .join(", ");
        }
        return typeof s.ports === "string" ? s.ports : "";
      };

      if (svcMetric) {
        const data = svcMetric.metric_data as any;
        const rawList: any[] = data?.services || data?.items || [];
        for (const s of rawList) {
          const lbIPs = s.lb_ingress && s.lb_ingress.length > 0 ? s.lb_ingress : s.external_ips || [];
          svcList.push({
            name: s.name || "unknown",
            namespace: s.namespace || "default",
            type: s.type || s.service_type || "ClusterIP",
            clusterIP: s.cluster_ip || s.clusterIP || "None",
            externalIP: lbIPs.length > 0 ? lbIPs[0] : (s.external_ip || s.externalIP || null),
            ports: parsePorts(s),
          });
        }
      } else {
        // Fallback: extract from namespace_resources (has service names per NS)
        const nsResMetric = latestByType["namespace_resources"];
        if (nsResMetric) {
          const data = nsResMetric.metric_data as any;
          console.log("[observability] namespace_resources sample (first ns):", data?.namespaces?.[0]);
          const systemNS = new Set(["kube-system", "kube-public", "kube-node-lease"]);

          // Format A: { namespaces: [{ name, service_list, services, ... }] }
          if (data?.namespaces && Array.isArray(data.namespaces)) {
            for (const ns of data.namespaces as any[]) {
              const nsName: string = ns.name || ns.namespace || "unknown";
              if (systemNS.has(nsName)) continue;

              // Full service objects
              const fullSvcs: any[] = ns.services || [];
              for (const s of fullSvcs) {
                const lbIPs = s.lb_ingress?.length > 0 ? s.lb_ingress : s.external_ips || [];
                svcList.push({
                  name: s.name || "unknown",
                  namespace: nsName,
                  type: s.type || s.service_type || "ClusterIP",
                  clusterIP: s.cluster_ip || s.clusterIP || "—",
                  externalIP: lbIPs.length > 0 ? lbIPs[0] : (s.external_ip || null),
                  ports: parsePorts(s),
                });
              }

              // Name-only list
              if (fullSvcs.length === 0) {
                const nameList: string[] = ns.service_list || ns.service_names || [];
                for (const svcName of nameList) {
                  svcList.push({
                    name: svcName,
                    namespace: nsName,
                    type: "ClusterIP",
                    clusterIP: "—",
                    externalIP: null,
                    ports: "",
                  });
                }
              }
            }
          }
        }
      }
      console.log("[observability] services parsed:", svcList.length, svcList.slice(0, 2));
      setServices(svcList);

      // Parse ingress data
      const ingMetric = latestByType["ingresses"] || latestByType["ingress_list"];
      const ingList: IngressData[] = [];

      if (ingMetric) {
        const data = ingMetric.metric_data as any;
        const rawList: any[] = data?.ingresses || data?.items || [];
        for (const ing of rawList) {
          // Derive hosts from rules if not present as top-level field
          let hosts: string[] = ing.hosts || [];
          if (hosts.length === 0 && Array.isArray(ing.rules)) {
            hosts = ing.rules.map((r: any) => r.host).filter(Boolean);
          }
          ingList.push({
            name: ing.name || "unknown",
            namespace: ing.namespace || "default",
            hosts,
            tls: !!(ing.tls || (Array.isArray(ing.tls_hosts) && ing.tls_hosts.length > 0)),
            rules: ing.rules || [],
            className: ing.class_name || ing.ingressClassName || ing.ingress_class || null,
          });
        }
      } else {
        // Fallback: extract from namespace_resources
        const nsResMetric = latestByType["namespace_resources"];
        if (nsResMetric) {
          const data = nsResMetric.metric_data as any;
          console.log("[observability] ingress fallback - namespace_resources ns[0]:", data?.namespaces?.[0]);
          const systemNS = new Set(["kube-system", "kube-public", "kube-node-lease"]);
          if (data?.namespaces && Array.isArray(data.namespaces)) {
            for (const ns of data.namespaces as any[]) {
              const nsName: string = ns.name || ns.namespace || "unknown";
              if (systemNS.has(nsName)) continue;
              const ingresses: any[] = ns.ingresses || [];
              for (const ing of ingresses) {
                const hosts: string[] = ing.hosts || (Array.isArray(ing.rules) ? ing.rules.map((r: any) => r.host).filter(Boolean) : []);
                ingList.push({
                  name: ing.name || "unknown",
                  namespace: nsName,
                  hosts,
                  tls: !!(ing.tls),
                  rules: ing.rules || [],
                  className: ing.class_name || ing.ingressClassName || null,
                });
              }
            }
          }
        }
      }
      console.log("[observability] ingresses parsed:", ingList.length, ingList.slice(0, 2));
      setIngresses(ingList);

      // Parse deployments
      const deplMetric = latestByType["deployments"];
      if (deplMetric) {
        const raw: any[] = (deplMetric.metric_data as any)?.deployments || [];
        setDeployments(raw.map((d: any) => ({
          name: d.name || "unknown",
          namespace: d.namespace || "default",
          desired: d.desired ?? d.replicas ?? 0,
          ready: d.ready ?? d.ready_replicas ?? 0,
          available: d.available ?? d.available_replicas ?? 0,
          updated: d.updated ?? d.updated_replicas ?? 0,
        })));
      }

      // Parse daemonsets
      const dsMetric = latestByType["daemonsets"];
      if (dsMetric) {
        const raw: any[] = (dsMetric.metric_data as any)?.daemonsets || [];
        setDaemonSets(raw.map((d: any) => ({
          name: d.name || "unknown",
          namespace: d.namespace || "default",
          desired: d.desired ?? d.desired_number_scheduled ?? 0,
          ready: d.ready ?? d.number_ready ?? 0,
          available: d.available ?? d.number_available ?? 0,
          updated: d.updated ?? d.updated_number_scheduled ?? 0,
        })));
      }

      // Parse statefulsets
      const stsMetric = latestByType["statefulsets"];
      if (stsMetric) {
        const raw: any[] = (stsMetric.metric_data as any)?.statefulsets || [];
        setStatefulSets(raw.map((s: any) => ({
          name: s.name || "unknown",
          namespace: s.namespace || "default",
          desired: s.desired ?? s.replicas ?? 0,
          ready: s.ready ?? s.ready_replicas ?? 0,
          available: s.available ?? s.current_replicas ?? 0,
          updated: s.updated ?? s.updated_replicas ?? 0,
        })));
      }

      // Parse jobs
      const jobsMetric = latestByType["jobs"];
      if (jobsMetric) {
        const raw: any[] = (jobsMetric.metric_data as any)?.jobs || [];
        setJobs(raw.map((j: any) => ({
          name: j.name || "unknown",
          namespace: j.namespace || "default",
          status: j.status || "Unknown",
          completions: j.completions ?? 0,
          failed: j.failed ?? 0,
          active: j.active ?? 0,
        })));
      }

      // Parse cronjobs
      const cjMetric = latestByType["cronjobs"];
      if (cjMetric) {
        const raw: any[] = (cjMetric.metric_data as any)?.cronjobs || [];
        setCronJobs(raw.map((c: any) => ({
          name: c.name || "unknown",
          namespace: c.namespace || "default",
          schedule: c.schedule || "",
          suspend: c.suspend ?? false,
          active: c.active ?? 0,
          last_schedule: c.last_schedule ?? null,
        })));
      }

      // Parse networkpolicies
      const npMetric = latestByType["networkpolicies"];
      if (npMetric) {
        const raw: any[] = (npMetric.metric_data as any)?.networkpolicies || [];
        setNetworkPolicies(raw.map((n: any) => ({
          name: n.name || "unknown",
          namespace: n.namespace || "default",
          policy_types: Array.isArray(n.policy_types) ? n.policy_types : [],
        })));
      }

      // Parse namespace CPU/memory usage — derived from pod_details containers
      // (agent does not send a dedicated namespace_usage metric; we aggregate here)
      {
        const podsMetricForNs = latestByType["pod_details"] || latestByType["pods"];
        const nsMap: Record<string, { cpuMilli: number; memBytes: number; podCount: number }> = {};

        if (podsMetricForNs) {
          const data = podsMetricForNs.metric_data as any;
          const podArr: any[] = data?.pods ?? [];
          const systemNS = new Set(["kube-system", "kube-public", "kube-node-lease"]);

          for (const pod of podArr) {
            const ns: string = pod.namespace || pod.Namespace || "default";
            if (systemNS.has(ns)) continue;
            if (!nsMap[ns]) nsMap[ns] = { cpuMilli: 0, memBytes: 0, podCount: 0 };
            nsMap[ns].podCount++;

            const containers: any[] = pod.containers || pod.Containers || [];
            for (const c of containers) {
              const res = c.resources || c.Resources;
              const limits = res?.limits || res?.Limits;
              const requests = res?.requests || res?.Requests;
              // Prefer requests, fallback to limits
              const src = requests || limits;
              if (src) {
                nsMap[ns].cpuMilli  += Number(src.cpu  ?? 0);
                nsMap[ns].memBytes  += Number(src.memory ?? 0);
              }
            }
          }
        }

        const nsEntries = Object.entries(nsMap);
        const totalCPU = nsEntries.reduce((s, [, v]) => s + v.cpuMilli, 0);
        const totalMem = nsEntries.reduce((s, [, v]) => s + v.memBytes, 0);
        const totalPodsFallback = nsEntries.reduce((s, [, v]) => s + v.podCount, 0) || 1;

        if (nsEntries.length > 0) {
          // If containers have no requests/limits set, use pod count as proxy
          const useCPUProxy  = totalCPU === 0;
          const useMemProxy  = totalMem === 0;
          setHasResourceData(!useCPUProxy || !useMemProxy);

          setNamespaceUsage(
            nsEntries
              .sort((a, b) => b[1].podCount - a[1].podCount)
              .map(([ns, v]) => ({
                namespace: ns,
                cpuPercent: useCPUProxy
                  ? Math.round((v.podCount / totalPodsFallback) * 100)
                  : Math.round((v.cpuMilli / (totalCPU || 1)) * 100),
                memoryPercent: useMemProxy
                  ? Math.round((v.podCount / totalPodsFallback) * 100)
                  : Math.round((v.memBytes / (totalMem || 1)) * 100),
                podCount: v.podCount,
              }))
          );
        } else {
          // Fallback: use namespace_resources pod counts as proxy
          const nsResMetric = latestByType["namespace_resources"];
          if (nsResMetric) {
            const data = nsResMetric.metric_data as any;
            const nsList: NamespaceUsage[] = [];
            if (data?.namespaces && Array.isArray(data.namespaces)) {
              const systemNS = new Set(["kube-system", "kube-public", "kube-node-lease"]);
              const filtered = (data.namespaces as any[]).filter(
                (n) => !systemNS.has(n.name || n.namespace) && (n.pods || 0) > 0
              );
              const totalPods = filtered.reduce((s, n) => s + (n.pods || 0), 0) || 1;
              for (const ns of filtered) {
                const pct = Math.round(((ns.pods || 0) / totalPods) * 100);
                nsList.push({
                  namespace: ns.name || ns.namespace || "unknown",
                  cpuPercent: pct,
                  memoryPercent: pct,
                  podCount: ns.pods || 0,
                });
              }
            }
            setNamespaceUsage(nsList);
          }
        }
      }

      // Detect monitoring agents
      const agentNames = ["Prometheus", "Grafana", "Loki", "Elasticsearch", "Jaeger", "metrics-server"];
      const detectedAgents: AgentStatus[] = [];

      // Check from pod names/namespaces
      const allPodData = pods.length > 0 ? pods : [];
      const allSvcData = services.length > 0 ? services : [];

      for (const agentName of agentNames) {
        const searchTerm = agentName.toLowerCase();
        const foundPod = allPodData.find(
          (p) =>
            p.name.toLowerCase().includes(searchTerm) ||
            p.namespace.toLowerCase().includes(searchTerm)
        );
        const foundSvc = allSvcData.find(
          (s) =>
            s.name.toLowerCase().includes(searchTerm) ||
            s.namespace.toLowerCase().includes(searchTerm)
        );

        detectedAgents.push({
          name: agentName,
          installed: !!(foundPod || foundSvc),
          namespace: foundPod?.namespace || foundSvc?.namespace || null,
        });
      }

      // Also check the monitoring_agents metric if available
      const monMetric = latestByType["monitoring_agents"] || latestByType["installed_agents"];
      if (monMetric) {
        const data = monMetric.metric_data as any;
        if (data?.agents && Array.isArray(data.agents)) {
          for (const a of data.agents) {
            const existing = detectedAgents.find(
              (d) => d.name.toLowerCase() === (a.name || "").toLowerCase()
            );
            if (existing) {
              existing.installed = a.installed ?? true;
              existing.namespace = a.namespace || existing.namespace;
            }
          }
        }
      }

      setAgents(detectedAgents);
    } catch (err) {
      console.error("Error in observability data:", err);
    } finally {
      setLoading(false);
      hasDataRef.current = true;
    }
  }, [selectedClusterId]);

  // Reset on cluster change: clear stale data and show loading spinner
  useEffect(() => {
    if (!selectedClusterId) return;
    hasDataRef.current = false;
    setPods([]);
    setServices([]);
    setIngresses([]);
    setDeployments([]);
    setDaemonSets([]);
    setStatefulSets([]);
    setJobs([]);
    setCronJobs([]);
    setNetworkPolicies([]);
    setNamespaceUsage([]);
    setLastSync(null);
    setLoading(true);
  }, [selectedClusterId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedClusterId) return;

    const channel = supabase
      .channel("observability-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_metrics",
          filter: `cluster_id=eq.${selectedClusterId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClusterId, fetchData]);

  return {
    pods,
    services,
    ingresses,
    deployments,
    daemonSets,
    statefulSets,
    jobs,
    cronJobs,
    networkPolicies,
    namespaceUsage,
    hasResourceData,
    agents,
    loading,
    lastSync,
    refetch: fetchData,
  };
};
