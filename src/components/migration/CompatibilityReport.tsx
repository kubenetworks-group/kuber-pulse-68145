import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, CheckCircle2, XCircle, Info, Wrench,
  ShieldCheck, GitCompare, Cpu, HardDrive, Globe, Package,
} from "lucide-react";
import { type ClusterMigration } from "@/services/migrationAnalysisService";

interface Issue {
  severity: "critical" | "warning" | "info";
  kind: string;
  resource: string;
  namespace?: string;
  issue: string;
  suggestion: string;
  autoFixable: boolean;
}

interface CompatibilityReportProps {
  migration: ClusterMigration;
}

const SEV = {
  critical: {
    icon: <XCircle className="w-4 h-4 text-destructive" />,
    badge: <Badge variant="destructive" className="text-xs py-0">Crítico</Badge>,
    bg: "bg-destructive/5 border-destructive/20",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    badge: <Badge className="text-xs py-0 bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">Aviso</Badge>,
    bg: "bg-amber-50/50 border-amber-200/60 dark:bg-amber-950/10",
  },
  info: {
    icon: <Info className="w-4 h-4 text-blue-500" />,
    badge: <Badge variant="outline" className="text-xs py-0 text-blue-600 border-blue-300">Info</Badge>,
    bg: "bg-blue-50/40 border-blue-200/50 dark:bg-blue-950/10",
  },
};

function scoreColor(score: number) {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}
function scoreLabel(score: number) {
  if (score >= 90) return "Excelente — pronto para migrar";
  if (score >= 80) return "Alta compatibilidade";
  if (score >= 60) return "Compatibilidade moderada";
  return "Requer atenção antes de migrar";
}

function parseAIText(raw: string): string {
  // Strip markdown bold/italic markers for cleaner display
  return raw
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/#{1,3} /g, "")
    .trim();
}

export function CompatibilityReport({ migration }: CompatibilityReportProps) {
  const score = migration.compatibility_score ?? 100;
  const aiAnalysis = migration.ai_analysis as Record<string, unknown> | null;
  const rawText = aiAnalysis?.["raw"] as string | undefined;
  const issues = (aiAnalysis?.["issues"] ?? []) as Issue[];
  const criticals = issues.filter(i => i.severity === "critical");
  const warnings = issues.filter(i => i.severity === "warning");
  const infos = issues.filter(i => i.severity === "info");
  const transformLog = (migration.transformation_log ?? []) as Array<Record<string, string>>;
  const autoFixed = migration.issues_auto_fixed ?? 0;
  const issuesFound = migration.issues_found ?? 0;
  const manualActions = issuesFound - autoFixed;

  return (
    <div className="space-y-4">
      {/* ── Score header ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Relatório de Compatibilidade
            </span>
            <span className={`text-3xl font-bold tabular-nums ${scoreColor(score)}`}>{score}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Score de compatibilidade</span>
              <span className={`font-semibold ${scoreColor(score)}`}>{scoreLabel(score)}</span>
            </div>
            <Progress value={score} className="h-2.5" />
          </div>

          {/* Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<XCircle className="w-4 h-4 text-destructive" />} value={criticals.length} label="Críticos" color="text-destructive" />
            <StatCard icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} value={warnings.length} label="Avisos" color="text-amber-600" />
            <StatCard icon={<Wrench className="w-4 h-4 text-primary" />} value={autoFixed} label="Auto-corrigidos" color="text-primary" />
            <StatCard
              icon={manualActions > 0
                ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                : <CheckCircle2 className="w-4 h-4 text-green-500" />}
              value={manualActions}
              label="Ação manual"
              color={manualActions > 0 ? "text-amber-600" : "text-green-600"}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Issue list ───────────────────────────────────────────────── */}
      {issues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Problemas detectados ({issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticals.length > 0 && (
              <IssueGroup label="Críticos" issues={criticals} />
            )}
            {warnings.length > 0 && (
              <IssueGroup label="Avisos" issues={warnings} />
            )}
            {infos.length > 0 && (
              <IssueGroup label="Informativos" issues={infos} />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Transformations applied ──────────────────────────────────── */}
      {transformLog.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <GitCompare className="w-4 h-4" />
                Transformações aplicadas
              </span>
              <Badge variant="outline" className="text-xs">{transformLog.length} alterações</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {transformLog.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 border text-xs">
                  <Wrench className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium font-mono">{entry.kind}/{entry.resource}</span>
                    {entry.namespace && <span className="text-muted-foreground ml-1">({entry.namespace})</span>}
                    <p className="text-green-600 dark:text-green-400 font-mono mt-0.5">{entry.change}</p>
                    <p className="text-muted-foreground italic mt-0.5">{entry.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Checklist ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Checklist de migração
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <CheckItem ok={criticals.length === 0} label="Nenhum bloqueio crítico" />
            <CheckItem ok={autoFixed >= issuesFound || issuesFound === 0} label="Problemas auto-corrigidos" />
            <CheckItem ok={manualActions === 0} label="Sem ações manuais pendentes" icon={manualActions > 0 ? "warn" : "ok"} />
            <CheckItem ok={score >= 80} label={`Score ≥ 80% (atual: ${score}%)`} />
            <CheckItem ok={transformLog.length > 0 || issuesFound === 0} label="Manifests transformados" />
            <CheckItem ok icon="ok" label="Agente fará remapeamento de StorageClass" />
          </div>
        </CardContent>
      </Card>

      {/* ── AI analysis ──────────────────────────────────────────────── */}
      {rawText && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Análise da IA
              <Badge variant="secondary" className="text-xs">Gemini</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/30 border p-4 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {parseAIText(rawText)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function IssueGroup({ label, issues }: { label: string; issues: Issue[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {issues.map((issue, i) => {
        const sev = SEV[issue.severity];
        return (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${sev.bg}`}>
            <div className="mt-0.5 shrink-0">{sev.icon}</div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {sev.badge}
                <span className="text-xs font-mono font-medium">{issue.kind}/{issue.resource}</span>
                {issue.namespace && (
                  <Badge variant="outline" className="text-xs py-0">{issue.namespace}</Badge>
                )}
                {issue.autoFixable && (
                  <Badge variant="outline" className="text-xs py-0 text-green-600 border-green-300">
                    <Wrench className="w-2.5 h-2.5 mr-1" />auto-fix
                  </Badge>
                )}
              </div>
              <p className="text-xs text-foreground">{issue.issue}</p>
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                {issue.suggestion}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-lg border bg-card text-center gap-1">
      {icon}
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

function CheckItem({ ok, label, icon }: { ok: boolean; label: string; icon?: "ok" | "warn" }) {
  const isWarn = !ok || icon === "warn";
  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${ok ? "bg-green-50/50 border-green-200 dark:bg-green-950/10" : "bg-amber-50/50 border-amber-200 dark:bg-amber-950/10"}`}>
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
        : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
      <span className={ok ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>{label}</span>
    </div>
  );
}
