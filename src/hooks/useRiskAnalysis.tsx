import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";

export interface RiskCategory {
  level: "critical" | "high" | "medium" | "low";
  score: number;
  count: number;
  items: RiskItem[];
}

export interface RiskItem {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  resource?: string;
  namespace?: string;
  detectedAt: string;
}

export interface UnstablePod {
  name: string;
  namespace: string;
  restartCount: number;
  status: string;
  reason?: string;
  lastRestart?: string;
}

export interface ResourceIssue {
  podName: string;
  namespace: string;
  containerName: string;
  issue: "no_limits" | "no_requests" | "high_memory" | "high_cpu";
  currentUsage?: string;
  limit?: string;
  cpuLimitMilli?: number;
  cpuRequestMilli?: number;
  memoryLimitBytes?: number;
  memoryRequestBytes?: number;
}

export interface ServicePort {
  name: string;
  protocol: string;
  port: number;
  targetPort: string;
  nodePort?: number;
}

export interface ServiceData {
  name: string;
  namespace: string;
  type: "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName" | string;
  clusterIP: string;
  ports: ServicePort[];
  endpointCount: number;
  hasNoEndpoints: boolean;
  lbIngress: string[];
  externalIPs: string[];
}

export interface VolumeProblem {
  name: string;
  namespace?: string;
  type: "pvc" | "pv";
  issue: "near_full" | "pending" | "released" | "failed" | "orphan";
  usagePercent?: number;
  status: string;
}

export interface ClusterChange {
  id: string;
  type: string;
  reason: string;
  message: string;
  namespace: string;
  involvedObject: string;
  timestamp: string;
}

export interface ProbeIssue {
  podName: string;
  namespace: string;
  containerName: string;
  missingProbes: ("readiness" | "liveness" | "startup")[];
}

export interface CertificateIssue {
  name: string;
  namespace: string;
  expiresAt?: string;
  daysUntilExpiry?: number;
  issue: "expiring_soon" | "expired" | "invalid";
}

export interface TrendData {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface AvailabilityData {
  totalNodes: number;
  readyNodes: number;
  totalPods: number;
  runningPods: number;
  pendingPods: number;
  failedPods: number;
  nodeHealth: number;
  podHealth: number;
}

export interface PublicExposure {
  type: "ingress" | "loadbalancer" | "nodeport";
  name: string;
  namespace: string;
  hosts?: string[];
  ports?: number[];
  hasNetworkPolicy: boolean;
}

export interface RiskAnalysis {
  overallScore: number;
  risks: {
    security: RiskCategory;
    availability: RiskCategory;
    configuration: RiskCategory;
    exposure: RiskCategory;
  };
  trends: TrendData[];
  unstablePods: UnstablePod[];
  resourceIssues: ResourceIssue[];
  volumeProblems: VolumeProblem[];
  probeIssues: ProbeIssue[];
  certificateIssues: CertificateIssue[];
  recentChanges: ClusterChange[];
  availability: AvailabilityData;
  publicExposures: PublicExposure[];
  services: ServiceData[];
}

const defaultRiskCategory: RiskCategory = {
  level: "low",
  score: 0,
  count: 0,
  items: [],
};

const defaultAvailability: AvailabilityData = {
  totalNodes: 0,
  readyNodes: 0,
  totalPods: 0,
  runningPods: 0,
  pendingPods: 0,
  failedPods: 0,
  nodeHealth: 100,
  podHealth: 100,
};

const defaultAnalysis: RiskAnalysis = {
  overallScore: 0,
  risks: {
    security: { ...defaultRiskCategory },
    availability: { ...defaultRiskCategory },
    configuration: { ...defaultRiskCategory },
    exposure: { ...defaultRiskCategory },
  },
  trends: [],
  unstablePods: [],
  resourceIssues: [],
  volumeProblems: [],
  probeIssues: [],
  certificateIssues: [],
  recentChanges: [],
  availability: { ...defaultAvailability },
  publicExposures: [],
  services: [],
};

const POLL_INTERVAL_MS = 60_000; // 60s fallback polling

export const useRiskAnalysis = () => {
  const { selectedClusterId } = useCluster();
  const [analysis, setAnalysis] = useState<RiskAnalysis>(defaultAnalysis);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetchingRef = useRef(false);

  const calculateRiskLevel = (score: number): "critical" | "high" | "medium" | "low" => {
    if (score >= 75) return "critical";
    if (score >= 50) return "high";
    if (score >= 25) return "medium";
    return "low";
  };

  const fetchRiskData = useCallback(async (silent = false) => {
    if (!selectedClusterId) {
      setAnalysis(defaultAnalysis);
      setLoading(false);
      return;
    }
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // Fetch security threats
      const { data: threats } = await supabase
        .from("security_threats")
        .select("*")
        .eq("cluster_id", selectedClusterId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      // Fetch latest security metrics
      const { data: securityMetrics } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "security")
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch pod details
      const { data: podMetrics } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "pod_details")
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch node metrics
      const { data: nodeMetrics } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "nodes")
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch events
      const { data: eventsMetrics } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "events")
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch PVCs
      const { data: pvcs } = await supabase
        .from("pvcs")
        .select("*")
        .eq("cluster_id", selectedClusterId);

      // Fetch standalone PVs
      const { data: pvs } = await supabase
        .from("persistent_volumes")
        .select("*")
        .eq("cluster_id", selectedClusterId);

      // Fetch services metric
      const { data: servicesMetrics } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "services")
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch historical incidents + security threats for trends (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [{ data: historicalIncidents }, { data: historicalThreats }] = await Promise.all([
        supabase
          .from("ai_incidents")
          .select("severity, created_at")
          .eq("cluster_id", selectedClusterId)
          .gte("created_at", sevenDaysAgo.toISOString()),
        supabase
          .from("security_threats")
          .select("severity, created_at")
          .eq("cluster_id", selectedClusterId)
          .gte("created_at", sevenDaysAgo.toISOString()),
      ]);

      // Split threats: real attacks vs configuration risks
      // is_attack === false  → config risk (probe missing, RBAC, etc.)
      // is_attack !== false  → real attack (matches what the Ameaças tab shows)
      const allThreats = threats || [];
      const attackThreats = allThreats.filter((t: any) => t.is_attack !== false);
      const configThreatList = allThreats.filter((t: any) => t.is_attack === false);

      // Process security risks — real attacks only
      const securityItems: RiskItem[] = [];
      let securityScore = 0;

      attackThreats.forEach((threat: any) => {
        securityItems.push({
          id: threat.id,
          title: threat.threat_type || "Security Threat",
          description: threat.description || "",
          severity: threat.severity as any,
          category: "security",
          resource: threat.affected_resource,
          namespace: threat.namespace,
          detectedAt: threat.created_at,
        });

        if (threat.severity === "critical") securityScore += 25;
        else if (threat.severity === "high") securityScore += 15;
        else if (threat.severity === "medium") securityScore += 8;
        else securityScore += 3;
      });

      // Config risks (is_attack === false) contribute to configuration score
      let configurationScore = 0;
      configThreatList.forEach((threat: any) => {
        if (threat.severity === "critical") configurationScore += 10;
        else if (threat.severity === "high") configurationScore += 6;
        else if (threat.severity === "medium") configurationScore += 3;
        else configurationScore += 1;
      });

      // Process pod data for unstable pods and probes
      const unstablePods: UnstablePod[] = [];
      const probeIssues: ProbeIssue[] = [];
      const resourceIssues: ResourceIssue[] = [];
      let availabilityScore = 0;
      
      const availability: AvailabilityData = { ...defaultAvailability };

      const podData = podMetrics?.metric_data as any;
      if (podData?.pods && Array.isArray(podData.pods)) {
        availability.totalPods = podData.pods.length;
        
        podData.pods.forEach((pod: any) => {
          // Use lowercase properties as per actual data structure
          const podPhase = pod.phase || pod.Phase || pod.Status;
          const podName = pod.name || pod.Name;
          const podNamespace = pod.namespace || pod.Namespace;
          const podTotalRestarts = pod.total_restarts || pod.RestartCount || pod.restarts || 0;
          const podContainers = pod.containers || pod.Containers || [];
          
          if (podPhase === "Running") {
            availability.runningPods++;
          } else if (podPhase === "Pending") {
            availability.pendingPods++;
            availabilityScore += 5;
          } else if (podPhase === "Failed") {
            availability.failedPods++;
            availabilityScore += 10;
          }

          // Use pod-level restart count directly — total_restarts already sums all containers.
          // Do NOT add container restart counts on top (would double-count).
          const totalRestarts = podTotalRestarts;

          // Only flag as unstable if actively crashing OR restart count is very high.
          // Running pods with moderate restarts from the past are NOT unstable.
          const isCrashing = podPhase === "CrashLoopBackOff" || podPhase === "Error";
          const isFailed   = podPhase === "Failed";
          if (isCrashing || isFailed || (totalRestarts > 20 && podPhase !== "Running")) {
            unstablePods.push({
              name: podName,
              namespace: podNamespace,
              restartCount: totalRestarts,
              status: podPhase,
              reason: pod.status_reason || pod.StatusReason,
            });
          }

          // Skip system namespaces for probe/resource checks — those are managed by Kubernetes itself.
          const systemNamespaces = ["kube-system", "kube-public", "kube-node-lease"];
          const isSystemNs = systemNamespaces.includes(podNamespace);

          // Check for missing probes (if available in data)
          if (!isSystemNs && podContainers && Array.isArray(podContainers)) {
            podContainers.forEach((container: any) => {
              const containerName = container.name || container.Name || "unknown";
              const missing: ("readiness" | "liveness" | "startup")[] = [];

              // Check both lowercase and PascalCase property names
              if (!container.readiness_probe && !container.ReadinessProbe) missing.push("readiness");
              if (!container.liveness_probe && !container.LivenessProbe) missing.push("liveness");

              if (missing.length > 0) {
                probeIssues.push({
                  podName: podName,
                  namespace: podNamespace,
                  containerName,
                  missingProbes: missing,
                });
                configurationScore += missing.length * 3;
              }

              // Check resource limits - look at resources object
              const resources = container.resources || container.Resources;
              const limits = resources?.limits || resources?.Limits;
              const requests = resources?.requests || resources?.Requests;

              // Extract numeric CPU/memory values if present
              const cpuLimitMilli: number | undefined = limits?.cpu != null ? Number(limits.cpu) : undefined;
              const memoryLimitBytes: number | undefined = limits?.memory != null ? Number(limits.memory) : undefined;
              const cpuRequestMilli: number | undefined = requests?.cpu != null ? Number(requests.cpu) : undefined;
              const memoryRequestBytes: number | undefined = requests?.memory != null ? Number(requests.memory) : undefined;

              if (!limits) {
                resourceIssues.push({
                  podName: podName,
                  namespace: podNamespace,
                  containerName,
                  issue: "no_limits",
                  cpuLimitMilli,
                  memoryLimitBytes,
                  cpuRequestMilli,
                  memoryRequestBytes,
                });
                configurationScore += 5;
              }
              if (!requests) {
                resourceIssues.push({
                  podName: podName,
                  namespace: podNamespace,
                  containerName,
                  issue: "no_requests",
                  cpuLimitMilli,
                  memoryLimitBytes,
                  cpuRequestMilli,
                  memoryRequestBytes,
                });
                configurationScore += 3;
              }
            });
          }
        });

        availability.podHealth = availability.totalPods > 0
          ? Math.round((availability.runningPods / availability.totalPods) * 100)
          : 100;
      }

      // Process security data for resource limits
      const securityData = securityMetrics?.metric_data as any;
      if (securityData?.pod_security) {
        const podSecurity = securityData.pod_security;
        const totalPodCount = podSecurity.total_pods || 0;
        const podsWithLimits = podSecurity.pods_with_resource_limits || 0;
        
        if (totalPodCount > 0 && podsWithLimits < totalPodCount) {
          const missingLimitsPercent = ((totalPodCount - podsWithLimits) / totalPodCount) * 100;
          configurationScore += Math.min(missingLimitsPercent * 0.5, 25);
        }
      }

      // Process node data for availability
      const nodeData = nodeMetrics?.metric_data as any;
      if (nodeData?.nodes && Array.isArray(nodeData.nodes)) {
        availability.totalNodes = nodeData.nodes.length;
        nodeData.nodes.forEach((node: any) => {
          // Use lowercase properties as per actual data structure
          const nodeStatus = node.status || node.Status;
          if (nodeStatus === "Ready") {
            availability.readyNodes++;
          } else {
            availabilityScore += 20;
          }
        });
        availability.nodeHealth = availability.totalNodes > 0
          ? Math.round((availability.readyNodes / availability.totalNodes) * 100)
          : 100;
      }

      // Process events for recent changes
      const recentChanges: ClusterChange[] = [];
      const eventsData = eventsMetrics?.metric_data as any;
      if (eventsData?.events && Array.isArray(eventsData.events)) {
        eventsData.events
          .filter((e: any) => ["Warning", "Normal"].includes(e.type || e.Type))
          .slice(0, 20)
          .forEach((event: any) => {
            // Use lowercase properties as per actual data structure
            const involvedObj = event.involved_object || event.InvolvedObject || {};
            const objName = typeof involvedObj === 'object' 
              ? `${involvedObj.kind || ''}/${involvedObj.name || ''}` 
              : involvedObj;
            const eventNamespace = typeof involvedObj === 'object'
              ? involvedObj.namespace || event.namespace || event.Namespace
              : event.namespace || event.Namespace;
              
            recentChanges.push({
              id: `${objName}-${event.last_time || event.LastTimestamp}`,
              type: event.type || event.Type,
              reason: event.reason || event.Reason,
              message: event.message || event.Message,
              namespace: eventNamespace || "unknown",
              involvedObject: objName,
              timestamp: event.last_time || event.LastTimestamp,
            });
          });
      }

      // Process PVCs for volume problems
      const volumeProblems: VolumeProblem[] = [];
      if (pvcs && pvcs.length > 0) {
        pvcs.forEach((pvc: any) => {
          // Use requested_bytes as capacity (actual column name from DB)
          const capacityBytes = pvc.requested_bytes || pvc.capacity_bytes;
          const usedBytes = pvc.used_bytes || 0;
          const usagePercent = usedBytes && capacityBytes
            ? (usedBytes / capacityBytes) * 100
            : 0;

          if (usagePercent > 85) {
            volumeProblems.push({
              name: pvc.name,
              namespace: pvc.namespace,
              type: "pvc",
              issue: "near_full",
              usagePercent: Math.round(usagePercent),
              status: pvc.status,
            });
            configurationScore += 10;
          } else if (pvc.status === "Pending") {
            volumeProblems.push({
              name: pvc.name,
              namespace: pvc.namespace,
              type: "pvc",
              issue: "pending",
              status: pvc.status,
            });
            configurationScore += 5;
          }
        });
      }

      if (pvs && pvs.length > 0) {
        pvs.forEach((pv: any) => {
          if (pv.status === "Released") {
            volumeProblems.push({
              name: pv.name,
              type: "pv",
              issue: "released",
              status: pv.status,
            });
            configurationScore += 3;
          } else if (pv.status === "Failed") {
            volumeProblems.push({
              name: pv.name,
              type: "pv",
              issue: "failed",
              status: pv.status,
            });
            configurationScore += 8;
          }
        });
      }

      // Process public exposures
      const publicExposures: PublicExposure[] = [];
      let exposureScore = 0;

      if (securityData?.ingress_controller) {
        const ingress = securityData.ingress_controller;
        if (ingress.detected) {
          publicExposures.push({
            type: "ingress",
            name: ingress.type || "Ingress Controller",
            namespace: ingress.namespace || "unknown",
            hasNetworkPolicy: ingress.has_required_rbac || false,
          });
        }
      }

      if (securityData?.network_policies) {
        const netPolicies = securityData.network_policies;
        const coverage = netPolicies.coverage_percent || 0;
        if (coverage < 50) {
          exposureScore += 20;
        } else if (coverage < 80) {
          exposureScore += 10;
        }
      }

      // Calculate trends — always generate 7 days, combining ai_incidents + security_threats
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split("T")[0];
      });

      const allHistorical = [
        ...(historicalIncidents || []),
        ...(historicalThreats || []),
      ];

      const trends: TrendData[] = last7Days.map((date) => {
        const dayItems = allHistorical.filter(
          (item: any) => item.created_at.split("T")[0] === date
        );
        return {
          date,
          critical: dayItems.filter((i: any) => i.severity === "critical").length,
          high:     dayItems.filter((i: any) => i.severity === "high").length,
          medium:   dayItems.filter((i: any) => i.severity === "medium").length,
          low:      dayItems.filter((i: any) => i.severity === "low").length,
        };
      });

      // Parse services data
      const services: ServiceData[] = [];
      const servicesData = servicesMetrics?.metric_data as any;
      if (servicesData?.services && Array.isArray(servicesData.services)) {
        servicesData.services.forEach((svc: any) => {
          const ports = (svc.ports || []).map((p: any) => ({
            name: p.name || "",
            protocol: p.protocol || "TCP",
            port: p.port,
            targetPort: p.target_port || String(p.port),
            nodePort: p.node_port,
          }));
          services.push({
            name: svc.name,
            namespace: svc.namespace,
            type: svc.type || "ClusterIP",
            clusterIP: svc.cluster_ip || "",
            ports,
            endpointCount: svc.endpoint_count ?? 0,
            hasNoEndpoints: svc.has_no_endpoints ?? false,
            lbIngress: svc.lb_ingress || [],
            externalIPs: svc.external_ips || [],
          });
        });
      }

      // Cap scores at 100
      securityScore = Math.min(securityScore, 100);
      availabilityScore = Math.min(availabilityScore, 100);
      configurationScore = Math.min(configurationScore, 100);
      exposureScore = Math.min(exposureScore, 100);

      // Calculate overall score (weighted average, inverted - 0 is best)
      const overallScore = Math.round(
        (securityScore * 0.35 +
          availabilityScore * 0.25 +
          configurationScore * 0.25 +
          exposureScore * 0.15)
      );

      setAnalysis({
        overallScore,
        risks: {
          security: {
            level: calculateRiskLevel(securityScore),
            score: securityScore,
            count: securityItems.length,
            items: securityItems,
          },
          availability: {
            level: calculateRiskLevel(availabilityScore),
            score: availabilityScore,
            count: unstablePods.length,
            items: [],
          },
          configuration: {
            level: calculateRiskLevel(configurationScore),
            score: configurationScore,
            count: resourceIssues.length + probeIssues.length + volumeProblems.length,
            items: [],
          },
          exposure: {
            level: calculateRiskLevel(exposureScore),
            score: exposureScore,
            count: publicExposures.length,
            items: [],
          },
        },
        trends,
        unstablePods,
        resourceIssues,
        volumeProblems,
        probeIssues,
        certificateIssues: [], // Requires agent update
        recentChanges,
        availability,
        publicExposures,
        services,
      });
    } catch (error) {
      console.error("Error fetching risk data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
      fetchingRef.current = false;
    }
  }, [selectedClusterId]);

  useEffect(() => {
    fetchRiskData();

    if (!selectedClusterId) return;

    // ── Realtime subscriptions ─────────────────────────────────────────
    const channel = supabase
      .channel(`risk-analysis-${selectedClusterId}`)
      // security_threats: any change
      .on("postgres_changes", {
        event: "*", schema: "public", table: "security_threats",
        filter: `cluster_id=eq.${selectedClusterId}`,
      }, () => fetchRiskData(true))
      // agent_metrics: INSERT or UPDATE (agent sends fresh metrics)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "agent_metrics",
        filter: `cluster_id=eq.${selectedClusterId}`,
      }, () => fetchRiskData(true))
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "agent_metrics",
        filter: `cluster_id=eq.${selectedClusterId}`,
      }, () => fetchRiskData(true))
      // agent_commands: when a fix completes, refresh score
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "agent_commands",
        filter: `cluster_id=eq.${selectedClusterId}`,
      }, () => fetchRiskData(true))
      // auto_heal_actions_log: new heal action = score might change
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "auto_heal_actions_log",
        filter: `cluster_id=eq.${selectedClusterId}`,
      }, () => fetchRiskData(true))
      .subscribe();

    // ── Polling fallback: every 60s ────────────────────────────────────
    const poll = setInterval(() => fetchRiskData(true), POLL_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [selectedClusterId, fetchRiskData]);

  const manualRefresh = useCallback(async () => {
    await fetchRiskData(false);
  }, [fetchRiskData]);

  return {
    analysis,
    loading,
    refreshing,
    lastUpdated,
    refetch: manualRefresh,
  };
};
