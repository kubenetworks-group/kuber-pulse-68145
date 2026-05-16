import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NodeInfo {
  name: string;
  cpu: number;
  memory: string | number;
  memoryGB: number;
  memoryUsageGB?: number;
  cpuCapacity?: number;
  memoryCapacity?: number;
  cpuPercent?: number;
  memoryPercent?: number;
  status: string;
  osImage?: string;
  kernelVersion?: string;
  containerRuntime?: string;
  pool: string;
  labels?: Record<string, string>;
}

interface NodeMetrics {
  nodes: NodeInfo[];
  totalCPU: number;
  totalMemory: number;
  cpuUsage: number;
  memoryUsage: number;
  loading: boolean;
  collectedAt: Date | null;  // when the agent collected the data
  refresh: () => void;
}

export const useNodeMetrics = (clusterId: string | undefined) => {
  const [metrics, setMetrics] = useState<NodeMetrics>({
    nodes: [],
    totalCPU: 0,
    totalMemory: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    loading: true,
    collectedAt: null,
    refresh: () => {},
  });

  const fetchNodeMetrics = useCallback(async () => {
    if (!clusterId) return;

    try {
      // Fetch all three metric types in parallel
      const [nodesResult, cpuResult, memoryResult] = await Promise.all([
        supabase
          .from('agent_metrics')
          .select('metric_data, collected_at')
          .eq('cluster_id', clusterId)
          .eq('metric_type', 'nodes')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('agent_metrics')
          .select('metric_data, collected_at')
          .eq('cluster_id', clusterId)
          .eq('metric_type', 'cpu')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('agent_metrics')
          .select('metric_data, collected_at')
          .eq('cluster_id', clusterId)
          .eq('metric_type', 'memory')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const nodesData = nodesResult.data;
      const cpuData = cpuResult.data?.metric_data as any;
      const memoryData = memoryResult.data?.metric_data as any;

      if (!nodesData?.metric_data) {
        setMetrics(prev => ({ ...prev, loading: false }));
        return;
      }

      const nodeMetrics = nodesData.metric_data as any;
      const nodes = nodeMetrics.nodes || [];

      let totalCPUCapacity = 0;
      let totalCPUUsage = 0;
      let totalMemoryCapacity = 0;
      let totalMemoryUsage = 0;

      const processedNodes = nodes.map((node: any) => {
        const cpuCapacity = node.capacity?.cpu || 0;     // millicores
        const memoryCapacity = node.capacity?.memory || 0; // bytes
        const cpuUsage = node.usage?.cpu || 0;           // millicores
        const memoryUsage = node.usage?.memory || 0;     // bytes

        totalCPUCapacity += cpuCapacity;
        totalCPUUsage += cpuUsage;
        totalMemoryCapacity += memoryCapacity;
        totalMemoryUsage += memoryUsage;

        let pool = 'worker';
        if (node.labels) {
          if (
            node.labels['node-role.kubernetes.io/control-plane'] ||
            node.labels['node-role.kubernetes.io/master']
          ) {
            pool = 'control-plane';
          } else if (node.labels['agentpool']) {
            pool = node.labels['agentpool'];
          } else if (node.labels['pool']) {
            pool = node.labels['pool'];
          }
        }
        if (pool === 'worker' && node.name) {
          if (node.name.includes('control-plane') || node.name.includes('master')) {
            pool = 'control-plane';
          } else {
            const poolMatch = node.name.match(/pool-[a-z0-9]+-[a-z0-9]+/);
            if (poolMatch) pool = poolMatch[0];
          }
        }

        const cpuPercent = cpuCapacity > 0 ? (cpuUsage / cpuCapacity) * 100 : 0;
        const memoryPercent = memoryCapacity > 0 ? (memoryUsage / memoryCapacity) * 100 : 0;

        return {
          name: node.name,
          cpu: cpuUsage,
          cpuCapacity,
          cpuPercent,
          memory: memoryUsage,
          memoryCapacity,
          memoryGB: memoryCapacity / (1024 ** 3),
          memoryUsageGB: memoryUsage / (1024 ** 3),
          memoryPercent,
          status: node.status,
          osImage: node.osImage,
          kernelVersion: node.kernelVersion,
          containerRuntime: node.containerRuntime,
          pool,
          labels: node.labels,
        };
      });

      // Prefer the dedicated cpu/memory metrics for aggregate percentages — they come
      // from a direct cluster-level measurement and are more up-to-date than summing
      // per-node usage from the nodes metric.
      const overallCpuUsage =
        cpuData?.usage_percent != null
          ? cpuData.usage_percent
          : totalCPUCapacity > 0
          ? (totalCPUUsage / totalCPUCapacity) * 100
          : 0;

      const overallMemoryUsage =
        memoryData?.usage_percent != null
          ? memoryData.usage_percent
          : totalMemoryCapacity > 0
          ? (totalMemoryUsage / totalMemoryCapacity) * 100
          : 0;

      // When the dedicated cpu/memory metrics are fresher than the nodes metric,
      // apply their percentages back to per-node usage so the Workers tab stays
      // consistent with the Overview. For a single-node cluster the cluster % = node %.
      // For multi-node we distribute proportionally based on each node's capacity share.
      let finalNodes = processedNodes;
      const hasFreshCpu    = cpuData?.usage_percent    != null && totalCPUCapacity > 0;
      const hasFreshMemory = memoryData?.usage_percent != null && totalMemoryCapacity > 0;

      if (hasFreshCpu || hasFreshMemory) {
        finalNodes = processedNodes.map(node => {
          const cpuShare    = totalCPUCapacity    > 0 ? node.cpuCapacity!    / totalCPUCapacity    : 0;
          const memoryShare = totalMemoryCapacity > 0 ? node.memoryCapacity! / totalMemoryCapacity : 0;

          const correctedCpuPercent    = hasFreshCpu    ? overallCpuUsage    : node.cpuPercent    ?? 0;
          const correctedMemoryPercent = hasFreshMemory ? overallMemoryUsage : node.memoryPercent ?? 0;

          const correctedCpuUsage    = hasFreshCpu    ? (correctedCpuPercent    / 100) * (node.cpuCapacity    ?? 0) : node.cpu;
          const correctedMemoryUsage = hasFreshMemory ? (correctedMemoryPercent / 100) * (node.memoryCapacity ?? 0) : Number(node.memory);

          return {
            ...node,
            cpu:           correctedCpuUsage,
            cpuPercent:    correctedCpuPercent,
            memory:        correctedMemoryUsage,
            memoryUsageGB: correctedMemoryUsage / (1024 ** 3),
            memoryPercent: correctedMemoryPercent,
          };
        });
      }

      setMetrics(prev => ({
        ...prev,
        nodes: finalNodes,
        totalCPU: totalCPUCapacity / 1000,
        totalMemory: totalMemoryCapacity / (1024 ** 3),
        cpuUsage: overallCpuUsage,
        memoryUsage: overallMemoryUsage,
        loading: false,
        collectedAt: nodesData.collected_at ? new Date(nodesData.collected_at) : new Date(),
      }));
    } catch (error) {
      console.error('Error fetching node metrics:', error);
      setMetrics(prev => ({ ...prev, loading: false }));
    }
  }, [clusterId]);

  useEffect(() => {
    if (!clusterId) return;

    fetchNodeMetrics();

    // Poll every 30 seconds as primary update mechanism
    const pollInterval = setInterval(fetchNodeMetrics, 30_000);

    // Also subscribe to realtime inserts as an accelerator (fires immediately when
    // new metrics land, rather than waiting for the next poll tick)
    const channel = supabase
      .channel(`node-metrics-${clusterId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_metrics',
          filter: `cluster_id=eq.${clusterId}`,
        },
        () => {
          fetchNodeMetrics();
        }
      )
      .subscribe();

    // Expose refresh so consumers can trigger an immediate re-fetch
    setMetrics(prev => ({ ...prev, refresh: fetchNodeMetrics }));

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [clusterId, fetchNodeMetrics]);

  return metrics;
};
