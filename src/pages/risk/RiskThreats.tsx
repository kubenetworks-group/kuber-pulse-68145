import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRiskAnalysis } from "@/hooks/useRiskAnalysis";
import { useSecurityThreats } from "@/hooks/useSecurityThreats";
import { useCluster } from "@/contexts/ClusterContext";
import { SecurityThreatsPanel } from "@/components/risk/SecurityThreatsPanel";
import { RiskPanelFilters, RiskFilters, filterThreats, extractNamespaces } from "@/components/risk/RiskPanelFilters";
import { RiskPageHeader } from "@/components/risk/RiskPageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";

const C = { critical: "#FF2D2D", high: "#FF7A00", medium: "#F5C518", low: "#00E5A0" } as const;

export default function RiskThreats() {
  const { analysis, loading, refreshing, lastUpdated, refetch } = useRiskAnalysis();
  const { threats, stats, loading: tLoading, scanning, runSecurityScan, mitigateThreat, markAsFalsePositive, updateThreatStatus } = useSecurityThreats();
  const { clusters, selectedClusterId } = useCluster();
  const [filters, setFilters] = useState<RiskFilters>({ severity: "all", status: "all", namespace: "all", period: "all" });

  const cluster    = clusters.find(c => c.id === selectedClusterId);
  const namespaces = useMemo(() => extractNamespaces(threats), [threats]);
  const filtered   = useMemo(() => filterThreats(threats, filters), [threats, filters]);
  const attacks    = useMemo(() => filtered.filter(t => t.status === "active" && t.is_attack !== false), [filtered]);

  if (!selectedClusterId) return (
    <DashboardLayout>
      <div className="flex items-center justify-center pt-20">
        <p className="text-sm text-muted-foreground">Selecione um cluster.</p>
      </div>
    </DashboardLayout>
  );

  if (loading) return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5 p-4 sm:p-6">
        <RiskPageHeader
          title="Ameaças de Segurança"
          subtitle="Detecção e mitigação de ameaças em tempo real"
          clusterName={cluster?.name}
          clusterEnv={cluster?.environment}
          score={analysis.overallScore}
          stats={[
            { label: "Críticas",   value: stats.critical,  color: C.critical },
            { label: "Altas",      value: stats.high,       color: C.high },
            { label: "Ativas",     value: attacks.length,   color: C.medium },
            { label: "Resolvidas", value: stats.mitigated,  color: C.low },
          ]}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          onRefresh={refetch}
        />
        <RiskPanelFilters filters={filters} onFiltersChange={setFilters} namespaces={namespaces} showStatusFilter />
        <SecurityThreatsPanel
          threats={filtered} stats={stats} loading={tLoading} scanning={scanning}
          onScan={runSecurityScan} onMitigate={mitigateThreat}
          onMarkFalsePositive={markAsFalsePositive} onUpdateStatus={updateThreatStatus}
        />
      </div>
    </DashboardLayout>
  );
}
