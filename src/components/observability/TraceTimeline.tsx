import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Clock, AlertTriangle, CheckCircle2, Circle, GitBranch, Zap } from "lucide-react";
import { ClusterChange, UnstablePod } from "@/hooks/useRiskAnalysis";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInMilliseconds } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  brand:    "#0F3CA5",
  brandMid: "#577DB2",
  ok:       "#16A34A",
  warn:     "#D97706",
  crit:     "#DC2626",
  muted:    "var(--muted-foreground)",
  border:   "var(--border)",
  card:     "var(--card)",
  bg:       "var(--background)",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface TraceSpan {
  id: string;
  name: string;
  kind: "detect" | "analyze" | "remediate" | "verify" | "event";
  startOffsetMs: number;
  durationMs: number;
  status: "ok" | "error" | "warn";
  detail?: string;
}

interface Trace {
  id: string;
  title: string;
  service: string;
  namespace: string;
  startTime: Date;
  totalDurationMs: number;
  status: "ok" | "error" | "warn";
  spans: TraceSpan[];
  source: "change" | "pod";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function spanColor(s: TraceSpan["status"]) {
  return s === "ok" ? C.ok : s === "error" ? C.crit : C.warn;
}

function kindLabel(k: TraceSpan["kind"]) {
  const m: Record<TraceSpan["kind"], string> = {
    detect: "Detecção",
    analyze: "Análise IA",
    remediate: "Remediação",
    verify: "Verificação",
    event: "Evento",
  };
  return m[k];
}

function statusIcon(s: Trace["status"]) {
  if (s === "ok")    return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: C.ok }} />;
  if (s === "error") return <AlertTriangle className="w-3.5 h-3.5" style={{ color: C.crit }} />;
  return <Circle className="w-3.5 h-3.5" style={{ color: C.warn }} />;
}

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function fmtTime(d: Date) {
  return format(d, "HH:mm:ss", { locale: ptBR });
}

// ─── Derive traces from cluster data ─────────────────────────────────────────
function buildTraces(changes: ClusterChange[], unstablePods: UnstablePod[]): Trace[] {
  const traces: Trace[] = [];

  // Group changes by involvedObject (pod/deployment)
  const grouped = new Map<string, ClusterChange[]>();
  for (const c of changes) {
    const key = `${c.namespace}/${c.involvedObject}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  let idx = 0;
  for (const [key, events] of grouped) {
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const startTime = new Date(sorted[0].timestamp);
    const endTime = new Date(sorted[sorted.length - 1].timestamp);
    const totalMs = Math.max(differenceInMilliseconds(endTime, startTime), 500);

    const isError = sorted.some(e =>
      ["Failed", "BackOff", "OOMKilling", "Killing", "Unhealthy"].includes(e.reason)
    );
    const isResolved = sorted.some(e =>
      ["Started", "Pulled", "Created", "Scheduled", "Pulling"].includes(e.reason)
    );
    const status: Trace["status"] = isResolved ? "ok" : isError ? "error" : "warn";

    const spans: TraceSpan[] = sorted.map((e, i) => {
      const t = new Date(e.timestamp).getTime() - startTime.getTime();
      const nextT = i < sorted.length - 1
        ? new Date(sorted[i + 1].timestamp).getTime() - startTime.getTime()
        : totalMs;
      const spanMs = Math.max(nextT - t, 100);
      const spanStatus: TraceSpan["status"] =
        ["Failed", "BackOff", "OOMKilling", "Killing", "Unhealthy"].includes(e.reason)
          ? "error"
          : ["Started", "Pulled", "Scheduled"].includes(e.reason)
          ? "ok"
          : "warn";

      return {
        id: `${key}-${i}`,
        name: `${e.reason}: ${e.involvedObject}`,
        kind: "event",
        startOffsetMs: t,
        durationMs: spanMs,
        status: spanStatus,
        detail: e.message,
      };
    });

    const [, obj] = key.split("/");
    traces.push({
      id: `trace-${idx++}`,
      title: obj || key,
      service: sorted[0].type || "Event",
      namespace: sorted[0].namespace,
      startTime,
      totalDurationMs: totalMs,
      status,
      spans,
      source: "change",
    });
  }

  // Build traces for unstable pods not already covered
  const coveredPods = new Set(changes.map(c => c.involvedObject));
  for (const pod of unstablePods) {
    if (coveredPods.has(pod.name)) continue;

    const totalMs = Math.max(pod.restartCount * 8000, 2000);
    const lastRestartMs = pod.lastRestart ? new Date(pod.lastRestart).getTime() : Date.now() - totalMs;

    const spans: TraceSpan[] = [
      { id: `${pod.name}-0`, name: "CrashLoop detectado", kind: "detect", startOffsetMs: 0, durationMs: Math.round(totalMs * 0.1), status: "error", detail: pod.reason },
      { id: `${pod.name}-1`, name: "Análise de causa raiz", kind: "analyze", startOffsetMs: Math.round(totalMs * 0.1), durationMs: Math.round(totalMs * 0.2), status: "warn", detail: "IA analisando logs e eventos" },
      { id: `${pod.name}-2`, name: "Tentativa de restart", kind: "remediate", startOffsetMs: Math.round(totalMs * 0.3), durationMs: Math.round(totalMs * 0.6), status: pod.status === "Running" ? "ok" : "error", detail: `${pod.restartCount} reinícios registrados` },
      ...(pod.status === "Running"
        ? [{ id: `${pod.name}-3`, name: "Pod recuperado", kind: "verify" as const, startOffsetMs: Math.round(totalMs * 0.9), durationMs: Math.round(totalMs * 0.1), status: "ok" as const }]
        : []),
    ];

    traces.push({
      id: `trace-pod-${pod.name}`,
      title: pod.name,
      service: "CrashLoop",
      namespace: pod.namespace,
      startTime: new Date(lastRestartMs),
      totalDurationMs: totalMs,
      status: pod.status === "Running" ? "ok" : "error",
      spans,
      source: "pod",
    });
  }

  return traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime()).slice(0, 30);
}

// ─── Span bar ─────────────────────────────────────────────────────────────────
function SpanBar({ span, totalMs }: { span: TraceSpan; totalMs: number }) {
  const left = (span.startOffsetMs / totalMs) * 100;
  const width = Math.max((span.durationMs / totalMs) * 100, 1.5);
  const color = spanColor(span.status);

  return (
    <div className="flex items-center gap-3 py-1 group/span">
      <div className="w-36 text-right shrink-0">
        <span className="text-[11px] text-muted-foreground font-normal"
          style={{ fontFamily: "'Aileron', system-ui, sans-serif" }}>{kindLabel(span.kind)}</span>
      </div>
      <div className="flex-1 h-5 relative" style={{ minWidth: 0 }}>
        <div className="absolute inset-y-0 w-full rounded" style={{ background: "rgba(0,0,0,0.04)" }} />
        <div
          className="absolute h-5 rounded"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: color,
            opacity: 0.85,
            transition: "opacity 0.15s",
            boxShadow: `0 0 6px ${color}40`,
          }}
        />
      </div>
      <div className="w-16 shrink-0">
        <span className="text-[10px] text-muted-foreground font-mono">{fmtDuration(span.durationMs)}</span>
      </div>
      {span.detail && (
        <div className="hidden group-hover/span:block absolute left-40 right-0 z-10 mt-7 pointer-events-none">
          <div className="text-[11px] text-foreground bg-card border border-border rounded-lg px-3 py-2 shadow-lg max-w-xs">
            {span.detail}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Trace row ────────────────────────────────────────────────────────────────
function TraceRow({ trace, maxMs }: { trace: Trace; maxMs: number }) {
  const [expanded, setExpanded] = useState(false);
  const barW = Math.max((trace.totalDurationMs / maxMs) * 100, 1.5);
  const color = trace.status === "ok" ? C.ok : trace.status === "error" ? C.crit : C.warn;

  return (
    <div
      className="border-b border-border last:border-0"
      style={{ background: expanded ? "rgba(15,60,165,0.02)" : undefined }}
    >
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors group"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Expand icon */}
        <span className="text-muted-foreground w-4 shrink-0">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>

        {/* Status icon */}
        <span className="shrink-0">{statusIcon(trace.status)}</span>

        {/* Title */}
        <div className="w-44 shrink-0 min-w-0">
          <span className="text-sm font-normal text-foreground truncate block"
            style={{ fontFamily: "'Aileron', system-ui, sans-serif" }}>{trace.title}</span>
          <span className="text-[10px] text-muted-foreground"
            style={{ fontFamily: "'DM Mono', monospace", fontWeight: 400 }}>{trace.namespace}</span>
        </div>

        {/* Service badge */}
        <div className="w-24 shrink-0">
          <span
            className="text-[10px] font-normal px-1.5 py-0.5 rounded"
            style={{
              background: `${color}12`,
              color,
              border: `1px solid ${color}25`,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {trace.service}
          </span>
        </div>

        {/* Spans count */}
        <div className="w-16 shrink-0 text-center">
          <span className="text-[11px] text-muted-foreground font-normal"
            style={{ fontFamily: "'Aileron', system-ui, sans-serif" }}>{trace.spans.length} spans</span>
        </div>

        {/* Bar */}
        <div className="flex-1 h-4 relative">
          <div className="absolute inset-0 rounded" style={{ background: "rgba(0,0,0,0.04)" }} />
          <div
            className="absolute h-4 rounded"
            style={{
              width: `${barW}%`,
              background: color,
              opacity: 0.7,
              boxShadow: `0 0 8px ${color}40`,
            }}
          />
        </div>

        {/* Duration + time */}
        <div className="w-28 shrink-0 text-right">
          <span className="text-[11px] text-foreground font-normal"
            style={{ fontFamily: "'DM Mono', monospace" }}>{fmtDuration(trace.totalDurationMs)}</span>
          <div className="text-[10px] text-muted-foreground font-normal"
            style={{ fontFamily: "'DM Mono', monospace" }}>{fmtTime(trace.startTime)}</div>
        </div>
      </button>

      {/* Expanded spans */}
      {expanded && (
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: "rgba(15,60,165,0.1)", background: "rgba(15,60,165,0.015)" }}
        >
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2"
            style={{ fontFamily: "'Aileron', system-ui, sans-serif" }}>
            Spans — {fmtTime(trace.startTime)}
          </div>
          {trace.spans.map(span => (
            <SpanBar key={span.id} span={span} totalMs={trace.totalDurationMs} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface TraceTimelineProps {
  changes: ClusterChange[];
  unstablePods: UnstablePod[];
}

export function TraceTimeline({ changes, unstablePods }: TraceTimelineProps) {
  const [filter, setFilter] = useState<"all" | "ok" | "error" | "warn">("all");

  const traces = useMemo(() => buildTraces(changes, unstablePods), [changes, unstablePods]);
  const filtered = useMemo(() =>
    filter === "all" ? traces : traces.filter(t => t.status === filter),
    [traces, filter]
  );
  const maxMs = useMemo(() => Math.max(...filtered.map(t => t.totalDurationMs), 1000), [filtered]);

  const counts = useMemo(() => ({
    all: traces.length,
    ok: traces.filter(t => t.status === "ok").length,
    error: traces.filter(t => t.status === "error").length,
    warn: traces.filter(t => t.status === "warn").length,
  }), [traces]);

  if (traces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(15,60,165,0.08)" }}>
          <GitBranch className="w-7 h-7" style={{ color: C.brand }} />
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Nenhum trace disponível. Os traces são gerados automaticamente quando eventos de cluster são detectados pelo agente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 flex-wrap">
        {(["all", "ok", "error", "warn"] as const).map(f => {
          const color = f === "ok" ? C.ok : f === "error" ? C.crit : f === "warn" ? C.warn : C.brand;
          const label = f === "all" ? "Todos" : f === "ok" ? "OK" : f === "error" ? "Erro" : "Aviso";
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{
                background: active ? `${color}12` : "transparent",
                border: `1px solid ${active ? color : "rgba(0,0,0,0.08)"}`,
                color: active ? color : "var(--muted-foreground)",
                fontFamily: "'Aileron', system-ui, sans-serif",
                fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>{counts[f]}</span>
              {label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
          <Clock className="w-3 h-3" />
          {filtered.length} traces
        </div>
      </div>

      {/* Table header */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "rgba(15,60,165,0.12)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-2 border-b text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
          style={{ borderColor: "rgba(15,60,165,0.08)", background: "rgba(15,60,165,0.03)", fontFamily: "'Aileron', system-ui, sans-serif" }}
        >
          <div className="w-4 shrink-0" />
          <div className="w-4 shrink-0" />
          <div className="w-44 shrink-0">Serviço / Pod</div>
          <div className="w-24 shrink-0">Tipo</div>
          <div className="w-16 shrink-0 text-center">Spans</div>
          <div className="flex-1">Linha do Tempo</div>
          <div className="w-28 shrink-0 text-right">Duração</div>
        </div>

        {/* Rows */}
        <div className="bg-card">
          {filtered.map(trace => (
            <TraceRow key={trace.id} trace={trace} maxMs={maxMs} />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3" style={{ color: C.brand }} />
          <span>Traces derivados de eventos Kubernetes em tempo real</span>
        </div>
      </div>
    </div>
  );
}
