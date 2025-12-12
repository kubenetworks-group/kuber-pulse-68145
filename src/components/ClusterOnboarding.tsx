import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Shield,
  Activity,
  DollarSign,
  Zap,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Lightbulb,
  BarChart3,
  Bot,
  Lock,
  TrendingDown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ClusterAssistantChat } from "@/components/ClusterAssistantChat";

const onboardingSteps = [
  {
    id: 1,
    icon: Brain,
    title: "Bem-vindo ao Kodo!",
    subtitle: "Gestão Inteligente de Kubernetes",
    description: "O Kodo é a plataforma mais avançada para gerenciar seus clusters Kubernetes com inteligência artificial. Veja o que podemos fazer por você!",
    features: [
      { icon: Activity, text: "Monitoramento em tempo real 24/7" },
      { icon: Brain, text: "Análise com IA avançada" },
      { icon: Shield, text: "Segurança automatizada" },
      { icon: DollarSign, text: "Otimização de custos" }
    ],
    highlight: "Reduza em até 60% o tempo gasto em operações",
    color: "primary"
  },
  {
    id: 2,
    icon: Bot,
    title: "Auto-Healing Inteligente",
    subtitle: "Resolução automática de problemas",
    description: "Nossa IA monitora seus clusters 24/7 e resolve problemas automaticamente antes que afetem seus usuários.",
    features: [
      { icon: Zap, text: "Detecção de anomalias em segundos" },
      { icon: CheckCircle2, text: "Correção automática de pods com falha" },
      { icon: Activity, text: "Restart inteligente de serviços" },
      { icon: Brain, text: "Aprendizado contínuo com seus padrões" }
    ],
    highlight: "Tempo médio de resolução: 30 segundos",
    color: "accent"
  },
  {
    id: 3,
    icon: TrendingDown,
    title: "Otimização de Custos",
    subtitle: "Economize até 40% na sua infraestrutura",
    description: "Análise inteligente de recursos identifica desperdícios e sugere otimizações para reduzir seus custos de cloud.",
    features: [
      { icon: BarChart3, text: "Análise detalhada por namespace" },
      { icon: DollarSign, text: "Identificação de recursos ociosos" },
      { icon: Activity, text: "Recomendações de rightsizing" },
      { icon: Zap, text: "Alertas de gastos anormais" }
    ],
    highlight: "Economia média de $2.500/mês por cluster",
    color: "primary"
  },
  {
    id: 4,
    icon: Lock,
    title: "Segurança Avançada",
    subtitle: "Proteção completa para seus workloads",
    description: "Escaneamento contínuo de vulnerabilidades, análise de RBAC e detecção de configurações inseguras.",
    features: [
      { icon: Shield, text: "Scan de vulnerabilidades em imagens" },
      { icon: Lock, text: "Análise de políticas RBAC" },
      { icon: CheckCircle2, text: "Compliance com CIS Benchmarks" },
      { icon: Brain, text: "Recomendações de hardening" }
    ],
    highlight: "Score de segurança em tempo real",
    color: "accent"
  }
];

export const ClusterOnboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;
  const step = onboardingSteps[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate("/clusters");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4">
      {/* AI Assistant Chat */}
      <ClusterAssistantChat />
      
      <div className="w-full max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom duration-700">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Passo {currentStep + 1} de {onboardingSteps.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Main Card */}
        <Card className="p-8 md:p-12 bg-card/50 backdrop-blur-2xl border-border/50 shadow-2xl relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-br from-accent/20 to-transparent rounded-full blur-3xl" />
          
          <div className="relative space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 animate-pulse" style={{ animationDuration: '3s' }}>
                <Icon className="w-12 h-12 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="bg-gradient-primary bg-clip-text text-transparent">
                    {step.title}
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground font-medium">
                  {step.subtitle}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-base text-foreground text-center max-w-2xl mx-auto">
              {step.description}
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {step.features.map((feature, index) => {
                const FeatureIcon = feature.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-xl bg-background/50 border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 animate-in fade-in slide-in-from-bottom"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
                      <FeatureIcon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {feature.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Highlight Box */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 text-center">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Lightbulb className="w-5 h-5" />
                <span className="font-semibold text-lg">{step.highlight}</span>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/clusters")}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                Pular introdução
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
                  {currentStep === onboardingSteps.length - 1 ? (
                    <>
                      Configurar Cluster
                      <Sparkles className="w-4 h-4" />
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
        <div className="flex justify-center gap-2">
          {onboardingSteps.map((_, index) => (
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
