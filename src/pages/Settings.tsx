import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Loader2, Sparkles, GraduationCap, Crown, Clock, Brain, Server, User, CreditCard, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AvatarUpload } from "@/components/AvatarUpload";

const Settings = () => {
  const { user } = useAuth();
  const { subscription, currentPlan, isTrialActive, daysLeftInTrial, planLimits, isReadOnly, changePlan } = useSubscription();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [profile, setProfile] = useState({
    full_name: "",
    company: "",
    username: "",
    avatar_url: "",
  });

  const aiUsagePercent = planLimits.aiAnalysesPerMonth === Infinity 
    ? 0 
    : ((subscription?.ai_analyses_used || 0) / planLimits.aiAnalysesPerMonth) * 100;

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error(error);
    } else if (data) {
      setProfile({
        full_name: data.full_name || "",
        company: data.company || "",
        username: data.username || "",
        avatar_url: data.avatar_url || "",
      });
    }
  };

  const handleGenerateDemoData = async () => {
    setDemoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-data');
      if (error) throw error;
      toast.success(`Generated ${data.clusters} clusters and ${data.incidents} AI incidents!`);
      setTimeout(() => window.location.href = '/', 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate demo data");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleGenerateAISavings = async () => {
    setSavingsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-ai-savings');
      if (error) throw error;
      toast.success(`Generated ${data.savings_created} AI savings records!`);
      setTimeout(() => window.location.href = '/costs', 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate AI savings data");
    } finally {
      setSavingsLoading(false);
    }
  };

  const validateUsername = (username: string) => {
    if (!username) {
      setUsernameError("");
      return true;
    }
    if (username.length < 3) {
      setUsernameError("Username deve ter pelo menos 3 caracteres");
      return false;
    }
    if (username.length > 20) {
      setUsernameError("Username deve ter no máximo 20 caracteres");
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError("Username pode conter apenas letras, números e _");
      return false;
    }
    setUsernameError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateUsername(profile.username)) return;
    
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        username: profile.username || null,
        company: profile.company,
      })
      .eq("id", user?.id);

    if (error) {
      if (error.code === '23505') {
        toast.error("Este username já está em uso");
      } else {
        toast.error("Falha ao atualizar perfil");
      }
      console.error(error);
    } else {
      toast.success("Perfil atualizado com sucesso!");
    }
    setLoading(false);
  };

  const plans = [
    {
      name: "Free",
      price: "R$ 0",
      period: "/mês",
      features: ["1 cluster", "5 análises de IA/mês", "7 dias de histórico", "Suporte por email"],
      current: currentPlan === 'free',
      plan: 'free' as const,
    },
    {
      name: "Pro",
      price: "R$ 99",
      period: "/mês",
      features: ["10 clusters", "100 análises de IA/mês", "30 dias de histórico", "Auto-healing básico", "Suporte prioritário"],
      current: currentPlan === 'pro',
      plan: 'pro' as const,
      popular: true,
    },
    {
      name: "Enterprise",
      price: "R$ 299",
      period: "/mês",
      features: ["Clusters ilimitados", "Análises de IA ilimitadas", "90 dias de histórico", "Auto-healing avançado", "Suporte 24/7", "SLA garantido"],
      current: currentPlan === 'enterprise',
      plan: 'enterprise' as const,
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Gerencie sua conta e preferências</p>
        </div>

        <Tabs defaultValue="profile" className="max-w-4xl">
          <TabsList className="mb-6">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="upgrade" className="gap-2">
              <Crown className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2">
              <Database className="w-4 h-4" />
              Dados
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="p-6 bg-card border-border">
              <h3 className="text-lg font-semibold text-card-foreground mb-6">Foto de Perfil</h3>
              {user && (
                <AvatarUpload
                  userId={user.id}
                  currentAvatarUrl={profile.avatar_url}
                  username={profile.username}
                  onAvatarChange={(url) => setProfile({ ...profile, avatar_url: url })}
                />
              )}
            </Card>

            <Card className="p-6 bg-card border-border">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Informações do Perfil</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    value={profile.full_name}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">O nome completo não pode ser alterado</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={profile.username}
                    onChange={(e) => {
                      setProfile({ ...profile, username: e.target.value });
                      validateUsername(e.target.value);
                    }}
                    placeholder="meu_username"
                    className={usernameError ? "border-destructive" : ""}
                  />
                  {usernameError && (
                    <p className="text-xs text-destructive">{usernameError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Seu identificador único na plataforma</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    value={profile.company}
                    onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                    placeholder="Minha Empresa Ltda."
                  />
                </div>
                <Button type="submit" disabled={loading || !!usernameError}>
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </form>
            </Card>

            <Card className="p-6 bg-card border-border">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Informações da Conta</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">ID do Usuário</span>
                  <span className="text-card-foreground font-mono text-xs">{user?.id}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Conta Criada</span>
                  <span className="text-card-foreground">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : "N/A"}
                  </span>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Upgrade Tab */}
          <TabsContent value="upgrade" className="space-y-6">
            {/* Current Plan Status */}
            <Card className="p-6 bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-amber-500/20">
                  <Crown className="h-6 w-6 text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">Seu Plano Atual</h3>
                    <Badge variant="secondary" className="capitalize">
                      {currentPlan}
                    </Badge>
                    {isTrialActive && (
                      <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                        Trial - {daysLeftInTrial} dias restantes
                      </Badge>
                    )}
                    {isReadOnly && (
                      <Badge variant="destructive">Somente leitura</Badge>
                    )}
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-3 mt-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                      <Brain className="w-4 h-4 text-blue-500" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Análises de IA</p>
                        <p className="font-medium text-sm">
                          {subscription?.ai_analyses_used || 0} / {planLimits.aiAnalysesPerMonth === Infinity ? '∞' : planLimits.aiAnalysesPerMonth}
                        </p>
                        {planLimits.aiAnalysesPerMonth !== Infinity && (
                          <Progress value={aiUsagePercent} className="h-1 mt-1" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                      <Server className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Limite de clusters</p>
                        <p className="font-medium">
                          {planLimits.clusters === Infinity ? 'Ilimitado' : `Até ${planLimits.clusters}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                      <Clock className="w-4 h-4 text-purple-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Histórico</p>
                        <p className="font-medium">{planLimits.historyRetentionDays} dias</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Plans Grid */}
            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((plan) => (
                <Card 
                  key={plan.name}
                  className={`p-6 relative ${plan.popular ? 'border-primary shadow-lg' : 'border-border'} ${plan.current ? 'bg-primary/5' : ''}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                      Mais Popular
                    </Badge>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.current ? "outline" : plan.popular ? "default" : "secondary"}
                    disabled={plan.current}
                  >
                    {plan.current ? "Plano Atual" : "Escolher Plano"}
                  </Button>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-6">
            {/* Demo Data Card */}
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/20">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Gerar Dados de Demonstração</h3>
                  <p className="text-muted-foreground mb-4">
                    Popule sua plataforma com dados realistas incluindo 8 clusters de múltiplos provedores,
                    incidentes detectados por IA com ações de auto-healing.
                  </p>
                  <Button 
                    onClick={handleGenerateDemoData} 
                    disabled={demoLoading}
                    className="gap-2"
                  >
                    {demoLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {demoLoading ? 'Gerando...' : 'Gerar Dados Demo'}
                  </Button>
                </div>
              </div>
            </Card>

            {/* AI Savings Data Generator */}
            <Card className="p-6 bg-gradient-to-br from-success/5 to-success/10 border-success/20">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-success/20">
                  <Sparkles className="h-6 w-6 text-success" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Gerar Dados de Economia IA</h3>
                  <p className="text-muted-foreground mb-4">
                    Popule o banco com dados realistas de economia gerada por IA baseados nos seus clusters existentes.
                  </p>
                  <Button 
                    onClick={handleGenerateAISavings} 
                    disabled={savingsLoading}
                    className="gap-2 bg-success hover:bg-success/90"
                  >
                    {savingsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savingsLoading ? 'Gerando...' : 'Gerar Dados de Economia'}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Welcome Tutorial Card */}
            <Card className="p-6 bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-accent/20">
                  <GraduationCap className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Tutorial de Boas-Vindas</h3>
                  <p className="text-muted-foreground mb-4">
                    Reveja o tutorial interativo que mostra todas as funcionalidades do Kodo.
                  </p>
                  <Button 
                    onClick={() => navigate('/welcome')} 
                    variant="outline"
                    className="gap-2"
                  >
                    <GraduationCap className="h-4 w-4" />
                    Ver Tutorial
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
