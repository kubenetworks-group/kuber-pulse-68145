import { DashboardLayout } from "@/components/DashboardLayout";
import { NodeDetailsCard } from "@/components/NodeDetailsCard";
import { CostChart } from "@/components/CostChart";
import { ClusterHealthMap } from "@/components/ClusterHealthMap";
import { AIInsightsWidget } from "@/components/AIInsightsWidget";
import { PodHealthByNamespace } from "@/components/PodHealthByNamespace";
import { ClusterEvents } from "@/components/ClusterEvents";
import { StorageChart } from "@/components/StorageChart";
import { DashboardGrid } from "@/components/DashboardGrid";
import { DraggableCard } from "@/components/DraggableCard";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNodeMetrics } from "@/hooks/useNodeMetrics";

const Index = () => {
  const { user } = useAuth();
  const { selectedClusterId, clusters } = useCluster();
  const { t } = useTranslation();
  const [clusterData, setClusterData] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageMetrics, setStorageMetrics] = useState({
    total: 0,
    allocated: 0,
    used: 0,
    available: 0
  });
  const nodeMetrics = useNodeMetrics(selectedClusterId);
  const { layout, isEditMode, handleLayoutChange, handleEditModeChange, handleResetLayout } = useDashboardLayout();

  useEffect(() => {
    if (user && selectedClusterId) {
      fetchData();
    }
  }, [user, selectedClusterId]);

  // Real-time subscription for cluster metrics
  useEffect(() => {
    if (!selectedClusterId) return;

    const channel = supabase
      .channel('cluster-metrics-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clusters',
          filter: `id=eq.${selectedClusterId}`
        },
        (payload) => {
          console.log('Real-time cluster update:', payload);
          setClusterData(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_metrics',
          filter: `cluster_id=eq.${selectedClusterId}`
        },
        (payload) => {
          console.log('Real-time metrics received:', payload);
          // Refresh data when new metrics arrive
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClusterId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch selected cluster data
      const { data: cluster, error: clusterError } = await supabase
        .from('clusters')
        .select('*')
        .eq('id', selectedClusterId)
        .single();

      if (clusterError) {
        console.error('Error fetching cluster:', clusterError);
      } else {
        setClusterData(cluster);
        
        // Fetch PVCs for storage calculation
        const { data: pvcsData, error: pvcsError } = await supabase
          .from('pvcs')
          .select('requested_bytes, used_bytes')
          .eq('cluster_id', selectedClusterId);

        if (pvcsError) {
          console.error('Error fetching PVCs:', pvcsError);
        } else if (pvcsData) {
          // Calculate storage metrics with 3 distinct values:
          // 1. Physical Capacity (from cluster.storage_total_gb - actual disk on nodes)
          // 2. Allocated (from PVCs requested_bytes - what was promised in PVCs)
          // 3. Used Real (from PVCs used_bytes - what is actually written)
          const allocatedBytes = pvcsData.reduce((sum, pvc) => sum + (pvc.requested_bytes || 0), 0);
          const usedBytes = pvcsData.reduce((sum, pvc) => sum + (pvc.used_bytes || 0), 0);
          const physicalCapacityGB = cluster?.storage_total_gb || 0; // Physical disk
          const allocatedGB = allocatedBytes / (1024 ** 3); // Allocated in PVCs
          const usedGB = usedBytes / (1024 ** 3); // Actually used
          const availableGB = Math.max(0, physicalCapacityGB - usedGB); // Available based on real usage

          setStorageMetrics({
            total: physicalCapacityGB,    // Physical capacity
            allocated: allocatedGB,        // Allocated in PVCs
            used: usedGB,
            available: Math.max(0, availableGB) // Ensure non-negative
          });
        }
      }

      // Fetch recent AI incidents for selected cluster
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('ai_incidents')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (incidentsError) {
        console.error('Error fetching incidents:', incidentsError);
      } else {
        setIncidents(incidentsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              {t('dashboard.title')}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
              {clusterData ? `${clusterData.name} - ${clusterData.environment}` : t('dashboard.overview')}
            </p>
          </div>
        </div>

        {/* Dashboard Grid with Drag & Drop */}
        <DashboardGrid
          layout={layout}
          onLayoutChange={handleLayoutChange}
          isEditMode={isEditMode}
          onEditModeChange={handleEditModeChange}
          onResetLayout={handleResetLayout}
        >
          {incidents.length > 0 && (
            <div key="ai-insights" data-grid={layout.find(l => l.i === 'ai-insights')}>
              <DraggableCard isEditMode={isEditMode} noWrapper>
                <AIInsightsWidget recentIncidents={incidents} />
              </DraggableCard>
            </div>
          )}
          
          <div key="node-details" data-grid={layout.find(l => l.i === 'node-details')}>
            <DraggableCard isEditMode={isEditMode} noWrapper>
              <NodeDetailsCard 
                nodes={nodeMetrics.nodes}
                totalCPU={nodeMetrics.totalCPU}
                totalMemory={nodeMetrics.totalMemory}
                cpuUsage={nodeMetrics.cpuUsage}
                memoryUsage={nodeMetrics.memoryUsage}
                loading={nodeMetrics.loading}
              />
            </DraggableCard>
          </div>

          <div key="cost-chart" data-grid={layout.find(l => l.i === 'cost-chart')}>
            <DraggableCard isEditMode={isEditMode} noWrapper>
              <CostChart />
            </DraggableCard>
          </div>

          <div key="storage-chart" data-grid={layout.find(l => l.i === 'storage-chart')}>
            <DraggableCard isEditMode={isEditMode} noWrapper>
              <StorageChart 
                total={storageMetrics.total}
                allocated={storageMetrics.allocated}
                used={storageMetrics.used}
                available={storageMetrics.available}
              />
            </DraggableCard>
          </div>

          <div key="pod-health" data-grid={layout.find(l => l.i === 'pod-health')}>
            <DraggableCard isEditMode={isEditMode} noWrapper>
              <PodHealthByNamespace />
            </DraggableCard>
          </div>

          <div key="cluster-events" data-grid={layout.find(l => l.i === 'cluster-events')}>
            <DraggableCard isEditMode={isEditMode} noWrapper>
              <ClusterEvents />
            </DraggableCard>
          </div>
        </DashboardGrid>
      </div>
    </DashboardLayout>
  );
};

export default Index;
