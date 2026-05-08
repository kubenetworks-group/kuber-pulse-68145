import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TabsContent } from "@/components/ui/tabs";
import { useRiskAnalysis } from "@/hooks/useRiskAnalysis";
import { useCluster } from "@/contexts/ClusterContext";
import { useSecurityThreats } from "@/hooks/useSecurityThreats";
import { RisksOverview } from "@/components/risk/RisksOverview";
import { ClusterChangesWidget } from "@/components/risk/ClusterChangesWidget";
import { AvailabilityWidget } from "@/components/risk/AvailabilityWidget";
import { PublicExposuresWidget } from "@/components/risk/PublicExposuresWidget";
import { ProblemTrendChart } from "@/components/risk/ProblemTrendChart";
import { UnstablePodsWidget } from "@/components/risk/UnstablePodsWidget";
import { ResourceMisuseWidget } from "@/components/risk/ResourceMisuseWidget";
import { MissingProbesWidget } from "@/components/risk/MissingProbesWidget";
import { ProblematicVolumesWidget } from "@/components/risk/ProblematicVolumesWidget";
import { CertificatesWidget } from "@/components/risk/CertificatesWidget";
import { LoadBalancerMonitorWidget } from "@/components/risk/LoadBalancerMonitorWidget";
import { SecurityThreatsPanel } from "@/components/risk/SecurityThreatsPanel";
import { ConfigurationRisksWidget } from "@/components/risk/ConfigurationRisksWidget";
import {
  RiskPanelFilters,
  RiskFilters,
  filterThreats,
  extractNamespaces,
} from "@/components/risk/RiskPanelFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Activity,
  Globe,
  ShieldAlert,
  Shield,
  TrendingUp,
} from "lucide-react";

// ─── Score helpers ────────────────────────────────────────────────────────────

function getScoreLevel(score: number) {
  if (score >= 75) return { label: "Crítico", color: "text-red-500", ring: "stroke-red-500", bg: "bg-red-500/10 border-red-500/20" };
  if (score >= 50) return { label: "Alto", color: "text-orange-500", ring: "stroke-orange-500", bg: "bg-orange-500/10 border-orange-500/20" };
  if (score >= 25) return { label: "Médio", color: "text-yellow-500", ring: "stroke-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" };
  return { label: "Baixo", color: "text-green-500", ring: "stroke-green-500", bg: "bg-green-500/10 border-green-500/20" };
}

function ScoreRing({ score }: { score: number }) {
  const { label, color, ring } = getScoreLevel(score);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - score / 100);

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-16 w-16 flex-shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} className="stroke-border fill-none" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r}
            className={cn("fill-none transition-all duration-700", ring)}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dash}
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center text-base font-bold", color)}>
          {score}
        </span>
      </div>
      <div>
        <p className={cn("text-sm font-semibold", color)}>Risco {label}</p>
        <p className="text-xs text-muted-foreground">
          {score >= 50 ? "Ação recomendada" : "Cluster saudável"}
        </p>
      </div>
    </div>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
}

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors",
              isActive
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
            {!!tab.badge && (
              <span
                className={cn(
                  "h-5 min-w-5 px-1 rounded-full text-white text-[10px] flex items-center justify-center",
                  tab.badgeColor ?? "bg-primary"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const RiskPanel = () => {
  const { analysis, loading } = useRiskAnalysis();
  const { clusters, selectedClusterId } = useCluster();
  const {
    threats,
    stats: threatStats,
    loading: threatsLoading,
    scanning,
    runSecurityScan,
    mitigateThreat,
    markAsFalsePositive,
    updateThreatStatus,
  } = useSecurityThreats();

  const [filters, setFilters] = useState<RiskFilters>({
    severity: "all",
    status: "all",
    namespace: "all",
    period: "all",
  });
  const [activeTab, setActiveTab] = useState("threats");

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId);
  const availableNamespaces = useMemo(() => extractNamespaces(threats), [threats]);
  const filteredThreats = useMemo(() => filterThreats(threats, filters), [threats, filters]);

  const activeAttacks = filteredThreats.filter(
    (t) => t.status === "active" && t.is_attack !== false
  );
  const configRisks = filteredThreats.filter(
    (t) => t.is_attack === false && t.status === "active"
  );

  const tabs: TabItem[] = [
    {
      id: "threats",
      label: "Ameaças",
      icon: ShieldAlert,
      badge: activeAttacks.length || undefined,
      badgeColor: activeAttacks.length ? "bg-red-500" : undefined,
    },
    {
      id: "risks",
      label: "Riscos",
      icon: AlertTriangle,
      badge: configRisks.length || undefined,
      badgeColor: configRisks.length ? "bg-orange-500" : undefined,
    },
    { id: "loadbalancer", label: "LoadBalancers", icon: Globe },
    { id: "health", label: "Health", icon: Activity },
  ];

  if (!selectedClusterId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="p-4 rounded-full bg-muted/50">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium">Nenhum cluster selecionado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione um cluster para visualizar o painel de risco.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-16 w-48 rounded-xl" />
          </div>
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20">
                <Shield className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Painel de Risco</h1>
                {selectedCluster && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {selectedCluster.name}
                    {selectedCluster.environment && (
                      <span className="ml-2 text-xs font-mono opacity-60">
                        · {selectedCluster.environment}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <ScoreRing score={analysis.overallScore} />
          </div>

          {/* Stats strip */}
          <div className="border-t border-border/60 grid grid-cols-4 divide-x divide-border/60">
            {[
              {
                label: "Ameaças críticas",
                value: threatStats.critical,
                color: "text-red-500",
              },
              {
                label: "Ameaças altas",
                value: threatStats.high,
                color: "text-orange-500",
              },
              {
                label: "Riscos ativos",
                value: configRisks.length,
                color: "text-yellow-500",
              },
              {
                label: "Resolvidas",
                value: threatStats.mitigated,
                color: "text-green-500",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-5 py-3 text-center">
                <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────────────── */}
        <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {/* ── Tab contents ─────────────────────────────────────────────────── */}

        {activeTab === "threats" && (
          <div className="space-y-4">
            <RiskPanelFilters
              filters={filters}
              onFiltersChange={setFilters}
              namespaces={availableNamespaces}
              showStatusFilter={true}
            />
            <SecurityThreatsPanel
              threats={filteredThreats}
              stats={threatStats}
              loading={threatsLoading}
              scanning={scanning}
              onScan={runSecurityScan}
              onMitigate={mitigateThreat}
              onMarkFalsePositive={markAsFalsePositive}
              onUpdateStatus={updateThreatStatus}
            />
          </div>
        )}

        {activeTab === "risks" && (
          <div className="space-y-6">
            <RiskPanelFilters
              filters={filters}
              onFiltersChange={setFilters}
              namespaces={availableNamespaces}
              showStatusFilter={true}
            />
            {configRisks.length > 0 && (
              <ConfigurationRisksWidget
                risks={configRisks}
                onResolve={mitigateThreat}
                onMarkFalsePositive={markAsFalsePositive}
              />
            )}
            <RisksOverview risks={analysis.risks} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ClusterChangesWidget changes={analysis.recentChanges} />
              <AvailabilityWidget availability={analysis.availability} />
            </div>
            <PublicExposuresWidget exposures={analysis.publicExposures} />
            <ProblemTrendChart trends={analysis.trends} />
          </div>
        )}

        {activeTab === "loadbalancer" && (
          <div className="space-y-6">
            <LoadBalancerMonitorWidget />
            <PublicExposuresWidget exposures={analysis.publicExposures} />
          </div>
        )}

        {activeTab === "health" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UnstablePodsWidget pods={analysis.unstablePods} />
              <ResourceMisuseWidget issues={analysis.resourceIssues} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MissingProbesWidget issues={analysis.probeIssues} />
              <ProblematicVolumesWidget problems={analysis.volumeProblems} />
            </div>
            <CertificatesWidget issues={analysis.certificateIssues} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RiskPanel;
