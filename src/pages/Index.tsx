import { MetricCard } from "@/components/MetricCard";
import { ClusterCard } from "@/components/ClusterCard";
import { RecentEvents } from "@/components/RecentEvents";
import { CostChart } from "@/components/CostChart";
import { Button } from "@/components/ui/button";
import { Server, DollarSign, Shield, Database, Plus, Bell } from "lucide-react";

const Index = () => {
  const clusters = [
    {
      name: "prod-us-east-1",
      status: "healthy" as const,
      nodes: 12,
      pods: 148,
      cpuUsage: 68,
      memoryUsage: 72,
      environment: "AWS EKS - Production",
    },
    {
      name: "staging-eu-west-1",
      status: "warning" as const,
      nodes: 6,
      pods: 84,
      cpuUsage: 82,
      memoryUsage: 89,
      environment: "GCP GKE - Staging",
    },
    {
      name: "prod-asia-1",
      status: "healthy" as const,
      nodes: 8,
      pods: 112,
      cpuUsage: 54,
      memoryUsage: 61,
      environment: "Azure AKS - Production",
    },
    {
      name: "dev-us-west-2",
      status: "critical" as const,
      nodes: 4,
      pods: 32,
      cpuUsage: 45,
      memoryUsage: 52,
      environment: "On-Premises - Development",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <Server className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">CloudOps Platform</h1>
                <p className="text-sm text-muted-foreground">Multi-Cloud Infrastructure Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon">
                <Bell className="w-4 h-4" />
              </Button>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Connect Cluster
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Clusters"
            value={4}
            subtitle="Across 3 cloud providers"
            icon={Server}
            trend={{ value: 25, isPositive: true }}
          />
          <MetricCard
            title="Monthly Cost"
            value="$3,800"
            subtitle="Current billing cycle"
            icon={DollarSign}
            trend={{ value: 12, isPositive: false }}
          />
          <MetricCard
            title="Security Score"
            value="94%"
            subtitle="All clusters audited"
            icon={Shield}
            trend={{ value: 8, isPositive: true }}
          />
          <MetricCard
            title="Total Storage"
            value="2.4 TB"
            subtitle="Active persistent volumes"
            icon={Database}
            trend={{ value: 15, isPositive: true }}
          />
        </div>

        {/* Clusters Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Active Clusters</h2>
            <Button variant="outline" size="sm">View All</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {clusters.map((cluster) => (
              <ClusterCard key={cluster.name} {...cluster} />
            ))}
          </div>
        </div>

        {/* Cost and Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CostChart />
          <RecentEvents />
        </div>
      </div>
    </div>
  );
};

export default Index;
