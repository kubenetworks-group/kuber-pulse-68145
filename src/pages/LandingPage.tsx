import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import kodoLogo from "@/assets/kodo-logo.png";
import { useEffect, useState, useRef } from "react";
import {
  Shield,
  Zap,
  Brain,
  DollarSign,
  Activity,
  Wrench,
  ArrowRight,
  Check,
  Sparkles,
  Server,
  LineChart,
  BellRing,
  Upload,
  Settings,
  Play,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Menu,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ───────────── Animated counter ───────────── */
const useCounter = (end: number, duration = 2000, decimals = 0) => {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let start: number;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(parseFloat((eased * end).toFixed(decimals)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible, end, duration, decimals]);

  return { count, ref };
};

/* ───────────── Dashboard mockup ───────────── */
const DashboardMockup = () => (
  <div className="relative w-full max-w-4xl mx-auto">
    {/* Glow behind the card */}
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600/30 via-violet-600/20 to-cyan-500/20 blur-[80px] scale-90" />

    <div className="rounded-2xl border border-white/10 bg-[#0d1117]/90 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/60">
      {/* Window bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <div className="flex-1 mx-4">
          <div className="w-48 h-5 rounded-md bg-white/5 flex items-center px-3">
            <span className="text-[10px] text-white/30">app.kodo.io/dashboard</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 grid grid-cols-3 gap-3">
        {/* Sidebar */}
        <div className="col-span-1 space-y-1">
          {["Dashboard", "Clusters", "AI Monitor", "FinOps", "Security", "Agents"].map((item, i) => (
            <div
              key={item}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                i === 0
                  ? "bg-blue-500/20 text-blue-400 font-medium"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-blue-400" : "bg-white/20"}`} />
              {item}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="col-span-2 space-y-3">
          {/* Metric cards */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Uptime", value: "99.9%", color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Savings", value: "R$4.2k", color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Incidents", value: "0", color: "text-violet-400", bg: "bg-violet-500/10" },
            ].map((m) => (
              <div key={m.label} className={`rounded-lg p-2 ${m.bg} border border-white/5`}>
                <p className="text-[9px] text-white/40 mb-1">{m.label}</p>
                <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 h-20 flex items-end gap-1">
            {[30, 55, 40, 70, 50, 85, 65, 90, 75, 95, 80, 100].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t"
                style={{
                  height: `${h}%`,
                  background: `linear-gradient(to top, rgba(59,130,246,0.8), rgba(139,92,246,0.4))`,
                  opacity: 0.7 + i * 0.025,
                }}
              />
            ))}
          </div>

          {/* Alerts */}
          <div className="space-y-1.5">
            {[
              { status: "ok", msg: "All pods healthy — production-cluster", time: "now" },
              { status: "warn", msg: "CPU spike detected — auto-healing triggered", time: "2m" },
              { status: "ok", msg: "Cost anomaly resolved — saved R$320", time: "5m" },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-1.5">
                {a.status === "ok"
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  : <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                <span className="text-[10px] text-white/50 flex-1 truncate">{a.msg}</span>
                <span className="text-[9px] text-white/25">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ───────────── Data ───────────── */
const features = [
  {
    icon: Brain,
    title: "Monitor com IA",
    description: "Machine learning detecta anomalias e previne incidentes antes que afetem seus usuários.",
    accent: "from-blue-500/20 to-blue-600/5",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
    border: "hover:border-blue-500/30",
  },
  {
    icon: Shield,
    title: "Segurança",
    description: "Análise completa de RBAC, Network Policies e Pod Security. Vulnerabilidades identificadas automaticamente.",
    accent: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    border: "hover:border-emerald-500/30",
  },
  {
    icon: DollarSign,
    title: "FinOps",
    description: "Controle de custos multi-cloud com insights detalhados. Economize até 40% na sua infraestrutura.",
    accent: "from-amber-500/20 to-amber-600/5",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10",
    border: "hover:border-amber-500/30",
  },
  {
    icon: Activity,
    title: "Observabilidade",
    description: "Métricas em tempo real de CPU, memória, storage e rede. Dashboards personalizados.",
    accent: "from-violet-500/20 to-violet-600/5",
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/10",
    border: "hover:border-violet-500/30",
  },
  {
    icon: Wrench,
    title: "Auto-Healing",
    description: "Correções automáticas quando problemas são detectados — sem intervenção manual.",
    accent: "from-rose-500/20 to-rose-600/5",
    iconColor: "text-rose-400",
    iconBg: "bg-rose-500/10",
    border: "hover:border-rose-500/30",
  },
  {
    icon: Server,
    title: "Multi-Cluster",
    description: "AWS EKS, GKE, AKS e on-premises em uma única interface unificada e inteligente.",
    accent: "from-cyan-500/20 to-cyan-600/5",
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/10",
    border: "hover:border-cyan-500/30",
  },
];

const steps = [
  { n: "01", icon: Upload, title: "Conecte o Cluster", desc: "Instale o agente Kodo em menos de 5 minutos via kubectl ou Helm." },
  { n: "02", icon: Settings, title: "Configure Alertas", desc: "Defina políticas de auto-healing e thresholds personalizados." },
  { n: "03", icon: LineChart, title: "Monitore em Tempo Real", desc: "Dashboards interativos com métricas e anomalias ao vivo." },
  { n: "04", icon: BellRing, title: "Receba Insights", desc: "Notificações inteligentes antes que problemas impactem usuários." },
];

const faqs = [
  { q: "O que é o Kodo?", a: "Kodo é uma plataforma de gestão Kubernetes com inteligência artificial que oferece auto-healing automático, análise de segurança, FinOps e observabilidade em tempo real." },
  { q: "Como funciona o auto-healing?", a: "O Kodo usa IA para detectar anomalias em seus clusters e aplica correções automaticamente — reiniciando pods, escalando deployments ou ajustando recursos sem intervenção manual." },
  { q: "Funciona com qualquer cloud?", a: "Sim! Kodo é multi-cloud: AWS EKS, Google GKE, Azure AKS, DigitalOcean Kubernetes e clusters on-premises." },
  { q: "Quanto tempo leva para configurar?", a: "Menos de 5 minutos. Basta instalar nosso agente no seu cluster usando kubectl ou Helm." },
  { q: "O Kodo é seguro?", a: "Segurança é nossa prioridade. Coletamos apenas metadados e métricas de performance — nunca dados de aplicação ou secrets." },
  { q: "Como posso fazer uma demonstração?", a: "Entre em contato conosco para agendar uma demonstração personalizada da plataforma com nossa equipe." },
];


/* ───────────── Component ───────────── */
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const s1 = useCounter(99.9, 2000, 1);
  const s2 = useCounter(40, 1800);
  const s3 = useCounter(5, 1500);
  const s4 = useCounter(500, 2000);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="min-h-screen bg-[#060912] text-white overflow-x-hidden">

      {/* ── Background ── */}
      <div className="fixed inset-0 -z-10">
        {/* Radial gradient center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(59,130,246,0.15),transparent)]" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Navigation ── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-[#060912]/80 backdrop-blur-xl border-b border-white/5" : ""
        }`}
      >
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img src={kodoLogo} alt="Kodo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold tracking-tight">Kodo</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {["Recursos", "Como Funciona", "FAQ"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(" ", "-")}`}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                {item}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/60 hover:text-white hover:bg-white/5"
              >
                Entrar
              </Button>
            </Link>
            <Link to="/auth?tab=signup">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-5"
              >
                Começar agora
              </Button>
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-white/60 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#060912]/95 backdrop-blur-xl px-6 py-4 space-y-4">
            {["Recursos", "Como Funciona", "FAQ"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(" ", "-")}`}
                className="block text-sm text-white/60 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {item}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/auth" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full border-white/10 text-white/70 hover:bg-white/5">Entrar</Button>
              </Link>
              <Link to="/auth?tab=signup" onClick={() => setMenuOpen(false)}>
                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-500">Começar agora</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="relative pt-24 pb-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-4xl mx-auto mb-16">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-8">
                <Sparkles className="w-3.5 h-3.5" />
                Kubernetes com Inteligência Artificial
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
                Gerencie seus{" "}
                <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  clusters K8s
                </span>
                <br />
                sem esforço
              </h1>

              <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
                Plataforma cloud-native com IA que monitora, protege e otimiza
                seus clusters Kubernetes — com auto-healing e FinOps integrados.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/auth?tab=signup">
                  <Button
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-8 py-6 text-base font-medium shadow-xl shadow-blue-600/25 transition-all hover:shadow-blue-500/40 hover:-translate-y-0.5 group"
                  >
                    Começar agora
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="#como-funciona">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-white/60 hover:text-white hover:bg-white/5 rounded-xl px-8 py-6 text-base gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Ver como funciona
                  </Button>
                </a>
              </div>

              {/* Social proof mini */}
              <div className="flex items-center justify-center gap-6 mt-10 text-sm text-white/30">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Setup em 5 minutos
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Multi-cloud
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Suporte dedicado
                </span>
              </div>
            </div>

            {/* Dashboard mockup */}
            <DashboardMockup />
          </div>
        </section>

        {/* ═══════════════════ STATS ═══════════════════ */}
        <section className="py-20 px-6 border-y border-white/[0.04]">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { ref: s1.ref, value: `${s1.count}%`, label: "Uptime garantido", color: "text-blue-400" },
              { ref: s2.ref, value: `${s2.count}%`, label: "Economia média", color: "text-emerald-400" },
              { ref: s3.ref, value: `${s3.count} min`, label: "Setup rápido", color: "text-violet-400" },
              { ref: s4.ref, value: `${s4.count}+`, label: "Clusters gerenciados", color: "text-amber-400" },
            ].map(({ ref, value, label, color }) => (
              <div key={label} ref={ref} className="text-center">
                <div className={`text-4xl lg:text-5xl font-bold mb-2 ${color}`}>{value}</div>
                <div className="text-sm text-white/40">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════ FEATURES ═══════════════════ */}
        <section id="recursos" className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            {/* Section header */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 text-sm mb-5">
                <Cpu className="w-3.5 h-3.5" />
                Recursos
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                Tudo que você precisa para{" "}
                <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                  operar com confiança
                </span>
              </h2>
              <p className="text-white/40 text-lg max-w-xl mx-auto">
                Uma plataforma completa para simplificar e automatizar sua operação cloud-native.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f) => (
                <div
                  key={f.title}
                  className={`group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:bg-white/[0.04] ${f.border}`}
                >
                  {/* Gradient hover bg */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className="relative z-10">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${f.iconBg} mb-4`}>
                      <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                    </div>
                    <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
        <section id="como-funciona" className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 text-sm mb-5">
                <Zap className="w-3.5 h-3.5" />
                Como funciona
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                Operacional em{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  minutos
                </span>
              </h2>
              <p className="text-white/40 text-lg max-w-xl mx-auto">
                Processo simples, resultado imediato.
              </p>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Connector line */}
              <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-blue-500/30 via-violet-500/30 to-emerald-500/30" />

              {steps.map((s, i) => (
                <div key={s.n} className="relative flex flex-col items-center text-center group">
                  {/* Number circle */}
                  <div className="relative mb-6 z-10">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-violet-600/10 border border-white/10 flex flex-col items-center justify-center gap-0.5 group-hover:border-blue-500/30 transition-colors">
                      <span className="text-[10px] text-white/30 font-mono">{s.n}</span>
                      <s.icon className="w-6 h-6 text-white/70" />
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold mb-2">{s.title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed max-w-[180px]">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-14">
              <Link to="/auth">
                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-8 py-6 text-base shadow-xl shadow-blue-600/25 hover:-translate-y-0.5 transition-all group"
                >
                  Começar agora
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════ SOCIAL PROOF STRIP ═══════════════════ */}
        <section className="py-12 px-6 border-y border-white/[0.04] bg-white/[0.01]">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-sm text-white/30 mb-8 uppercase tracking-widest">Integra com as principais plataformas</p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {["AWS EKS", "Google GKE", "Azure AKS", "DigitalOcean", "Rancher", "OpenShift"].map((p) => (
                <div
                  key={p}
                  className="px-5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/40 hover:text-white/60 hover:border-white/10 transition-colors"
                >
                  {p}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ FAQ ═══════════════════ */}
        <section id="faq" className="py-24 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 text-sm mb-5">
                <Circle className="w-3.5 h-3.5" />
                FAQ
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                Perguntas{" "}
                <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  frequentes
                </span>
              </h2>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 data-[state=open]:border-white/10 data-[state=open]:bg-white/[0.04] transition-all"
                >
                  <AccordionTrigger className="text-left hover:no-underline py-5 text-sm font-medium text-white/80 hover:text-white">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-white/40 pb-5 leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ═══════════════════ FINAL CTA ═══════════════════ */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-blue-950/60 via-[#0d1117] to-violet-950/40 p-16 text-center">
              {/* Glow */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 bg-blue-600/20 blur-[80px] rounded-full" />
              {/* Grid */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              <div className="relative z-10">
                <div className="inline-flex w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 items-center justify-center mb-6">
                  <Zap className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">
                  Pronto para transformar<br />sua operação?
                </h2>
                <p className="text-white/40 text-lg mb-10 max-w-xl mx-auto">
                  Junte-se a centenas de empresas que já automatizaram sua gestão Kubernetes com IA.
                </p>
                <Link to="/auth">
                  <Button
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-10 py-6 text-base font-medium shadow-2xl shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all group"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Começar agora
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <p className="mt-6 text-sm text-white/25">
                  Setup em 5 min · Multi-cloud · Suporte dedicado
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
