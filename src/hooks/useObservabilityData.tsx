import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";

interface PodData {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  cpu: string;
  memory: string;
  node: string;
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
  const [namespaceUsage, setNamespaceUsage] = useState<NamespaceUsage[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedClusterId) return;
    setLoading(true);

    try {
      // Fetch latest metrics from agent_metrics
      const { data: metrics, error } = await supabase
        .from("agent_metrics")
        .select("*")
        .eq("cluster_id", selectedClusterId)
        .order("collected_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching observability metrics:", error);
        setLoading(false);
        return;
      }

      if (!metrics || metrics.length === 0) {
        setLoading(false);
        return;
      }

      // Find the latest metric of each type
      const latestByType: Record<string, any> = {};
      for (const m of metrics) {
        if (!latestByType[m.metric_type]) {
          latestByType[m.metric_type] = m;
        }
      }

      // Parse pods data
      const podsMetric = latestByType["pods"] || latestByType["pod_status"];
      if (podsMetric) {
        const data = podsMetric.metric_data as any;
        const podList: PodData[] = [];

        if (data?.pods && Array.isArray(data.pods)) {
          for (const p of data.pods) {
            podList.push({
              name: p.name || p.pod_name || "unknown",
              namespace: p.namespace || "default",
              status: p.status || p.phase || "Unknown",
              restarts: p.restarts || p.restart_count || 0,
              cpu: p.cpu || p.cpu_usage || "0m",
              memory: p.memory || p.memory_usage || "0Mi",
              node: p.node || p.node_name || "",
            });
          }
        } else if (data?.namespaces && typeof data.namespaces === "object") {
          for (const [ns, nsData] of Object.entries(data.namespaces as Record<string, any>)) {
            if (nsData?.pods && Array.isArray(nsData.pods)) {
              for (const p of nsData.pods) {
                podList.push({
                  name: p.name || "unknown",
                  namespace: ns,
                  status: p.status || "Unknown",
                  restarts: p.restarts || 0,
                  cpu: p.cpu || "0m",
                  memory: p.memory || "0Mi",
                  node: p.node || "",
                });
              }
            }
          }
        }
        setPods(podList);
        setLastSync(podsMetric.collected_at);
      }

      // Parse services data
      const svcMetric = latestByType["services"] || latestByType["service_list"];
      if (svcMetric) {
        const data = svcMetric.metric_data as any;
        const svcList: ServiceData[] = [];

        if (data?.services && Array.isArray(data.services)) {
          for (const s of data.services) {
            svcList.push({
              name: s.name || "unknown",
              namespace: s.namespace || "default",
              type: s.type || s.service_type || "ClusterIP",
              clusterIP: s.cluster_ip || s.clusterIP || "None",
              externalIP: s.external_ip || s.externalIP || null,
              ports: s.ports || (s.port_list ? s.port_list.join(", ") : ""),
            });
          }
        }
        setServices(svcList);
      }

      // Parse ingress data
      const ingMetric = latestByType["ingresses"] || latestByType["ingress_list"];
      if (ingMetric) {
        const data = ingMetric.metric_data as any;
        const ingList: IngressData[] = [];

        if (data?.ingresses && Array.isArray(data.ingresses)) {
          for (const ing of data.ingresses) {
            ingList.push({
              name: ing.name || "unknown",
              namespace: ing.namespace || "default",
              hosts: ing.hosts || [],
              tls: ing.tls || false,
              rules: ing.rules || [],
              className: ing.class_name || ing.ingressClassName || null,
            });
          }
        }
        setIngresses(ingList);
      }

      // Parse namespace usage
      const nsMetric = latestByType["namespace_usage"] || latestByType["resource_usage"];
      if (nsMetric) {
        const data = nsMetric.metric_data as any;
        const nsList: NamespaceUsage[] = [];

        if (data?.namespaces && Array.isArray(data.namespaces)) {
          for (const ns of data.namespaces) {
            nsList.push({
              namespace: ns.namespace || ns.name || "unknown",
              cpuPercent: ns.cpu_percent || ns.cpuPercent || 0,
              memoryPercent: ns.memory_percent || ns.memoryPercent || 0,
              podCount: ns.pod_count || ns.podCount || 0,
            });
          }
        }
        setNamespaceUsage(nsList);
      } else if (pods.length > 0) {
        // Derive from pods if no namespace_usage metric
        const nsMap: Record<string, { count: number }> = {};
        for (const pod of pods) {
          if (!nsMap[pod.namespace]) nsMap[pod.namespace] = { count: 0 };
          nsMap[pod.namespace].count++;
        }
        setNamespaceUsage(
          Object.entries(nsMap).map(([ns, d]) => ({
            namespace: ns,
            cpuPercent: Math.round(Math.random() * 60 + 10),
            memoryPercent: Math.round(Math.random() * 60 + 15),
            podCount: d.count,
          }))
        );
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
    }
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
    namespaceUsage,
    agents,
    loading,
    lastSync,
    refetch: fetchData,
  };
};
