import { DashboardLayout } from "@/components/DashboardLayout";
import { PodLogViewer } from "@/components/observability/PodLogViewer";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { Box, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const KubernetesPods = () => {
  const { clusters } = useCluster();
  const { pods, loading, refetch } = useObservabilityData();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Box className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Pods</h1>
              <p className="text-sm text-muted-foreground">Visualize pods e logs ao vivo</p>
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
          <PodLogViewer pods={pods} onRefresh={refetch} loading={loading} />
        )}
      </div>
    </DashboardLayout>
  );
};

export default KubernetesPods;
