import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldAlert, ShieldOff, CheckCircle, XCircle, ChevronDown, ChevronUp,
  RefreshCw, Shield, Clock, Target, Lightbulb, ChevronRight,
  Wrench, Eye, Info, Sparkles, Zap, FileText, Ban, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SecurityThreat, ThreatStats } from "@/hooks/useSecurityThreats";
import { SecurityReportModal } from "./SecurityReportModal";
import { HTTPAttackReportModal } from "./HTTPAttackReportModal";

// ─── Status colors only (consistent across light/dark themes) ────────────────

const STATUS = {
  accent:   "#00E5A0",
  critical: "#FF2D2D", critDim: "rgba(255,45,45,0.15)",  critBdr: "rgba(255,45,45,0.3)",
  high:     "#FF7A00", highDim: "rgba(255,122,0,0.15)",  highBdr: "rgba(255,122,0,0.3)",
  medium:   "#F5C518", medDim:  "rgba(245,197,24,0.15)", medBdr:  "rgba(245,197,24,0.3)",
  low:      "#00E5A0", lowDim:  "rgba(0,229,160,0.12)",  lowBdr:  "rgba(0,229,160,0.25)",
} as const;

const SEV: Record<string, { dot: string; text: string; bg: string; bdr: string; label: string }> = {
  critical: { dot: STATUS.critical, text: STATUS.critical, bg: STATUS.critDim, bdr: STATUS.critBdr, label: "Crítica" },
  high:     { dot: STATUS.high,     text: STATUS.high,     bg: STATUS.highDim, bdr: STATUS.highBdr, label: "Alta"    },
  medium:   { dot: STATUS.medium,   text: STATUS.medium,   bg: STATUS.medDim,  bdr: STATUS.medBdr,  label: "Média"   },
  low:      { dot: STATUS.low,      text: STATUS.low,      bg: STATUS.lowDim,  bdr: STATUS.lowBdr,  label: "Baixa"   },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SYS_NS = new Set([
  "kube-system","kube-public","kube-node-lease","calico-system","calico-apiserver",
  "tigera-operator","cilium","cilium-system","istio-system","istio-operator",
  "linkerd","linkerd-viz","metallb-system","ingress-nginx","ingress","cert-manager",
  "monitoring","prometheus","grafana","lens-metrics","flux-system","argocd","argo",
  "velero","gatekeeper-system","kyverno","local-path-storage","kodo","kodo-agent",
]);

const FIXABLE = new Set([
  "privilege_escalation","privileged_container","host_network","host_pid",
  "missing_security_context","writable_root_filesystem","suspicious_process",
  "root_container","container_as_root","run_as_root","suspicious_network",
  "excessive_rbac","overprivileged_rbac","resource_abuse","crypto_mining",
  // HTTP attack types — fixed via block_attacker_ip
  "shell_injection","sql_injection","path_traversal","brute_force","port_scan",
]);

const HTTP_ATTACK_TYPES = new Set([
  "shell_injection","sql_injection","path_traversal","brute_force","port_scan",
]);
const isHTTPAttack = (t: SecurityThreat) => HTTP_ATTACK_TYPES.has(t.threat_type);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNS(t: SecurityThreat): string | null {
  return t.affected_resources?.[0]?.namespace || t.namespace || null;
}

const isSys  = (t: SecurityThreat) => { const ns = getNS(t); return !!ns && SYS_NS.has(ns); };
const canFix = (t: SecurityThreat) => FIXABLE.has(t.threat_type) && !isSys(t);

// ─── AI Fix button ────────────────────────────────────────────────────────────

function AIBtn({ label, count, loading, onClick }: {
  label: string; count?: number; loading: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick} disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium border-none",
        "transition-all duration-150 hover:-translate-y-px disabled:opacity-60",
      )}
      style={{
        background: STATUS.accent, color: "#000", cursor: loading ? "not-allowed" : "pointer",
        outline: "none",
      }}
      onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,229,160,0.35)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      {loading
        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        : <Zap className="w-3.5 h-3.5" />}
      {label}
      {count !== undefined && count > 0 && (
        <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold"
          style={{ background: "rgba(0,0,0,0.2)" }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Inner tab bar ────────────────────────────────────────────────────────────

function InnerTabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string; badge?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex border-b border-border">
      {tabs.map(({ id, label, badge }) => {
        const on = active === id;
        return (
          <button key={id} onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-xs transition-colors duration-150",
              "border-b-2 -mb-px outline-none",
              on ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground font-normal"
            )}
            style={{
              borderBottomColor: on ? STATUS.accent : "transparent",
              background: "none", border: "none",
              borderBottom: on ? `2px solid ${STATUS.accent}` : "2px solid transparent",
              marginBottom: -1, cursor: "pointer",
            }}
          >
            {label}
            {badge !== undefined && badge > 0 && (
              <span
                className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold"
                style={{
                  background: on ? STATUS.critDim : undefined,
                  color: on ? STATUS.critical : undefined,
                  border: on ? `1px solid ${STATUS.critBdr}` : undefined,
                }}
                // fallback to Tailwind when not "on"
                {...(!on ? { className: "flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border" } : {})}
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

// ─── ThreatRow ────────────────────────────────────────────────────────────────

function ThreatRow({ threat, idx, onMitigate, onMarkFalsePositive, onUpdateStatus }: {
  threat: SecurityThreat; idx: number;
  onMitigate: (id: string, act: string) => void;
  onMarkFalsePositive: (id: string) => void;
  onUpdateStatus: (id: string, s: string) => void;
}) {
  const [open, setOpen]           = useState(false);
  const [authorizing, setAuth]    = useState(false);
  const [showReport, setReport]   = useState(false);

  const sev     = SEV[threat.severity] ?? SEV.low;
  const ns      = getNS(threat);
  const res     = threat.affected_resources || [];
  const ai      = (threat as any).ai_analysis || {};
  const steps   = ai.mitigation_steps as string[] || [];
  const fixable = canFix(threat);
  const system  = isSys(threat);
  const pod     = res[0]?.pod || threat.pod_name || null;
  const ev      = (threat.evidence || {}) as any;
  const httpAtk = isHTTPAttack(threat);

  const authorize = async () => {
    setAuth(true);
    try { await onMitigate(threat.id, "auto_fix_authorized"); }
    finally { setAuth(false); }
  };

  return (
    <div
      className={cn(
        "border-b border-border last:border-0 transition-colors duration-150",
        open ? "bg-muted/60" : "hover:bg-muted/30"
      )}
      style={{ animation: "rp-in 280ms ease both", animationDelay: `${idx * 28}ms` }}
    >
      {/* Row header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-none cursor-pointer outline-none"
      >
        {/* Severity dot */}
        <span
          className="rounded-full flex-shrink-0"
          style={{ width: 8, height: 8, background: sev.dot, boxShadow: `0 0 5px ${sev.dot}70` }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Pod or title */}
            <span
              className={cn("text-sm font-medium text-foreground truncate max-w-[220px]",
                pod ? "font-mono" : "")}
            >
              {pod ?? threat.title}
            </span>
            {pod && (
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {threat.title}
              </span>
            )}
            {/* Severity pill */}
            <span
              className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: sev.bg, color: sev.text, border: `1px solid ${sev.bdr}` }}
            >
              {sev.label}
            </span>
            {/* Namespace badge */}
            {ns && (
              <span className="flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                {ns}
              </span>
            )}
            {/* Fix available */}
            {fixable && (
              <span
                className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "rgba(0,229,160,0.10)", color: STATUS.accent, border: "1px solid rgba(0,229,160,0.25)" }}
              >
                <Wrench className="w-2.5 h-2.5" />
                correção disponível
              </span>
            )}
            {/* System badge */}
            {system && (
              <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                sistema
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              {new Date(threat.created_at).toLocaleString("pt-BR")}
            </span>
            {threat.threat_type && (
              <span className="text-[11px] text-muted-foreground font-mono opacity-70">
                {threat.threat_type}
              </span>
            )}
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {threat.status === "active" && (
            <span className="rounded-full animate-pulse" style={{ width: 6, height: 6, background: STATUS.critical }} />
          )}
          {threat.status === "mitigated"    && <CheckCircle className="w-3.5 h-3.5" style={{ color: STATUS.low }} />}
          {threat.status === "investigating"&& <Eye className="w-3.5 h-3.5 text-blue-500" />}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pl-10 flex flex-col gap-4">
          {threat.description && (
            <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-border pl-3 m-0">
              {threat.description}
            </p>
          )}

          {/* ── HTTP Attack Trace ── */}
          {httpAtk && ev.lb_ingress && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Globe className="w-2.5 h-2.5" /> Trace do Ataque
              </span>
              <div className="font-mono text-xs px-3 py-2 rounded-md bg-muted border border-border text-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-muted-foreground">LB:</span>
                <strong style={{ color: STATUS.critical }}>{ev.lb_ingress}</strong>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span><span className="text-muted-foreground">svc/</span>{ev.service_name ?? "?"}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span><span className="text-muted-foreground">pod/</span>{threat.pod_name ?? "?"}</span>
                {ev.attack_url && (
                  <>
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    <span className="break-all text-[11px]" style={{ color: STATUS.high }}>
                      {ev.attack_url.slice(0, 90)}{ev.attack_url.length > 90 ? "…" : ""}
                    </span>
                  </>
                )}
              </div>
              {threat.source_ip && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Ban className="w-3 h-3" style={{ color: STATUS.critical }} />
                  <span>IP do atacante: <strong className="font-mono" style={{ color: STATUS.critical }}>{threat.source_ip}</strong></span>
                  {(threat as any).destination_ip && (
                    <span className="ml-2">C2: <strong className="font-mono" style={{ color: STATUS.high }}>{(threat as any).destination_ip}</strong></span>
                  )}
                  {ev.internal_source && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: STATUS.critDim, color: STATUS.critical, border: `1px solid ${STATUS.critBdr}` }}>
                      ⚠ LATERAL MOVEMENT
                    </span>
                  )}
                </div>
              )}
              {ev.decoded_payload && (
                <div className="font-mono text-[10px] px-2 py-1.5 rounded bg-black/30 border border-border text-muted-foreground break-all">
                  {ev.decoded_payload.slice(0, 200)}{ev.decoded_payload.length > 200 ? "…" : ""}
                </div>
              )}
              {ev.external_traffic_policy === "Cluster" && (
                <p className="text-[11px] m-0" style={{ color: STATUS.medium }}>
                  ⚠ externalTrafficPolicy=Cluster: o IP exibido pode ser o IP do nó, não o IP real do atacante. Para bloqueio efetivo, configure externalTrafficPolicy=Local no Service.
                </p>
              )}
            </div>
          )}

          {(res.length > 0 || threat.pod_name) && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Target className="w-2.5 h-2.5" /> Recursos afetados
              </span>
              <div className="flex flex-wrap gap-2">
                {res.map((r: any, i: number) => (
                  <div key={i} className="font-mono text-xs px-2 py-1 rounded-md bg-muted border border-border text-foreground flex gap-2.5 flex-wrap">
                    {r.namespace && <span><span className="text-muted-foreground">ns/</span>{r.namespace}</span>}
                    {r.pod       && <span><span className="text-muted-foreground">pod/</span>{r.pod}</span>}
                    {r.container && <span><span className="text-muted-foreground">ctr/</span>{r.container}</span>}
                    {r.node      && <span><span className="text-muted-foreground">node/</span>{r.node}</span>}
                  </div>
                ))}
                {!res.length && threat.pod_name && (
                  <div className="font-mono text-xs px-2 py-1 rounded-md bg-muted border border-border text-foreground flex gap-2.5">
                    {ns && <span><span className="text-muted-foreground">ns/</span>{ns}</span>}
                    <span><span className="text-muted-foreground">pod/</span>{threat.pod_name}</span>
                    {threat.container_name && <span><span className="text-muted-foreground">ctr/</span>{threat.container_name}</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {ai.recommendation && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Lightbulb className="w-2.5 h-2.5" /> Análise de IA
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed m-0">{ai.recommendation}</p>
              {ai.confidence && (
                <span className="text-[11px] text-muted-foreground">
                  Confiança: {Math.round(ai.confidence * 100)}%
                </span>
              )}
            </div>
          )}

          {steps.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Passos de mitigação</span>
              <ol className="flex flex-col gap-1 list-none p-0 m-0">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground mt-0.5 w-4 flex-shrink-0">{i + 1}.</span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {system && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted border border-border text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Namespace de sistema (<code className="font-mono">{ns}</code>). Nenhuma ação automática.</span>
            </div>
          )}

          {threat.status === "active" && (
            <div className="flex flex-wrap gap-2 pt-1">
              {/* HTTP attack: block attacker IP */}
              {httpAtk && threat.source_ip && (
                <AIBtn
                  label={`Bloquear ${threat.source_ip}`}
                  loading={authorizing}
                  onClick={authorize}
                />
              )}
              {/* Non-HTTP fixable threats */}
              {fixable && !httpAtk && (
                <AIBtn label="Autorizar Correção" loading={authorizing} onClick={authorize} />
              )}
              <button onClick={() => onMitigate(threat.id, "manual_review")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-transparent border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
                style={{ color: STATUS.low }}
              >
                <CheckCircle className="w-3.5 h-3.5" />Resolvido
              </button>
              <button onClick={() => onUpdateStatus(threat.id, "investigating")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-transparent border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
              >
                <Eye className="w-3.5 h-3.5" />Investigando
              </button>
              <button onClick={() => onMarkFalsePositive(threat.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-transparent border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
              >
                <XCircle className="w-3.5 h-3.5" />Falso positivo
              </button>
              {/* HTTP attack: generate PDF report */}
              {httpAtk && (
                <button
                  onClick={() => setReport(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-transparent border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
                >
                  <FileText className="w-3.5 h-3.5" />Relatório PDF
                </button>
              )}
            </div>
          )}

          {/* HTTP attack report modal */}
          {showReport && (
            <HTTPAttackReportModal
              open={showReport}
              onClose={() => setReport(false)}
              threatId={threat.id}
              threat={threat}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  threats: SecurityThreat[]; stats: ThreatStats;
  loading: boolean; scanning: boolean; onScan: () => void;
  onMitigate: (id: string, act: string) => void;
  onMarkFalsePositive: (id: string) => void;
  onUpdateStatus: (id: string, s: string) => void;
}

// ─── SecurityThreatsPanel ─────────────────────────────────────────────────────

export function SecurityThreatsPanel({ threats, stats, loading, scanning, onScan, onMitigate, onMarkFalsePositive, onUpdateStatus }: Props) {
  const [showSys, setShowSys]   = useState(false);
  const [tab, setTab]           = useState<"active"|"resolved">("active");
  const [showBulk, setShowBulk] = useState(false);
  const [bulking, setBulking]   = useState(false);
  const [showReport, setShowReport] = useState(false);

  const attacks  = threats.filter(t => t.is_attack !== false);
  const user     = attacks.filter(t => !isSys(t));
  const system   = attacks.filter(t => isSys(t));
  const active   = user.filter(t => t.status === "active");
  const resolved = user.filter(t => t.status === "mitigated" || t.status === "false_positive");
  const ORDER    = { critical: 0, high: 1, medium: 2, low: 3 } as Record<string, number>;
  const sorted   = [...active].sort((a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9));
  const fixable  = sorted.filter(t => canFix(t));

  const doBulk = async () => {
    setBulking(true);
    try { for (const t of fixable) await onMitigate(t.id, "auto_fix_authorized"); }
    finally { setBulking(false); setShowBulk(false); }
  };

  /* ── Loading ── */
  if (loading) return (
    <div className="bg-card border border-border rounded-xl flex items-center justify-center py-16 gap-3 text-muted-foreground text-sm">
      <RefreshCw className="w-4 h-4 animate-spin" />
      Carregando ameaças…
    </div>
  );

  /* ── Empty ── */
  if (!active.length && !resolved.length) return (
    <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-16 gap-4">
      <div className="p-3.5 rounded-xl" style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.18)" }}>
        <Shield className="w-5 h-5" style={{ color: STATUS.accent }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Nenhuma ameaça em namespaces de usuário</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          {system.length} componente{system.length !== 1 ? "s" : ""} de sistema detectado{system.length !== 1 ? "s" : ""} — apenas informacional.
        </p>
      </div>
      <button onClick={onScan} disabled={scanning}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs bg-muted border border-border text-muted-foreground hover:bg-accent transition-colors cursor-pointer outline-none disabled:opacity-50"
      >
        <RefreshCw className={cn("w-3 h-3", scanning && "animate-spin")} />
        Executar varredura
      </button>
    </div>
  );

  /* ── Main ── */
  return (
    <div className="flex flex-col gap-3">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {fixable.length > 0 && (
          <AIBtn label="Corrigir com IA" count={fixable.length} loading={bulking} onClick={() => setShowBulk(true)} />
        )}
        <button onClick={() => setShowReport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted border border-border text-muted-foreground hover:bg-accent transition-colors cursor-pointer outline-none"
        >
          <FileText className="w-3 h-3" />Relatório
        </button>
        <button onClick={onScan} disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted border border-border text-muted-foreground hover:bg-accent transition-colors cursor-pointer outline-none disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3 h-3", scanning && "animate-spin")} />
          Varredura
        </button>
        <SecurityReportModal open={showReport} onClose={() => setShowReport(false)} />
      </div>

      {/* ── Bulk fix dialog ── */}
      <AlertDialog open={showBulk} onOpenChange={o => !o && setShowBulk(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: STATUS.accent }} />
              Corrigir {fixable.length} ameaça{fixable.length !== 1 ? "s" : ""} com IA
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-3">
                <p>A IA enviará comandos de correção para o agente resolver automaticamente:</p>
                <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
                  {fixable.map(t => {
                    const s = SEV[t.severity] ?? SEV.low;
                    return (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: s.dot }} />
                        <span className="font-medium flex-1 min-w-0 truncate">{t.title}</span>
                        <span className="font-mono text-muted-foreground flex-shrink-0">{getNS(t)}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  As correções podem levar alguns minutos para serem aplicadas pelo agente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doBulk} disabled={bulking} className="gap-1.5">
              {bulking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Autorizar e corrigir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Threat list ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <InnerTabBar
          tabs={[
            { id: "active",   label: "Ativas",     badge: active.length   },
            { id: "resolved", label: "Resolvidas", badge: resolved.length },
          ]}
          active={tab}
          onChange={id => setTab(id as "active"|"resolved")}
        />

        {tab === "active" && (
          sorted.length === 0
            ? <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4" />Nenhuma ameaça ativa em namespaces de usuário
              </div>
            : <div>
                {sorted.map((t, i) => (
                  <ThreatRow key={t.id} threat={t} idx={i}
                    onMitigate={onMitigate} onMarkFalsePositive={onMarkFalsePositive} onUpdateStatus={onUpdateStatus} />
                ))}
              </div>
        )}

        {tab === "resolved" && (
          resolved.length === 0
            ? <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4" />Nenhuma ameaça resolvida ainda
              </div>
            : <ScrollArea className="max-h-[480px]">
                <div>
                  {resolved.map((t, i) => (
                    <ThreatRow key={t.id} threat={t} idx={i}
                      onMitigate={onMitigate} onMarkFalsePositive={onMarkFalsePositive} onUpdateStatus={onUpdateStatus} />
                  ))}
                </div>
              </ScrollArea>
        )}
      </div>

      {/* ── System threats ── */}
      {system.length > 0 && (
        <div className="bg-card/60 border border-border rounded-xl overflow-hidden">
          <button onClick={() => setShowSys(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer outline-none transition-colors"
          >
            <span className="flex items-center gap-2">
              <ShieldOff className="w-3 h-3" />
              Componentes de sistema — informacional ({system.length})
            </span>
            <ChevronRight className={cn("w-3 h-3 transition-transform", showSys && "rotate-90")} />
          </button>
          {showSys && (
            <div className="border-t border-border">
              {system.map((t, i) => (
                <ThreatRow key={t.id} threat={t} idx={i}
                  onMitigate={onMitigate} onMarkFalsePositive={onMarkFalsePositive} onUpdateStatus={onUpdateStatus} />
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes rp-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
