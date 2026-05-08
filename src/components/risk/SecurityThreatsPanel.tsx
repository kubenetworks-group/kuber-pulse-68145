import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldAlert,
  ShieldOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Shield,
  Clock,
  Target,
  Lightbulb,
  ChevronRight,
  Lock,
  Wrench,
  Eye,
  Info,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SecurityThreat, ThreatStats } from "@/hooks/useSecurityThreats";

// System namespaces — threats here are informational only, no auto-fix
const SYSTEM_NAMESPACES = new Set([
  "kube-system", "kube-public", "kube-node-lease",
  "calico-system", "calico-apiserver", "tigera-operator",
  "cilium", "cilium-system", "istio-system", "istio-operator",
  "linkerd", "linkerd-viz", "metallb-system",
  "ingress-nginx", "ingress", "cert-manager",
  "monitoring", "prometheus", "grafana", "lens-metrics",
  "flux-system", "argocd", "argo", "velero",
  "gatekeeper-system", "kyverno", "local-path-storage",
  "kodo", "kodo-agent",
]);

// Threat types that can be auto-fixed with user authorization
const AUTO_FIXABLE_TYPES = new Set([
  // Security context / privilege issues
  "privilege_escalation",
  "privileged_container",
  "host_network",
  "host_pid",
  "missing_security_context",
  "writable_root_filesystem",
  // Suspicious process / root container
  "suspicious_process",
  "root_container",
  "container_as_root",
  "run_as_root",
  // Network / RBAC
  "suspicious_network",
  "excessive_rbac",
  "overprivileged_rbac",
  // Resource abuse
  "resource_abuse",
  "crypto_mining",
]);

function getThreatNamespace(threat: SecurityThreat): string | null {
  const resources = threat.affected_resources || [];
  if (resources.length > 0 && resources[0]?.namespace) return resources[0].namespace;
  return threat.namespace || null;
}

function isSystemThreat(threat: SecurityThreat): boolean {
  const ns = getThreatNamespace(threat);
  if (!ns) return false;
  return SYSTEM_NAMESPACES.has(ns);
}

function isFixable(threat: SecurityThreat): boolean {
  return AUTO_FIXABLE_TYPES.has(threat.threat_type) && !isSystemThreat(threat);
}

const severityDot: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
};

const severityLabel: Record<string, { text: string; className: string }> = {
  critical: { text: "Crítica", className: "text-red-500 bg-red-500/10 border-red-500/20" },
  high: { text: "Alta", className: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  medium: { text: "Média", className: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
  low: { text: "Baixa", className: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
};

interface SecurityThreatsPanelProps {
  threats: SecurityThreat[];
  stats: ThreatStats;
  loading: boolean;
  scanning: boolean;
  onScan: () => void;
  onMitigate: (threatId: string, action: string) => void;
  onMarkFalsePositive: (threatId: string) => void;
  onUpdateStatus: (threatId: string, status: string) => void;
}

function ThreatRow({
  threat,
  onMitigate,
  onMarkFalsePositive,
  onUpdateStatus,
}: {
  threat: SecurityThreat;
  onMitigate: (id: string, action: string) => void;
  onMarkFalsePositive: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  const sev = severityLabel[threat.severity] ?? severityLabel.low;
  const dot = severityDot[threat.severity] ?? "bg-blue-400";
  const ns = getThreatNamespace(threat);
  const resources = threat.affected_resources || [];
  const aiAnalysis = threat.ai_analysis || {};
  const steps = aiAnalysis.mitigation_steps || [];
  const canFix = isFixable(threat);
  const system = isSystemThreat(threat);

  const handleAuthorize = async () => {
    setAuthorizing(true);
    try {
      await onMitigate(threat.id, "auto_fix_authorized");
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <div className={cn(
      "border-b border-border/40 last:border-0 transition-colors",
      expanded ? "bg-muted/30" : "hover:bg-muted/20"
    )}>
      {/* Row header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0 mt-0.5", dot)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{threat.title}</span>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 border", sev.className)}>
              {sev.text}
            </Badge>
            {ns && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                {ns}
              </Badge>
            )}
            {system && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                sistema
              </Badge>
            )}
            {canFix && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border border-primary/20">
                <Wrench className="h-2.5 w-2.5 mr-0.5" />
                correção disponível
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {new Date(threat.created_at).toLocaleString("pt-BR")}
            </span>
            {threat.threat_type && (
              <span className="font-mono opacity-70">{threat.threat_type}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {threat.status === "active" && (
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          )}
          {threat.status === "mitigated" && (
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          )}
          {threat.status === "investigating" && (
            <Eye className="h-3.5 w-3.5 text-blue-400" />
          )}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Description */}
          {threat.description && (
            <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">
              {threat.description}
            </p>
          )}

          {/* Affected resources */}
          {(resources.length > 0 || threat.pod_name) && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Target className="h-3 w-3" /> Recursos afetados
              </p>
              <div className="flex flex-wrap gap-2">
                {resources.map((r: any, i: number) => (
                  <div key={i} className="text-xs font-mono bg-muted px-2 py-1 rounded flex flex-wrap gap-x-3 gap-y-0.5">
                    {r.namespace && <span><span className="text-muted-foreground">ns/</span>{r.namespace}</span>}
                    {r.pod && <span><span className="text-muted-foreground">pod/</span>{r.pod}</span>}
                    {r.container && <span><span className="text-muted-foreground">ctr/</span>{r.container}</span>}
                    {r.node && <span><span className="text-muted-foreground">node/</span>{r.node}</span>}
                  </div>
                ))}
                {!resources.length && threat.pod_name && (
                  <div className="text-xs font-mono bg-muted px-2 py-1 rounded flex gap-3">
                    {ns && <span><span className="text-muted-foreground">ns/</span>{ns}</span>}
                    <span><span className="text-muted-foreground">pod/</span>{threat.pod_name}</span>
                    {threat.container_name && <span><span className="text-muted-foreground">ctr/</span>{threat.container_name}</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Recommendation */}
          {aiAnalysis.recommendation && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3" /> Análise de IA
              </p>
              <p className="text-sm text-foreground/80 pl-1">{aiAnalysis.recommendation}</p>
              {aiAnalysis.confidence && (
                <p className="text-[11px] text-muted-foreground">
                  Confiança: {Math.round(aiAnalysis.confidence * 100)}%
                </p>
              )}
            </div>
          )}

          {/* Steps */}
          {steps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Passos de mitigação</p>
              <ol className="space-y-1">
                {steps.map((step: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="flex-shrink-0 text-[10px] font-bold text-muted-foreground mt-1 w-4">{i + 1}.</span>
                    <span className="text-foreground/80">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* System namespace notice */}
          {system && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Este recurso pertence a um namespace de sistema (<code className="font-mono">{ns}</code>).
                Nenhuma ação automática é aplicada — verifique se o comportamento é esperado para este componente.
              </span>
            </div>
          )}

          {/* Actions */}
          {threat.status === "active" && (
            <div className="flex flex-wrap gap-2 pt-1">
              {/* Authorize fix — only for user namespace fixable issues */}
              {canFix && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleAuthorize}
                  disabled={authorizing}
                >
                  {authorizing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  Autorizar Correção
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-green-600 border-green-500/30 hover:bg-green-500/10 hover:text-green-500"
                onClick={() => onMitigate(threat.id, "manual_review")}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Resolvido
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => onUpdateStatus(threat.id, "investigating")}
              >
                <Eye className="h-3.5 w-3.5" />
                Investigando
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={() => onMarkFalsePositive(threat.id)}
              >
                <XCircle className="h-3.5 w-3.5" />
                Falso positivo
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SecurityThreatsPanel({
  threats,
  stats,
  loading,
  scanning,
  onScan,
  onMitigate,
  onMarkFalsePositive,
  onUpdateStatus,
}: SecurityThreatsPanelProps) {
  const [showSystem, setShowSystem] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active");
  const [showBulkFix, setShowBulkFix] = useState(false);
  const [bulkFixing, setBulkFixing] = useState(false);

  // Only real attacks
  const attackThreats = threats.filter(t => t.is_attack !== false);

  // Split user vs system
  const userThreats = attackThreats.filter(t => !isSystemThreat(t));
  const systemThreats = attackThreats.filter(t => isSystemThreat(t));

  const activeUser = userThreats.filter(t => t.status === "active");
  const resolvedUser = userThreats.filter(t => t.status === "mitigated" || t.status === "false_positive");

  // Sort active: critical first, then high, then others
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedActive = [...activeUser].sort(
    (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
  );

  const criticalCount = activeUser.filter(t => t.severity === "critical").length;
  const highCount = activeUser.filter(t => t.severity === "high").length;
  const mediumCount = activeUser.filter(t => t.severity === "medium").length;

  // Fixable = active user threats with an auto-fix mapping
  const fixableThreats = sortedActive.filter(t => isFixable(t));

  const handleBulkFix = async () => {
    if (!fixableThreats.length) return;
    setBulkFixing(true);
    try {
      for (const threat of fixableThreats) {
        await onMitigate(threat.id, "auto_fix_authorized");
      }
    } finally {
      setBulkFixing(false);
      setShowBulkFix(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando ameaças...</span>
        </div>
      </div>
    );
  }

  if (activeUser.length === 0 && resolvedUser.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="p-3 rounded-full bg-green-500/10">
            <Shield className="h-6 w-6 text-green-500" />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm">Nenhuma ameaça em namespaces de usuário</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Ameaças de sistema ({systemThreats.length}) são informacionais e não requerem ação.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onScan} disabled={scanning} className="gap-2">
            {scanning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Executar varredura
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6">
          {[
            { label: "Críticas", count: criticalCount, className: "text-red-500" },
            { label: "Altas", count: highCount, className: "text-orange-500" },
            { label: "Médias", count: mediumCount, className: "text-yellow-500" },
            { label: "Resolvidas", count: stats.mitigated, className: "text-green-500" },
          ].map(({ label, count, className }) => (
            <div key={label} className="text-center">
              <p className={cn("text-2xl font-semibold tabular-nums", className)}>{count}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {fixableThreats.length > 0 && (
            <Button
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setShowBulkFix(true)}
              disabled={bulkFixing}
            >
              {bulkFixing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Corrigir com IA
              <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-white/20 text-[10px] flex items-center justify-center">
                {fixableThreats.length}
              </span>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onScan} disabled={scanning} className="gap-2">
            {scanning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Varredura
          </Button>
        </div>
      </div>

      {/* Bulk fix confirmation dialog */}
      <AlertDialog open={showBulkFix} onOpenChange={(o) => !o && setShowBulkFix(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Corrigir {fixableThreats.length} ameaça{fixableThreats.length !== 1 ? "s" : ""} com IA
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>A IA enviará comandos de correção para o agente resolver as seguintes ameaças automaticamente:</p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {fixableThreats.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full flex-shrink-0",
                        t.severity === "critical" ? "bg-red-500" :
                        t.severity === "high" ? "bg-orange-500" :
                        t.severity === "medium" ? "bg-yellow-500" : "bg-blue-400"
                      )} />
                      <span className="font-medium truncate">{t.title}</span>
                      <span className="font-mono text-muted-foreground flex-shrink-0">
                        {getThreatNamespace(t)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  As correções são enviadas como comandos ao agente e podem levar alguns minutos para serem aplicadas.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkFix}
              disabled={bulkFixing}
              className="gap-1.5"
            >
              {bulkFixing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Autorizar e corrigir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tabs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center border-b border-border px-1 bg-muted/30">
          <button
            onClick={() => setActiveTab("active")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors",
              activeTab === "active"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Ativas
            {activeUser.length > 0 && (
              <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                {activeUser.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("resolved")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors",
              activeTab === "resolved"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Resolvidas
            {resolvedUser.length > 0 && (
              <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-muted text-muted-foreground text-[10px] flex items-center justify-center">
                {resolvedUser.length}
              </span>
            )}
          </button>
        </div>

        {/* Threat list */}
        {activeTab === "active" && (
          <>
            {sortedActive.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-sm">
                <Shield className="h-4 w-4" />
                Nenhuma ameaça ativa em namespaces de usuário
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {sortedActive.map(threat => (
                  <ThreatRow
                    key={threat.id}
                    threat={threat}
                    onMitigate={onMitigate}
                    onMarkFalsePositive={onMarkFalsePositive}
                    onUpdateStatus={onUpdateStatus}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "resolved" && (
          <>
            {resolvedUser.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-sm">
                <CheckCircle className="h-4 w-4" />
                Nenhuma ameaça resolvida ainda
              </div>
            ) : (
              <ScrollArea className="max-h-[480px]">
                <div className="divide-y divide-border/40">
                  {resolvedUser.map(threat => (
                    <ThreatRow
                      key={threat.id}
                      threat={threat}
                      onMitigate={onMitigate}
                      onMarkFalsePositive={onMarkFalsePositive}
                      onUpdateStatus={onUpdateStatus}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </div>

      {/* System threats — collapsed by default */}
      {systemThreats.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowSystem(v => !v)}
          >
            <span className="flex items-center gap-2">
              <ShieldOff className="h-3.5 w-3.5" />
              Componentes de sistema — informacional ({systemThreats.length})
            </span>
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showSystem && "rotate-90")} />
          </button>

          {showSystem && (
            <div className="border-t border-border/50 divide-y divide-border/40">
              {systemThreats.map(threat => (
                <ThreatRow
                  key={threat.id}
                  threat={threat}
                  onMitigate={onMitigate}
                  onMarkFalsePositive={onMarkFalsePositive}
                  onUpdateStatus={onUpdateStatus}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
