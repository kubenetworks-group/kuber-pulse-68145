import { DashboardLayout } from "@/components/DashboardLayout";
import { useRiskAnalysis } from "@/hooks/useRiskAnalysis";
import { useCluster } from "@/contexts/ClusterContext";
import { LoadBalancerMonitorWidget } from "@/components/risk/LoadBalancerMonitorWidget";
import { PublicExposuresWidget } from "@/components/risk/PublicExposuresWidget";
import { RiskPageHeader } from "@/components/risk/RiskPageHeader";
import { Skeleton } from "@/components/ui/skeleton";

const C = { critical: "#FF2D2D", high: "#FF7A00", medium: "#F5C518", low: "#00E5A0" } as const;

export default function RiskLoadBalancer() {
  const { analysis, loading, refreshing, lastUpdated, refetch } = useRiskAnalysis();
  const { clusters, selectedClusterId } = useCluster();
  const cluster = clusters.find(c => c.id === selectedClusterId);

  const lbExposures = analysis.publicExposures.filter(e => e.type === "loadbalancer");
  const ingressExposures = analysis.publicExposures.filter(e => e.type === "ingress");
  const unprotected = analysis.publicExposures.filter(e => !e.hasNetworkPolicy);

  if (!selectedClusterId) return <DashboardLayout><div className="flex items-center justify-center pt-20"><p className="text-sm text-muted-foreground">Selecione um cluster.</p></div></DashboardLayout>;
  if (loading) return <DashboardLayout><div className="flex flex-col gap-4 p-6"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <RiskPageHeader
          title="LoadBalancers & Exposições"
          subtitle="Monitoramento de serviços expostos publicamente"
          clusterName={cluster?.name}
          clusterEnv={cluster?.environment}
          score={analysis.overallScore}
          stats={[
            { label: "LoadBalancers",  value: lbExposures.length,      color: C.high },
            { label: "Ingresses",      value: ingressExposures.length,  color: C.medium },
            { label: "Sem NetworkPolicy", value: unprotected.length,   color: C.critical },
          ]}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          onRefresh={refetch}
        />
        <LoadBalancerMonitorWidget />
        <PublicExposuresWidget exposures={analysis.publicExposures} />
      </div>
    </DashboardLayout>
  );
}
