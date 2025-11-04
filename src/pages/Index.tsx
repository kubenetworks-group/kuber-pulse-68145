import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { ClusterCard } from "@/components/ClusterCard";
import { RecentEvents } from "@/components/RecentEvents";
import { CostChart } from "@/components/CostChart";
import { Server, DollarSign, Shield, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user } = useAuth();
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClusters();
  }, [user]);

  const fetchClusters = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("clusters")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(4);

    if (!error && data) {
      setClusters(data);
    }
    setLoading(false);
  };

  const totalNodes = clusters.reduce((sum, c) => sum + (c.nodes || 0), 0);
  const totalPods = clusters.reduce((sum, c) => sum + (c.pods || 0), 0);
  const totalStorage = clusters.reduce((sum, c) => sum + (c.storage_used_gb || 0), 0);
  const totalCost = clusters.reduce((sum, c) => sum + (c.monthly_cost || 0), 0);

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your infrastructure</p>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Clusters"
            value={clusters.length}
            subtitle={`${totalNodes} total nodes`}
            icon={Server}
          />
          <MetricCard
            title="Monthly Cost"
            value={`$${totalCost.toFixed(0)}`}
            subtitle="Current billing cycle"
            icon={DollarSign}
          />
          <MetricCard
            title="Total Pods"
            value={totalPods}
            subtitle="Across all clusters"
            icon={Database}
          />
          <MetricCard
            title="Total Storage"
            value={`${totalStorage.toFixed(1)} GB`}
            subtitle="Active volumes"
            icon={Database}
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Clusters Grid */}
            {clusters.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Active Clusters</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {clusters.map((cluster) => (
                    <ClusterCard
                      key={cluster.id}
                      name={cluster.name}
                      status={cluster.status}
                      nodes={cluster.nodes}
                      pods={cluster.pods}
                      cpuUsage={Number(cluster.cpu_usage)}
                      memoryUsage={Number(cluster.memory_usage)}
                      environment={`${cluster.provider.toUpperCase()} - ${cluster.environment}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Cost and Events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CostChart />
              <RecentEvents />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Index;
