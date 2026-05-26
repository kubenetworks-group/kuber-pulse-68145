import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRiskAnalysis } from "@/hooks/useRiskAnalysis";
import { useSecurityThreats } from "@/hooks/useSecurityThreats";
import { useCluster } from "@/contexts/ClusterContext";
import { RiskPageHeader } from "@/components/risk/RiskPageHeader";
import { SecurityReportModal } from "@/components/risk/SecurityReportModal";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const C = { critical: "#FF2D2D", high: "#FF7A00", medium: "#F5C518", low: "#00E5A0" } as const;

export default function RiskAudit() {
  const { analysis, loading, refreshing, lastUpdated, refetch } = useRiskAnalysis();
  const { threats, stats, mitigateThreat } = useSecurityThreats();
  const { clusters, selectedClusterId } = useCluster();
  const [showReport, setShowReport] = useState(false);

  const cluster = clusters.find(c => c.id === selectedClusterId);

  const attacks = useMemo(() => threats.filter(t => t.status === "active" && t.is_attack !== false), [threats]);
  const suspiciousBehaviors = useMemo(() => threats.filter(t =>
    t.status === "active" && ["excessive_rbac","overprivileged_rbac","misconfiguration","unauthorized_access"].includes(t.threat_type)
  ), [threats]);

  if (!selectedClusterId) return <DashboardLayout><div className="flex items-center justify-center pt-20"><p className="text-sm text-muted-foreground">Selecione um cluster.</p></div></DashboardLayout>;
  if (loading) return <DashboardLayout><div className="flex flex-col gap-4 p-6"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5 p-4 sm:p-6">
        <RiskPageHeader
          title="Auditoria IA"
          subtitle="Análise de comportamentos suspeitos e relatórios de segurança"
          clusterName={cluster?.name}
          clusterEnv={cluster?.environment}
          score={analysis.overallScore}
          stats={[
            { label: "Suspeitos",  value: suspiciousBehaviors.length, color: C.medium },
            { label: "Ataques",    value: attacks.length,             color: C.critical },
            { label: "Corrigidos", value: stats.mitigated,            color: C.low },
          ]}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          onRefresh={refetch}
        />

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: "Comportamentos suspeitos", value: suspiciousBehaviors.length, color: C.medium, desc: "RBAC, jobs, configMaps" },
            { label: "Ataques detectados",        value: attacks.length,            color: C.critical, desc: "atividades maliciosas" },
            { label: "Corrigidos pela IA",        value: stats.mitigated,           color: C.low,  desc: "últimos 30 dias" },
          ].map(({ label, value, color, desc }) => (
            <div key={label} className="bg-card border border-border rounded-xl px-5 py-4 overflow-hidden" style={{ borderTopWidth: 2, borderTopColor: color }}>
              <div className="font-bold tabular-nums leading-none" style={{ fontFamily: "'DM Mono',monospace", fontSize: 30, color }}>{value}</div>
              <div className="text-sm text-foreground font-medium mt-1.5">{label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
            </div>
          ))}
        </div>

        {/* Generate report CTA */}
        <div className="bg-card border border-border rounded-xl px-7 py-6 flex items-center justify-between gap-5 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl" style={{ background: "rgba(15,60,165,0.08)", border: "1px solid rgba(15,60,165,0.15)" }}>
              <FileText className="w-5 h-5" style={{ color: "#0F3CA5" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Relatório de Segurança com IA</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
                Análise completa das ameaças, comportamentos suspeitos, linha do tempo e guia de troubleshooting.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 text-white transition-all hover:-translate-y-px"
            style={{ background: "#0F3CA5", border: "none", cursor: "pointer", boxShadow: "0 2px 12px rgba(15,60,165,0.2)" }}
          >
            <FileText className="w-3.5 h-3.5" />
            Gerar Relatório
          </button>
        </div>

        {/* Suspicious behaviors list */}
        {suspiciousBehaviors.length > 0 ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <ShieldAlert className="w-3.5 h-3.5" style={{ color: C.medium }} />
              <span className="text-sm font-semibold text-foreground">Comportamentos Suspeitos Detectados</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(245,197,24,0.12)", color: C.medium, border: "1px solid rgba(245,197,24,0.25)" }}>
                {suspiciousBehaviors.length}
              </span>
            </div>
            {suspiciousBehaviors.slice(0, 20).map((t, i) => {
              const dotColor = t.severity === "critical" ? C.critical : t.severity === "high" ? C.high : C.medium;
              const ns = t.namespace || t.affected_resources?.[0]?.namespace;
              return (
                <div key={t.id} className={cn("flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/40", i < suspiciousBehaviors.length - 1 && "border-b border-border")}>
                  <span className="rounded-full flex-shrink-0 mt-1" style={{ width: 8, height: 8, background: dotColor, boxShadow: `0 0 4px ${dotColor}60` }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground font-medium">{t.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border font-mono">{t.threat_type}</span>
                      {ns && <span className="text-[10px] text-muted-foreground font-mono">{ns}</span>}
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.description}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 font-mono">
                    {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="p-3.5 rounded-xl" style={{ background: "rgba(15,60,165,0.06)", border: "1px solid rgba(15,60,165,0.12)" }}>
                <ShieldAlert className="w-5 h-5" style={{ color: "#0F3CA5" }} />
              </div>
              <p className="text-sm font-medium text-foreground">Nenhum comportamento suspeito detectado</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Execute uma varredura para detectar RBAC wildcards, jobs suspeitos e credenciais expostas.
              </p>
            </div>
          </div>
        )}
      </div>

      <SecurityReportModal open={showReport} onClose={() => setShowReport(false)} />
    </DashboardLayout>
  );
}
