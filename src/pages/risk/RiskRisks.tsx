import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRiskAnalysis } from "@/hooks/useRiskAnalysis";
import { useSecurityThreats } from "@/hooks/useSecurityThreats";
import { useCluster } from "@/contexts/ClusterContext";
import { RisksOverview } from "@/components/risk/RisksOverview";
import { ClusterChangesWidget } from "@/components/risk/ClusterChangesWidget";
import { AvailabilityWidget } from "@/components/risk/AvailabilityWidget";
import { PublicExposuresWidget } from "@/components/risk/PublicExposuresWidget";
import { ProblemTrendChart } from "@/components/risk/ProblemTrendChart";
import { ConfigurationRisksWidget } from "@/components/risk/ConfigurationRisksWidget";
import { RiskPanelFilters, RiskFilters, filterThreats, extractNamespaces } from "@/components/risk/RiskPanelFilters";
import { RiskPageHeader } from "@/components/risk/RiskPageHeader";
import { Skeleton } from "@/components/ui/skeleton";

const C = { critical: "#FF2D2D", high: "#FF7A00", medium: "#F5C518", low: "#00E5A0" } as const;
const calcLevel = (s: number): "critical"|"high"|"medium"|"low" => s >= 75 ? "critical" : s >= 50 ? "high" : s >= 25 ? "medium" : "low";

export default function RiskRisks() {
  const { analysis, loading, refreshing, lastUpdated, refetch } = useRiskAnalysis();
  const { threats, stats, mitigateThreat, markAsFalsePositive } = useSecurityThreats();
  const { clusters, selectedClusterId } = useCluster();
  const [filters, setFilters] = useState<RiskFilters>({ severity: "all", status: "all", namespace: "all", period: "all" });

  const cluster     = clusters.find(c => c.id === selectedClusterId);
  const namespaces  = useMemo(() => extractNamespaces(threats), [threats]);
  const filtered    = useMemo(() => filterThreats(threats, filters), [threats, filters]);
  const configRisks = useMemo(() => filtered.filter(t => t.is_attack === false && t.status === "active"), [filtered]);

  const displayRisks = useMemo(() => {
    let cfgScore = 0;
    configRisks.forEach(t => { if (t.severity === "critical") cfgScore += 10; else if (t.severity === "high") cfgScore += 6; else if (t.severity === "medium") cfgScore += 3; else cfgScore += 1; });
    cfgScore = Math.min(cfgScore + analysis.risks.configuration.score * 0.4, 100);
    return { ...analysis.risks, configuration: { ...analysis.risks.configuration, score: Math.round(cfgScore), level: calcLevel(Math.round(cfgScore)), count: configRisks.length + analysis.risks.configuration.count } };
  }, [configRisks, analysis.risks]);

  if (!selectedClusterId) return <DashboardLayout><div className="flex items-center justify-center pt-20"><p className="text-sm text-muted-foreground">Selecione um cluster.</p></div></DashboardLayout>;
  if (loading) return <DashboardLayout><div className="flex flex-col gap-4 p-6"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <RiskPageHeader
          title="Riscos de Configuração"
          subtitle="Misconfigurações, exposições e desvios de boas práticas"
          clusterName={cluster?.name}
          clusterEnv={cluster?.environment}
          score={analysis.overallScore}
          stats={[
            { label: "Config. Risks", value: configRisks.length,          color: C.high },
            { label: "Exposições",    value: analysis.publicExposures.length, color: C.medium },
            { label: "Resolvidas",    value: stats.mitigated,              color: C.low },
          ]}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          onRefresh={refetch}
        />
        <RiskPanelFilters filters={filters} onFiltersChange={setFilters} namespaces={namespaces} showStatusFilter />
        {configRisks.length > 0 && (
          <ConfigurationRisksWidget risks={configRisks} onResolve={mitigateThreat} onMarkFalsePositive={markAsFalsePositive} />
        )}
        <RisksOverview risks={displayRisks} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ClusterChangesWidget changes={analysis.recentChanges} />
          <AvailabilityWidget availability={analysis.availability} />
        </div>
        <PublicExposuresWidget exposures={analysis.publicExposures} />
        <ProblemTrendChart trends={analysis.trends} />
      </div>
    </DashboardLayout>
  );
}
