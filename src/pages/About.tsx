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
  MapPin,
} from "lucide-react";
import kodoLogo from "@/assets/kodo-logo.png";

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

const NAV_LINKS = [
  { label: "Problema", href: "#problema" },
  { label: "Mercado", href: "#mercado" },
  { label: "Solução", href: "#solucao" },
  { label: "Demo", href: "#demo" },
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
          ? "bg-white/90 backdrop-blur-2xl border-b border-[#0F3CA5]/10 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={kodoLogo} alt="Kodo" className="h-6 w-auto" />
          <span className="text-sm font-semibold tracking-tight text-[#1A1A1A]">kodo</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[11px] uppercase tracking-[0.15em] text-[#6B6B6B] hover:text-[#0F3CA5] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          href="mailto:suporte@kubenetworks.com.br"
          className="hidden md:inline-flex text-[11px] px-4 py-2 rounded-full border border-[#0F3CA5]/30 text-[#0F3CA5] hover:bg-[#0F3CA5] hover:text-white transition-all"
        >
          Falar com a equipe
        </a>

        <button className="md:hidden text-[#1A1A1A]/60" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-white/98 backdrop-blur-2xl border-t border-[#0F3CA5]/10 px-6 py-6 flex flex-col gap-5">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-xs uppercase tracking-[0.15em] text-[#6B6B6B] hover:text-[#0F3CA5]"
            >
              {l.label}
            </a>
          ))}
          <a
            href="mailto:suporte@kubenetworks.com.br"
            className="mt-2 text-center text-sm py-2.5 rounded-full border border-[#0F3CA5]/30 text-[#0F3CA5]"
          >
            Falar com a equipe
          </a>
        </div>
      )}
    </header>
  );
};

const Hero = () => (
  <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden bg-[#F0F4FA]">
    <div
      className="absolute inset-0 opacity-[0.4]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(15,60,165,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,60,165,0.06) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    />
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#0F3CA5]/8 blur-[120px] rounded-full pointer-events-none" />
    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-[#577DB2]/10 blur-[100px] rounded-full pointer-events-none" />
    <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-[#0A5B93]/6 blur-[80px] rounded-full pointer-events-none" />

    <div className="relative z-10 max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F3CA5]/8 border border-[#0F3CA5]/15 text-[#0F3CA5] text-[10px] uppercase tracking-[0.2em] mb-10">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0F3CA5] animate-pulse" />
        Pitch — Kodo · 2025
      </div>

      <div className="flex items-center justify-center gap-5 sm:gap-7 mb-8">
        <img
          src={kodoLogo}
          alt="Kodo"
          className="h-16 sm:h-20 lg:h-28 w-auto drop-shadow-sm"
        />
        <div className="w-px self-stretch bg-[#0F3CA5]/15 hidden sm:block" />
        <h1 className="text-left text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight leading-[1.0] text-[#1A1A1A]">
          Kubernetes{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #0F3CA5, #0A5B93, #577DB2)" }}
          >
            inteligente
          </span>
          <br />
          para um mercado
          <br />
          que não pode errar.
        </h1>
      </div>

      <p className="text-lg sm:text-xl text-[#6B6B6B] max-w-2xl mx-auto leading-relaxed font-light">
        O Brasil e a LATAM adotaram Kubernetes em escala — sem a infraestrutura
        de operação para sustentá-lo. Kodo resolve isso com IA.
      </p>

      <div className="mt-12 flex flex-wrap justify-center gap-12 text-center">
        {[
          { v: "43.7B", s: "USD", l: "mercado global K8s até 2032" },
          { v: "28%", s: "CAGR", l: "crescimento K8s na LATAM" },
          { v: "120K", s: "déficit", l: "engenheiros DevOps na LATAM" },
        ].map((d) => (
          <div key={d.l} className="flex flex-col items-center gap-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-bold text-[#1A1A1A] tracking-tight">{d.v}</span>
              <span className="text-xs text-[#0F3CA5] font-mono">{d.s}</span>
            </div>
            <span className="text-[11px] text-[#9B9B9B] max-w-[120px] leading-tight">{d.l}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#9B9B9B]">
      <span className="text-[9px] uppercase tracking-widest">scroll</span>
      <div className="w-px h-8 bg-gradient-to-b from-[#0F3CA5]/30 to-transparent" />
    </div>
  </section>
);

const StatCard = ({
  icon: Icon,
  value,
  unit,
  label,
  source,
  accent,
  accentBg,
}: {
  icon: React.ElementType;
  value: number;
  unit: string;
  label: string;
  source: string;
  accent: string;
  accentBg: string;
}) => {
  const { count, ref } = useCounter(value, 2000, value % 1 !== 0 ? 1 : 0);
  return (
    <div
      ref={ref}
      className="group relative rounded-2xl border border-[#E4EAF5] bg-white p-7 hover:border-[#0F3CA5]/20 hover:shadow-lg transition-all duration-300 shadow-sm"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-6 ${accentBg}`}>
        <Icon className={`w-[18px] h-[18px] ${accent}`} />
      </div>
      <div className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1A1A1A] mb-1">
        {value % 1 !== 0 ? count.toFixed(1) : Math.round(count)}
        <span className="text-xl sm:text-2xl text-[#9B9B9B] ml-1">{unit}</span>
      </div>
      <p className="text-sm text-[#333333] font-medium mt-3 mb-1">{label}</p>
      <p className="text-[10px] text-[#9B9B9B] font-mono">{source}</p>
    </div>
  );
};

const Problem = () => (
  <section id="problema" className="py-28 md:py-40 px-6 bg-white">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-20">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#0F3CA5] mb-5 font-mono">
          01 — O Problema
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6 text-[#1A1A1A]">
          Kubernetes cresceu.
          <br />
          <span className="text-[#9B9B9B]">A capacidade de operá-lo, não.</span>
        </h2>
        <p className="text-base text-[#6B6B6B] leading-relaxed max-w-2xl">
          A adoção de Kubernetes no Brasil e na LATAM explodiu nos últimos três anos.
          Mais de 60% das empresas tech de médio e grande porte já rodam workloads em K8s —
          mas a infraestrutura de operação não acompanhou, gerando uma crise silenciosa de
          custo, disponibilidade e segurança na região.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={AlertTriangle}
          value={70}
          unit="%"
          label="do tempo de SRE gasto em operação, não em inovação"
          source="CNCF State of K8s 2024"
          accent="text-red-500"
          accentBg="bg-red-50"
        />
        <StatCard
          icon={DollarSign}
          value={32}
          unit="%"
          label="do orçamento de cloud desperdiçado em recursos ociosos"
          source="Flexera State of Cloud 2024"
          accent="text-amber-600"
          accentBg="bg-amber-50"
        />
        <StatCard
          icon={Cpu}
          value={120}
          unit="K"
          label="engenheiros DevOps em falta na América Latina"
          source="IDC Workforce Report LATAM 2024"
          accent="text-[#0F3CA5]"
          accentBg="bg-[#E6EEF8]"
        />
        <StatCard
          icon={Activity}
          value={5.6}
          unit="K/min"
          label="custo médio de downtime em produção (USD)"
          source="Gartner IT Operations 2024"
          accent="text-[#0A5B93]"
          accentBg="bg-[#E6EEF8]"
        />
      </div>

      <div className="mt-16 rounded-2xl border border-[#E4EAF5] bg-[#F0F4FA] p-8 md:p-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {[
            {
              stat: "70%",
              copy: "das empresas brasileiras que adotaram K8s relatam dificuldades para manter clusters estáveis em produção.",
              source: "CNCF LATAM Survey 2024",
              color: "text-red-500",
            },
            {
              stat: "4x",
              copy: "mais incidentes de segurança em clusters Kubernetes sem gestão dedicada vs. ambientes gerenciados.",
              source: "Red Hat K8s Security Report 2024",
              color: "text-amber-600",
            },
            {
              stat: "R$ 4.2M",
              copy: "custo médio estimado de uma hora de downtime crítico em operações financeiras digitais no Brasil.",
              source: "FGV Digital 2024",
              color: "text-[#0F3CA5]",
            },
          ].map((item) => (
            <div key={item.stat} className="border-t border-[#E4EAF5] pt-6">
              <div className={`text-3xl sm:text-4xl font-bold mb-3 ${item.color}`}>{item.stat}</div>
              <p className="text-sm text-[#6B6B6B] leading-relaxed mb-3">{item.copy}</p>
              <p className="text-[10px] text-[#9B9B9B] font-mono">{item.source}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const Market = () => (
  <section id="mercado" className="py-28 md:py-40 px-6 bg-[#F0F4FA] border-t border-[#E4EAF5]">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-20">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#0F3CA5] mb-5 font-mono">
          02 — O Mercado
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6 text-[#1A1A1A]">
          Um mercado de
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #0F3CA5, #0A5B93)" }}
          >
            US$ 43.7 bilhões
          </span>
          <br />
          <span className="text-[#9B9B9B]">crescendo a 21% ao ano.</span>
        </h2>
        <p className="text-base text-[#6B6B6B] leading-relaxed max-w-2xl">
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
            detail: "Mercado global de K8s e cloud-native management até 2032, CAGR de 21%",
            source: "Fortune Business Insights 2024",
            border: "border-[#0F3CA5]/20",
            bg: "bg-white",
            badge: "text-[#0F3CA5] bg-[#E6EEF8]",
          },
          {
            label: "SAM",
            sub: "Mercado Endereçável Disponível",
            value: "US$ 2.1B",
            detail: "LATAM cloud-native operations até 2027, CAGR 28% — maior crescimento regional do mundo",
            source: "IDC Latin America Cloud 2024",
            border: "border-[#0A5B93]/20",
            bg: "bg-white",
            badge: "text-[#0A5B93] bg-[#E6EEF8]",
          },
          {
            label: "SOM",
            sub: "Mercado Obtível Real",
            value: "US$ 180M",
            detail: "Brasil: 12.000+ empresas usando K8s em produção com orçamento de cloud acima de R$ 50k/mês",
            source: "CNCF + Análise interna Kodo",
            border: "border-emerald-200",
            bg: "bg-white",
            badge: "text-emerald-700 bg-emerald-50",
          },
        ].map((tier) => (
          <div key={tier.label} className={`rounded-2xl border p-7 ${tier.border} ${tier.bg} shadow-sm hover:shadow-md transition-shadow`}>
            <div className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full mb-4 ${tier.badge}`}>
              {tier.label}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[#9B9B9B] mb-2">{tier.sub}</div>
            <div className="text-3xl sm:text-4xl font-bold text-[#1A1A1A] mb-3">{tier.value}</div>
            <p className="text-xs text-[#6B6B6B] leading-relaxed mb-3">{tier.detail}</p>
            <p className="text-[10px] text-[#9B9B9B] font-mono">{tier.source}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        <div className="rounded-2xl border border-[#E4EAF5] bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#E6EEF8] flex items-center justify-center">
              <Globe className="w-4 h-4 text-[#0F3CA5]" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#9B9B9B] mb-0.5">Brasil</div>
              <div className="text-sm font-semibold text-[#1A1A1A]">Maior mercado K8s da LATAM</div>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { label: "Adoção YoY de Kubernetes", value: "68%", bar: 68 },
              { label: "Empresas tech usando K8s em produção", value: "60%+", bar: 60 },
              { label: "Crescimento do mercado cloud até 2027", value: "CAGR 22%", bar: 44 },
              { label: "Déficit de profissionais DevOps/SRE", value: "85K vagas", bar: 85 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-[#6B6B6B]">{item.label}</span>
                  <span className="font-semibold text-[#0F3CA5]">{item.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#E6EEF8] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${item.bar}%`,
                      background: "linear-gradient(90deg, #0F3CA5, #577DB2)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#9B9B9B] font-mono mt-5">CNCF LATAM Survey 2024 · IDC Brasil</p>
        </div>

        <div className="rounded-2xl border border-[#E4EAF5] bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#E6EEF8] flex items-center justify-center">
              <MapPin className="w-4 h-4 text-[#0F3CA5]" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#9B9B9B] mb-0.5">São Paulo</div>
              <div className="text-sm font-semibold text-[#1A1A1A]">Hub tech da América Latina</div>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { v: "65%", l: "das empresas tech brasileiras têm sede em São Paulo" },
              { v: "3.200+", l: "startups de tecnologia ativas na Grande São Paulo" },
              { v: "R$ 2.8B", l: "investido em cloud e infra tech em SP em 2024" },
              { v: "Faria Lima", l: "maior concentração de fintechs K8s-first do Brasil" },
            ].map((item) => (
              <div key={item.l} className="flex items-start gap-3 py-2 border-b border-[#F0F4FA] last:border-0">
                <span className="text-sm font-bold text-[#0F3CA5] min-w-[60px]">{item.v}</span>
                <span className="text-xs text-[#6B6B6B] leading-relaxed">{item.l}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#9B9B9B] font-mono mt-4">FIPE · ABStartups · Distrito 2024</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E4EAF5] bg-white p-8 md:p-12 shadow-sm">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#9B9B9B] mb-8">Por que agora</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              icon: TrendingUp,
              title: "Adoção explosiva no Brasil",
              copy: "68% de crescimento YoY na adoção K8s. O Brasil é o maior mercado K8s da LATAM com 60%+ das empresas tech já em produção.",
            },
            {
              icon: Globe,
              title: "Vácuo competitivo local",
              copy: "Os players dominantes são DataDog, New Relic, Dynatrace — todos internacionais, todos caros, sem foco em LATAM nem suporte em português.",
            },
            {
              icon: Brain,
              title: "IA como diferencial",
              copy: "LLMs tornaram viável um copiloto de operação que entende Kubernetes em profundidade e atua autonomamente — sem precisar de time SRE dedicado.",
            },
            {
              icon: BarChart3,
              title: "Pressão de FinOps",
              copy: "CFOs brasileiros exigem ROI em cloud. K8s sem otimização inteligente queima orçamento visível — 32% desperdiçado em média.",
            },
          ].map((item) => (
            <div key={item.title} className="border-t border-[#E4EAF5] pt-6">
              <item.icon className="w-4 h-4 text-[#0F3CA5]/50 mb-4" />
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-2">{item.title}</h3>
              <p className="text-xs text-[#6B6B6B] leading-relaxed">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const Solution = () => (
  <section id="solucao" className="py-28 md:py-40 px-6 bg-white border-t border-[#E4EAF5]">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-20">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#0F3CA5] mb-5 font-mono">
          03 — A Solução
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6 text-[#1A1A1A]">
          Kodo.
          <br />
          <span className="text-[#9B9B9B]">O copiloto de operação K8s</span>
          <br />
          <span className="text-[#9B9B9B]">nativo para LATAM.</span>
        </h2>
        <p className="text-base text-[#6B6B6B] leading-relaxed max-w-2xl">
          Uma plataforma SaaS que monitora, diagnostica, auto-cura e otimiza
          clusters Kubernetes com inteligência artificial — reduzindo o custo
          operacional em até 60% e eliminando incidentes antes que cheguem à produção.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
        {[
          {
            icon: Brain,
            title: "IA Monitor",
            copy: "Detecta anomalias, CrashLoops, OOMKills e gargalos antes de impactar usuários. Root cause em linguagem natural — sem precisar abrir terminal.",
            accent: "text-[#0F3CA5]",
            bg: "bg-[#E6EEF8]",
            border: "border-[#0F3CA5]/15",
          },
          {
            icon: Wrench,
            title: "Auto-Healing",
            copy: "Correções aplicadas automaticamente ou via aprovação WhatsApp. Sem ticket, sem plantão às 3h, sem depender de engenheiro sênior de prontidão.",
            accent: "text-[#0A5B93]",
            bg: "bg-[#E6EEF8]",
            border: "border-[#0A5B93]/15",
          },
          {
            icon: DollarSign,
            title: "FinOps Inteligente",
            copy: "Recomenda redimensionamento de nodes, PVCs e workloads em tempo real. Economiza até 40% do orçamento cloud com ações práticas e mensuráveis.",
            accent: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-200",
          },
          {
            icon: Shield,
            title: "Segurança Contínua",
            copy: "Análise de RBAC, Network Policies e vulnerabilidades CVE. Mitigação em tempo real com priorização por risco e impacto no negócio.",
            accent: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-200",
          },
          {
            icon: Activity,
            title: "Observabilidade Unificada",
            copy: "Prometheus, Loki, eventos K8s nativos em uma única tela. Contexto completo do cluster sem precisar de Grafana desatualizado ou ferramentas desconexas.",
            accent: "text-[#0F3CA5]",
            bg: "bg-[#E6EEF8]",
            border: "border-[#0F3CA5]/15",
          },
          {
            icon: Zap,
            title: "Setup em 5 Minutos",
            copy: "Um único comando kubectl. Sem firewall, sem VPN, sem agentes invasivos. Multi-cloud desde o primeiro dia — EKS, GKE, AKS e bare metal.",
            accent: "text-red-500",
            bg: "bg-red-50",
            border: "border-red-200",
          },
        ].map((f) => (
          <div key={f.title} className={`rounded-2xl border ${f.border} bg-white p-7 hover:shadow-md transition-all duration-300 shadow-sm group`}>
            <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-5`}>
              <f.icon className={`w-5 h-5 ${f.accent}`} />
            </div>
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-2">{f.title}</h3>
            <p className="text-xs text-[#6B6B6B] leading-relaxed">{f.copy}</p>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-8 md:p-12 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F3CA5 0%, #1C2F45 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/5 blur-[80px] rounded-full" />
        <div className="relative z-10">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-8">Pipeline de valor Kodo</div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-0">
            {[
              { step: "01", label: "Agente instala", sub: "kubectl apply — 5 min" },
              { step: "02", label: "IA monitora", sub: "Tempo real, 24/7" },
              { step: "03", label: "Anomalia detectada", sub: "Root cause automático" },
              { step: "04", label: "Auto-heal ou aprovação", sub: "WhatsApp em 1 clique" },
              { step: "05", label: "FinOps otimiza", sub: "Economia contínua" },
            ].map((s, i, arr) => (
              <div key={s.step} className="flex items-center gap-0 flex-1 w-full md:w-auto">
                <div className="flex flex-col items-center md:items-start gap-1 px-4 md:px-5 flex-1">
                  <span className="text-[9px] font-mono text-white/40">{s.step}</span>
                  <span className="text-sm font-semibold text-white">{s.label}</span>
                  <span className="text-[10px] text-white/50">{s.sub}</span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-white/20 flex-shrink-0 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

type Scene = 0 | 1 | 2 | 3;

const SCENE_DURATION = 4500;

const SCENES = [
  {
    id: 0,
    label: "Monitor",
    status: "healthy",
    metrics: {
      uptime: { value: "99.9%", color: "text-emerald-600" },
      pods: { value: "248/250", color: "text-[#1A1A1A]" },
      incidents: { value: "0", color: "text-emerald-600" },
      savings: { value: "R$4.2k", color: "text-[#0F3CA5]" },
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
      uptime: { value: "99.9%", color: "text-emerald-600" },
      pods: { value: "248/250", color: "text-[#1A1A1A]" },
      incidents: { value: "1", color: "text-red-500" },
      savings: { value: "R$4.2k", color: "text-[#0F3CA5]" },
    },
    logs: [
      { type: "warn", text: "[AI] CPU spike detectado · api-gateway (namespace: prod)" },
      { type: "warn", text: "[AI] Root cause: connection pool não liberado após timeout" },
      { type: "info", text: "[AI] Confiança: 94% · ação recomendada: restart pod" },
    ],
    badge: { text: "Anomalia detectada", color: "bg-amber-50 border-amber-200 text-amber-700" },
    progress: null,
    finops: null,
  },
  {
    id: 2,
    label: "Auto-Heal",
    status: "healing",
    metrics: {
      uptime: { value: "99.9%", color: "text-emerald-600" },
      pods: { value: "248/250", color: "text-[#1A1A1A]" },
      incidents: { value: "1", color: "text-amber-600" },
      savings: { value: "R$4.2k", color: "text-[#0F3CA5]" },
    },
    logs: [
      { type: "heal", text: "[Auto-Heal] Aprovação WhatsApp recebida · Dener C." },
      { type: "heal", text: "[Auto-Heal] Reiniciando pod api-gateway-7d4f9b..." },
      { type: "info", text: "[Auto-Heal] Aguardando readiness probe..." },
    ],
    badge: { text: "Auto-healing em curso", color: "bg-[#E6EEF8] border-[#0F3CA5]/20 text-[#0F3CA5]" },
    progress: { label: "Aplicando correção", pct: 75 },
    finops: null,
  },
  {
    id: 3,
    label: "Resolvido",
    status: "resolved",
    metrics: {
      uptime: { value: "99.9%", color: "text-emerald-600" },
      pods: { value: "250/250", color: "text-emerald-600" },
      incidents: { value: "0", color: "text-emerald-600" },
      savings: { value: "R$4.2k", color: "text-[#0F3CA5]" },
    },
    logs: [
      { type: "ok", text: "Incidente resolvido em 47s · SLA restaurado" },
      { type: "ok", text: "Pod api-gateway-7d4f9b · Running · Ready 1/1" },
      { type: "finops", text: "[FinOps] Detectado: 3 nodes subutilizados · economia potencial R$1.840/mês" },
    ],
    badge: { text: "Resolvido em 47s", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    progress: null,
    finops: { text: "Economia detectada · R$ 1.840/mês", action: "Ver recomendação" },
  },
] as const;

const LOG_TYPE_COLORS: Record<string, string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  heal: "text-[#0F3CA5]",
  info: "text-[#0A5B93]",
  finops: "text-amber-600",
};

const AnimatedSystemMockup = () => {
  const [scene, setScene] = useState<Scene>(0);
  const [logKey, setLogKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setScene((s) => {
        const next = ((s + 1) % 4) as Scene;
        setLogKey((k) => k + 1);
        return next;
      });
    }, SCENE_DURATION);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const current = SCENES[scene];
  const chartHeights = [30, 55, 40, 70, 50, 85, 65, 90, 75, 95, 80,
    scene === 1 || scene === 2 ? 100 : 60];

  const statusDot =
    current.status === "healthy" || current.status === "resolved"
      ? "bg-emerald-500"
      : current.status === "warning"
      ? "bg-amber-500 animate-pulse"
      : "bg-[#0F3CA5] animate-pulse";

  return (
    <div className="relative w-full">
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0F3CA5]/10 via-[#0A5B93]/5 to-[#577DB2]/8 blur-[80px] scale-95 rounded-3xl" />

      <div className="rounded-2xl border border-[#E4EAF5] bg-white overflow-hidden shadow-xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F0F4FA] bg-[#F8FAFC]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/70" />
            <div className="w-3 h-3 rounded-full bg-amber-400/70" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/70" />
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="w-48 h-5 rounded-md bg-[#F0F4FA] flex items-center px-3">
              <span className="text-[10px] text-[#9B9B9B] font-mono">app.kodo.io/dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span className="text-[9px] font-mono text-[#9B9B9B]">{current.label}</span>
          </div>
        </div>

        <div className="flex">
          <div className="hidden sm:flex flex-col w-32 border-r border-[#F0F4FA] p-3 gap-0.5 flex-shrink-0">
            {["Dashboard", "Clusters", "AI Monitor", "FinOps", "Security", "Agents"].map((item, i) => (
              <div
                key={item}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors ${
                  i === 0 ? "bg-[#E6EEF8] text-[#0F3CA5] font-medium" : "text-[#9B9B9B]"
                }`}
              >
                <div className={`w-1 h-1 rounded-full flex-shrink-0 ${i === 0 ? "bg-[#0F3CA5]" : "bg-[#E4EAF5]"}`} />
                {item}
              </div>
            ))}
          </div>

          <div className="flex-1 p-4 space-y-3 min-w-0">
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
                    className="rounded-xl bg-[#F8FAFC] border border-[#F0F4FA] p-2.5"
                  >
                    <p className="text-[9px] text-[#9B9B9B] mb-1 uppercase tracking-widest">{labels[key]}</p>
                    <p className={`text-sm font-bold tabular-nums transition-colors duration-500 ${metric.color}`}>
                      {metric.value}
                    </p>
                  </div>
                );
              })}
            </div>

            {current.badge && (
              <div
                className={`rounded-xl border px-3 py-2 text-[10px] font-medium ${current.badge.color}`}
                style={{ animation: "slide-up-fade 0.35s ease both" }}
              >
                {current.badge.text}
              </div>
            )}

            <div className="rounded-xl bg-[#F8FAFC] border border-[#F0F4FA] p-3 h-16 flex items-end gap-0.5 overflow-hidden">
              {chartHeights.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t origin-bottom"
                  style={{
                    height: `${h}%`,
                    background:
                      scene === 1 && i === chartHeights.length - 1
                        ? "rgba(217,119,6,0.7)"
                        : `linear-gradient(to top, rgba(15,60,165,0.7), rgba(87,125,178,0.3))`,
                    animation: `chart-bar-grow 0.4s ease ${i * 0.03}s both`,
                  }}
                />
              ))}
            </div>

            {current.progress && (
              <div className="space-y-1.5" style={{ animation: "slide-up-fade 0.3s ease both" }}>
                <div className="flex justify-between text-[9px] text-[#9B9B9B]">
                  <span>{current.progress.label}</span>
                  <span>{current.progress.pct}%</span>
                </div>
                <div className="h-1 rounded-full bg-[#E6EEF8] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${current.progress.pct}%`,
                      background: "linear-gradient(90deg, #0F3CA5, #577DB2)",
                      animation: "progress-fill 1.5s ease both",
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {current.logs.map((log: { type: string; text: string }, i: number) => (
                <div
                  key={`${logKey}-${i}`}
                  className="flex items-start gap-2 rounded-lg bg-[#F8FAFC] border border-[#F0F4FA] px-3 py-1.5"
                  style={{ animation: `slide-up-fade 0.3s ease ${i * 0.12}s both` }}
                >
                  {log.type === "ok" ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : log.type === "warn" ? (
                    <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                  ) : log.type === "heal" ? (
                    <Zap className="w-3 h-3 text-[#0F3CA5] flex-shrink-0 mt-0.5" />
                  ) : log.type === "finops" ? (
                    <DollarSign className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Brain className="w-3 h-3 text-[#0F3CA5] flex-shrink-0 mt-0.5" />
                  )}
                  <span
                    className={`text-[10px] font-mono leading-relaxed ${LOG_TYPE_COLORS[log.type] ?? "text-[#6B6B6B]"}`}
                  >
                    {log.text}
                  </span>
                </div>
              ))}
            </div>

            {current.finops && (
              <div
                className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
                style={{ animation: "slide-up-fade 0.4s ease 0.3s both" }}
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span className="text-[10px] text-amber-700 font-medium">{current.finops.text}</span>
                </div>
                <span className="text-[9px] text-amber-600/70 flex-shrink-0">{current.finops.action}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 py-3 border-t border-[#F0F4FA]">
          {([0, 1, 2, 3] as Scene[]).map((s) => (
            <button
              key={s}
              onClick={() => { setScene(s); setLogKey((k) => k + 1); }}
              className={`rounded-full transition-all duration-300 ${
                scene === s ? "w-4 h-1.5 bg-[#0F3CA5]" : "w-1.5 h-1.5 bg-[#E4EAF5] hover:bg-[#577DB2]/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

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

  if (!type) return <AnimatedSystemMockup />;

  if (type === "video") {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-[#E4EAF5] bg-white aspect-video shadow-xl">
        <video src={src} autoPlay muted loop playsInline controls className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#E4EAF5] bg-white aspect-video shadow-xl">
      <iframe src={src} title="Kodo Demo" className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
    </div>
  );
};

const DemoSection = () => (
  <section id="demo" className="py-28 md:py-40 px-6 bg-[#F0F4FA] border-t border-[#E4EAF5]">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-16">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#0F3CA5] mb-5 font-mono">
          04 — Demo ao vivo
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6 text-[#1A1A1A]">
          Veja o Kodo
          <br />
          <span className="text-[#9B9B9B]">em ação.</span>
        </h2>
        <p className="text-base text-[#6B6B6B] leading-relaxed max-w-xl">
          Da detecção de anomalia ao auto-healing aprovado via WhatsApp — em menos de
          60 segundos. Sem ticket, sem plantão, sem intervenção manual.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        {[
          { label: "01 · Monitor saudável", color: "text-emerald-700 border-emerald-200 bg-emerald-50" },
          { label: "02 · Anomalia detectada", color: "text-amber-700 border-amber-200 bg-amber-50" },
          { label: "03 · Auto-healing", color: "text-[#0F3CA5] border-[#0F3CA5]/20 bg-[#E6EEF8]" },
          { label: "04 · Resolvido + FinOps", color: "text-[#0A5B93] border-[#0A5B93]/20 bg-[#E6EEF8]" },
        ].map((s) => (
          <span key={s.label} className={`text-[10px] font-mono px-3 py-1 rounded-full border ${s.color}`}>
            {s.label}
          </span>
        ))}
      </div>

      <DemoPlayer />

      <p className="mt-4 text-[10px] text-[#9B9B9B] text-center font-mono">
        simulação · dados fictícios para fins de demonstração
      </p>
    </div>
  </section>
);

const Model = () => (
  <section id="modelo" className="py-28 md:py-40 px-6 bg-white border-t border-[#E4EAF5]">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-20">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#0F3CA5] mb-5 font-mono">
          05 — Modelo de Negócio
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6 text-[#1A1A1A]">
          SaaS recorrente.
          <br />
          <span className="text-[#9B9B9B]">Expansão por cluster.</span>
        </h2>
        <p className="text-base text-[#6B6B6B] leading-relaxed max-w-2xl">
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
            items: ["Monitor básico", "3 auto-heals por mês", "Dashboard de custos", "Comunidade"],
            border: "border-[#E4EAF5]",
            badge: "text-[#6B6B6B] bg-[#F0F4FA]",
            highlight: false,
          },
          {
            tier: "Pro",
            price: "R$ 490",
            desc: "por cluster / mês",
            items: ["Monitor com IA ilimitado", "Auto-heal ilimitado", "FinOps avançado", "WhatsApp alerts", "Suporte prioritário"],
            border: "border-[#0F3CA5]/30",
            badge: "text-[#0F3CA5] bg-[#E6EEF8]",
            highlight: true,
          },
          {
            tier: "Enterprise",
            price: "Custom",
            desc: "multi-cluster · SLA garantido",
            items: ["Tudo do Pro", "RBAC avançado", "SSO e SAML", "Compliance reports", "CSM dedicado"],
            border: "border-[#E4EAF5]",
            badge: "text-[#6B6B6B] bg-[#F0F4FA]",
            highlight: false,
          },
        ].map((plan) => (
          <div
            key={plan.tier}
            className={`rounded-2xl border p-7 flex flex-col shadow-sm ${plan.highlight ? "ring-2 ring-[#0F3CA5]/20 shadow-[#0F3CA5]/5 shadow-lg" : ""} ${plan.border} bg-white`}
          >
            <div className={`inline-block self-start text-[10px] font-bold px-2.5 py-1 rounded-full mb-4 ${plan.badge}`}>
              {plan.tier}
            </div>
            <div className="text-3xl font-bold text-[#1A1A1A] mb-1">{plan.price}</div>
            <div className="text-xs text-[#9B9B9B] mb-6">{plan.desc}</div>
            <ul className="space-y-2.5 mt-auto">
              {plan.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-[#6B6B6B]">
                  <div className="w-1 h-1 rounded-full bg-[#0F3CA5]/40 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#E4EAF5] bg-[#F0F4FA] p-8 md:p-12">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#9B9B9B] mb-8">Economia unitária estimada</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { v: "menos de R$ 80", l: "CAC estimado (PLG + outbound)", sub: "custo por aquisição" },
            { v: "mais de 85%", l: "Gross Margin SaaS", sub: "margem bruta" },
            { v: "24 meses", l: "LTV/CAC acima de 3x", sub: "payback target" },
            { v: "R$ 490 a R$ 2.4K", l: "Expansão por upsell de clusters", sub: "net dollar retention" },
          ].map((m) => (
            <div key={m.l} className="border-t border-[#E4EAF5] pt-6">
              <div className="text-xl sm:text-2xl font-bold text-[#1A1A1A] mb-2">{m.v}</div>
              <div className="text-xs text-[#333333] font-medium mb-1">{m.l}</div>
              <div className="text-[10px] text-[#9B9B9B]">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const Vision = () => (
  <section id="visao" className="py-28 md:py-40 px-6 bg-[#F0F4FA] border-t border-[#E4EAF5]">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mb-20">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#0F3CA5] mb-5 font-mono">
          06 — Visão
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6 text-[#1A1A1A]">
          Ser o padrão de
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #0F3CA5, #0A5B93, #577DB2)" }}
          >
            operação Kubernetes
          </span>
          <br />
          <span className="text-[#9B9B9B]">na América Latina.</span>
        </h2>
        <p className="text-base text-[#6B6B6B] leading-relaxed max-w-2xl">
          Começamos em São Paulo — o maior hub tech da LATAM — com foco em
          PMEs e scale-ups que adotaram cloud-native mas não têm time de SRE sênior.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        {[
          {
            phase: "Fase 1", period: "2025", title: "Brasil",
            items: ["Product-market fit com 50 clientes pagantes", "FinOps + Auto-heal como pilares", "Canal PLG + outbound tech", "MRR alvo: R$ 150K"],
            border: "border-[#0F3CA5]/20",
            bg: "bg-white",
            badge: "text-[#0F3CA5]",
          },
          {
            phase: "Fase 2", period: "2026", title: "LATAM",
            items: ["Expansão para México, Colômbia e Argentina", "Enterprise com MSPs e SIs regionais", "Compliance nativo (LGPD, NOM, Marco de Datos)", "MRR alvo: R$ 800K"],
            border: "border-[#577DB2]/20",
            bg: "bg-white",
            badge: "text-[#577DB2]",
          },
          {
            phase: "Fase 3", period: "2027+", title: "Plataforma",
            items: ["Marketplace de automações K8s", "Kodo AI como serviço (API-first)", "Parcerias OEM com cloud providers", "MRR alvo: R$ 3M+"],
            border: "border-emerald-200",
            bg: "bg-white",
            badge: "text-emerald-600",
          },
        ].map((p) => (
          <div key={p.phase} className={`rounded-2xl border p-7 ${p.border} ${p.bg} shadow-sm`}>
            <div className="flex items-center gap-2 mb-6">
              <span className={`text-[10px] font-bold font-mono ${p.badge}`}>{p.phase}</span>
              <span className="text-[10px] text-[#9B9B9B]">·</span>
              <span className="text-[10px] text-[#9B9B9B]">{p.period}</span>
            </div>
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">{p.title}</h3>
            <ul className="space-y-2.5">
              {p.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-[#6B6B6B] leading-relaxed">
                  <ArrowRight className="w-3 h-3 flex-shrink-0 mt-0.5 text-[#9B9B9B]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#E4EAF5] bg-white p-8 md:p-12 shadow-sm">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#9B9B9B] mb-8">Posicionamento competitivo</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E4EAF5]">
                <th className="text-left pb-4 text-[#9B9B9B] font-normal pr-6"></th>
                {["Kodo", "DataDog", "New Relic", "Komodor"].map((h) => (
                  <th key={h} className={`text-center pb-4 font-semibold pr-6 ${h === "Kodo" ? "text-[#0F3CA5]" : "text-[#9B9B9B]"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4FA]">
              {[
                ["Foco em LATAM e Brasil", "sim", "nao", "nao", "nao"],
                ["Auto-healing nativo", "sim", "nao", "nao", "sim"],
                ["FinOps integrado", "sim", "parcial", "nao", "nao"],
                ["Preço acessível (menos de R$ 500/cluster)", "sim", "nao", "nao", "nao"],
                ["Setup em menos de 5 minutos", "sim", "nao", "nao", "sim"],
                ["Suporte em português", "sim", "nao", "nao", "nao"],
              ].map(([feature, ...vals]) => (
                <tr key={feature}>
                  <td className="py-3 pr-6 text-[#6B6B6B]">{feature}</td>
                  {vals.map((v, i) => (
                    <td
                      key={i}
                      className={`text-center py-3 pr-6 font-medium ${
                        v === "sim"
                          ? i === 0
                            ? "text-[#0F3CA5]"
                            : "text-emerald-600"
                          : v === "nao"
                          ? "text-[#E4EAF5]"
                          : "text-amber-500"
                      }`}
                    >
                      {v === "sim" ? "✓" : v === "nao" ? "✗" : v}
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

const Contact = () => (
  <section
    className="py-28 md:py-40 px-6 relative overflow-hidden"
    style={{ background: "linear-gradient(135deg, #0F3CA5 0%, #1C2F45 100%)" }}
  >
    <div
      className="absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    />
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-white/5 blur-[100px] rounded-full" />

    <div className="max-w-4xl mx-auto text-center relative z-10">
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-8 font-mono">
        Contato
      </div>
      <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8 text-white">
        Construindo o futuro
        <br />
        <span className="text-white/50">da infraestrutura na LATAM.</span>
      </h2>
      <p className="text-base text-white/60 max-w-xl mx-auto mb-14 leading-relaxed">
        Se você quer entender mais sobre o mercado, o produto ou explorar
        uma parceria — entre em contato.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
        <a
          href="mailto:suporte@kubenetworks.com.br"
          className="px-8 py-4 rounded-full bg-white text-[#0F3CA5] text-sm font-semibold hover:bg-white/90 transition-all inline-flex items-center justify-center gap-2 group"
        >
          Falar com a equipe
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </a>
        <Link
          to="/"
          className="px-8 py-4 rounded-full border border-white/20 text-sm text-white/70 hover:border-white/40 hover:text-white transition-all inline-flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          Ver o produto
        </Link>
      </div>
      <div className="border-t border-white/10 pt-14 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left sm:text-center">
        {[
          { v: "2025", l: "Fundado em São Paulo, Brasil" },
          { v: "B2B SaaS", l: "Modelo de negócio cloud-native" },
          { v: "LATAM", l: "Foco de expansão regional" },
        ].map((s) => (
          <div key={s.v}>
            <div className="text-lg font-bold text-white mb-1">{s.v}</div>
            <div className="text-xs text-white/40">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default function About() {
  useEffect(() => {
    document.title = "Kodo · Pitch — Kubernetes inteligente para LATAM";
  }, []);

  return (
    <div className="min-h-screen bg-[#F0F4FA] text-[#1A1A1A] antialiased overflow-x-hidden">
      <SEO
        title="Sobre o Kodo — Gestão Kubernetes com IA feita no Brasil"
        description="Conheça a KubeNetworks e o Kodo: plataforma brasileira de gestão Kubernetes com IA. Auto-healing automático, FinOps e segurança para clusters K8s em produção."
        path="/sobre"
      />

      <Nav />

      <main>
        <Hero />
        <Problem />
        <Market />
        <Solution />
        <DemoSection />
        <Model />
        <Vision />
        <Contact />
      </main>

      <footer className="border-t border-[#E4EAF5] bg-white px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={kodoLogo} alt="Kodo" className="h-4 w-auto opacity-40" />
            <span className="text-[10px] text-[#9B9B9B]">kodo · {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <Link to="/privacidade" className="text-[10px] text-[#9B9B9B] hover:text-[#0F3CA5] transition-colors">
              Privacidade
            </Link>
            <Link to="/termos" className="text-[10px] text-[#9B9B9B] hover:text-[#0F3CA5] transition-colors">
              Termos
            </Link>
            <Link to="/auth" className="text-[10px] text-[#9B9B9B] hover:text-[#0F3CA5] transition-colors">
              Acessar plataforma
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
