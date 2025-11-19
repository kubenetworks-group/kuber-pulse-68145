import { useEffect, useState } from "react";
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
}

export const useNodeMetrics = (clusterId: string | undefined) => {
  const [metrics, setMetrics] = useState<NodeMetrics>({
    nodes: [],
    totalCPU: 0,
    totalMemory: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    loading: true,
  });

  useEffect(() => {
    if (!clusterId) return;

    const fetchNodeMetrics = async () => {
      try {
        // Fetch latest node metrics
        const { data: nodesData } = await supabase
          .from('agent_metrics')
          .select('metric_data, collected_at')
          .eq('cluster_id', clusterId)
          .eq('metric_type', 'nodes')
          .order('collected_at', { ascending: false })
          .limit(1)
          .single();

        // Fetch CPU and Memory usage
        const { data: cpuData } = await supabase
          .from('agent_metrics')
          .select('metric_data')
          .eq('cluster_id', clusterId)
          .eq('metric_type', 'cpu')
          .order('collected_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: memoryData } = await supabase
          .from('agent_metrics')
          .select('metric_data')
          .eq('cluster_id', clusterId)
          .eq('metric_type', 'memory')
          .order('collected_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (nodesData?.metric_data) {
          const nodeMetrics = nodesData.metric_data as any;
          const nodes = nodeMetrics.nodes || [];
          
          // Calculate total CPU and memory from capacity and usage
          let totalCPUCapacity = 0;
          let totalCPUUsage = 0;
          let totalMemoryCapacity = 0;
          let totalMemoryUsage = 0;

          // Process each node with new capacity/usage structure
          const processedNodes = nodes.map((node: any) => {
            // Extract capacity and usage
            const cpuCapacity = node.capacity?.cpu || 0; // in millicores
            const memoryCapacity = node.capacity?.memory || 0; // in bytes
            const cpuUsage = node.usage?.cpu || 0; // in millicores
            const memoryUsage = node.usage?.memory || 0; // in bytes

            // Accumulate totals
            totalCPUCapacity += cpuCapacity;
            totalCPUUsage += cpuUsage;
            totalMemoryCapacity += memoryCapacity;
            totalMemoryUsage += memoryUsage;

            // Determine pool from labels and name
            let pool = 'worker';
            
            if (node.labels) {
              if (node.labels['node-role.kubernetes.io/control-plane'] || 
                  node.labels['node-role.kubernetes.io/master']) {
                pool = 'control-plane';
              } else if (node.labels['agentpool']) {
                pool = node.labels['agentpool'];
              } else if (node.labels['pool']) {
                pool = node.labels['pool'];
              }
            }
            
            // Fallback to name-based detection for pool
            if (pool === 'worker' && node.name) {
              if (node.name.includes('control-plane') || node.name.includes('master')) {
                pool = 'control-plane';
              } else {
                // Extract pool name like "pool-k8s-78ff849f5f" from node name
                const poolMatch = node.name.match(/pool-[a-z0-9]+-[a-z0-9]+/);
                if (poolMatch) {
                  pool = poolMatch[0];
                }
              }
            }

            // Calculate individual node percentages
            const cpuPercent = cpuCapacity > 0 ? (cpuUsage / cpuCapacity) * 100 : 0;
            const memoryPercent = memoryCapacity > 0 ? (memoryUsage / memoryCapacity) * 100 : 0;

            return {
              name: node.name,
              cpu: cpuUsage, // millicores used
              cpuCapacity: cpuCapacity, // millicores total
              cpuPercent: cpuPercent,
              memory: memoryUsage, // bytes used
              memoryCapacity: memoryCapacity, // bytes total
              memoryGB: memoryCapacity / (1024 * 1024 * 1024), // GB total
              memoryUsageGB: memoryUsage / (1024 * 1024 * 1024), // GB used
              memoryPercent: memoryPercent,
              status: node.status,
              osImage: node.osImage,
              kernelVersion: node.kernelVersion,
              containerRuntime: node.containerRuntime,
              pool,
              labels: node.labels,
            };
          });

          // Calculate overall usage percentages
          const overallCpuUsage = totalCPUCapacity > 0 ? (totalCPUUsage / totalCPUCapacity) * 100 : 0;
          const overallMemoryUsage = totalMemoryCapacity > 0 ? (totalMemoryUsage / totalMemoryCapacity) * 100 : 0;

          setMetrics({
            nodes: processedNodes,
            totalCPU: totalCPUCapacity / 1000, // convert millicores to cores
            totalMemory: totalMemoryCapacity / (1024 * 1024 * 1024), // convert bytes to GB
            cpuUsage: overallCpuUsage,
            memoryUsage: overallMemoryUsage,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Error fetching node metrics:', error);
        setMetrics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchNodeMetrics();

    // Real-time subscription for updates
    const channel = supabase
      .channel('node-metrics-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_metrics',
          filter: `cluster_id=eq.${clusterId}`
        },
        () => {
          fetchNodeMetrics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clusterId]);

  return metrics;
};
