import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AnimatedParticles } from "@/components/AnimatedParticles";
import { Footer } from "@/components/Footer";
import kodoLogo from "@/assets/kodo-logo.png";
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
  BarChart3
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Monitor IA",
    description: "Análise inteligente e detecção de anomalias com machine learning para prevenir incidentes antes que aconteçam.",
    color: "text-primary"
  },
  {
    icon: Shield,
    title: "Segurança",
    description: "Análise completa de RBAC, Network Policies, Pod Security e muito mais. Identifique vulnerabilidades automaticamente.",
    color: "text-success"
  },
  {
    icon: DollarSign,
    title: "FinOps",
    description: "Controle de custos multi-cloud com insights detalhados. Economize até 40% na sua infraestrutura.",
    color: "text-warning"
  },
  {
    icon: Activity,
    title: "Observabilidade",
    description: "Métricas em tempo real de CPU, memória, storage e rede. Dashboards personalizados para cada necessidade.",
    color: "text-chart-4"
  },
  {
    icon: Wrench,
    title: "Auto-Healing",
    description: "Correções automáticas de problemas detectados. Reinicie pods, escale recursos e muito mais.",
    color: "text-destructive"
  },
  {
    icon: Server,
    title: "Multi-Cluster",
    description: "Gerencie múltiplos clusters Kubernetes de diferentes provedores em uma única interface unificada.",
    color: "text-primary"
  }
];

const pricingPlans = [
  {
    name: "Free",
    price: "R$0",
    period: "/mês",
    description: "Para começar a explorar",
    features: [
      "1 cluster",
      "5 análises IA/mês",
      "Métricas básicas",
      "Suporte comunidade"
    ],
    cta: "Começar Grátis",
    popular: false
  },
  {
    name: "Pro",
    price: "R$149",
    period: "/mês",
    description: "Para times em crescimento",
    features: [
      "Até 10 clusters",
      "Análises IA ilimitadas",
      "Auto-Healing",
      "Alertas avançados",
      "Suporte prioritário"
    ],
    cta: "Começar Agora",
    popular: true
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <AnimatedParticles />
      
      {/* Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />

      {/* Header */}
      <header className="relative z-20 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <img src={kodoLogo} alt="Kodo" className="w-10 h-10 object-contain relative z-10" />
            </div>
            <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Kodo
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </a>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              Termos
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:flex">
                Login
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-gradient-primary hover:opacity-90 transition-opacity">
                Começar Agora
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative z-10 container mx-auto px-4 pt-20 pb-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Sparkles className="w-4 h-4" />
              Plataforma de Gestão Kubernetes com IA
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Gerencie sua infraestrutura{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Kubernetes
              </span>{" "}
              com Inteligência Artificial
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              Auto-cura, segurança, FinOps e observabilidade em tempo real. 
              Tudo em uma única plataforma inteligente para sua operação cloud-native.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-primary hover:opacity-90 transition-opacity gap-2 text-lg px-8 py-6 shadow-lg hover:shadow-primary/30">
                  Começar Agora
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="gap-2 text-lg px-8 py-6 border-border/50 hover:bg-muted/50">
                  Ver Recursos
                </Button>
              </a>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-success" />
                <span className="text-sm">SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-success" />
                <span className="text-sm">LGPD Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-success" />
                <span className="text-sm">99.9% Uptime</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative z-10 py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Tudo que você precisa para{" "}
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  gerenciar Kubernetes
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Uma plataforma completa com recursos avançados de IA para simplificar 
                a operação da sua infraestrutura cloud-native.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card 
                  key={feature.title}
                  className="p-6 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="relative z-10 py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Planos para{" "}
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  todos os tamanhos
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Comece gratuitamente e escale conforme sua necessidade.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {pricingPlans.map((plan) => (
                <Card 
                  key={plan.name}
                  className={`p-8 relative overflow-hidden ${
                    plan.popular 
                      ? 'border-primary/50 bg-gradient-to-br from-primary/5 to-accent/5' 
                      : 'bg-card/50 backdrop-blur-sm border-border/50'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-primary text-primary-foreground text-xs font-medium">
                      Popular
                    </div>
                  )}
                  
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground mb-4">{plan.description}</p>
                  
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/auth" className="block">
                    <Button 
                      className={`w-full ${plan.popular ? 'bg-gradient-primary hover:opacity-90' : ''}`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>

            <div className="text-center mt-8">
              <Link to="/auth" className="text-primary hover:underline">
                Ver todos os planos →
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative z-10 py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto p-12 text-center bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Pronto para transformar sua operação?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Junte-se a centenas de empresas que já automatizaram sua gestão Kubernetes com o Kodo.
              </p>
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-primary hover:opacity-90 transition-opacity gap-2 text-lg px-8 py-6">
                  Começar Gratuitamente
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
