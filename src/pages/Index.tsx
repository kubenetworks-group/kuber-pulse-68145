import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { ClusterCard } from "@/components/ClusterCard";
import { CostChart } from "@/components/CostChart";
import { RecentEvents } from "@/components/RecentEvents";
import { ClusterHealthMap } from "@/components/ClusterHealthMap";
import { AIInsightsWidget } from "@/components/AIInsightsWidget";
import { Server, DollarSign, Database, HardDrive, Bot } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const Index = () => {
  const { user } = useAuth();
  const [clusters, setClusters] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch clusters
      const { data: clustersData, error: clustersError } = await supabase
        .from('clusters')
        .select('*')
        .order('created_at', { ascending: false });

      if (clustersError) {
        console.error('Error fetching clusters:', clustersError);
      } else {
        setClusters(clustersData || []);
      }

      // Fetch recent AI incidents
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('ai_incidents')
        .select('*')
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

  const totalNodes = clusters.reduce((sum, cluster) => sum + (cluster.nodes || 0), 0);
  const totalPods = clusters.reduce((sum, cluster) => sum + (cluster.pods || 0), 0);
  const totalStorage = clusters.reduce((sum, cluster) => sum + (cluster.storage_used_gb || 0), 0);
  const totalMonthlyCost = clusters.reduce((sum, cluster) => sum + (cluster.monthly_cost || 0), 0);
  const aiActionsToday = incidents.filter(i => {
    const today = new Date().toDateString();
    return new Date(i.created_at).toDateString() === today && i.action_taken;
  }).length;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time overview of your CloudOps infrastructure
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <MetricCard
            title="Total Clusters"
            value={clusters.length.toString()}
            icon={Server}
          />
          <MetricCard
            title="Total Nodes"
            value={totalNodes.toString()}
            icon={Server}
          />
          <MetricCard
            title="Total Pods"
            value={totalPods.toString()}
            icon={Database}
          />
          <MetricCard
            title="Total Storage"
            value={`${totalStorage.toFixed(0)} GB`}
            icon={HardDrive}
          />
          <MetricCard
            title="AI Actions Today"
            value={aiActionsToday.toString()}
            icon={Bot}
          />
        </div>

        {/* AI Insights Widget */}
        {incidents.length > 0 && (
          <AIInsightsWidget recentIncidents={incidents} />
        )}

        {/* Cluster Health Map */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Cluster Health Map</h2>
          <ClusterHealthMap clusters={clusters} loading={loading} />
        </div>

        {/* Active Clusters */}
        {!loading && clusters.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Active Clusters</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {clusters.slice(0, 4).map((cluster) => (
                <ClusterCard
                  key={cluster.id}
                  name={cluster.name}
                  status={cluster.status}
                  pods={cluster.pods}
                  nodes={cluster.nodes}
                  cpuUsage={cluster.cpu_usage}
                  memoryUsage={cluster.memory_usage}
                  environment={`${cluster.provider} - ${cluster.environment}`}
                />
              ))}
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
