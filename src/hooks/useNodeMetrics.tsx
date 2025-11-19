import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NodeInfo {
  name: string;
  cpu: number;
  memory: string | number;
  memoryGB: number;
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
          
          // Calculate total CPU and memory
          const totalCPU = nodes.reduce((sum: number, node: any) => sum + (node.cpu || 0), 0);
          const totalMemoryKi = nodes.reduce((sum: number, node: any) => {
            const memory = node.memory || '0';
            const memoryValue = parseInt(memory.replace('Ki', ''));
            return sum + memoryValue;
          }, 0);
          const totalMemoryGB = totalMemoryKi / (1024 * 1024);

          // Extract pool information from node names and labels
          const processedNodes = nodes.map((node: any) => {
            let pool = 'default';
            
            // Try to get pool from labels first
            if (node.labels) {
              if (node.labels['pool']) {
                pool = node.labels['pool'];
              } else if (node.labels['agentpool']) {
                pool = node.labels['agentpool'];
              } else if (node.labels['node-role.kubernetes.io/control-plane'] || 
                         node.labels['node-role.kubernetes.io/master']) {
                pool = 'control-plane';
              }
            }
            
            // Fallback to name-based detection
            if (pool === 'default') {
              if (node.name.includes('control-plane') || node.name.includes('master')) {
                pool = 'control-plane';
              } else if (node.name.includes('pool-')) {
                const match = node.name.match(/pool-[^-]+/);
                pool = match ? match[0] : 'worker';
              }
            }

            const memoryValue = typeof node.memory === 'string' 
              ? parseInt(node.memory.replace('Ki', '')) 
              : node.memory;

            return {
              ...node,
              pool,
              memoryGB: memoryValue / (1024 * 1024),
              osImage: node.osImage,
              kernelVersion: node.kernelVersion,
            };
          });

          const cpuUsage = (cpuData?.metric_data as any)?.usage_percent || 0;
          const memoryUsage = (memoryData?.metric_data as any)?.usage_percent || 0;

          setMetrics({
            nodes: processedNodes,
            totalCPU,
            totalMemory: totalMemoryGB,
            cpuUsage,
            memoryUsage,
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
