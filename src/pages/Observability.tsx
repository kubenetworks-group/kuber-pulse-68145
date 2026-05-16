import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ObservabilityHeader } from "@/components/observability/ObservabilityHeader";
import { PodsOverviewChart } from "@/components/observability/PodsOverviewChart";
import { ServicesOverview } from "@/components/observability/ServicesOverview";
import { IngressOverview } from "@/components/observability/IngressOverview";
import { ResourceUsageCharts } from "@/components/observability/ResourceUsageCharts";
import { MonitoringAgentsSuggestions } from "@/components/observability/MonitoringAgentsSuggestions";
import { AgentRestartHistory } from "@/components/observability/AgentRestartHistory";
import { AlertRulesManager } from "@/components/observability/AlertRulesManager";
import { AlertInstancesList } from "@/components/observability/AlertInstancesList";
import { WebhookConfigManager } from "@/components/observability/WebhookConfigManager";
import { PodLogViewer } from "@/components/observability/PodLogViewer";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Bell, Terminal, BarChart3 } from "lucide-react";

const Observability = () => {
  const { clusters } = useCluster();
  const { pods, services, ingresses, namespaceUsage, hasResourceData, agents, loading, lastSync, refetch } =
    useObservabilityData();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <ObservabilityHeader lastSync={lastSync} onRefresh={refetch} loading={loading} />

        {clusters.length === 0 ? (
          <ClusterOnboarding />
        ) : (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              <TabsTrigger value="overview" className="gap-1.5 text-xs">
                <BarChart3 className="w-3.5 h-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-1.5 text-xs">
                <Bell className="w-3.5 h-3.5" />
                Alertas
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5 text-xs">
                <Terminal className="w-3.5 h-3.5" />
                Logs
              </TabsTrigger>
              <TabsTrigger value="agents" className="gap-1.5 text-xs">
                <Activity className="w-3.5 h-3.5" />
                Agentes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5">
              <ResourceUsageCharts namespaceUsage={namespaceUsage} loading={loading} hasResourceData={hasResourceData} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <PodsOverviewChart pods={pods} loading={loading} />
                <ServicesOverview services={services} loading={loading} />
              </div>
              <IngressOverview ingresses={ingresses} loading={loading} />
            </TabsContent>

            <TabsContent value="alerts" className="space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <AlertInstancesList />
                <AlertRulesManager />
              </div>
              <WebhookConfigManager />
            </TabsContent>

            <TabsContent value="logs" className="space-y-5">
              <PodLogViewer pods={pods} onRefresh={refetch} loading={loading} />
            </TabsContent>

            <TabsContent value="agents" className="space-y-5">
              <MonitoringAgentsSuggestions agents={agents} loading={loading} />
              <AgentRestartHistory />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Observability;
