import { DashboardLayout } from "@/components/DashboardLayout";
import { ObservabilityHeader } from "@/components/observability/ObservabilityHeader";
import { PodsOverviewChart } from "@/components/observability/PodsOverviewChart";
import { ServicesOverview } from "@/components/observability/ServicesOverview";
import { IngressOverview } from "@/components/observability/IngressOverview";
import { ResourceUsageCharts } from "@/components/observability/ResourceUsageCharts";
import { MonitoringAgentsSuggestions } from "@/components/observability/MonitoringAgentsSuggestions";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";

const Observability = () => {
  const { clusters } = useCluster();
  const { pods, services, ingresses, namespaceUsage, agents, loading, lastSync, refetch } =
    useObservabilityData();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <ObservabilityHeader lastSync={lastSync} onRefresh={refetch} loading={loading} />

        {clusters.length === 0 ? (
          <ClusterOnboarding />
        ) : (
          <div className="space-y-5">
            {/* Resource Usage Charts */}
            <ResourceUsageCharts namespaceUsage={namespaceUsage} loading={loading} />

            {/* Pods + Services Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <PodsOverviewChart pods={pods} loading={loading} />
              <ServicesOverview services={services} loading={loading} />
            </div>

            {/* Ingress */}
            <IngressOverview ingresses={ingresses} loading={loading} />

            {/* Monitoring Agents Suggestions */}
            <MonitoringAgentsSuggestions agents={agents} loading={loading} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Observability;
