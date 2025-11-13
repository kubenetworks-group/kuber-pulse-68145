import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, Building2, Server, Sparkles } from "lucide-react";
import { DemoClusterButton } from "@/components/DemoClusterButton";

interface ClusterConfig {
  name: string;
  provider: string;
  cluster_type: string;
  environment: string;
  api_endpoint: string;
  region: string;
  kubeconfig?: string;
}

interface ValidationResult {
  has_storage: boolean;
  has_monitoring: boolean;
  has_ingress: boolean;
  available_features: string[];
  recommendations: string;
  validation_status: 'success' | 'warning' | 'error';
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { completeOnboarding } = useOnboarding();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Company Info
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");

  // Step 2: Cluster Configuration
  const [clusterConfig, setClusterConfig] = useState<ClusterConfig>({
    name: "",
    provider: "",
    cluster_type: "kubernetes",
    environment: "production",
    api_endpoint: "",
    region: "",
    kubeconfig: "",
  });

  // Step 3: Validation Results
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [clusterId, setClusterId] = useState<string | null>(null);
  
  // Step 4: Configuration Progress
  const [configStep, setConfigStep] = useState(0);
  const [configMessage, setConfigMessage] = useState("");

  const handleDemoClusterSuccess = (cluster: any, validation: any) => {
    setClusterId(cluster.id);
    
    // Format validation result to match expected structure
    const formattedResult: ValidationResult = {
      has_storage: validation.has_storage,
      has_monitoring: validation.has_monitoring,
      has_ingress: validation.has_ingress,
      available_features: validation.available_features?.storage || [],
      recommendations: validation.recommendations,
      validation_status: validation.validation_status === 'completed' ? 'success' : validation.validation_status
    };
    
    setValidationResult(formattedResult);
    setStep(3);
  };

  const handleStep1Next = async () => {
    if (!companyName.trim()) {
      toast.error("Por favor, informe o nome da empresa");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .insert({
          user_id: user?.id,
          company_name: companyName,
          cnpj: cnpj || null,
          onboarding_completed: false,
        });

      if (error) throw error;
      setStep(2);
    } catch (error) {
      console.error('Error saving company info:', error);
      toast.error("Erro ao salvar informações da empresa");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Next = async () => {
    if (!clusterConfig.name || !clusterConfig.provider || !clusterConfig.api_endpoint) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // Create cluster
      const { data: cluster, error: clusterError } = await supabase
        .from('clusters')
        .insert({
          user_id: user?.id,
          name: clusterConfig.name,
          provider: clusterConfig.provider,
          cluster_type: clusterConfig.cluster_type,
          environment: clusterConfig.environment,
          api_endpoint: clusterConfig.api_endpoint,
          region: clusterConfig.region,
          config_file: clusterConfig.kubeconfig,
          status: 'connecting',
        })
        .select()
        .single();

      if (clusterError) throw clusterError;
      setClusterId(cluster.id);

      // Validate cluster with AI
      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-cluster-setup',
        {
          body: {
            cluster_id: cluster.id,
            config: clusterConfig,
          },
        }
      );

      if (validationError) throw validationError;
      setValidationResult(validationData);
      setStep(3);
    } catch (error) {
      console.error('Error validating cluster:', error);
      toast.error("Erro ao validar cluster");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setStep(4); // Go to configuration step
    
    // Simulate configuration steps with progress
    const configSteps = [
      { message: "Inicializando ambiente...", delay: 800 },
      { message: "Configurando permissões de acesso...", delay: 1000 },
      { message: "Carregando métricas do cluster...", delay: 1200 },
      { message: "Ativando monitoramento em tempo real...", delay: 1000 },
      { message: "Preparando dashboard...", delay: 800 }
    ];

    for (let i = 0; i < configSteps.length; i++) {
      setConfigStep(i);
      setConfigMessage(configSteps[i].message);
      await new Promise(resolve => setTimeout(resolve, configSteps[i].delay));
    }

    try {
      // Initialize trial subscription
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (org) {
        const { data: trialData, error: trialError } = await supabase.functions.invoke('initialize-trial', {
          body: { organization_id: org.id, user_id: user?.id },
        });

        if (trialError) {
          console.error('Error initializing trial:', trialError);
          toast.error("Erro ao inicializar trial");
        } else {
          console.log('Trial initialized:', trialData);
          toast.success("Trial de 30 dias ativado!");
        }
      }

      await completeOnboarding();
      navigate('/');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error("Erro ao finalizar configuração");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl p-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  s === step
                    ? "bg-primary text-primary-foreground scale-110"
                    : s < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s < step ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`h-1 flex-1 mx-2 rounded transition-all ${
                    s < step ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Company Information */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <Building2 className="w-12 h-12 mx-auto text-primary" />
              <h2 className="text-2xl font-bold">Informações da Empresa</h2>
              <p className="text-muted-foreground">
                Vamos começar com algumas informações básicas
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="companyName">Nome da Empresa *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Minha Empresa LTDA"
                />
              </div>

              <div>
                <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>

            <Button
              onClick={handleStep1Next}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Próximo"
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Cluster Configuration */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <Server className="w-12 h-12 mx-auto text-primary" />
              <h2 className="text-2xl font-bold">Configuração do Cluster</h2>
              <p className="text-muted-foreground">
                Configure a conexão com seu cluster Kubernetes
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="clusterName">Nome do Cluster *</Label>
                <Input
                  id="clusterName"
                  value={clusterConfig.name}
                  onChange={(e) =>
                    setClusterConfig({ ...clusterConfig, name: e.target.value })
                  }
                  placeholder="Ex: Production EKS"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="provider">Provedor Cloud *</Label>
                  <Select
                    value={clusterConfig.provider}
                    onValueChange={(value) =>
                      setClusterConfig({ ...clusterConfig, provider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws">AWS (EKS)</SelectItem>
                      <SelectItem value="gcp">Google Cloud (GKE)</SelectItem>
                      <SelectItem value="azure">Azure (AKS)</SelectItem>
                      <SelectItem value="digitalocean">DigitalOcean</SelectItem>
                      <SelectItem value="on-premise">On-Premise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="environment">Ambiente *</Label>
                  <Select
                    value={clusterConfig.environment}
                    onValueChange={(value) =>
                      setClusterConfig({ ...clusterConfig, environment: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">Produção</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="development">Desenvolvimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="apiEndpoint">API Endpoint *</Label>
                <Input
                  id="apiEndpoint"
                  value={clusterConfig.api_endpoint}
                  onChange={(e) =>
                    setClusterConfig({ ...clusterConfig, api_endpoint: e.target.value })
                  }
                  placeholder="https://api.cluster.example.com"
                />
              </div>

              <div>
                <Label htmlFor="region">Região</Label>
                <Input
                  id="region"
                  value={clusterConfig.region}
                  onChange={(e) =>
                    setClusterConfig({ ...clusterConfig, region: e.target.value })
                  }
                  placeholder="Ex: us-east-1"
                />
              </div>

              <div>
                <Label htmlFor="kubeconfig">Kubeconfig (opcional)</Label>
                <Textarea
                  id="kubeconfig"
                  value={clusterConfig.kubeconfig}
                  onChange={(e) =>
                    setClusterConfig({ ...clusterConfig, kubeconfig: e.target.value })
                  }
                  placeholder="Cole aqui o conteúdo do seu kubeconfig..."
                  rows={4}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-center space-y-2 mb-4">
                <p className="text-sm text-muted-foreground">
                  Não tem um cluster ainda? Crie um cluster de teste para explorar o sistema
                </p>
              </div>
              <DemoClusterButton onSuccess={handleDemoClusterSuccess} />
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={handleStep2Next}
                disabled={loading}
                className="flex-1"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  "Validar Cluster"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Validation Results */}
        {step === 3 && validationResult && (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <Sparkles className="w-12 h-12 mx-auto text-primary" />
              <h2 className="text-2xl font-bold">Análise do Ambiente</h2>
              <p className="text-muted-foreground">
                A IA analisou seu cluster e detectou as seguintes capacidades
              </p>
            </div>

            {/* Validation Status */}
            <Card className={`p-4 ${
              validationResult.validation_status === 'success'
                ? 'bg-green-500/10 border-green-500/20'
                : validationResult.validation_status === 'warning'
                ? 'bg-yellow-500/10 border-yellow-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex items-center gap-3">
                {validationResult.validation_status === 'success' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-yellow-500" />
                )}
                <div>
                  <p className="font-semibold">
                    {validationResult.validation_status === 'success'
                      ? 'Cluster validado com sucesso!'
                      : 'Cluster validado com avisos'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {validationResult.recommendations}
                  </p>
                </div>
              </div>
            </Card>

            {/* Features Grid */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 text-center">
                <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  validationResult.has_storage ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  {validationResult.has_storage ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  )}
                </div>
                <p className="font-medium">Storage</p>
                <p className="text-xs text-muted-foreground">
                  {validationResult.has_storage ? 'Disponível' : 'Não detectado'}
                </p>
              </Card>

              <Card className="p-4 text-center">
                <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  validationResult.has_monitoring ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  {validationResult.has_monitoring ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  )}
                </div>
                <p className="font-medium">Monitoramento</p>
                <p className="text-xs text-muted-foreground">
                  {validationResult.has_monitoring ? 'Disponível' : 'Não detectado'}
                </p>
              </Card>

              <Card className="p-4 text-center">
                <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  validationResult.has_ingress ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  {validationResult.has_ingress ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  )}
                </div>
                <p className="font-medium">Ingress</p>
                <p className="text-xs text-muted-foreground">
                  {validationResult.has_ingress ? 'Disponível' : 'Não detectado'}
                </p>
              </Card>
            </div>

            {/* Available Features */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Funcionalidades Disponíveis</h3>
              <div className="flex flex-wrap gap-2">
                {validationResult.available_features.map((feature) => (
                  <span
                    key={feature}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </Card>

            <Button
              onClick={handleFinish}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                "Concluir e Acessar Dashboard"
              )}
            </Button>
          </div>
        )}

        {/* Step 4: Configuration Progress */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center space-y-2 mb-8">
              <Sparkles className="w-12 h-12 mx-auto text-primary animate-pulse" />
              <h2 className="text-2xl font-bold">Configurando Dashboard</h2>
              <p className="text-muted-foreground">
                Aguarde enquanto preparamos tudo para você
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-4">
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out"
                  style={{ width: `${((configStep + 1) / 5) * 100}%` }}
                />
              </div>

              {/* Current Step Message */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground animate-fade-in">
                  {configMessage}
                </p>
              </div>

              {/* Configuration Steps */}
              <div className="space-y-3 mt-6">
                {[
                  "Inicializando ambiente",
                  "Configurando permissões",
                  "Carregando métricas",
                  "Ativando monitoramento",
                  "Preparando dashboard"
                ].map((label, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      index < configStep ? 'bg-green-500' : 
                      index === configStep ? 'bg-primary animate-pulse' :
                      'bg-muted'
                    }`}>
                      {index < configStep && <CheckCircle2 className="w-4 h-4 text-white" />}
                      {index === configStep && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                    </div>
                    <span className={`text-sm ${
                      index <= configStep ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
