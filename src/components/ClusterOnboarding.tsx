import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Server,
  Cloud,
  Terminal,
  FileCode,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Copy,
  ExternalLink,
  Lightbulb,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const onboardingSteps = [
  {
    id: 1,
    icon: Server,
    title: "Bem-vindo ao Kodo!",
    subtitle: "Configure seu primeiro cluster Kubernetes",
    description: "Para começar a monitorar seus clusters, você precisa conectar pelo menos um cluster Kubernetes. Vamos te guiar nesse processo!",
    tips: [
      "Você pode conectar clusters de qualquer provedor (AWS, GCP, Azure, etc.)",
      "O processo é rápido e leva menos de 5 minutos",
      "Você terá acesso completo ao monitoramento em tempo real"
    ],
    action: "Começar Configuração",
    color: "primary"
  },
  {
    id: 2,
    icon: Cloud,
    title: "Escolha seu Provedor",
    subtitle: "Onde está seu cluster Kubernetes?",
    description: "O Kodo suporta clusters de diversos provedores. Escolha onde seu cluster está hospedado:",
    providers: [
      { name: "AWS EKS", popular: true },
      { name: "Google GKE", popular: true },
      { name: "Azure AKS", popular: true },
      { name: "DigitalOcean", popular: false },
      { name: "On-Premise", popular: false },
      { name: "Outros", popular: false }
    ],
    tips: [
      "Você pode adicionar clusters de múltiplos provedores",
      "Clusters on-premise também são suportados",
      "O processo é similar para todos os provedores"
    ],
    color: "accent"
  },
  {
    id: 3,
    icon: Terminal,
    title: "Obter Credenciais",
    subtitle: "Como conseguir as informações do cluster",
    description: "Você precisará do arquivo kubeconfig do seu cluster. Veja como obtê-lo em cada provedor:",
    commands: [
      {
        provider: "AWS EKS",
        command: "aws eks update-kubeconfig --name <cluster-name> --region <region>",
        description: "Execute no AWS CLI para configurar o kubeconfig"
      },
      {
        provider: "Google GKE",
        command: "gcloud container clusters get-credentials <cluster-name> --region <region>",
        description: "Execute no Google Cloud SDK"
      },
      {
        provider: "Azure AKS",
        command: "az aks get-credentials --resource-group <rg-name> --name <cluster-name>",
        description: "Execute no Azure CLI"
      }
    ],
    tips: [
      "O arquivo kubeconfig geralmente está em ~/.kube/config",
      "Certifique-se de ter as permissões necessárias",
      "Você pode testar a conexão com: kubectl get nodes"
    ],
    color: "primary"
  },
  {
    id: 4,
    icon: FileCode,
    title: "Instalar o Agente",
    subtitle: "Deploy do Kodo Agent no seu cluster",
    description: "Para monitoramento completo, você precisa instalar o Kodo Agent no seu cluster:",
    installSteps: [
      {
        step: 1,
        title: "Aplicar o manifesto Kubernetes",
        command: "kubectl apply -f https://raw.githubusercontent.com/kodo-platform/agent/main/deploy.yaml",
        description: "Isso criará o namespace e deployment do agente"
      },
      {
        step: 2,
        title: "Configurar a API Key",
        command: "kubectl create secret generic kodo-secret -n kodo --from-literal=API_KEY=<sua-api-key>",
        description: "Sua API key será gerada automaticamente ao adicionar o cluster"
      },
      {
        step: 3,
        title: "Verificar o status",
        command: "kubectl get pods -n kodo",
        description: "Confirme que o pod do agente está rodando"
      }
    ],
    tips: [
      "O agente coleta métricas de CPU, memória e eventos",
      "Ele usa menos de 100MB de RAM",
      "Atualizações são automáticas e sem downtime"
    ],
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Comando copiado!");
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4">
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

            {/* Providers Grid */}
            {step.providers && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {step.providers.map((provider, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg bg-background/50 border border-border/50 hover:border-primary/50 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">
                        {provider.name}
                      </span>
                      {provider.popular && (
                        <Badge variant="secondary" className="text-xs">
                          Popular
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Commands */}
            {step.commands && (
              <div className="space-y-4">
                {step.commands.map((cmd, index) => (
                  <div
                    key={index}
                    className="space-y-2 animate-in fade-in slide-in-from-left duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">{cmd.provider}</span>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 rounded-lg transition-opacity" />
                      <div className="relative flex items-center gap-2 p-4 rounded-lg bg-muted/50 border border-border font-mono text-sm">
                        <code className="flex-1 overflow-x-auto">{cmd.command}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(cmd.command)}
                          className="flex-shrink-0"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">{cmd.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Install Steps */}
            {step.installSteps && (
              <div className="space-y-6">
                {step.installSteps.map((installStep, index) => (
                  <div
                    key={index}
                    className="space-y-3 animate-in fade-in slide-in-from-left duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                        {installStep.step}
                      </div>
                      <h3 className="font-semibold">{installStep.title}</h3>
                    </div>
                    <div className="relative group ml-11">
                      <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 rounded-lg transition-opacity" />
                      <div className="relative flex items-center gap-2 p-4 rounded-lg bg-muted/50 border border-border font-mono text-xs">
                        <code className="flex-1 overflow-x-auto">{installStep.command}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(installStep.command)}
                          className="flex-shrink-0"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground ml-11">{installStep.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tips */}
            <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 text-primary">
                <Lightbulb className="w-5 h-5" />
                <span className="font-semibold">Dicas Importantes</span>
              </div>
              <ul className="space-y-2">
                {step.tips.map((tip, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-left duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/clusters")}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Ir para Clusters
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
                      Adicionar Cluster
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
