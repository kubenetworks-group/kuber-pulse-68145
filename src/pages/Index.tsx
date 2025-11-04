import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { ClusterCard } from "@/components/ClusterCard";
import { CostChart } from "@/components/CostChart";
import { RecentEvents } from "@/components/RecentEvents";
import { ClusterHealthMap } from "@/components/ClusterHealthMap";
import { AIInsightsWidget } from "@/components/AIInsightsWidget";
import { PodHealthByNamespace } from "@/components/PodHealthByNamespace";
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

  useEffect(() => {
    if (user && selectedClusterId) {
      fetchData();
    }
  }, [user, selectedClusterId]);

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

  const aiActionsToday = incidents.filter(i => {
    const today = new Date().toDateString();
    return new Date(i.created_at).toDateString() === today && i.action_taken;
  }).length;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
            {t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('dashboard.overview')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <MetricCard
            title={t('dashboard.totalClusters')}
            value={clusters.length.toString()}
            icon={Server}
          />
          <MetricCard
            title={t('dashboard.activeNodes')}
            value={clusterData?.nodes?.toString() || '0'}
            icon={Server}
          />
          <MetricCard
            title={t('dashboard.runningPods')}
            value={clusterData?.pods?.toString() || '0'}
            icon={Database}
          />
          <MetricCard
            title={t('clusters.storage')}
            value={`${clusterData?.storage_used_gb?.toFixed(0) || 0} GB`}
            icon={HardDrive}
          />
          <MetricCard
            title={t('aiMonitor.title')}
            value={aiActionsToday.toString()}
            icon={Bot}
          />
        </div>

        {/* AI Insights Widget */}
        {incidents.length > 0 && (
          <AIInsightsWidget recentIncidents={incidents} />
        )}

        {/* Pod Health by Namespace */}
        <PodHealthByNamespace />

        {/* Selected Cluster Details */}
        {!loading && clusterData && (
          <div>
            <h2 className="text-2xl font-bold mb-4">{t('dashboard.clusterDetails')}</h2>
            <div className="grid gap-6 md:grid-cols-2">
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
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <CostChart />
          <RecentEvents />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
