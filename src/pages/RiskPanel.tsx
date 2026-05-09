import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
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
import { ServicesWidget } from "@/components/risk/ServicesWidget";
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
import { AlertTriangle, Activity, Globe, ShieldAlert, Shield, FileText, RefreshCw } from "lucide-react";
import { SecurityReportModal } from "@/components/risk/SecurityReportModal";
import { cn } from "@/lib/utils";

// ─── Status colors only (brand/severity — same in all themes) ────────────────

const STATUS = {
  accent:   "#00E5A0",
  critical: "#FF2D2D", critDim: "rgba(255,45,45,0.12)",
  high:     "#FF7A00", highDim: "rgba(255,122,0,0.12)",
  medium:   "#F5C518", medDim:  "rgba(245,197,24,0.12)",
  low:      "#00E5A0", lowDim:  "rgba(0,229,160,0.10)",
} as const;

function scoreConfig(s: number) {
  if (s >= 75) return { label: "Crítico", color: STATUS.critical, action: "Ação imediata necessária" };
  if (s >= 50) return { label: "Alto",    color: STATUS.high,     action: "Ação recomendada" };
  if (s >= 25) return { label: "Médio",   color: STATUS.medium,   action: "Monitorar de perto" };
  return             { label: "Baixo",   color: STATUS.low,      action: "Cluster saudável" };
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const [mounted, setMounted] = useState(false);
  const { color } = scoreConfig(score);
  const r = 38, circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
        {/* Glow halo */}
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="10" opacity="0.06" />
        {/* Track — neutral in both themes */}
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-border" opacity="0.6" />
        {/* Progress arc */}
        <circle cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? offset : circ}
          style={{
            transition: "stroke-dashoffset 1s cubic-bezier(0.34,1.2,0.64,1)",
            filter: `drop-shadow(0 0 6px ${color}80)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="tabular-nums font-bold leading-none"
          style={{ fontFamily: "'JetBrains Mono','Geist Mono',monospace", fontSize: 26, color }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

// ─── Outer tab bar ────────────────────────────────────────────────────────────

interface Tab { id: string; label: string; Icon: React.ElementType; badge?: number; badgeColor?: string }

function TabBar({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex border-b border-border">
      {tabs.map(({ id, label, Icon, badge, badgeColor }) => {
        const on = active === id;
        return (
          <button
            key={id} onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors duration-150 outline-none",
              "border-b-2 -mb-px",
              on
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground font-normal"
            )}
            style={{ borderBottomColor: on ? STATUS.accent : "transparent", background: "none", border: "none",
              borderBottom: on ? `2px solid ${STATUS.accent}` : "2px solid transparent",
              marginBottom: -1, cursor: "pointer", outline: "none",
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {!!badge && (
              <span
                className="flex items-center justify-center text-[10px] font-bold leading-none"
                style={{
                  minWidth: 18, height: 18, padding: "0 5px", borderRadius: 100,
                  background: badgeColor ?? STATUS.accent,
                  color: badgeColor ? "#fff" : "#000",
                }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── RiskPanel ────────────────────────────────────────────────────────────────

export default function RiskPanel() {
  const { analysis, loading, refreshing, lastUpdated, refetch } = useRiskAnalysis();
  const { clusters, selectedClusterId } = useCluster();
  const {
    threats, stats: tStats, loading: tLoading, scanning,
    runSecurityScan, mitigateThreat, markAsFalsePositive, updateThreatStatus,
  } = useSecurityThreats();

  const [filters, setFilters] = useState<RiskFilters>({ severity: "all", status: "all", namespace: "all", period: "all" });
  const [activeTab, setActiveTab] = useState("threats");
  const [showReport, setShowReport] = useState(false);

  const cluster    = clusters.find(c => c.id === selectedClusterId);
  const namespaces = useMemo(() => extractNamespaces(threats), [threats]);
  const filtered   = useMemo(() => filterThreats(threats, filters), [threats, filters]);

  const attacks     = useMemo(() => filtered.filter(t => t.status === "active" && t.is_attack !== false), [filtered]);
  const configRisks = useMemo(() => filtered.filter(t => t.is_attack === false && t.status === "active"), [filtered]);

  // Recompute security/config scores from the filtered+resolved-aware threats data.
  // This makes the RisksOverview cards respond to filters and to threat mitigations.
  const calcLevel = (score: number): "critical" | "high" | "medium" | "low" =>
    score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low";

  const displayRisks = useMemo(() => {
    let secScore = 0;
    attacks.forEach(t => {
      if (t.severity === "critical") secScore += 25;
      else if (t.severity === "high") secScore += 15;
      else if (t.severity === "medium") secScore += 8;
      else secScore += 3;
    });
    secScore = Math.min(secScore, 100);

    let cfgScore = 0;
    configRisks.forEach(t => {
      if (t.severity === "critical") cfgScore += 10;
      else if (t.severity === "high") cfgScore += 6;
      else if (t.severity === "medium") cfgScore += 3;
      else cfgScore += 1;
    });
    // Blend with infra score (probe/volume/resource issues) weighted at 40%
    cfgScore = Math.min(cfgScore + analysis.risks.configuration.score * 0.4, 100);

    return {
      ...analysis.risks,
      security: {
        ...analysis.risks.security,
        score: secScore,
        level: calcLevel(secScore),
        count: attacks.length,
      },
      configuration: {
        ...analysis.risks.configuration,
        score: Math.round(cfgScore),
        level: calcLevel(Math.round(cfgScore)),
        count: configRisks.length + analysis.risks.configuration.count,
      },
    };
  }, [attacks, configRisks, analysis.risks]);

  const { color: riskColor, label: riskLabel, action: riskAction } = scoreConfig(analysis.overallScore);

  const suspiciousBehaviors = useMemo(() => threats.filter(t =>
    t.status === "active" && ["excessive_rbac","overprivileged_rbac","misconfiguration","unauthorized_access"].includes(t.threat_type)
  ), [threats]);

  const tabs: Tab[] = [
    { id: "threats",      label: "Ameaças",     Icon: ShieldAlert,   badge: attacks.length || undefined,              badgeColor: attacks.length ? STATUS.critical : undefined },
    { id: "risks",        label: "Riscos",       Icon: AlertTriangle, badge: configRisks.length || undefined,          badgeColor: configRisks.length ? STATUS.high : undefined },
    { id: "loadbalancer", label: "LoadBalancers",Icon: Globe },
    { id: "health",       label: "Health",       Icon: Activity },
    { id: "audit",        label: "Auditoria IA", Icon: FileText,      badge: suspiciousBehaviors.length || undefined,  badgeColor: suspiciousBehaviors.length ? STATUS.medium : undefined },
  ];

  /* ── no cluster ── */
  if (!selectedClusterId) return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center pt-20 gap-4">
        <div className="p-4 rounded-xl bg-muted border border-border">
          <Shield className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Selecione um cluster para visualizar o painel de risco.
        </p>
      </div>
    </DashboardLayout>
  );

  /* ── loading ── */
  if (loading) return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </DashboardLayout>
  );

  /* ── main ── */
  const statRow = [
    { label: "CRÍTICAS",   value: tStats.critical,    color: STATUS.critical },
    { label: "ALTAS",      value: tStats.high,         color: STATUS.high },
    { label: "ATIVOS",     value: configRisks.length,  color: STATUS.medium },
    { label: "RESOLVIDAS", value: tStats.mitigated,    color: STATUS.low },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5">

        {/* ── Hero header ──────────────────────────────────────────────── */}
        <div
          className="bg-card border border-border rounded-xl overflow-hidden"
          style={{ borderLeftWidth: 3, borderLeftColor: riskColor }}
        >
          {/* Top row */}
          <div className="px-7 py-5 flex items-center justify-between gap-6 flex-wrap">
            {/* Left: title + cluster */}
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS.accent }} />
                <span
                  className="text-foreground font-medium"
                  style={{ fontFamily: "'JetBrains Mono','Geist Mono',monospace", fontSize: 17 }}
                >
                  Painel de Risco
                </span>
                {cluster && (
                  <>
                    <span className="text-muted-foreground text-xs mx-0.5">·</span>
                    <span
                      className="text-muted-foreground text-xs"
                      style={{ fontFamily: "'JetBrains Mono','Geist Mono',monospace" }}
                    >
                      {cluster.name}
                    </span>
                    {cluster.environment && (
                      <span
                        className="text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded text-[10px]"
                        style={{ fontFamily: "'JetBrains Mono','Geist Mono',monospace" }}
                      >
                        {cluster.environment}
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground m-0">{riskAction}</p>
            </div>

            {/* Right: risk badge + score ring + refresh */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mb-1"
                  style={{ background: `${riskColor}15`, border: `1px solid ${riskColor}30` }}
                >
                  <span className="rounded-full" style={{ width: 6, height: 6, background: riskColor }} />
                  <span
                    className="text-[11px] font-semibold tracking-wide"
                    style={{ color: riskColor, fontFamily: "'Geist','Inter',sans-serif" }}
                  >
                    RISCO {riskLabel.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 mt-0.5">
                  <p
                    className="text-[10px] text-muted-foreground m-0"
                    style={{ fontFamily: "'JetBrains Mono','Geist Mono',monospace" }}
                  >
                    {lastUpdated
                      ? `atualizado ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                      : "score de risco"}
                  </p>
                  <button
                    onClick={refetch}
                    disabled={refreshing}
                    title="Atualizar pontuação"
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    style={{ background: "none", border: "none", cursor: refreshing ? "not-allowed" : "pointer", padding: 2 }}
                  >
                    <RefreshCw
                      style={{ width: 11, height: 11 }}
                      className={refreshing ? "animate-spin" : ""}
                    />
                  </button>
                </div>
              </div>
              <ScoreRing score={analysis.overallScore} />
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 border-t border-border">
            {statRow.map(({ label, value, color }, i) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 transition-colors duration-150 hover:bg-muted/50",
                  i < 3 && "border-r border-border"
                )}
              >
                <span
                  className="rounded-full flex-shrink-0"
                  style={{ width: 4, height: 4, background: color, boxShadow: `0 0 5px ${color}` }}
                />
                <div>
                  <div
                    className="font-bold tabular-nums leading-none"
                    style={{ fontFamily: "'JetBrains Mono','Geist Mono',monospace", fontSize: 22, color }}
                  >
                    {value}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab navigation ────────────────────────────────────────────── */}
        <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {/* ── Tab content ───────────────────────────────────────────────── */}

        {activeTab === "threats" && (
          <div className="flex flex-col gap-3">
            <RiskPanelFilters filters={filters} onFiltersChange={setFilters} namespaces={namespaces} showStatusFilter />
            <SecurityThreatsPanel
              threats={filtered} stats={tStats} loading={tLoading} scanning={scanning}
              onScan={runSecurityScan} onMitigate={mitigateThreat}
              onMarkFalsePositive={markAsFalsePositive} onUpdateStatus={updateThreatStatus}
            />
          </div>
        )}

        {activeTab === "risks" && (
          <div className="flex flex-col gap-6">
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
        )}

        {activeTab === "loadbalancer" && (
          <div className="flex flex-col gap-6">
            <LoadBalancerMonitorWidget />
            <PublicExposuresWidget exposures={analysis.publicExposures} />
          </div>
        )}

        {activeTab === "health" && (
          <div className="flex flex-col gap-6">
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
        )}

        {activeTab === "audit" && (
          <div className="flex flex-col gap-5">
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "Comportamentos suspeitos", value: suspiciousBehaviors.length, color: STATUS.medium, desc: "RBAC, jobs, configMaps" },
                { label: "Ataques detectados",       value: attacks.length,              color: STATUS.critical, desc: "atividades maliciosas" },
                { label: "Corrigidos pela IA",       value: tStats.mitigated,            color: STATUS.low,  desc: "last 30 days" },
              ].map(({ label, value, color, desc }) => (
                <div
                  key={label}
                  className="bg-card border border-border rounded-xl px-5 py-4 relative overflow-hidden"
                  style={{ borderTopWidth: 2, borderTopColor: color }}
                >
                  <div className="font-bold tabular-nums leading-none"
                    style={{ fontFamily: "'JetBrains Mono','Geist Mono',monospace", fontSize: 30, color }}
                  >
                    {value}
                  </div>
                  <div className="text-sm text-foreground font-medium mt-1.5">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                </div>
              ))}
            </div>

            {/* Generate report CTA */}
            <div className="bg-card border border-border rounded-xl px-7 py-6 flex items-center justify-between gap-5 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.2)" }}>
                  <FileText className="w-5 h-5" style={{ color: STATUS.accent }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground m-0">Relatório de Segurança com IA</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
                    Análise completa das ameaças, comportamentos suspeitos, linha do tempo e guia de troubleshooting.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReport(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 transition-all duration-150 hover:-translate-y-px"
                style={{
                  background: STATUS.accent, color: "#000", border: "none", cursor: "pointer",
                  boxShadow: "0 2px 12px rgba(0,229,160,0.2)",
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                Gerar Relatório
              </button>
            </div>

            {/* Suspicious behaviors list */}
            {suspiciousBehaviors.length > 0 ? (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                  <ShieldAlert className="w-3.5 h-3.5" style={{ color: STATUS.medium }} />
                  <span className="text-sm font-semibold text-foreground">Comportamentos Suspeitos Detectados</span>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(245,197,24,0.12)", color: STATUS.medium, border: "1px solid rgba(245,197,24,0.25)" }}
                  >
                    {suspiciousBehaviors.length}
                  </span>
                </div>
                {suspiciousBehaviors.slice(0, 15).map((t, i) => {
                  const dotColor = t.severity === "critical" ? STATUS.critical : t.severity === "high" ? STATUS.high : STATUS.medium;
                  const ns = t.namespace || t.affected_resources?.[0]?.namespace;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/40",
                        i < suspiciousBehaviors.length - 1 && "border-b border-border"
                      )}
                    >
                      <span className="rounded-full flex-shrink-0 mt-1" style={{ width: 8, height: 8, background: dotColor, boxShadow: `0 0 4px ${dotColor}60` }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-foreground font-medium">{t.title}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border"
                            style={{ fontFamily: "'JetBrains Mono','Geist Mono',monospace" }}
                          >
                            {t.threat_type}
                          </span>
                          {ns && (
                            <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono','Geist Mono',monospace" }}>
                              {ns}
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.description}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3.5 rounded-xl" style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.15)" }}>
                    <ShieldAlert className="w-5 h-5" style={{ color: STATUS.accent }} />
                  </div>
                  <p className="text-sm font-medium text-foreground">Nenhum comportamento suspeito detectado</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Execute uma varredura para detectar RBAC wildcards, jobs suspeitos e credenciais expostas.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <SecurityReportModal open={showReport} onClose={() => setShowReport(false)} />
      </div>
    </DashboardLayout>
  );
}
