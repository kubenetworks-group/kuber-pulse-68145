import { DashboardLayout } from "@/components/DashboardLayout";
import { NodeDetailsCard } from "@/components/NodeDetailsCard";
import { AIInsightsWidget } from "@/components/AIInsightsWidget";
import { PodHealthByNamespace } from "@/components/PodHealthByNamespace";
import { ClusterEvents } from "@/components/ClusterEvents";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { AgentUpdateBanner } from "@/components/AgentUpdateBanner";
import { AdminAlertsDisplay } from "@/components/AdminAlertsDisplay";
import { SecurityThreatsFloatingAlert } from "@/components/SecurityThreatsFloatingAlert";
import { WeeklyReportBanner } from "@/components/WeeklyReportBanner";
import { CleanHeader } from "@/components/dashboard/CleanHeader";
import { CleanMetricsRow } from "@/components/dashboard/CleanMetricsRow";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNodeMetrics } from "@/hooks/useNodeMetrics";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { user } = useAuth();
  const { selectedClusterId, clusters } = useCluster();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [clusterData, setClusterData] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const nodeMetrics = useNodeMetrics(selectedClusterId);

  // Check if user has completed onboarding
  useEffect(() => {
    if (user) {
      const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${user.id}`);
      const hasSeenWelcome = localStorage.getItem(`welcome_shown_${user.id}`);
      
      // If user is new (seen welcome but not completed onboarding), redirect to welcome
      if (hasSeenWelcome && !hasCompletedOnboarding) {
        navigate('/welcome');
      }
    }
  }, [user, navigate]);

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

  // Prefer clusters.cpu_usage/memory_usage when available — those are updated on every
  // metric cycle by agent-receive-metrics and propagated in real-time via the clusters
  // realtime subscription. Fall back to the hook's computed value when not set yet.
  const liveCpuUsage    = clusterData?.cpu_usage    ?? nodeMetrics.cpuUsage;
  const liveMemoryUsage = clusterData?.memory_usage ?? nodeMetrics.memoryUsage;

  return (
    <DashboardLayout>
      {/* Floating Security Alert */}
      <SecurityThreatsFloatingAlert />
      
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* System banners (kept above the fold) */}
        <AgentUpdateBanner />
        <WeeklyReportBanner />
        <AdminAlertsDisplay />

        {/* Clean header */}
        <CleanHeader clusterData={clusterData} />

        {/* Onboarding if no clusters */}
        {clusters.length === 0 ? (
          <ClusterOnboarding />
        ) : (
          <div className="space-y-6">
            {/* Top metrics row — minimal pill cards */}
            <CleanMetricsRow
              clusterData={clusterData}
              cpuUsage={liveCpuUsage}
              memoryUsage={liveMemoryUsage}
            />

            {/* Node infrastructure */}
            {selectedClusterId && (
              <NodeDetailsCard
                nodes={nodeMetrics.nodes}
                totalCPU={nodeMetrics.totalCPU}
                totalMemory={nodeMetrics.totalMemory}
                cpuUsage={liveCpuUsage}
                memoryUsage={liveMemoryUsage}
                loading={nodeMetrics.loading}
                collectedAt={nodeMetrics.collectedAt}
                onRefresh={nodeMetrics.refresh}
              />
            )}

            {/* Two-column layout on large screens: pods + events */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PodHealthByNamespace />
              </div>
              <div>
                <ClusterEvents />
              </div>
            </div>

            {/* AI insights — full width */}
            <AIInsightsWidget recentIncidents={incidents} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
export default Index;
