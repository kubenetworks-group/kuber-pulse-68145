import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NodeInfo {
  name: string;
  os: string;
  kernel: string;
  cpuCapacity: number;
  memoryCapacity: number;
  pool: string;
}

interface NamespaceInfo {
  name: string;
  podCount: number;
}

export interface ClusterAnalysis {
  nodes: NodeInfo[];
  totalNodes: number;
  totalPods: number;
  runningPods: number;
  pendingPods: number;
  failedPods: number;
  totalCpu: number;
  totalMemoryGb: number;
  pvcCount: number;
  totalStorageGb: number;
  usedStorageGb: number;
  namespaces: NamespaceInfo[];
  controlPlaneNodes: number;
  workerNodes: number;
}

export const useClusterAnalysis = (clusterId: string | null) => {
  const [analysis, setAnalysis] = useState<ClusterAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!clusterId) {
      setLoading(false);
      return;
    }

    const fetchAnalysis = async () => {
      setLoading(true);
      setProgress(10);

      try {
        // Fetch nodes metrics
        const { data: nodesMetric } = await supabase
          .from("agent_metrics")
          .select("metric_data")
          .eq("cluster_id", clusterId)
          .eq("metric_type", "nodes")
          .order("collected_at", { ascending: false })
          .limit(1)
          .single();

        setProgress(30);

        // Fetch pods metrics
        const { data: podsMetric } = await supabase
          .from("agent_metrics")
          .select("metric_data")
          .eq("cluster_id", clusterId)
          .eq("metric_type", "pods")
          .order("collected_at", { ascending: false })
          .limit(1)
          .single();

        setProgress(50);

        // Fetch PVCs
        const { data: pvcs } = await supabase
          .from("pvcs")
          .select("*")
          .eq("cluster_id", clusterId);

        setProgress(70);

        // Fetch PVs
        const { data: pvs } = await supabase
          .from("persistent_volumes")
          .select("*")
          .eq("cluster_id", clusterId);

        setProgress(90);

        // Process nodes data
        const nodesData = nodesMetric?.metric_data as any;
        const nodes: NodeInfo[] = [];
        let totalCpu = 0;
        let totalMemoryBytes = 0;
        let controlPlaneNodes = 0;
        let workerNodes = 0;

        if (nodesData?.nodes && Array.isArray(nodesData.nodes)) {
          nodesData.nodes.forEach((node: any) => {
            const cpuCapacity = parseInt(node.capacity?.cpu || "0");
            const memoryStr = node.capacity?.memory || "0";
            const memoryBytes = parseMemory(memoryStr);

            totalCpu += cpuCapacity;
            totalMemoryBytes += memoryBytes;

            const isControlPlane = node.labels?.["node-role.kubernetes.io/control-plane"] !== undefined ||
                                   node.labels?.["node-role.kubernetes.io/master"] !== undefined;
            
            if (isControlPlane) {
              controlPlaneNodes++;
            } else {
              workerNodes++;
            }

            nodes.push({
              name: node.name || "Unknown",
              os: node.nodeInfo?.osImage || "Unknown",
              kernel: node.nodeInfo?.kernelVersion || "Unknown",
              cpuCapacity,
              memoryCapacity: Math.round(memoryBytes / (1024 * 1024 * 1024)),
              pool: node.labels?.["node.kubernetes.io/instance-type"] || 
                    node.labels?.["beta.kubernetes.io/instance-type"] || 
                    "default",
            });
          });
        }

        // Process pods data
        const podsData = podsMetric?.metric_data as any;
        let totalPods = 0;
        let runningPods = 0;
        let pendingPods = 0;
        let failedPods = 0;
        const namespaceMap: Record<string, number> = {};

        if (podsData?.pods && Array.isArray(podsData.pods)) {
          podsData.pods.forEach((pod: any) => {
            totalPods++;
            const phase = pod.status?.phase?.toLowerCase();
            if (phase === "running") runningPods++;
            else if (phase === "pending") pendingPods++;
            else if (phase === "failed") failedPods++;

            const ns = pod.namespace || "default";
            namespaceMap[ns] = (namespaceMap[ns] || 0) + 1;
          });
        }

        const namespaces: NamespaceInfo[] = Object.entries(namespaceMap)
          .map(([name, podCount]) => ({ name, podCount }))
          .sort((a, b) => b.podCount - a.podCount)
          .slice(0, 5);

        // Process storage data
        const pvcCount = pvcs?.length || 0;
        let totalStorageBytes = 0;
        let usedStorageBytes = 0;

        pvcs?.forEach((pvc: any) => {
          totalStorageBytes += pvc.requested_bytes || 0;
          usedStorageBytes += pvc.used_bytes || 0;
        });

        pvs?.forEach((pv: any) => {
          if (!pv.claim_ref_name) {
            // Standalone PV (not bound to PVC)
            totalStorageBytes += pv.capacity_bytes || 0;
          }
        });

        setProgress(100);

        setAnalysis({
          nodes,
          totalNodes: nodes.length,
          totalPods,
          runningPods,
          pendingPods,
          failedPods,
          totalCpu,
          totalMemoryGb: Math.round(totalMemoryBytes / (1024 * 1024 * 1024)),
          pvcCount,
          totalStorageGb: Math.round(totalStorageBytes / (1024 * 1024 * 1024)),
          usedStorageGb: Math.round(usedStorageBytes / (1024 * 1024 * 1024)),
          namespaces,
          controlPlaneNodes,
          workerNodes,
        });

      } catch (error) {
        console.error("Error fetching cluster analysis:", error);
        setAnalysis(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [clusterId]);

  return { analysis, loading, progress };
};

function parseMemory(memoryStr: string): number {
  const value = parseInt(memoryStr);
  if (memoryStr.endsWith("Ki")) return value * 1024;
  if (memoryStr.endsWith("Mi")) return value * 1024 * 1024;
  if (memoryStr.endsWith("Gi")) return value * 1024 * 1024 * 1024;
  if (memoryStr.endsWith("Ti")) return value * 1024 * 1024 * 1024 * 1024;
  return value;
}
