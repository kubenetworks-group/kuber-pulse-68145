import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Shield,
  Zap,
  Activity,
  DollarSign,
  Wrench,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import kodoLogo from "@/assets/kodo-logo.png";
import { Footer } from "@/components/Footer";

/* ───────── Animated counter ───────── */
const useCounter = (end: number, duration = 1800, decimals = 0) => {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => e.isIntersecting && setVisible(true),
      { threshold: 0.4 }
    );
    obs.observe(ref.current);
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

/* ───────── Apple-like sticky nav ───────── */
const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Produto", href: "#produto" },
    { label: "Problema", href: "#problema" },
    { label: "Solução", href: "#solucao" },
    { label: "Mercado", href: "#mercado" },
    { label: "Planos", href: "/plans" },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/40"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={kodoLogo} alt="Kodo" className="h-6 w-auto" />
          <span className="text-sm font-medium tracking-tight">kodo</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[12px] text-foreground/80 hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/auth"
            className="text-[12px] text-foreground/80 hover:text-foreground transition-colors"
          >
            Entrar
          </Link>
          <Link
            to="/auth?tab=signup"
            className="text-[12px] px-3.5 py-1.5 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            Começar
          </Link>
        </div>

        <button
          className="md:hidden text-foreground"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl">
          <div className="px-6 py-6 flex flex-col gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm text-foreground/80"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-3 pt-2">
              <Link
                to="/auth"
                className="flex-1 text-center text-sm py-2 rounded-full border border-border"
              >
                Entrar
              </Link>
              <Link
                to="/auth?tab=signup"
                className="flex-1 text-center text-sm py-2 rounded-full bg-foreground text-background"
              >
                Começar
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

/* ───────── Hero ───────── */
const Hero = () => (
  <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
    <div className="absolute inset-0 -z-10">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[140px] rounded-full" />
    </div>

    <div className="max-w-5xl mx-auto px-6 text-center">
      <span className="inline-block text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-6">
        Plataforma de Operação Inteligente
      </span>

      <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[1.05]">
        Kubernetes,
        <br />
        <span className="bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
          sem o caos.
        </span>
      </h1>

      <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
        O Kodo é o copiloto de IA que monitora, diagnostica e corrige seus
        clusters em tempo real — para que sua equipe pare de apagar incêndios e
        volte a construir.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/auth?tab=signup"
          className="px-7 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition"
        >
          Começar grátis
        </Link>
        <a
          href="#produto"
          className="px-7 py-3 rounded-full border border-border text-sm font-medium hover:bg-muted/50 transition flex items-center justify-center gap-1.5"
        >
          Ver como funciona <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Grátis para começar · Sem cartão · 30 dias de Pro inclusos
      </p>
    </div>

    <div className="mt-20 md:mt-28 max-w-5xl mx-auto px-6">
      <div className="relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-primary/20 via-transparent to-primary/10 blur-3xl" />
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border/40">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
            <span className="ml-3 text-[10px] font-mono text-muted-foreground">
              kodo.app / dashboard
            </span>
          </div>
          <div className="p-8 md:p-12 grid grid-cols-3 gap-6">
            {[
              { label: "Uptime", value: "99.98%", tone: "text-success" },
              { label: "Pods saudáveis", value: "248/250", tone: "" },
              { label: "Incidentes 24h", value: "0", tone: "text-success" },
            ].map((m) => (
              <div key={m.label} className="text-left">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  {m.label}
                </div>
                <div
                  className={`text-2xl md:text-4xl font-semibold tracking-tight font-mono ${m.tone}`}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
          <div className="px-8 md:px-12 pb-10">
            <div className="h-32 rounded-lg border border-border/40 bg-muted/30 flex items-center justify-center text-xs font-mono text-muted-foreground">
              ░ ai-monitor ░ analisando 12 namespaces · 0 anomalias
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ───────── How ───────── */
const How = () => {
  const steps = [
    {
      n: "01",
      t: "Conecte",
      c: "Um único comando kubectl instala o agente Kodo no seu cluster. Sem firewall, sem VPN.",
    },
    {
      n: "02",
      t: "Aprenda",
      c: "Em minutos, a IA mapeia workloads, namespaces e padrões normais de comportamento.",
    },
    {
      n: "03",
      t: "Opere",
      c: "Receba diagnósticos, mitigações automáticas e relatórios semanais de saúde no seu painel.",
    },
  ];

  return (
    <section id="produto" className="py-24 md:py-40 border-t border-border/40">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-3xl">
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Como funciona
          </span>
          <h2 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.1]">
            Três passos.
            <br />
            <span className="text-muted-foreground">Zero atrito.</span>
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.n} className="border-t border-border pt-6">
              <div className="text-xs font-mono text-muted-foreground tracking-widest">
                {s.n}
              </div>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                {s.t}
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {s.c}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───────── Problem ───────── */
const Problem = () => {
  const pains = [
    {
      title: "Equipes sobrecarregadas",
      copy: "85% dos times de SRE no Brasil relatam burnout por plantão noturno e pods caindo em produção.",
    },
    {
      title: "Custo descontrolado",
      copy: "Clusters mal dimensionados desperdiçam até 40% do orçamento de cloud em workloads ociosos.",
    },
    {
      title: "Falta de talento sênior",
      copy: "LATAM tem déficit estimado de 120 mil engenheiros DevOps qualificados em Kubernetes.",
    },
    {
      title: "Visibilidade fragmentada",
      copy: "Métricas em Prometheus, logs em Loki, alertas no Slack. Ninguém vê o todo a tempo.",
    },
  ];

  return (
    <section id="problema" className="py-24 md:py-40 border-t border-border/40">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-3xl">
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            O problema
          </span>
          <h2 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.1]">
            Operar Kubernetes
            <br />
            <span className="text-muted-foreground">não deveria doer tanto.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            No Brasil e na América Latina, mais de 70% das empresas que adotaram
            Kubernetes nos últimos 3 anos relatam dificuldade em manter clusters
            estáveis, seguros e dentro do orçamento.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-px bg-border/40 rounded-2xl overflow-hidden border border-border/40">
          {pains.map((p) => (
            <div
              key={p.title}
              className="bg-background p-8 md:p-10 hover:bg-muted/30 transition-colors"
            >
              <h3 className="text-xl font-medium tracking-tight">{p.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {p.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───────── Solution ───────── */
const Solution = () => {
  const features = [
    {
      icon: Brain,
      title: "IA que diagnostica",
      copy: "Detecta CrashLoopBackOff, OOMKills, gargalos de CPU e descreve a causa raiz em linguagem natural.",
    },
    {
      icon: Wrench,
      title: "Auto-cura segura",
      copy: "Aplica correções automaticamente, com aprovação opcional via WhatsApp para namespaces críticos.",
    },
    {
      icon: Shield,
      title: "Segurança contínua",
      copy: "Classifica vulnerabilidades como ameaça ou risco e mitiga ataques em tempo real.",
    },
    {
      icon: DollarSign,
      title: "Otimização de custos",
      copy: "Recomenda redimensionamento de PVCs, nodes e workloads para reduzir o gasto mensal.",
    },
    {
      icon: Activity,
      title: "Observabilidade unificada",
      copy: "Métricas, logs e eventos em uma única tela — Prometheus, Loki e eventos K8s nativos.",
    },
    {
      icon: Zap,
      title: "Setup em minutos",
      copy: "Um comando kubectl conecta seu cluster. Sem agentes complexos, sem mudanças invasivas.",
    },
  ];

  return (
    <section id="solucao" className="py-24 md:py-40 border-t border-border/40">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-3xl">
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            A solução
          </span>
          <h2 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.1]">
            Uma plataforma.
            <br />
            <span className="text-muted-foreground">Toda a operação.</span>
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="group p-8 rounded-2xl border border-border/50 bg-card/30 hover:border-border hover:bg-card/60 transition-all"
            >
              <f.icon className="h-5 w-5 text-foreground/70 mb-6 group-hover:text-foreground transition-colors" />
              <h3 className="text-lg font-medium tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {f.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───────── Market ───────── */
const MarketStat = ({
  value,
  suffix = "",
  decimals = 0,
  label,
  source,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  label: string;
  source: string;
}) => {
  const { count, ref } = useCounter(value, 1800, decimals);
  return (
    <div className="text-center md:text-left">
      <div className="text-5xl md:text-7xl font-semibold tracking-tight bg-gradient-to-b from-foreground to-foreground/40 bg-clip-text text-transparent">
        <span ref={ref}>
          {decimals > 0 ? count.toFixed(decimals) : Math.round(count)}
        </span>
        {suffix}
      </div>
      <div className="mt-3 text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground mt-1">{source}</div>
    </div>
  );
};

const Market = () => (
  <section id="mercado" className="py-24 md:py-40 border-t border-border/40">
    <div className="max-w-5xl mx-auto px-6">
      <div className="max-w-3xl">
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          O mercado
        </span>
        <h2 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.1]">
          Um mercado em
          <br />
          <span className="text-muted-foreground">expansão acelerada.</span>
        </h2>
        <p className="mt-6 text-lg text-muted-foreground">
          A adoção de Kubernetes cresce em ritmo recorde — e a demanda por
          plataformas de gestão inteligente cresce ainda mais rápido.
        </p>
      </div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
        <MarketStat
          value={9.6}
          decimals={1}
          suffix="B"
          label="Mercado global de Kubernetes"
          source="USD até 2031 · CAGR 23,4% (Gartner)"
        />
        <MarketStat
          value={2.1}
          decimals={1}
          suffix="B"
          label="LATAM em cloud-native"
          source="USD em 2027 · CAGR 28% (IDC LATAM)"
        />
        <MarketStat
          value={68}
          suffix="%"
          label="Empresas brasileiras adotando K8s"
          source="Crescimento ano-a-ano (CNCF Brasil 2025)"
        />
      </div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-px bg-border/40 rounded-2xl overflow-hidden border border-border/40">
        {[
          { v: "96%", l: "das empresas Fortune 500 usam Kubernetes" },
          { v: "+540%", l: "crescimento de vagas DevOps no Brasil em 5 anos" },
          { v: "R$ 4,2M", l: "custo médio de uma hora de downtime crítico" },
        ].map((s) => (
          <div key={s.l} className="bg-background p-8 md:p-10">
            <div className="text-3xl md:text-4xl font-semibold tracking-tight">
              {s.v}
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {s.l}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ───────── CTA ───────── */
const CTA = () => (
  <section className="py-24 md:py-40 border-t border-border/40">
    <div className="max-w-4xl mx-auto px-6 text-center">
      <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.1]">
        Pronto para um
        <br />
        <span className="text-muted-foreground">Kubernetes silencioso?</span>
      </h2>
      <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
        Comece grátis hoje. Conecte seu primeiro cluster em menos de 5 minutos.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/auth?tab=signup"
          className="px-8 py-3.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition"
        >
          Criar conta grátis
        </Link>
        <Link
          to="/plans"
          className="px-8 py-3.5 rounded-full border border-border text-sm font-medium hover:bg-muted/50 transition"
        >
          Ver planos
        </Link>
      </div>
    </div>
  </section>
);

/* ───────── Page ───────── */
const About = () => {
  useEffect(() => {
    document.title = "Sobre o Kodo · Kubernetes inteligente para times modernos";
    const desc =
      "Conheça o Kodo: plataforma de operação Kubernetes com IA. Diagnóstico em tempo real, auto-cura, segurança e otimização de custos para times no Brasil e LATAM.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Nav />
      <main>
        <Hero />
        <How />
        <Problem />
        <Solution />
        <Market />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default About;
