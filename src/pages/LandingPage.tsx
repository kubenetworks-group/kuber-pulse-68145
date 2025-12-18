import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Lock,
  BarChart3,
  Upload,
  Settings,
  LineChart,
  BellRing,
  Terminal,
  Cpu,
  Database,
  GitBranch,
  Boxes,
  Network
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Animated counter hook
const useCounter = (end: number, duration: number = 2000, start: number = 0) => {
  const [count, setCount] = useState(start);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * (end - start) + start));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isVisible, end, duration, start]);

  return { count, ref };
};

// Matrix code rain component
const MatrixRain = () => {
  const chars = "01アイウエオカキクケコサシスセソタチツテト";
  const columns = 20;
  
  return (
    <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="absolute text-primary text-xs font-mono whitespace-nowrap"
          style={{
            left: `${(i / columns) * 100}%`,
            animation: `matrix-fall ${8 + Math.random() * 4}s linear infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        >
          {Array.from({ length: 30 }).map((_, j) => (
            <div key={j} style={{ opacity: 1 - j * 0.03 }}>
              {chars[Math.floor(Math.random() * chars.length)]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// Floating tech icons
const FloatingTechIcons = () => {
  const icons = [Cpu, Database, GitBranch, Boxes, Network, Terminal];
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {icons.map((Icon, i) => (
        <div
          key={i}
          className="absolute animate-float-tech opacity-20"
          style={{
            left: `${10 + (i * 15)}%`,
            top: `${20 + (i % 3) * 25}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${5 + i}s`,
          }}
        >
          <Icon className="w-8 h-8 text-primary" />
        </div>
      ))}
    </div>
  );
};

// Scan line effect
const ScanLine = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div 
      className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line"
      style={{ boxShadow: '0 0 20px 5px hsl(var(--primary) / 0.3)' }}
    />
  </div>
);

// Typing effect component
const TypingText = ({ texts }: { texts: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = texts[currentIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentText.length) {
          setDisplayText(currentText.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setCurrentIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, isDeleting ? 50 : 100);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentIndex, texts]);

  return (
    <span className="text-primary">
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
};

const features = [
  {
    icon: Brain,
    title: "Monitor IA",
    description: "Analise inteligente e deteccao de anomalias com machine learning para prevenir incidentes antes que acontecam.",
    color: "text-primary",
    gradient: "from-primary/20 to-violet-500/20"
  },
  {
    icon: Shield,
    title: "Seguranca",
    description: "Analise completa de RBAC, Network Policies, Pod Security e muito mais. Identifique vulnerabilidades automaticamente.",
    color: "text-success",
    gradient: "from-success/20 to-emerald-500/20"
  },
  {
    icon: DollarSign,
    title: "FinOps",
    description: "Controle de custos multi-cloud com insights detalhados. Economize ate 40% na sua infraestrutura.",
    color: "text-warning",
    gradient: "from-warning/20 to-amber-500/20"
  },
  {
    icon: Activity,
    title: "Observabilidade",
    description: "Metricas em tempo real de CPU, memoria, storage e rede. Dashboards personalizados para cada necessidade.",
    color: "text-chart-4",
    gradient: "from-violet-500/20 to-purple-500/20"
  },
  {
    icon: Wrench,
    title: "Auto-Healing",
    description: "Correcoes automaticas de problemas detectados. Reinicie pods, escale recursos e muito mais.",
    color: "text-destructive",
    gradient: "from-destructive/20 to-red-500/20"
  },
  {
    icon: Server,
    title: "Multi-Cluster",
    description: "Gerencie multiplos clusters Kubernetes de diferentes provedores em uma unica interface unificada.",
    color: "text-primary",
    gradient: "from-blue-500/20 to-cyan-500/20"
  }
];

const stats = [
  { value: 99.9, suffix: "%", label: "Uptime garantido" },
  { value: 40, suffix: "%", label: "Economia media" },
  { value: 5, suffix: "min", label: "Setup rapido" },
  { value: 24, suffix: "/7", label: "Monitoramento" },
];

const howItWorks = [
  {
    step: 1,
    icon: Upload,
    title: "Conecte seu Cluster",
    description: "Instale o agente Kodo no seu cluster Kubernetes em menos de 5 minutos."
  },
  {
    step: 2,
    icon: Settings,
    title: "Configure Preferencias",
    description: "Defina alertas personalizados e politicas de auto-healing."
  },
  {
    step: 3,
    icon: LineChart,
    title: "Monitore em Tempo Real",
    description: "Acompanhe metricas e anomalias em dashboards interativos."
  },
  {
    step: 4,
    icon: BellRing,
    title: "Receba Insights",
    description: "Seja notificado antes que problemas afetem seus usuarios."
  }
];

const faqs = [
  {
    question: "O que e o Kodo?",
    answer: "Kodo e uma plataforma de gestao Kubernetes com inteligencia artificial que oferece auto-healing automatico, analise de seguranca, FinOps e observabilidade em tempo real para seus clusters K8s."
  },
  {
    question: "Como funciona o auto-healing do Kodo?",
    answer: "O auto-healing do Kodo usa IA para detectar anomalias e problemas em seus clusters Kubernetes automaticamente. Quando um problema e identificado, o sistema pode reiniciar pods, escalar deployments ou aplicar correcoes sem intervencao manual."
  },
  {
    question: "O Kodo funciona com qualquer provedor de cloud?",
    answer: "Sim! O Kodo e multi-cloud e funciona com AWS EKS, Google GKE, Azure AKS, DigitalOcean Kubernetes, e clusters on-premises."
  },
  {
    question: "Quanto tempo leva para configurar o Kodo?",
    answer: "A configuracao do Kodo leva menos de 5 minutos. Basta instalar nosso agente no seu cluster usando kubectl ou helm."
  },
  {
    question: "O Kodo e seguro?",
    answer: "Sim, seguranca e nossa prioridade. O Kodo coleta apenas metadados e metricas de performance dos seus clusters, nunca dados de aplicacao ou secrets."
  },
  {
    question: "Posso testar o Kodo gratuitamente?",
    answer: "Sim! Oferecemos um plano gratuito permanente que inclui 1 cluster e 5 analises de IA por mes. Nao pedimos cartao de credito."
  }
];

const pricingPlans = [
  {
    name: "Free",
    price: "R$0",
    period: "/mes",
    description: "Para comecar a explorar",
    features: ["1 cluster", "5 analises IA/mes", "Metricas basicas", "Suporte comunidade"],
    cta: "Comecar Gratis",
    popular: false
  },
  {
    name: "Pro",
    price: "R$149",
    period: "/mes",
    description: "Para times em crescimento",
    features: ["Ate 10 clusters", "Analises IA ilimitadas", "Auto-Healing", "Alertas avancados", "Suporte prioritario"],
    cta: "Comecar Agora",
    popular: true
  }
];

export default function LandingPage() {
  const stat1 = useCounter(99.9, 2000, 0);
  const stat2 = useCounter(40, 2000, 0);
  const stat3 = useCounter(5, 1500, 0);
  const stat4 = useCounter(24, 1500, 0);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Advanced Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
      <div className="absolute inset-0 code-bg" />
      <MatrixRain />
      <FloatingTechIcons />
      <ScanLine />
      
      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-violet-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute top-2/3 left-1/2 w-72 h-72 bg-cyan-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '5s' }} />

      {/* Header */}
      <header className="relative z-20 border-b border-border/50 bg-background/60 backdrop-blur-xl sticky top-0">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-violet-500 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity animate-pulse" />
              <div className="absolute -inset-1 bg-primary/20 rounded-full animate-pulse-ring" />
              <img src={kodoLogo} alt="Kodo" className="w-10 h-10 object-contain relative z-10" />
            </div>
            <span className="text-2xl font-bold animate-text-shimmer">
              Kodo
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            {["Recursos", "Como Funciona", "Precos", "FAQ"].map((item, i) => (
              <a 
                key={item}
                href={`#${item.toLowerCase().replace(" ", "-")}`} 
                className="text-muted-foreground hover:text-primary transition-all hover:scale-105 relative group"
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-violet-500 group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:flex hover:bg-primary/10">
                Login
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-gradient-to-r from-primary to-violet-500 hover:opacity-90 transition-all hover:scale-105 animate-glow-pulse">
                <Zap className="w-4 h-4 mr-2" />
                Comecar Agora
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative z-10 container mx-auto px-4 pt-20 pb-32">
          <div className="max-w-5xl mx-auto text-center space-y-8">
            {/* Terminal-style badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card/80 border border-primary/30 text-primary font-mono text-sm animate-in fade-in slide-in-from-bottom-4 duration-700 animate-border-glow">
              <Terminal className="w-4 h-4" />
              <span className="text-muted-foreground">$</span>
              <span>kubectl get kodo --status=</span>
              <span className="text-success">active</span>
              <span className="animate-pulse">_</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              <span className="block mb-2">Gerencie Kubernetes com</span>
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-primary via-violet-500 to-cyan-400 bg-clip-text text-transparent">
                  <TypingText texts={["Inteligencia Artificial", "Auto-Healing", "Observabilidade", "FinOps Inteligente"]} />
                </span>
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 leading-relaxed">
              Plataforma cloud-native que combina <span className="text-primary font-semibold">machine learning</span>, 
              auto-remediacao e analise de custos para transformar sua operacao K8s.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-to-r from-primary to-violet-500 hover:opacity-90 transition-all hover:scale-105 gap-2 text-lg px-8 py-7 shadow-xl shadow-primary/20 group">
                  <Sparkles className="w-5 h-5 group-hover:animate-spin" />
                  Comecar Gratis
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="#como-funciona">
                <Button size="lg" variant="outline" className="gap-2 text-lg px-8 py-7 border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all">
                  <Terminal className="w-5 h-5" />
                  Ver Demo
                </Button>
              </a>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-16 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
              <div ref={stat1.ref} className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all group">
                <div className="text-4xl font-bold text-primary mb-1 group-hover:scale-110 transition-transform">
                  {stat1.count.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Uptime garantido</div>
              </div>
              <div ref={stat2.ref} className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-success/30 transition-all group">
                <div className="text-4xl font-bold text-success mb-1 group-hover:scale-110 transition-transform">
                  {stat2.count}%
                </div>
                <div className="text-sm text-muted-foreground">Economia media</div>
              </div>
              <div ref={stat3.ref} className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-warning/30 transition-all group">
                <div className="text-4xl font-bold text-warning mb-1 group-hover:scale-110 transition-transform">
                  {stat3.count}min
                </div>
                <div className="text-sm text-muted-foreground">Setup rapido</div>
              </div>
              <div ref={stat4.ref} className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-violet-500/30 transition-all group">
                <div className="text-4xl font-bold text-violet-500 mb-1 group-hover:scale-110 transition-transform">
                  {stat4.count}/7
                </div>
                <div className="text-sm text-muted-foreground">Monitoramento</div>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center gap-8 pt-8 text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-border/50">
                <Lock className="w-4 h-4 text-success" />
                <span className="text-sm font-medium">SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-border/50">
                <Shield className="w-4 h-4 text-success" />
                <span className="text-sm font-medium">LGPD Ready</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-border/50">
                <BarChart3 className="w-4 h-4 text-success" />
                <span className="text-sm font-medium">Enterprise Grade</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="recursos" className="relative z-10 py-24 bg-gradient-to-b from-muted/50 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
                <Cpu className="w-4 h-4" />
                Recursos
              </div>
              <h2 className="text-3xl sm:text-5xl font-bold mb-4">
                Tudo que voce precisa para{" "}
                <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                  dominar Kubernetes
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Plataforma completa com IA para simplificar sua operacao cloud-native.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card 
                  key={feature.title}
                  className="group p-6 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 relative overflow-hidden"
                >
                  {/* Animated background gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  
                  <div className="relative z-10">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                      <feature.icon className={`w-7 h-7 ${feature.color}`} />
                    </div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </div>

                  {/* Corner decoration */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="como-funciona" className="relative z-10 py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-sm mb-4">
                <GitBranch className="w-4 h-4" />
                Workflow
              </div>
              <h2 className="text-3xl sm:text-5xl font-bold mb-4">
                Setup em{" "}
                <span className="bg-gradient-to-r from-success to-emerald-400 bg-clip-text text-transparent">
                  4 passos simples
                </span>
              </h2>
            </div>

            <div className="relative max-w-5xl mx-auto">
              {/* Connection line */}
              <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-primary via-violet-500 to-success transform -translate-y-1/2 rounded-full" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {howItWorks.map((item, index) => (
                  <div key={item.step} className="relative group">
                    <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 h-full hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2">
                      <div className="flex flex-col items-center text-center">
                        {/* Step number with glow */}
                        <div className="relative mb-4">
                          <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse" />
                          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg">
                            {item.step}
                          </div>
                        </div>
                        
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                          <item.icon className="w-6 h-6 text-primary" />
                        </div>
                        
                        <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center mt-12">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-to-r from-primary to-violet-500 hover:opacity-90 transition-all hover:scale-105 gap-2 group">
                  Comecar em 5 Minutos
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="precos" className="relative z-10 py-24 bg-gradient-to-b from-muted/50 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/10 text-warning text-sm mb-4">
                <DollarSign className="w-4 h-4" />
                Pricing
              </div>
              <h2 className="text-3xl sm:text-5xl font-bold mb-4">
                Planos{" "}
                <span className="bg-gradient-to-r from-warning to-amber-400 bg-clip-text text-transparent">
                  transparentes
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Comece gratis e escale conforme sua necessidade.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {pricingPlans.map((plan) => (
                <Card 
                  key={plan.name}
                  className={`p-8 relative overflow-hidden transition-all duration-300 hover:-translate-y-2 ${
                    plan.popular 
                      ? 'border-primary/50 bg-gradient-to-br from-primary/10 to-violet-500/10 shadow-xl shadow-primary/10' 
                      : 'bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30'
                  }`}
                >
                  {plan.popular && (
                    <>
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-violet-500" />
                      <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-primary to-violet-500 text-primary-foreground text-xs font-bold animate-pulse">
                        Popular
                      </div>
                    </>
                  )}
                  
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground mb-4">{plan.description}</p>
                  
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-5xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-success" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/auth" className="block">
                    <Button 
                      className={`w-full transition-all ${plan.popular ? 'bg-gradient-to-r from-primary to-violet-500 hover:opacity-90' : 'hover:bg-primary/10'}`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>

            <div className="text-center mt-8">
              <Link to="/pricing" className="text-primary hover:text-violet-500 transition-colors inline-flex items-center gap-2">
                Ver comparacao completa
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="relative z-10 py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-500 text-sm mb-4">
                <Sparkles className="w-4 h-4" />
                FAQ
              </div>
              <h2 className="text-3xl sm:text-5xl font-bold mb-4">
                Perguntas{" "}
                <span className="bg-gradient-to-r from-violet-500 to-purple-400 bg-clip-text text-transparent">
                  Frequentes
                </span>
              </h2>
            </div>

            <div className="max-w-3xl mx-auto">
              <Accordion type="single" collapsible className="space-y-4">
                {faqs.map((faq, index) => (
                  <AccordionItem 
                    key={index} 
                    value={`item-${index}`}
                    className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl px-6 data-[state=open]:border-primary/50 data-[state=open]:shadow-lg data-[state=open]:shadow-primary/5 transition-all"
                  >
                    <AccordionTrigger className="text-left hover:no-underline py-5">
                      <span className="font-semibold text-lg">{faq.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative z-10 py-24 bg-gradient-to-b from-muted/50 to-background">
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto p-12 text-center relative overflow-hidden border-primary/30">
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-violet-500/10 to-cyan-500/20" />
              <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
              
              <div className="relative z-10">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-xl shadow-primary/30">
                  <Zap className="w-10 h-10 text-primary-foreground" />
                </div>
                
                <h2 className="text-3xl sm:text-5xl font-bold mb-4">
                  Pronto para transformar sua operacao?
                </h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                  Junte-se a centenas de empresas que ja automatizaram sua gestao Kubernetes com IA.
                </p>
                
                <Link to="/auth">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-violet-500 hover:opacity-90 transition-all hover:scale-105 gap-2 text-lg px-10 py-7 shadow-xl shadow-primary/20 group">
                    <Sparkles className="w-5 h-5 group-hover:animate-spin" />
                    Comecar Gratuitamente
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                
                <p className="text-sm text-muted-foreground mt-6 flex items-center justify-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1"><Check className="w-4 h-4 text-success" /> Sem cartao</span>
                  <span className="flex items-center gap-1"><Check className="w-4 h-4 text-success" /> 5 min setup</span>
                  <span className="flex items-center gap-1"><Check className="w-4 h-4 text-success" /> Cancele quando quiser</span>
                </p>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
