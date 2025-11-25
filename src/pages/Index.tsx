import { DashboardLayout } from "@/components/DashboardLayout";
import { NodeDetailsCard } from "@/components/NodeDetailsCard";
import { CostChart } from "@/components/CostChart";
import { AIInsightsWidget } from "@/components/AIInsightsWidget";
import { PodHealthByNamespace } from "@/components/PodHealthByNamespace";
import { ClusterEvents } from "@/components/ClusterEvents";
import { WelcomeHeader } from "@/components/WelcomeHeader";
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

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Welcome Header */}
        <WelcomeHeader />

        {/* Cluster Info Badge */}
        {clusterData && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 animate-in fade-in slide-in-from-top-3 duration-500">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium text-foreground">
              {clusterData.name} - {clusterData.environment}
            </span>
          </div>
        )}

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

            {/* Node Details */}
            {selectedClusterId && (
              <div className="animate-scale-in">
                <NodeDetailsCard
                  nodes={nodeMetrics.nodes}
                  totalCPU={nodeMetrics.totalCPU}
                  totalMemory={nodeMetrics.totalMemory}
                  cpuUsage={nodeMetrics.cpuUsage}
                  memoryUsage={nodeMetrics.memoryUsage}
                  loading={nodeMetrics.loading}
                />
              </div>
            )}

            {/* Cost Chart */}
            <div className="animate-scale-in">
              <CostChart />
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
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
