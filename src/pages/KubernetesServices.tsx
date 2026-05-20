import { DashboardLayout } from "@/components/DashboardLayout";
import { ServicesOverview } from "@/components/observability/ServicesOverview";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { Network, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const KubernetesServices = () => {
  const { clusters } = useCluster();
  const { services, loading, refetch } = useObservabilityData();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Services</h1>
              <p className="text-sm text-muted-foreground">Gerencie os serviços do cluster</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {clusters.length === 0 ? (
          <ClusterOnboarding />
        ) : (
          <ServicesOverview services={services} loading={loading} />
        )}
      </div>
    </DashboardLayout>
  );
};

export default KubernetesServices;
