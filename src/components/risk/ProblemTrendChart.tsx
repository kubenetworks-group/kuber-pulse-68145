import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, ChevronRight, Zap, Shield, Activity } from "lucide-react";
import { TrendData } from "@/hooks/useRiskAnalysis";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  critical: "#FF2D2D", critDim: "rgba(255,45,45,0.12)",
  high:     "#FF7A00", highDim: "rgba(255,122,0,0.12)",
  medium:   "#F5C518", medDim:  "rgba(245,197,24,0.12)",
  low:      "#00E5A0", lowDim:  "rgba(0,229,160,0.10)",
  accent:   "#00E5A0",
  txt:      "var(--foreground)",
  txt2:     "var(--muted-foreground)",
  border:   "var(--border)",
  bg:       "var(--card)",
  bgSubtle: "var(--muted)",
} as const;

// ─── Cascade rules: if X severity problems persist → Y consequences ───────────

interface CascadeRule {
  trigger: { severity: "critical" | "high" | "medium"; minCount: number };
  consequence: string;
  impact: "pods" | "cluster" | "availability" | "security" | "data";
  urgency: "immediate" | "short" | "medium";
  color: string;
}

const CASCADE_RULES: CascadeRule[] = [
  {
    trigger: { severity: "critical", minCount: 1 },
    consequence: "Risco de queda total do cluster — problemas críticos sem solução podem cascatear para todos os pods dependentes",
    impact: "cluster",
    urgency: "immediate",
    color: C.critical,
  },
  {
    trigger: { severity: "critical", minCount: 2 },
    consequence: "Múltiplos problemas críticos indicam instabilidade sistêmica — pods em outros namespaces podem falhar em reação",
    impact: "pods",
    urgency: "immediate",
    color: C.critical,
  },
  {
    trigger: { severity: "high", minCount: 1 },
    consequence: "Problemas de alta severidade tendem a escalar — containers em CrashLoop são comuns quando RBAC ou rede não são corrigidos",
    impact: "pods",
    urgency: "short",
    color: C.high,
  },
  {
    trigger: { severity: "high", minCount: 3 },
    consequence: "Acúmulo de riscos altos pode sobrecarregar o scheduler — pods novos podem não conseguir ser agendados nos nós",
    impact: "availability",
    urgency: "short",
    color: C.high,
  },
  {
    trigger: { severity: "medium", minCount: 5 },
    consequence: "Volume alto de riscos médios reduz a capacidade de resposta — alertas importantes podem ser ignorados no ruído",
    impact: "security",
    urgency: "medium",
    color: C.medium,
  },
  {
    trigger: { severity: "medium", minCount: 3 },
    consequence: "Configurações incorretas acumuladas comprometem auditorias e políticas de conformidade do cluster",
    impact: "security",
    urgency: "medium",
    color: C.medium,
  },
];

const IMPACT_LABELS: Record<CascadeRule["impact"], { label: string; Icon: React.ElementType }> = {
  pods:         { label: "Pods em risco",    Icon: Activity },
  cluster:      { label: "Estabilidade",     Icon: AlertTriangle },
  availability: { label: "Disponibilidade",  Icon: TrendingDown },
  security:     { label: "Segurança",        Icon: Shield },
  data:         { label: "Dados",            Icon: AlertTriangle },
};

const URGENCY_CONFIG = {
  immediate: { label: "Ação imediata",  color: C.critical, bg: C.critDim },
  short:     { label: "Curto prazo",    color: C.high,     bg: C.highDim },
  medium:    { label: "Médio prazo",    color: C.medium,   bg: C.medDim  },
};

// ─── Trend direction ─────────────────────────────────────────────────────────

function computeTrend(trends: TrendData[]) {
  if (trends.length < 2) return null;
  const first3  = trends.slice(0, 3).reduce((s, t) => s + t.critical + t.high + t.medium + t.low, 0);
  const last3   = trends.slice(-3).reduce((s, t) => s + t.critical + t.high + t.medium + t.low, 0);
  const delta   = last3 - first3;
  return { delta, rising: delta > 0, stable: delta === 0 };
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, e: any) => s + (e.value || 0), 0);
  return (
    <div style={{
      background: "var(--popover)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      minWidth: 140,
    }}>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8, fontFamily: "'Geist',sans-serif" }}>
        {format(parseISO(label), "EEEE, dd MMM", { locale: ptBR })}
      </p>
      {payload.map((entry: any) => entry.value > 0 && (
        <div key={entry.dataKey} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontFamily: "'Geist',sans-serif" }}>
            {entry.name}:
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: entry.color, fontFamily: "'JetBrains Mono',monospace" }}>
            {entry.value}
          </span>
        </div>
      ))}
      {total > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Total</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--foreground)", fontFamily: "'JetBrains Mono',monospace" }}>{total}</span>
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface ProblemTrendChartProps {
  trends: TrendData[];
}

export const ProblemTrendChart = ({ trends }: ProblemTrendChartProps) => {
  const formatXAxis = (value: string) => {
    try { return format(parseISO(value), "dd/MM", { locale: ptBR }); }
    catch { return value; }
  };

  const hasActivity = trends.some(t => t.critical > 0 || t.high > 0 || t.medium > 0 || t.low > 0);
  const hasStructure = trends.length > 0;

  // Compute totals by severity across all 7 days
  const totals = useMemo(() => trends.reduce(
    (acc, t) => ({
      critical: acc.critical + t.critical,
      high:     acc.high     + t.high,
      medium:   acc.medium   + t.medium,
      low:      acc.low      + t.low,
    }),
    { critical: 0, high: 0, medium: 0, low: 0 }
  ), [trends]);

  // Compute total per day for reference line
  const peakDay = useMemo(() => trends.reduce(
    (best, t) => {
      const total = t.critical + t.high + t.medium + t.low;
      return total > best.total ? { date: t.date, total } : best;
    },
    { date: "", total: 0 }
  ), [trends]);

  // Match cascade rules against current totals
  const activeWarnings = useMemo(() => CASCADE_RULES.filter(rule => {
    const count = totals[rule.trigger.severity];
    return count >= rule.trigger.minCount;
  }), [totals]);

  const trendDir = useMemo(() => computeTrend(trends), [trends]);

  // Overall risk message derived from active warnings
  const overallRisk = useMemo(() => {
    if (activeWarnings.some(w => w.urgency === "immediate")) return "immediate";
    if (activeWarnings.some(w => w.urgency === "short")) return "short";
    if (activeWarnings.some(w => w.urgency === "medium")) return "medium";
    return null;
  }, [activeWarnings]);

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 12, overflow: "hidden",
    }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "18px 22px 14px",
        borderBottom: hasActivity ? "1px solid var(--border)" : "none",
      }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <TrendingUp style={{ width: 15, height: 15, color: "var(--muted-foreground)", flexShrink: 0 }} />
          <span style={{
            fontSize: 14, fontWeight: 600, color: "var(--foreground)",
            fontFamily: "'Geist','Inter',sans-serif",
          }}>
            Tendência de Problemas (7 dias)
          </span>

          {/* Trend direction badge */}
          {trendDir && hasActivity && (
            <span style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, padding: "2px 9px", borderRadius: 100, fontWeight: 600,
              background: trendDir.rising ? C.critDim : trendDir.stable ? C.medDim : C.lowDim,
              color: trendDir.rising ? C.critical : trendDir.stable ? C.medium : C.accent,
              border: `1px solid ${trendDir.rising ? "rgba(255,45,45,0.2)" : trendDir.stable ? "rgba(245,197,24,0.2)" : "rgba(0,229,160,0.2)"}`,
            }}>
              {trendDir.rising
                ? <><TrendingUp style={{ width: 10, height: 10 }} /> Crescendo</>
                : trendDir.stable
                  ? <>Estável</>
                  : <><TrendingDown style={{ width: 10, height: 10 }} /> Melhorando</>
              }
            </span>
          )}
        </div>

        {/* Description */}
        <p style={{
          fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.55,
          fontFamily: "'Geist','Inter',sans-serif", margin: 0,
          maxWidth: 680,
        }}>
          Mostra incidentes e ameaças de segurança detectados por dia.{" "}
          <strong style={{ color: "var(--foreground)", fontWeight: 500 }}>
            Problemas não resolvidos acumulam risco em cascata
          </strong>{" "}
          — um RBAC mal configurado pode causar CrashLoop em pods, que pode derrubar serviços inteiros.
        </p>
      </div>

      {/* ── Risk cascade alert ───────────────────────────────────────────────── */}
      {overallRisk && (
        <div style={{
          margin: "0 22px 16px",
          marginTop: 16,
          background: URGENCY_CONFIG[overallRisk].bg,
          border: `1px solid ${URGENCY_CONFIG[overallRisk].color}30`,
          borderLeft: `3px solid ${URGENCY_CONFIG[overallRisk].color}`,
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}>
          <Zap style={{ width: 14, height: 14, color: URGENCY_CONFIG[overallRisk].color, flexShrink: 0, marginTop: 1 }} />
          <div>
            <span style={{
              fontSize: 11, fontWeight: 700, color: URGENCY_CONFIG[overallRisk].color,
              textTransform: "uppercase", letterSpacing: "0.06em",
              fontFamily: "'Geist',sans-serif",
            }}>
              {URGENCY_CONFIG[overallRisk].label} —{" "}
            </span>
            <span style={{ fontSize: 12, color: "var(--foreground)", fontFamily: "'Geist',sans-serif" }}>
              {activeWarnings.find(w => w.urgency === overallRisk)?.consequence}
            </span>
          </div>
        </div>
      )}

      {/* ── Chart ────────────────────────────────────────────────────────────── */}
      <div style={{ padding: "0 22px" }}>
        {!hasStructure ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <TrendingUp style={{ width: 36, height: 36, color: "var(--muted-foreground)", opacity: 0.4, margin: "0 auto 8px" }} />
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", fontFamily: "'Geist',sans-serif" }}>
                Aguardando dados do cluster...
              </p>
            </div>
          </div>
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gcrit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF2D2D" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FF2D2D" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ghigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF7A00" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#FF7A00" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gmed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F5C518" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F5C518" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00E5A0" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00E5A0" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="date" tickFormatter={formatXAxis}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "'Geist',sans-serif" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "'JetBrains Mono',monospace" }}
                  axisLine={false} tickLine={false} allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Peak day reference line */}
                {peakDay.total > 0 && (
                  <ReferenceLine
                    x={peakDay.date}
                    stroke="rgba(255,255,255,0.15)"
                    strokeDasharray="4 4"
                  />
                )}

                <Area type="monotone" dataKey="critical" name="Crítico"
                  stroke={C.critical} strokeWidth={2} fill="url(#gcrit)" fillOpacity={1} />
                <Area type="monotone" dataKey="high"     name="Alto"
                  stroke={C.high}     strokeWidth={2} fill="url(#ghigh)" fillOpacity={1} />
                <Area type="monotone" dataKey="medium"   name="Médio"
                  stroke={C.medium}   strokeWidth={1.5} fill="url(#gmed)" fillOpacity={1} />
                <Area type="monotone" dataKey="low"      name="Baixo"
                  stroke={C.accent}   strokeWidth={1.5} fill="url(#glow)" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Cascade warnings list ─────────────────────────────────────────────── */}
      {activeWarnings.length > 0 && (
        <div style={{ padding: "12px 22px 20px" }}>
          <p style={{
            fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 8, fontFamily: "'Geist',sans-serif", fontWeight: 600,
          }}>
            O que pode acontecer se não for resolvido
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {activeWarnings.slice(0, 3).map((w, i) => {
              const { label: impactLabel, Icon } = IMPACT_LABELS[w.impact];
              const urg = URGENCY_CONFIG[w.urgency];
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "8px 12px", borderRadius: 8,
                  background: "var(--muted)", border: "1px solid var(--border)",
                }}>
                  {/* Impact icon */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: `${w.color}18`, border: `1px solid ${w.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon style={{ width: 13, height: 13, color: w.color }} />
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 10, padding: "1px 7px", borderRadius: 100,
                        background: urg.bg, color: urg.color,
                        border: `1px solid ${urg.color}30`,
                        fontFamily: "'Geist',sans-serif", fontWeight: 600,
                        letterSpacing: "0.04em",
                      }}>
                        {urg.label}
                      </span>
                      <span style={{
                        fontSize: 10, color: "var(--muted-foreground)",
                        fontFamily: "'Geist',sans-serif",
                      }}>
                        {impactLabel}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 12, color: "var(--foreground)", lineHeight: 1.5,
                      fontFamily: "'Geist',sans-serif", margin: 0,
                    }}>
                      {w.consequence}
                    </p>
                  </div>

                  <ChevronRight style={{ width: 13, height: 13, color: "var(--muted-foreground)", flexShrink: 0, marginTop: 7 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Clean state ───────────────────────────────────────────────────────── */}
      {hasStructure && !hasActivity && (
        <div style={{ padding: "0 22px 20px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", borderRadius: 8,
            background: C.lowDim, border: `1px solid rgba(0,229,160,0.2)`,
          }}>
            <Shield style={{ width: 14, height: 14, color: C.accent, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 12, color: C.accent, fontWeight: 600, margin: 0, fontFamily: "'Geist',sans-serif" }}>
                Cluster estável nos últimos 7 dias
              </p>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "2px 0 0", fontFamily: "'Geist',sans-serif" }}>
                Nenhum incidente ou ameaça detectada. Continue monitorando para prevenir acúmulo de riscos.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
