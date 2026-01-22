import { useState, useEffect } from "react";
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
};

export const useRiskAnalysis = () => {
  const { selectedClusterId } = useCluster();
  const [analysis, setAnalysis] = useState<RiskAnalysis>(defaultAnalysis);
  const [loading, setLoading] = useState(true);

  const calculateRiskLevel = (score: number): "critical" | "high" | "medium" | "low" => {
    if (score >= 75) return "critical";
    if (score >= 50) return "high";
    if (score >= 25) return "medium";
    return "low";
  };

  const fetchRiskData = async () => {
    if (!selectedClusterId) {
      setAnalysis(defaultAnalysis);
      setLoading(false);
      return;
    }

    setLoading(true);

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
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Fetch pod details
      const { data: podMetrics } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "pod_details")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Fetch node metrics
      const { data: nodeMetrics } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "nodes")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Fetch events
      const { data: eventsMetrics } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "events")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

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

      // Fetch historical incidents for trends
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: historicalIncidents } = await supabase
        .from("ai_incidents")
        .select("severity, created_at")
        .eq("cluster_id", selectedClusterId)
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Process security risks
      const securityItems: RiskItem[] = [];
      let securityScore = 0;

      if (threats && threats.length > 0) {
        threats.forEach((threat: any) => {
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
      }

      // Process pod data for unstable pods and probes
      const unstablePods: UnstablePod[] = [];
      const probeIssues: ProbeIssue[] = [];
      const resourceIssues: ResourceIssue[] = [];
      let availabilityScore = 0;
      let configurationScore = 0;
      
      const availability: AvailabilityData = { ...defaultAvailability };

      const podData = podMetrics?.metric_data as any;
      if (podData?.pods && Array.isArray(podData.pods)) {
        availability.totalPods = podData.pods.length;
        
        podData.pods.forEach((pod: any) => {
          // Use lowercase properties as per actual data structure
          const podPhase = pod.phase || pod.Phase || pod.Status;
          const podName = pod.name || pod.Name;
          const podNamespace = pod.namespace || pod.Namespace;
          const podTotalRestarts = pod.total_restarts || pod.RestartCount || 0;
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

          // Check for unstable pods - look at individual container restart counts too
          let totalContainerRestarts = podTotalRestarts;
          if (podContainers && Array.isArray(podContainers)) {
            podContainers.forEach((c: any) => {
              totalContainerRestarts += c.restart_count || c.RestartCount || 0;
            });
          }
          
          if (totalContainerRestarts > 5 || podPhase === "CrashLoopBackOff" || podPhase === "Failed") {
            unstablePods.push({
              name: podName,
              namespace: podNamespace,
              restartCount: totalContainerRestarts,
              status: podPhase,
              reason: pod.status_reason || pod.StatusReason,
            });
          }

          // Check for missing probes (if available in data)
          if (podContainers && Array.isArray(podContainers)) {
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
              if (!resources?.limits && !resources?.Limits) {
                resourceIssues.push({
                  podName: podName,
                  namespace: podNamespace,
                  containerName,
                  issue: "no_limits",
                });
                configurationScore += 5;
              }
              if (!resources?.requests && !resources?.Requests) {
                resourceIssues.push({
                  podName: podName,
                  namespace: podNamespace,
                  containerName,
                  issue: "no_requests",
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

      // Calculate trends from historical data
      const trends: TrendData[] = [];
      if (historicalIncidents && historicalIncidents.length > 0) {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          return date.toISOString().split("T")[0];
        });

        last7Days.forEach((date) => {
          const dayIncidents = historicalIncidents.filter(
            (inc: any) => inc.created_at.split("T")[0] === date
          );
          trends.push({
            date,
            critical: dayIncidents.filter((i: any) => i.severity === "critical").length,
            high: dayIncidents.filter((i: any) => i.severity === "high").length,
            medium: dayIncidents.filter((i: any) => i.severity === "medium").length,
            low: dayIncidents.filter((i: any) => i.severity === "low").length,
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
      });
    } catch (error) {
      console.error("Error fetching risk data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();

    // Set up real-time subscription
    if (selectedClusterId) {
      const channel = supabase
        .channel("risk-analysis-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "security_threats",
            filter: `cluster_id=eq.${selectedClusterId}`,
          },
          () => fetchRiskData()
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "agent_metrics",
            filter: `cluster_id=eq.${selectedClusterId}`,
          },
          () => fetchRiskData()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedClusterId]);

  return {
    analysis,
    loading,
    refetch: fetchRiskData,
  };
};
