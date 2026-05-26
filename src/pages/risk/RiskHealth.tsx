import { DashboardLayout } from "@/components/DashboardLayout";
import { useRiskAnalysis } from "@/hooks/useRiskAnalysis";
import { useCluster } from "@/contexts/ClusterContext";
import { UnstablePodsWidget } from "@/components/risk/UnstablePodsWidget";
import { ResourceMisuseWidget } from "@/components/risk/ResourceMisuseWidget";
import { MissingProbesWidget } from "@/components/risk/MissingProbesWidget";
import { ProblematicVolumesWidget } from "@/components/risk/ProblematicVolumesWidget";
import { ServicesWidget } from "@/components/risk/ServicesWidget";
import { CertificatesWidget } from "@/components/risk/CertificatesWidget";
import { RiskPageHeader } from "@/components/risk/RiskPageHeader";
import { Skeleton } from "@/components/ui/skeleton";

const C = { critical: "#FF2D2D", high: "#FF7A00", medium: "#F5C518", low: "#00E5A0" } as const;

export default function RiskHealth() {
  const { analysis, loading, refreshing, lastUpdated, refetch } = useRiskAnalysis();
  const { clusters, selectedClusterId } = useCluster();
  const cluster = clusters.find(c => c.id === selectedClusterId);

  if (!selectedClusterId) return <DashboardLayout><div className="flex items-center justify-center pt-20"><p className="text-sm text-muted-foreground">Selecione um cluster.</p></div></DashboardLayout>;
  if (loading) return <DashboardLayout><div className="flex flex-col gap-4 p-6"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <RiskPageHeader
          title="Health do Cluster"
          subtitle="Pods instáveis, recursos, probes e volumes problemáticos"
          clusterName={cluster?.name}
          clusterEnv={cluster?.environment}
          score={analysis.overallScore}
          stats={[
            { label: "Pods instáveis",  value: analysis.unstablePods.length,      color: C.critical },
            { label: "Recursos",        value: analysis.resourceIssues.length,     color: C.high },
            { label: "Sem probes",      value: analysis.probeIssues.length,        color: C.medium },
            { label: "Volumes",         value: analysis.volumeProblems.length,     color: C.low },
          ]}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          onRefresh={refetch}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UnstablePodsWidget pods={analysis.unstablePods} />
          <ResourceMisuseWidget issues={analysis.resourceIssues} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MissingProbesWidget issues={analysis.probeIssues} />
          <ProblematicVolumesWidget problems={analysis.volumeProblems} />
        </div>
        <ServicesWidget services={analysis.services} />
        <CertificatesWidget issues={analysis.certificateIssues} />
      </div>
    </DashboardLayout>
  );
}
