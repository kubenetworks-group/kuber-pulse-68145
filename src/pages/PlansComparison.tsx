import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import kodoLogo from "@/assets/kodo-logo.png";
import { 
  Check, 
  X, 
  ArrowLeft, 
  Brain, 
  Server, 
  Shield, 
  Zap, 
  Clock,
  DollarSign,
  Users,
  Wrench,
  BarChart3,
  BellRing,
  Lock
} from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "R$ 0",
    period: "/mês",
    description: "Para começar a explorar",
    highlight: false,
  },
  {
    name: "Pro",
    price: "R$ 149",
    period: "/mês",
    description: "Para times em produção",
    highlight: true,
  },
];

const features = [
  {
    category: "Monitoramento",
    icon: BarChart3,
    items: [
      { name: "Clusters monitorados", free: "1", pro: "Ilimitado" },
      { name: "Retenção de métricas", free: "7 dias", pro: "90 dias" },
      { name: "Dashboard em tempo real", free: true, pro: true },
      { name: "Alertas básicos", free: true, pro: true },
      { name: "Alertas avançados personalizados", free: false, pro: true },
    ],
  },
  {
    category: "Inteligência Artificial",
    icon: Brain,
    items: [
      { name: "Análises de IA por mês", free: "5", pro: "Ilimitado" },
      { name: "Detecção de anomalias", free: "Básico", pro: "Avançado" },
      { name: "Recomendações automáticas", free: true, pro: true },
      { name: "Predição de incidentes", free: false, pro: true },
      { name: "Análise de root cause", free: false, pro: true },
    ],
  },
  {
    category: "Auto-Healing",
    icon: Wrench,
    items: [
      { name: "Auto-healing automático", free: false, pro: true },
      { name: "Restart automático de pods", free: false, pro: true },
      { name: "Scaling automático", free: false, pro: true },
      { name: "Rollback automático", free: false, pro: true },
      { name: "Aprovação via WhatsApp", free: false, pro: true },
    ],
  },
  {
    category: "Segurança",
    icon: Shield,
    items: [
      { name: "Scan de vulnerabilidades", free: "Básico", pro: "Completo" },
      { name: "Análise de RBAC", free: true, pro: true },
      { name: "Network Policies audit", free: false, pro: true },
      { name: "Pod Security Standards", free: false, pro: true },
      { name: "Remediação automática", free: false, pro: true },
    ],
  },
  {
    category: "FinOps",
    icon: DollarSign,
    items: [
      { name: "Estimativa de custos", free: true, pro: true },
      { name: "Breakdown por namespace", free: false, pro: true },
      { name: "Recomendações de economia", free: false, pro: true },
      { name: "Relatórios de custo", free: false, pro: true },
      { name: "Alertas de budget", free: false, pro: true },
    ],
  },
  {
    category: "Suporte",
    icon: Users,
    items: [
      { name: "Documentação", free: true, pro: true },
      { name: "Suporte por email", free: true, pro: true },
      { name: "Suporte prioritário", free: false, pro: true },
      { name: "SLA de resposta", free: "48h", pro: "4h" },
      { name: "Onboarding dedicado", free: false, pro: true },
    ],
  },
];

const renderValue = (value: boolean | string) => {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="w-5 h-5 text-success mx-auto" />
    ) : (
      <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
    );
  }
  return <span className="text-sm font-medium">{value}</span>;
};

export default function PlansComparison() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={kodoLogo} alt="Kodo" className="h-8 w-auto" />
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm">Começar Grátis</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Comparação de Planos</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Escolha o plano ideal para seu{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-500">
                Kubernetes
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Compare todas as funcionalidades e escolha o plano que melhor atende às necessidades do seu time.
            </p>
          </div>

          {/* Plans Header Cards */}
          <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
            <div className="col-span-1" />
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`p-6 text-center ${
                  plan.highlight
                    ? "bg-gradient-to-br from-primary/10 to-violet-500/10 border-primary/30"
                    : "bg-card"
                }`}
              >
                {plan.highlight && (
                  <div className="text-xs font-semibold text-primary mb-2">MAIS POPULAR</div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                <Link to="/auth">
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                  >
                    {plan.highlight ? "Começar Agora" : "Criar Conta"}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>

          {/* Features Comparison Table */}
          <div className="max-w-4xl mx-auto">
            {features.map((category) => (
              <div key={category.category} className="mb-8">
                <div className="flex items-center gap-3 mb-4 px-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <category.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">{category.category}</h2>
                </div>
                <Card className="overflow-hidden">
                  <div className="divide-y divide-border">
                    {category.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-3 gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="col-span-1 flex items-center">
                          <span className="text-sm text-muted-foreground">{item.name}</span>
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          {renderValue(item.free)}
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          {renderValue(item.pro)}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="max-w-2xl mx-auto mt-16 text-center">
            <Card className="p-8 bg-gradient-to-br from-primary/5 to-violet-500/5 border-primary/20">
              <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-3">
                Comece com 14 dias de trial Pro
              </h2>
              <p className="text-muted-foreground mb-6">
                Experimente todas as funcionalidades do plano Pro gratuitamente. Não é necessário cartão de crédito.
              </p>
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  <Zap className="w-4 h-4" />
                  Iniciar Trial Gratuito
                </Button>
              </Link>
            </Card>
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto mt-16">
            <h2 className="text-2xl font-bold text-center mb-8">Perguntas Frequentes</h2>
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Posso mudar de plano a qualquer momento?</h3>
                <p className="text-sm text-muted-foreground">
                  Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. As mudanças são aplicadas imediatamente.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-2">O que acontece após o trial?</h3>
                <p className="text-sm text-muted-foreground">
                  Após 14 dias, você pode escolher continuar com o plano Pro ou migrar para o plano Free sem perder seus dados.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Como funciona a cobrança?</h3>
                <p className="text-sm text-muted-foreground">
                  A cobrança é mensal e processada via Stripe. Você pode cancelar a qualquer momento sem multas.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Vocês oferecem planos para enterprise?</h3>
                <p className="text-sm text-muted-foreground">
                  Sim! Para necessidades específicas ou grandes volumes, entre em contato conosco em{" "}
                  <a href="mailto:suporte@kubenetworks.com.br" className="text-primary hover:underline">
                    suporte@kubenetworks.com.br
                  </a>
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
