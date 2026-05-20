import { DashboardLayout } from "@/components/DashboardLayout";
import { IngressOverview } from "@/components/observability/IngressOverview";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { Globe2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const KubernetesIngress = () => {
  const { clusters } = useCluster();
  const { ingresses, loading, refetch } = useObservabilityData();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Ingress</h1>
              <p className="text-sm text-muted-foreground">Regras de entrada e roteamento HTTP/TLS</p>
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
          <IngressOverview ingresses={ingresses} loading={loading} />
        )}
      </div>
    </DashboardLayout>
  );
};

export default KubernetesIngress;
