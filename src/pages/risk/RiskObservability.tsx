import { DashboardLayout } from "@/components/DashboardLayout";
import { useRiskAnalysis } from "@/hooks/useRiskAnalysis";
import { useCluster } from "@/contexts/ClusterContext";
import { ObservabilityTab } from "@/components/observability/ObservabilityTab";
import { RiskPageHeader } from "@/components/risk/RiskPageHeader";
import { Skeleton } from "@/components/ui/skeleton";

const C = { critical: "#FF2D2D", high: "#FF7A00", medium: "#F5C518", low: "#00E5A0" } as const;

export default function RiskObservability() {
  const { analysis, loading, refreshing, lastUpdated, refetch } = useRiskAnalysis();
  const { clusters, selectedClusterId } = useCluster();
  const cluster = clusters.find(c => c.id === selectedClusterId);

  if (!selectedClusterId) return <DashboardLayout><div className="flex items-center justify-center pt-20"><p className="text-sm text-muted-foreground">Selecione um cluster.</p></div></DashboardLayout>;
  if (loading) return <DashboardLayout><div className="flex flex-col gap-4 p-6"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5 p-4 sm:p-6">
        <RiskPageHeader
          title="Observabilidade"
          subtitle="Traces, métricas, serviços e logs do cluster"
          clusterName={cluster?.name}
          clusterEnv={cluster?.environment}
          score={analysis.overallScore}
          stats={[
            { label: "Eventos",   value: analysis.recentChanges.length,  color: C.medium },
            { label: "Instáveis", value: analysis.unstablePods.length,   color: C.high },
            { label: "Tendências",value: analysis.trends.length,         color: C.low },
          ]}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          onRefresh={refetch}
        />
        <ObservabilityTab
          changes={analysis.recentChanges}
          unstablePods={analysis.unstablePods}
          trends={analysis.trends}
        />
      </div>
    </DashboardLayout>
  );
}
