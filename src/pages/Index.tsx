import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { ClusterCard } from "@/components/ClusterCard";
import { CostChart } from "@/components/CostChart";
import { RecentEvents } from "@/components/RecentEvents";
import { ClusterHealthMap } from "@/components/ClusterHealthMap";
import { AIInsightsWidget } from "@/components/AIInsightsWidget";
import { PodHealthByNamespace } from "@/components/PodHealthByNamespace";
import { ClusterEvents } from "@/components/ClusterEvents";
import { StorageChart } from "@/components/StorageChart";
import { Server, DollarSign, Database, HardDrive, Bot } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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
          // Calculate storage metrics
          const allocatedBytes = pvcsData.reduce((sum, pvc) => sum + (pvc.requested_bytes || 0), 0);
          const usedBytes = pvcsData.reduce((sum, pvc) => sum + (pvc.used_bytes || 0), 0);
          const totalGB = cluster?.storage_total_gb || 0;
          const allocatedGB = allocatedBytes / (1024 ** 3); // Convert bytes to GB
          const usedGB = usedBytes / (1024 ** 3);
          const availableGB = totalGB - allocatedGB;

          setStorageMetrics({
            total: totalGB,
            allocated: allocatedGB,
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

  const aiActionsToday = incidents.filter(i => {
    const today = new Date().toDateString();
    return new Date(i.created_at).toDateString() === today && i.action_taken;
  }).length;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
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

        {/* Metrics Cards */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            title={t('dashboard.totalClusters')}
            value={clusters.length.toString()}
            icon={Server}
            trend={{ value: 12, isPositive: true }}
          />
          <MetricCard
            title={t('dashboard.activeNodes')}
            value={clusterData?.nodes?.toString() || '0'}
            icon={Server}
            trend={{ value: 8, isPositive: true }}
          />
          <MetricCard
            title={t('dashboard.runningPods')}
            value={clusterData?.pods?.toString() || '0'}
            icon={Database}
            trend={{ value: 15, isPositive: true }}
          />
          <MetricCard
            title={t('clusters.storage')}
            value={`${storageMetrics.used.toFixed(1)} / ${storageMetrics.total.toFixed(0)} GB`}
            subtitle={`${t('dashboard.allocated')}: ${storageMetrics.allocated.toFixed(1)} GB | ${t('dashboard.available')}: ${storageMetrics.available.toFixed(1)} GB`}
            icon={HardDrive}
            trend={{ 
              value: storageMetrics.total > 0 ? Math.round((storageMetrics.used / storageMetrics.total) * 100) : 0, 
              isPositive: false 
            }}
          />
          <MetricCard
            title={t('aiMonitor.title')}
            value={aiActionsToday.toString()}
            icon={Bot}
            trend={{ value: 23, isPositive: true }}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - 2 columns wide */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Insights Widget */}
            {incidents.length > 0 && (
              <div className="animate-scale-in">
                <AIInsightsWidget recentIncidents={incidents} />
              </div>
            )}

            {/* Selected Cluster Details */}
            {!loading && clusterData && (
              <div className="animate-scale-in">
                <ClusterCard
                  name={clusterData.name}
                  status={clusterData.status}
                  pods={clusterData.pods}
                  nodes={clusterData.nodes}
                  cpuUsage={clusterData.cpu_usage}
                  memoryUsage={clusterData.memory_usage}
                  environment={`${clusterData.provider} - ${clusterData.environment}`}
                />
              </div>
            )}

            {/* Cost Chart */}
            <div className="animate-scale-in">
              <CostChart />
            </div>

            {/* Storage Chart */}
            <div className="animate-scale-in">
              <StorageChart 
                total={storageMetrics.total}
                allocated={storageMetrics.allocated}
                used={storageMetrics.used}
                available={storageMetrics.available}
              />
            </div>
          </div>

          {/* Right Column - 1 column wide */}
          <div className="space-y-6">
            {/* Pod Health by Namespace */}
            <div className="animate-scale-in">
              <PodHealthByNamespace />
            </div>

            {/* Cluster Events */}
            <div className="animate-scale-in">
              <ClusterEvents />
            </div>

            {/* Recent Events */}
            <div className="animate-scale-in">
              <RecentEvents />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
