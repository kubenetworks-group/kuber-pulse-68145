import { useEffect, useState } from "react";
import { Shield, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS = {
  critical: "#FF2D2D",
  high:     "#FF7A00",
  medium:   "#F5C518",
  low:      "#00E5A0",
} as const;

function scoreConfig(s: number) {
  if (s >= 75) return { label: "Crítico", color: STATUS.critical, action: "Ação imediata necessária" };
  if (s >= 50) return { label: "Alto",    color: STATUS.high,     action: "Ação recomendada" };
  if (s >= 25) return { label: "Médio",   color: STATUS.medium,   action: "Monitorar de perto" };
  return             { label: "Baixo",   color: STATUS.low,      action: "Cluster saudável" };
}

function ScoreRing({ score }: { score: number }) {
  const [mounted, setMounted] = useState(false);
  const { color } = scoreConfig(score);
  const r = 34, circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="relative flex-shrink-0" style={{ width: 84, height: 84 }}>
      <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="8" opacity="0.07" />
        <circle cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-border" opacity="0.5" />
        <circle cx="42" cy="42" r={r} fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? offset : circ}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.34,1.2,0.64,1)", filter: `drop-shadow(0 0 5px ${color}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="tabular-nums font-bold leading-none"
          style={{ fontFamily: "'DM Mono','Courier New',monospace", fontSize: 22, color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

interface Stat { label: string; value: number; color: string }

interface RiskPageHeaderProps {
  title: string;
  subtitle?: string;
  clusterName?: string;
  clusterEnv?: string;
  score: number;
  stats: Stat[];
  lastUpdated?: Date | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function RiskPageHeader({
  title, subtitle, clusterName, clusterEnv, score, stats, lastUpdated, refreshing, onRefresh,
}: RiskPageHeaderProps) {
  const { color, label, action } = scoreConfig(score);

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Shield className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
            <span className="text-foreground font-semibold text-base"
              style={{ fontFamily: "'Aileron', system-ui, sans-serif" }}>{title}</span>
            {clusterName && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-muted-foreground text-xs font-mono">{clusterName}</span>
              </>
            )}
            {clusterEnv && (
              <span className="text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded text-[10px] font-mono">
                {clusterEnv}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle ?? action}</p>}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
          <div className="text-right">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mb-1"
              style={{ background: `${color}15`, border: `1px solid ${color}30` }}
            >
              <span className="rounded-full" style={{ width: 6, height: 6, background: color }} />
              <span className="text-[10px] font-medium tracking-wide" style={{ color, fontFamily: "'Aileron', system-ui, sans-serif" }}>
                Risco {label}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2 mt-0.5">
              {lastUpdated && (
                <p className="text-[10px] text-muted-foreground font-mono">
                  {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              )}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  style={{ background: "none", border: "none", cursor: refreshing ? "not-allowed" : "pointer", padding: 2 }}
                >
                  <RefreshCw style={{ width: 11, height: 11 }} className={refreshing ? "animate-spin" : ""} />
                </button>
              )}
            </div>
          </div>
          <ScoreRing score={score} />
        </div>
      </div>

      {stats.length > 0 && (
        <div className={cn("grid border-t border-border")} style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
          {stats.map(({ label, value, color }, i) => (
            <div
              key={label}
              className={cn(
                "flex flex-col items-center sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 sm:px-5 py-2.5 transition-colors hover:bg-muted/50",
                i < stats.length - 1 && "border-r border-border"
              )}
            >
              <span className="rounded-full flex-shrink-0 hidden sm:block" style={{ width: 4, height: 4, background: color, boxShadow: `0 0 5px ${color}` }} />
              <div className="text-center sm:text-left">
                <div className="font-medium tabular-nums leading-none"
                  style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color }}>{value}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5"
                  style={{ fontFamily: "'Aileron', system-ui, sans-serif", fontWeight: 400 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
