import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Server, 
  Brain, 
  DollarSign, 
  Shield, 
  Zap, 
  LineChart,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles
} from "lucide-react";
import kodoLogo from "@/assets/kodo-logo.png";
import { useAuth } from "@/contexts/AuthContext";

const welcomeSteps = [
  {
    id: 1,
    icon: Sparkles,
    title: "Bem-vindo ao Kodo!",
    description: "Sua plataforma de gerenciamento inteligente de infraestrutura Kubernetes multi-cloud",
    features: [
      "Monitoramento em tempo real",
      "Análise por IA",
      "Auto-healing inteligente",
      "Otimização de custos"
    ],
    color: "primary"
  },
  {
    id: 2,
    icon: Server,
    title: "Gestão Centralizada de Clusters",
    description: "Gerencie todos os seus clusters Kubernetes em um único lugar",
    features: [
      "Visualização unificada de múltiplos clusters",
      "Monitoramento de nodes, pods e recursos",
      "Logs e eventos em tempo real",
      "Suporte para AWS, GCP, Azure e on-premise"
    ],
    color: "accent"
  },
  {
    id: 3,
    icon: Brain,
    title: "Inteligência Artificial Avançada",
    description: "IA que aprende com seu ambiente e previne problemas",
    features: [
      "Detecção automática de anomalias",
      "Predição de falhas antes que aconteçam",
      "Recomendações inteligentes de otimização",
      "Análise de padrões e tendências"
    ],
    color: "primary"
  },
  {
    id: 4,
    icon: Shield,
    title: "Auto-Healing Inteligente",
    description: "Correção automática de problemas sem intervenção manual",
    features: [
      "Reinício automático de pods com falha",
      "Escalonamento inteligente de recursos",
      "Rollback automático de deploys problemáticos",
      "Healing baseado em políticas customizáveis"
    ],
    color: "accent"
  },
  {
    id: 5,
    icon: DollarSign,
    title: "Otimização de Custos",
    description: "Reduza gastos com análise inteligente de recursos",
    features: [
      "Análise detalhada de custos por cluster",
      "Identificação de recursos subutilizados",
      "Recomendações de economia",
      "Previsão de custos futuros"
    ],
    color: "primary"
  },
  {
    id: 6,
    icon: LineChart,
    title: "Métricas e Analytics",
    description: "Visualize e analise o desempenho da sua infraestrutura",
    features: [
      "Dashboards customizáveis",
      "Métricas de CPU, memória e storage",
      "Histórico de eventos e incidentes",
      "Relatórios automáticos"
    ],
    color: "accent"
  }
];

const Welcome = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  const progress = ((currentStep + 1) / welcomeSteps.length) * 100;
  const step = welcomeSteps[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < welcomeSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    // Save that user has completed onboarding
    localStorage.setItem(`onboarding_completed_${user?.id}`, 'true');
    navigate("/");
  };

  const handleSkip = () => {
    localStorage.setItem(`onboarding_completed_${user?.id}`, 'true');
    navigate("/");
  };

  return (
    <div className="min-h-screen relative bg-background flex items-center justify-center p-4 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      
      {/* Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />

      <div className="w-full max-w-4xl space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-top duration-700">
          <div className="inline-flex relative group">
            <div className="absolute inset-0 bg-gradient-primary rounded-full blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
            <img 
              src={kodoLogo} 
              alt="Kodo Logo" 
              className="w-20 h-20 object-contain relative z-10 drop-shadow-2xl"
            />
          </div>
          
          <Progress value={progress} className="h-2 max-w-md mx-auto" />
          
          <p className="text-sm text-muted-foreground">
            Passo {currentStep + 1} de {welcomeSteps.length}
          </p>
        </div>

        {/* Content Card */}
        <Card className="p-8 md:p-12 bg-card/50 backdrop-blur-2xl border-border/50 shadow-2xl animate-in fade-in slide-in-from-bottom duration-700">
          <div className="space-y-8">
            {/* Icon and Title */}
            <div className="text-center space-y-4">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                <Icon className="w-12 h-12 text-primary" />
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  {step.title}
                </span>
              </h1>
              
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
                {step.description}
              </p>
            </div>

            {/* Features List */}
            <div className="grid gap-4 max-w-2xl mx-auto">
              {step.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 rounded-lg bg-background/50 border border-border/50 animate-in fade-in slide-in-from-left duration-500"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm md:text-base text-foreground">{feature}</span>
                </div>
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground"
              >
                Pular tutorial
              </Button>

              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                  </Button>
                )}
                
                <Button
                  onClick={handleNext}
                  className="gap-2 bg-gradient-primary hover:opacity-90 shadow-lg hover:shadow-primary/50"
                >
                  {currentStep === welcomeSteps.length - 1 ? (
                    <>
                      Começar
                      <Zap className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Próximo
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2 animate-in fade-in duration-700" style={{ animationDelay: '200ms' }}>
          {welcomeSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentStep 
                  ? 'w-8 bg-primary' 
                  : index < currentStep
                  ? 'w-2 bg-primary/50'
                  : 'w-2 bg-muted'
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Welcome;
