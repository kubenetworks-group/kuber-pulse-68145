import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Shield,
  DollarSign,
  Activity,
  Wrench,
  TrendingUp,
  AlertTriangle,
  Globe,
  Cpu,
  BarChart3,
  Zap,
  ArrowRight,
  Menu,
  X,
  CheckCircle2,
  Play,
} from "lucide-react";
import kodoLogo from "@/assets/kodo-logo.png";

/* ─── Animated counter ─── */
const useCounter = (end: number, duration = 2000, decimals = 0) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let start: number;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setCount(parseFloat((eased * end).toFixed(decimals)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, end, duration, decimals]);

  return { count, ref };
};

/* ─── Nav ─── */
const NAV_LINKS = [
  { label: "Problema", href: "#problema" },
  { label: "Demo", href: "#demo" },
  { label: "Mercado", href: "#mercado" },
  { label: "Solução", href: "#solucao" },
  { label: "Modelo", href: "#modelo" },
  { label: "Visão", href: "#visao" },
];

const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#050810]/90 backdrop-blur-2xl border-b border-white/[0.06]"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={kodoLogo} alt="Kodo" className="h-6 w-auto" />
          <span className="text-sm font-semibold tracking-tight text-white">kodo</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[11px] uppercase tracking-[0.15em] text-white/40 hover:text-white/80 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          href="mailto:contato@kodo.io"
          className="hidden md:inline-flex text-[11px] px-4 py-2 rounded-full border border-white/20 text-white/70 hover:border-white/40 hover:text-white transition-all"
        >
          Falar com a equipe
        </a>

        <button className="md:hidden text-white/60" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-[#050810]/98 backdrop-blur-2xl border-t border-white/[0.06] px-6 py-6 flex flex-col gap-5">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-xs uppercase tracking-[0.15em] text-white/50 hover:text-white"
            >
              {l.label}
            </a>
          ))}
          <a
            href="mailto:contato@kodo.io"
            className="mt-2 text-center text-sm py-2.5 rounded-full border border-white/20 text-white/70"
          >
            Falar com a equipe
          </a>
        </div>
      )}
    </header>
  );
};

/* ─── Hero ─── */
const Hero = () => (
  <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
    <div
      className="absolute inset-0 opacity-[0.035]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    />
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />
    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />

    <div className="relative z-10 max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/40 text-[10px] uppercase tracking-[0.2em] mb-10">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        Pitch — Kodo · 2025
      </div>

      <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight leading-[1.0] mb-8">
        Kubernetes{" "}
        <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">
          inteligente
        </span>
        <br />
        para um mercado
        <br />
        que não pode errar.
      </h1>

      <p className="text-lg sm:text-xl text-white/35 max-w-2xl mx-auto leading-relaxed font-light">
        O Brasil e a LATAM adotaram Kubernetes em escala — sem a infraestrutura
        de operação para sustentá-lo. Kodo resolve isso com IA.
      </p>

      <div className="mt-12 flex flex-wrap justify-center gap-12 text-center">
        {[
          { v: "43.7B", s: "USD", l: "mercado global K8s até 2032" },
          { v: "68%", s: "YoY", l: "adoção K8s no Brasil" },
          { v: "120K", s: "déficit", l: "engenheiros DevOps na LATAM" },
        ].map((d) => (
          <div key={d.l} className="flex flex-col items-center gap-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{d.v}</span>
              <span className="text-xs text-blue-400 font-mono">{d.s}</span>
            </div>
            <span className="text-[11px] text-white/30 max-w-[120px] leading-tight">{d.l}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20">
      <span className="text-[9px] uppercase tracking-widest">scroll</span>
      <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
    </div>
  </section>
);

/* ─── Problema ─── */
const StatCard = ({
  icon: Icon,
  value,
  unit,
  label,
  source,
  accent,
}: {
  icon: React.ElementType;
  value: number;
  unit: string;
  label: string;
  source: string;
  accent: string;
}) => {
  const { count, ref } = useCounter(value, 2000, value % 1 !== 0 ? 1 : 0);
  return (
    <div
      ref={ref}
      className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-6 ${accent}`}>
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <div className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-1">
        {value % 1 !== 0 ? count.toFixed(1) : Math.round(count)}
        <span className="text-xl sm:text-2xl text-white/40 ml-1">{unit}</span>
      </div>
      <p className="text-sm text-white/60 font-medium mt-3 mb-1">{label}</p>
      <p className="text-[10px] text-white/25 font-mono">{source}</p>
    </div>
  );
};

const Problem = () => (
  <section id="problema" className="py-28 md:py-40 px-6">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-20">
        <div className="text-[10px] uppercase tracking-[0.25em] text-blue-400/70 mb-5 font-mono">
          01 — O Problema
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
          Kubernetes cresceu.
          <br />
          <span className="text-white/30">A capacidade de operá-lo, não.</span>
        </h2>
        <p className="text-base text-white/40 leading-relaxed max-w-2xl">
          A adoção de Kubernetes no Brasil e na LATAM explodiu nos últimos três anos.
          Mas a infra de operação não acompanhou — gerando uma crise silenciosa de
          custo, disponibilidade e segurança nas empresas da região.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={AlertTriangle}
          value={70}
          unit="%"
          label="do tempo de SRE gasto em operação, não em inovação"
          source="CNCF State of K8s 2024"
          accent="bg-red-500/10 text-red-400"
        />
        <StatCard
          icon={DollarSign}
          value={32}
          unit="%"
          label="do orçamento de cloud desperdiçado em recursos ociosos"
          source="Flexera State of Cloud 2024"
          accent="bg-amber-500/10 text-amber-400"
        />
        <StatCard
          icon={Cpu}
          value={120}
          unit="K"
          label="engenheiros DevOps em falta na América Latina"
          source="IDC Workforce Report LATAM 2024"
          accent="bg-violet-500/10 text-violet-400"
        />
        <StatCard
          icon={Activity}
          value={5.6}
          unit="K/min"
          label="custo médio de downtime em produção (USD)"
          source="Gartner IT Operations 2024"
          accent="bg-blue-500/10 text-blue-400"
        />
      </div>

      <div className="mt-16 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-8 md:p-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {[
            {
              stat: "70%",
              copy: "das empresas brasileiras que adotaram K8s relatam dificuldades para manter clusters estáveis em produção.",
              source: "CNCF LATAM Survey 2024",
            },
            {
              stat: "4x",
              copy: "mais incidentes de segurança em clusters Kubernetes sem gestão dedicada vs. ambientes gerenciados.",
              source: "Red Hat K8s Security Report 2024",
            },
            {
              stat: "R$ 4.2M",
              copy: "custo médio estimado de uma hora de downtime crítico em operações financeiras digitais no Brasil.",
              source: "FGV Digital 2024",
            },
          ].map((item) => (
            <div key={item.stat} className="border-t border-white/[0.06] pt-6">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-3">{item.stat}</div>
              <p className="text-sm text-white/50 leading-relaxed mb-3">{item.copy}</p>
              <p className="text-[10px] text-white/20 font-mono">{item.source}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

/* ══════════════════════════════════════════════════
   ANIMATED SYSTEM MOCKUP
   4 cenas que ciclam: Saudável → Anomalia → Auto-heal → Resolvido+FinOps
══════════════════════════════════════════════════ */

type Scene = 0 | 1 | 2 | 3;

const SCENE_DURATION = 4500; // ms por cena

const SCENES = [
  {
    id: 0,
    label: "Monitor",
    status: "healthy",
    metrics: {
      uptime: { value: "99.9%", color: "text-emerald-400" },
      pods: { value: "248/250", color: "text-white" },
      incidents: { value: "0", color: "text-emerald-400" },
      savings: { value: "R$4.2k", color: "text-blue-400" },
    },
    logs: [
      { type: "ok", text: "All pods healthy · production-cluster" },
      { type: "ok", text: "Memory usage nominal · 62% avg" },
      { type: "ok", text: "Network latency <10ms · all nodes" },
    ],
    badge: null,
    progress: null,
    finops: null,
  },
  {
    id: 1,
    label: "Anomalia",
    status: "warning",
    metrics: {
      uptime: { value: "99.9%", color: "text-emerald-400" },
      pods: { value: "248/250", color: "text-white" },
      incidents: { value: "1", color: "text-red-400" },
      savings: { value: "R$4.2k", color: "text-blue-400" },
    },
    logs: [
      { type: "warn", text: "[AI] CPU spike detectado · api-gateway (namespace: prod)" },
      { type: "warn", text: "[AI] Root cause: connection pool não liberado após timeout" },
      { type: "info", text: "[AI] Confiança: 94% · ação recomendada: restart pod" },
    ],
    badge: { text: "⚠ Anomalia detectada", color: "bg-yellow-500/15 border-yellow-500/40 text-yellow-300" },
    progress: null,
    finops: null,
  },
  {
    id: 2,
    label: "Auto-Heal",
    status: "healing",
    metrics: {
      uptime: { value: "99.9%", color: "text-emerald-400" },
      pods: { value: "248/250", color: "text-white" },
      incidents: { value: "1", color: "text-amber-400" },
      savings: { value: "R$4.2k", color: "text-blue-400" },
    },
    logs: [
      { type: "heal", text: "[Auto-Heal] Aprovação WhatsApp recebida · Dener C." },
      { type: "heal", text: "[Auto-Heal] Reiniciando pod api-gateway-7d4f9b..." },
      { type: "info", text: "[Auto-Heal] Aguardando readiness probe..." },
    ],
    badge: { text: "⚡ Auto-healing em curso", color: "bg-violet-500/15 border-violet-500/40 text-violet-300" },
    progress: { label: "Aplicando correção", pct: 75 },
    finops: null,
  },
  {
    id: 3,
    label: "Resolvido",
    status: "resolved",
    metrics: {
      uptime: { value: "99.9%", color: "text-emerald-400" },
      pods: { value: "250/250", color: "text-emerald-400" },
      incidents: { value: "0", color: "text-emerald-400" },
      savings: { value: "R$4.2k", color: "text-blue-400" },
    },
    logs: [
      { type: "ok", text: "Incidente resolvido em 47s · SLA restaurado" },
      { type: "ok", text: "Pod api-gateway-7d4f9b · Running · Ready 1/1" },
      { type: "finops", text: "[FinOps] Detectado: 3 nodes subutilizados · economia potencial R$1.840/mês" },
    ],
    badge: { text: "✓ Resolvido em 47s", color: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" },
    progress: null,
    finops: { text: "Economia detectada · R$ 1.840/mês", action: "Ver recomendação →" },
  },
] as const;

const LOG_TYPE_COLORS: Record<string, string> = {
  ok: "text-emerald-400",
  warn: "text-yellow-400",
  heal: "text-violet-400",
  info: "text-blue-400",
  finops: "text-amber-400",
};

const AnimatedSystemMockup = () => {
  const [scene, setScene] = useState<Scene>(0);
  const [logKey, setLogKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCycle = () => {
    intervalRef.current = setInterval(() => {
      setScene((s) => {
        const next = ((s + 1) % 4) as Scene;
        setLogKey((k) => k + 1);
        return next;
      });
    }, SCENE_DURATION);
  };

  useEffect(() => {
    startCycle();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const current = SCENES[scene];
  const chartHeights = [30, 55, 40, 70, 50, 85, 65, 90, 75, 95, 80,
    scene === 1 || scene === 2 ? 100 : 60];

  const statusDot =
    current.status === "healthy" || current.status === "resolved"
      ? "bg-emerald-400"
      : current.status === "warning"
      ? "bg-yellow-400 animate-pulse"
      : "bg-violet-400 animate-pulse";

  return (
    <div className="relative w-full">
      {/* glow */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600/20 via-violet-600/10 to-cyan-500/10 blur-[80px] scale-95 rounded-3xl" />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0a0e1a] overflow-hidden shadow-2xl shadow-black/60">
        {/* window bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] bg-white/[0.015]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="w-48 h-5 rounded-md bg-white/[0.04] flex items-center px-3">
              <span className="text-[10px] text-white/25 font-mono">app.kodo.io/dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span className="text-[9px] font-mono text-white/25">{current.label}</span>
          </div>
        </div>

        {/* layout */}
        <div className="flex">
          {/* sidebar */}
          <div className="hidden sm:flex flex-col w-32 border-r border-white/[0.05] p-3 gap-0.5 flex-shrink-0">
            {["Dashboard", "Clusters", "AI Monitor", "FinOps", "Security", "Agents"].map((item, i) => (
              <div
                key={item}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors ${
                  i === 0 ? "bg-blue-500/20 text-blue-400 font-medium" : "text-white/25"
                }`}
              >
                <div className={`w-1 h-1 rounded-full flex-shrink-0 ${i === 0 ? "bg-blue-400" : "bg-white/15"}`} />
                {item}
              </div>
            ))}
          </div>

          {/* main */}
          <div className="flex-1 p-4 space-y-3 min-w-0">
            {/* metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["uptime", "pods", "incidents", "savings"] as const).map((key) => {
                const metric = current.metrics[key];
                const labels: Record<string, string> = {
                  uptime: "Uptime",
                  pods: "Pods",
                  incidents: "Incidents",
                  savings: "Savings",
                };
                return (
                  <div
                    key={key}
                    className="rounded-xl bg-white/[0.025] border border-white/[0.05] p-2.5"
                  >
                    <p className="text-[9px] text-white/30 mb-1 uppercase tracking-widest">{labels[key]}</p>
                    <p className={`text-sm font-bold tabular-nums transition-colors duration-500 ${metric.color}`}>
                      {metric.value}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* badge */}
            {current.badge && (
              <div
                className={`rounded-xl border px-3 py-2 text-[10px] font-medium ${current.badge.color}`}
                style={{ animation: "slide-up-fade 0.35s ease both" }}
              >
                {current.badge.text}
              </div>
            )}

            {/* chart */}
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 h-16 flex items-end gap-0.5 overflow-hidden">
              {chartHeights.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t origin-bottom"
                  style={{
                    height: `${h}%`,
                    background:
                      scene === 1 && i === chartHeights.length - 1
                        ? "rgba(234,179,8,0.8)"
                        : `linear-gradient(to top, rgba(59,130,246,0.7), rgba(139,92,246,0.3))`,
                    animation: `chart-bar-grow 0.4s ease ${i * 0.03}s both`,
                  }}
                />
              ))}
            </div>

            {/* progress bar (cena heal) */}
            {current.progress && (
              <div className="space-y-1.5" style={{ animation: "slide-up-fade 0.3s ease both" }}>
                <div className="flex justify-between text-[9px] text-white/30">
                  <span>{current.progress.label}</span>
                  <span>{current.progress.pct}%</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400"
                    style={{
                      width: `${current.progress.pct}%`,
                      animation: "progress-fill 1.5s ease both",
                    }}
                  />
                </div>
              </div>
            )}

            {/* logs */}
            <div className="space-y-1.5">
              {current.logs.map((log, i) => (
                <div
                  key={`${logKey}-${i}`}
                  className="flex items-start gap-2 rounded-lg bg-white/[0.015] border border-white/[0.04] px-3 py-1.5"
                  style={{ animation: `slide-up-fade 0.3s ease ${i * 0.12}s both` }}
                >
                  {log.type === "ok" ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : log.type === "warn" ? (
                    <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                  ) : log.type === "heal" ? (
                    <Zap className="w-3 h-3 text-violet-400 flex-shrink-0 mt-0.5" />
                  ) : log.type === "finops" ? (
                    <DollarSign className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Brain className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span
                    className={`text-[10px] font-mono leading-relaxed ${LOG_TYPE_COLORS[log.type] ?? "text-white/40"}`}
                  >
                    {log.text}
                  </span>
                </div>
              ))}
            </div>

            {/* finops banner (cena 3) */}
            {current.finops && (
              <div
                className="flex items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5"
                style={{ animation: "slide-up-fade 0.4s ease 0.3s both" }}
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-[10px] text-amber-300 font-medium">{current.finops.text}</span>
                </div>
                <span className="text-[9px] text-amber-400/60 flex-shrink-0">{current.finops.action}</span>
              </div>
            )}
          </div>
        </div>

        {/* scene indicator dots */}
        <div className="flex items-center justify-center gap-2 py-3 border-t border-white/[0.04]">
          {([0, 1, 2, 3] as Scene[]).map((s) => (
            <button
              key={s}
              onClick={() => { setScene(s); setLogKey((k) => k + 1); }}
              className={`rounded-full transition-all duration-300 ${
                scene === s ? "w-4 h-1.5 bg-blue-400" : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── DemoPlayer: vídeo real ou mockup animado ─── */
const getEmbedUrl = (url: string): { type: "youtube" | "loom" | "video" | null; src: string } => {
  if (!url) return { type: null, src: "" };

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    let id = "";
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") {
        id = u.pathname.slice(1);
      } else {
        id = u.searchParams.get("v") ?? u.pathname.split("/").pop() ?? "";
      }
    } catch {
      id = url.split("v=")[1]?.split("&")[0] ?? "";
    }
    return { type: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=1&rel=0` };
  }

  if (url.includes("loom.com")) {
    const id = url.split("/share/")[1]?.split("?")[0] ?? url.split("/").pop() ?? "";
    return { type: "loom", src: `https://www.loom.com/embed/${id}?autoplay=1` };
  }

  return { type: "video", src: url };
};

const DemoPlayer = () => {
  const rawUrl = (import.meta.env.VITE_DEMO_VIDEO_URL as string | undefined) ?? "";
  const { type, src } = getEmbedUrl(rawUrl.trim());

  if (!type) {
    return <AnimatedSystemMockup />;
  }

  if (type === "video") {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0a0e1a] aspect-video shadow-2xl shadow-black/60">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600/20 via-violet-600/10 to-cyan-500/10 blur-[80px]" />
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          controls
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0a0e1a] aspect-video shadow-2xl shadow-black/60">
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600/20 via-violet-600/10 to-cyan-500/10 blur-[80px]" />
      <iframe
        src={src}
        title="Kodo Demo"
        className="w-full h-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

/* ─── Demo section ─── */
const DemoSection = () => (
  <section id="demo" className="py-28 md:py-40 px-6 border-t border-white/[0.04]">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-16">
        <div className="text-[10px] uppercase tracking-[0.25em] text-blue-400/70 mb-5 font-mono">
          02 — Demo ao vivo
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
          Veja o Kodo
          <br />
          <span className="text-white/30">em ação.</span>
        </h2>
        <p className="text-base text-white/40 leading-relaxed max-w-xl">
          Da detecção de anomalia ao auto-healing aprovado via WhatsApp — em menos de
          60 segundos. Sem ticket, sem plantão, sem intervention manual.
        </p>
      </div>

      {/* scene labels */}
      <div className="flex flex-wrap gap-3 mb-8">
        {[
          { label: "01 · Monitor saudável", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.04]" },
          { label: "02 · Anomalia detectada", color: "text-yellow-400 border-yellow-500/20 bg-yellow-500/[0.04]" },
          { label: "03 · Auto-healing", color: "text-violet-400 border-violet-500/20 bg-violet-500/[0.04]" },
          { label: "04 · Resolvido + FinOps", color: "text-blue-400 border-blue-500/20 bg-blue-500/[0.04]" },
        ].map((s) => (
          <span
            key={s.label}
            className={`text-[10px] font-mono px-3 py-1 rounded-full border ${s.color}`}
          >
            {s.label}
          </span>
        ))}
      </div>

      <DemoPlayer />

      <p className="mt-4 text-[10px] text-white/20 text-center font-mono">
        simulação · dados fictícios para fins de demonstração
      </p>
    </div>
  </section>
);

/* ─── Mercado ─── */
const Market = () => (
  <section id="mercado" className="py-28 md:py-40 px-6 border-t border-white/[0.04]">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-20">
        <div className="text-[10px] uppercase tracking-[0.25em] text-blue-400/70 mb-5 font-mono">
          03 — O Mercado
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
          Um mercado de
          <br />
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            US$ 43.7 bilhões
          </span>
          <br />
          <span className="text-white/30">crescendo a 21% ao ano.</span>
        </h2>
        <p className="text-base text-white/40 leading-relaxed max-w-2xl">
          O mercado global de gestão Kubernetes é um dos segmentos de software de
          infraestrutura que mais cresce no mundo. Na LATAM, a curva é ainda mais
          acentuada — e o mercado está praticamente sem competidor local.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        {[
          {
            label: "TAM",
            sub: "Mercado Total Endereçável",
            value: "US$ 43.7B",
            detail: "Mercado global de K8s & cloud-native management até 2032",
            source: "Fortune Business Insights 2024",
            color: "border-blue-500/20 bg-blue-500/[0.04]",
            badge: "text-blue-400 bg-blue-500/10",
          },
          {
            label: "SAM",
            sub: "Mercado Endereçável Disponível",
            value: "US$ 2.1B",
            detail: "LATAM cloud-native operations até 2027 · CAGR 28%",
            source: "IDC Latin America Cloud 2024",
            color: "border-violet-500/20 bg-violet-500/[0.04]",
            badge: "text-violet-400 bg-violet-500/10",
          },
          {
            label: "SOM",
            sub: "Mercado Obtível Real",
            value: "US$ 180M",
            detail: "Brasil: 12.000+ empresas usando K8s em produção com orçamento de cloud > R$ 50k/mês",
            source: "CNCF + Análise interna Kodo",
            color: "border-emerald-500/20 bg-emerald-500/[0.04]",
            badge: "text-emerald-400 bg-emerald-500/10",
          },
        ].map((tier) => (
          <div key={tier.label} className={`rounded-2xl border p-7 ${tier.color}`}>
            <div className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full mb-4 ${tier.badge}`}>
              {tier.label}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">{tier.sub}</div>
            <div className="text-3xl sm:text-4xl font-bold text-white mb-3">{tier.value}</div>
            <p className="text-xs text-white/40 leading-relaxed mb-3">{tier.detail}</p>
            <p className="text-[10px] text-white/20 font-mono">{tier.source}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-8 md:p-12">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-8">Por que agora</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              icon: TrendingUp,
              title: "Adoção explosiva no Brasil",
              copy: "68% de crescimento YoY na adoção K8s. O Brasil é o maior mercado K8s da LATAM.",
            },
            {
              icon: Globe,
              title: "Vácuo competitivo local",
              copy: "Os players dominantes são DataDog, New Relic, Dynatrace — todos gringos, todos caros, sem foco em LATAM.",
            },
            {
              icon: Brain,
              title: "IA como diferencial",
              copy: "LLMs tornaram viável um copiloto de operação que entende Kubernetes em profundidade e atua autonomamente.",
            },
            {
              icon: BarChart3,
              title: "Pressão de FinOps",
              copy: "CFOs brasileiros exigem ROI em cloud. K8s sem otimização inteligente queima orçamento visível.",
            },
          ].map((item) => (
            <div key={item.title} className="border-t border-white/[0.06] pt-6">
              <item.icon className="w-4 h-4 text-white/30 mb-4" />
              <h3 className="text-sm font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-xs text-white/40 leading-relaxed">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

/* ─── Solução ─── */
const Solution = () => (
  <section id="solucao" className="py-28 md:py-40 px-6 border-t border-white/[0.04]">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-20">
        <div className="text-[10px] uppercase tracking-[0.25em] text-blue-400/70 mb-5 font-mono">
          04 — A Solução
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
          Kodo.
          <br />
          <span className="text-white/30">O copiloto de operação K8s</span>
          <br />
          <span className="text-white/30">nativo para LATAM.</span>
        </h2>
        <p className="text-base text-white/40 leading-relaxed max-w-2xl">
          Uma plataforma SaaS que monitora, diagnostica, auto-cura e otimiza
          clusters Kubernetes com inteligência artificial — reduzindo o custo
          operacional em até 60% e eliminando incidentes antes que cheguem à produção.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            icon: Brain,
            title: "IA Monitor",
            copy: "Detecta anomalias, CrashLoops, OOMKills e gargalos antes de impactar usuários. Root cause em linguagem natural.",
            accent: "text-blue-400",
            bg: "bg-blue-500/[0.06]",
          },
          {
            icon: Wrench,
            title: "Auto-Healing",
            copy: "Correções aplicadas automaticamente ou via aprovação WhatsApp. Sem ticket, sem plantão às 3h.",
            accent: "text-violet-400",
            bg: "bg-violet-500/[0.06]",
          },
          {
            icon: DollarSign,
            title: "FinOps Inteligente",
            copy: "Recomenda redimensionamento de nodes, PVCs e workloads. Economiza até 40% do orçamento cloud.",
            accent: "text-amber-400",
            bg: "bg-amber-500/[0.06]",
          },
          {
            icon: Shield,
            title: "Segurança Contínua",
            copy: "Análise de RBAC, Network Policies e vulnerabilidades CVE. Mitigação em tempo real.",
            accent: "text-emerald-400",
            bg: "bg-emerald-500/[0.06]",
          },
          {
            icon: Activity,
            title: "Observabilidade Unificada",
            copy: "Prometheus, Loki, eventos K8s nativos em uma tela. Sem Grafana desatualizado.",
            accent: "text-cyan-400",
            bg: "bg-cyan-500/[0.06]",
          },
          {
            icon: Zap,
            title: "Setup em 5 Minutos",
            copy: "Um comando kubectl. Sem firewall, sem VPN, sem agentes invasivos. Multi-cloud desde o primeiro dia.",
            accent: "text-rose-400",
            bg: "bg-rose-500/[0.06]",
          },
        ].map((f) => (
          <div key={f.title} className={`rounded-2xl border border-white/[0.06] ${f.bg} p-7 hover:border-white/10 transition-all`}>
            <f.icon className={`w-5 h-5 ${f.accent} mb-5`} />
            <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
            <p className="text-xs text-white/40 leading-relaxed">{f.copy}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── Modelo ─── */
const Model = () => (
  <section id="modelo" className="py-28 md:py-40 px-6 border-t border-white/[0.04]">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-20">
        <div className="text-[10px] uppercase tracking-[0.25em] text-blue-400/70 mb-5 font-mono">
          05 — Modelo de Negócio
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
          SaaS recorrente.
          <br />
          <span className="text-white/30">Expansão por cluster.</span>
        </h2>
        <p className="text-base text-white/40 leading-relaxed max-w-2xl">
          Modelo subscription por cluster com produto freemium para aquisição e
          expansão natural conforme o cliente cresce.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        {[
          {
            tier: "Free",
            price: "R$ 0",
            desc: "1 cluster · 30 dias Pro inclusos",
            items: ["Monitor básico", "3 auto-heals/mês", "Dashboard de custos", "Comunidade"],
            color: "border-white/[0.06]",
            badge: "text-white/40 bg-white/[0.04]",
          },
          {
            tier: "Pro",
            price: "R$ 490",
            desc: "por cluster / mês",
            items: ["Monitor com IA ilimitado", "Auto-heal ilimitado", "FinOps avançado", "WhatsApp alerts", "Suporte prioritário"],
            color: "border-blue-500/30 bg-blue-500/[0.04]",
            badge: "text-blue-400 bg-blue-500/10",
            highlight: true,
          },
          {
            tier: "Enterprise",
            price: "Custom",
            desc: "multi-cluster · SLA garantido",
            items: ["Tudo do Pro", "RBAC avançado", "SSO / SAML", "Compliance reports", "CSM dedicado"],
            color: "border-white/[0.06]",
            badge: "text-white/40 bg-white/[0.04]",
          },
        ].map((plan) => (
          <div key={plan.tier} className={`rounded-2xl border p-7 flex flex-col ${"highlight" in plan && plan.highlight ? "ring-1 ring-blue-500/20" : ""} ${plan.color}`}>
            <div className={`inline-block self-start text-[10px] font-bold px-2.5 py-1 rounded-full mb-4 ${plan.badge}`}>
              {plan.tier}
            </div>
            <div className="text-3xl font-bold text-white mb-1">{plan.price}</div>
            <div className="text-xs text-white/30 mb-6">{plan.desc}</div>
            <ul className="space-y-2.5 mt-auto">
              {plan.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-white/50">
                  <div className="w-1 h-1 rounded-full bg-white/30 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-8 md:p-12">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-8">Economia unitária estimada</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { v: "< R$ 80", l: "CAC estimado (PLG + outbound)", sub: "custo por aquisição" },
            { v: "> 85%", l: "Gross Margin SaaS", sub: "margem bruta" },
            { v: "24 meses", l: "LTV/CAC > 3x", sub: "payback target" },
            { v: "R$ 490→R$2.4K", l: "Expansão por upsell de clusters", sub: "net dollar retention" },
          ].map((m) => (
            <div key={m.l} className="border-t border-white/[0.06] pt-6">
              <div className="text-xl sm:text-2xl font-bold text-white mb-2">{m.v}</div>
              <div className="text-xs text-white/50 font-medium mb-1">{m.l}</div>
              <div className="text-[10px] text-white/25">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

/* ─── Visão ─── */
const Vision = () => (
  <section id="visao" className="py-28 md:py-40 px-6 border-t border-white/[0.04]">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-20">
        <div className="text-[10px] uppercase tracking-[0.25em] text-blue-400/70 mb-5 font-mono">
          06 — Visão
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
          Ser o padrão de
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">
            operação Kubernetes
          </span>
          <br />
          <span className="text-white/30">na América Latina.</span>
        </h2>
        <p className="text-base text-white/40 leading-relaxed max-w-2xl">
          Começamos no Brasil — o maior mercado de tecnologia da LATAM — com foco em
          PMEs e scale-ups que adotaram cloud-native mas não têm time de SRE sênior.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        {[
          {
            phase: "Fase 1", period: "2025", title: "Brasil",
            items: ["Product-market fit com 50 clientes pagantes", "FinOps + Auto-heal como pilares", "Canal PLG + outbound tech", "MRR alvo: R$ 150K"],
            color: "border-blue-500/20 bg-blue-500/[0.04]", badge: "text-blue-400",
          },
          {
            phase: "Fase 2", period: "2026", title: "LATAM",
            items: ["Expansão para México, Colômbia e Argentina", "Enterprise com MSPs e SIs regionais", "Compliance nativo (LGPD, NOM, Marco de Datos)", "MRR alvo: R$ 800K"],
            color: "border-violet-500/20 bg-violet-500/[0.04]", badge: "text-violet-400",
          },
          {
            phase: "Fase 3", period: "2027+", title: "Plataforma",
            items: ["Marketplace de automações K8s", "Kodo AI como serviço (API-first)", "Parcerias OEM com cloud providers", "MRR alvo: R$ 3M+"],
            color: "border-emerald-500/20 bg-emerald-500/[0.04]", badge: "text-emerald-400",
          },
        ].map((p) => (
          <div key={p.phase} className={`rounded-2xl border p-7 ${p.color}`}>
            <div className="flex items-center gap-2 mb-6">
              <span className={`text-[10px] font-bold font-mono ${p.badge}`}>{p.phase}</span>
              <span className="text-[10px] text-white/20">·</span>
              <span className="text-[10px] text-white/30">{p.period}</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-4">{p.title}</h3>
            <ul className="space-y-2.5">
              {p.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-white/45 leading-relaxed">
                  <ArrowRight className="w-3 h-3 flex-shrink-0 mt-0.5 text-white/20" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-8 md:p-12">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-8">Posicionamento competitivo</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left pb-4 text-white/30 font-normal pr-6"></th>
                {["Kodo", "DataDog", "New Relic", "Komodor"].map((h) => (
                  <th key={h} className={`text-center pb-4 font-semibold pr-6 ${h === "Kodo" ? "text-blue-400" : "text-white/30"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {[
                ["Foco em LATAM / Brasil", "✓", "✗", "✗", "✗"],
                ["Auto-healing nativo", "✓", "✗", "✗", "✓"],
                ["FinOps integrado", "✓", "parcial", "✗", "✗"],
                ["Preço acessível (< R$ 500/cluster)", "✓", "✗", "✗", "✗"],
                ["Setup < 5 minutos", "✓", "✗", "✗", "✓"],
                ["Suporte em português", "✓", "✗", "✗", "✗"],
              ].map(([feature, ...vals]) => (
                <tr key={feature}>
                  <td className="py-3 pr-6 text-white/40">{feature}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={`text-center py-3 pr-6 ${v === "✓" ? i === 0 ? "text-blue-400 font-bold" : "text-emerald-400" : v === "✗" ? "text-white/15" : "text-amber-400/60"}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
);

/* ─── Contato ─── */
const Contact = () => (
  <section className="py-28 md:py-40 px-6 border-t border-white/[0.04]">
    <div className="max-w-4xl mx-auto text-center">
      <div className="text-[10px] uppercase tracking-[0.25em] text-blue-400/70 mb-8 font-mono">
        Contato
      </div>
      <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
        Construindo o futuro
        <br />
        <span className="text-white/30">da infraestrutura na LATAM.</span>
      </h2>
      <p className="text-base text-white/40 max-w-xl mx-auto mb-14 leading-relaxed">
        Se você quer entender mais sobre o mercado, o produto ou explorar
        uma parceria — entre em contato.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
        <a
          href="mailto:contato@kodo.io"
          className="px-8 py-4 rounded-full bg-white text-[#050810] text-sm font-semibold hover:bg-white/90 transition-all inline-flex items-center justify-center gap-2 group"
        >
          Falar com a equipe
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </a>
        <Link
          to="/"
          className="px-8 py-4 rounded-full border border-white/20 text-sm text-white/60 hover:border-white/40 hover:text-white transition-all inline-flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          Ver o produto
        </Link>
      </div>
      <div className="border-t border-white/[0.06] pt-14 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left sm:text-center">
        {[
          { v: "2025", l: "Fundado em São Paulo, Brasil" },
          { v: "B2B SaaS", l: "Modelo de negócio cloud-native" },
          { v: "LATAM", l: "Foco de expansão regional" },
        ].map((s) => (
          <div key={s.v}>
            <div className="text-lg font-bold text-white mb-1">{s.v}</div>
            <div className="text-xs text-white/30">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── Page ─── */
export default function About() {
  useEffect(() => {
    document.title = "Kodo · Pitch — Kubernetes inteligente para LATAM";
  }, []);

  return (
    <div className="min-h-screen bg-[#050810] text-white antialiased overflow-x-hidden">
      <SEO
        title="Sobre o Kodo — Kubernetes inteligente para LATAM"
        description="Conheça o Kodo: a plataforma brasileira de gestão Kubernetes com IA para auto-healing, segurança, FinOps e observabilidade."
        path="/sobre"
      />
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_50%_at_50%_-5%,rgba(59,130,246,0.08),transparent)]" />
      </div>

      <Nav />

      <main>
        <Hero />
        <Problem />
        <DemoSection />
        <Market />
        <Solution />
        <Model />
        <Vision />
        <Contact />
      </main>

      <footer className="border-t border-white/[0.04] px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={kodoLogo} alt="Kodo" className="h-4 w-auto opacity-40" />
            <span className="text-[10px] text-white/20">kodo · {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <Link to="/privacidade" className="text-[10px] text-white/20 hover:text-white/40 transition-colors">
              Privacidade
            </Link>
            <Link to="/termos" className="text-[10px] text-white/20 hover:text-white/40 transition-colors">
              Termos
            </Link>
            <Link to="/auth" className="text-[10px] text-white/20 hover:text-white/40 transition-colors">
              Acessar plataforma
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
