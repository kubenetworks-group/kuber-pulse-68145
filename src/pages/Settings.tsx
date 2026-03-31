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
import { useSubscription, PLAN_LIMITS } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Loader2, Sparkles, GraduationCap, Crown, Clock, Brain, Server, User, Check, Shield, MessageSquare, XCircle, Info, FileText, Lock, Download, Trash2, ExternalLink } from "lucide-react";
import { AIUsageWidget } from "@/components/AIUsageWidget";
import { useNavigate, Link } from "react-router-dom";
import { AvatarUpload } from "@/components/AvatarUpload";
import { MFASetup } from "@/components/MFASetup";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { WhatsAppConfig } from "@/components/WhatsAppConfig";
import { WhatsAppApprovals } from "@/components/WhatsAppApprovals";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const { user } = useAuth();
  const { subscription, currentPlan, isTrialActive, daysLeftInTrial, planLimits, isReadOnly, changePlan } = useSubscription();
  const { isAdmin } = useAdminCheck();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoDeleteLoading, setDemoDeleteLoading] = useState(false);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [userConsent, setUserConsent] = useState<{
    terms_accepted: boolean;
    privacy_policy_accepted: boolean;
    marketing_consent: boolean;
    consent_date: string;
  } | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
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
    fetchConsent();
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

  const fetchConsent = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_consents")
      .select("terms_accepted, privacy_policy_accepted, marketing_consent, consent_date")
      .eq("user_id", user.id)
      .order("consent_date", { ascending: false })
      .limit(1)
      .single();
    if (data) setUserConsent(data);
  };

  const handleToggleMarketing = async () => {
    if (!user) return;
    setConsentLoading(true);
    const newValue = !userConsent?.marketing_consent;
    const { error } = await supabase.from("user_consents").insert({
      user_id: user.id,
      terms_accepted: userConsent?.terms_accepted ?? true,
      privacy_policy_accepted: userConsent?.privacy_policy_accepted ?? true,
      marketing_consent: newValue,
      user_agent: navigator.userAgent,
    });
    if (!error) {
      setUserConsent((prev) => prev ? { ...prev, marketing_consent: newValue } : null);
      toast.success(newValue ? "Comunicações de marketing ativadas." : "Comunicações de marketing desativadas.");
    } else {
      toast.error("Erro ao atualizar preferência.");
    }
    setConsentLoading(false);
  };

  const handleExportData = async () => {
    if (!user) return;
    setExportLoading(true);
    try {
      const [profileRes, clustersRes, consentsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("clusters").select("name, provider, region, status, created_at").eq("user_id", user.id),
        supabase.from("user_consents").select("*").eq("user_id", user.id).order("consent_date", { ascending: false }),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
        profile: profileRes.data,
        clusters: clustersRes.data ?? [],
        consents: consentsRes.data ?? [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kodo-meus-dados-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dados exportados com sucesso!");
    } catch {
      toast.error("Erro ao exportar dados.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteAccountLoading(true);
    try {
      const { error } = await supabase.rpc("delete_user_account");
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Conta excluída com sucesso.");
    } catch {
      toast.error("Erro ao excluir conta. Entre em contato com o suporte.");
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const handleGenerateDemoData = async () => {
    setDemoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-data');
      if (error) throw error;
      toast.success(`Gerado ${data.clusters} clusters e ${data.incidents} incidentes IA!`);
      setTimeout(() => window.location.href = '/', 2000);
    } catch (error: any) {
      toast.error(error.message || "Falha ao gerar dados demo");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleDeleteDemoData = async () => {
    setDemoDeleteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-demo-data');
      if (error) throw error;
      toast.success(`Removidos: ${data.deleted.clusters} clusters, ${data.deleted.incidents} incidentes demo`);
      setTimeout(() => window.location.href = '/', 2000);
    } catch (error: any) {
      toast.error(error.message || "Falha ao remover dados demo");
    } finally {
      setDemoDeleteLoading(false);
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
    if (!user?.id) return;
    
    setLoading(true);

    // Use upsert to handle cases where profile doesn't exist yet
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        username: profile.username || null,
        company: profile.company,
        full_name: profile.full_name || null,
        avatar_url: profile.avatar_url || null,
      }, { 
        onConflict: 'id' 
      });

    if (error) {
      if (error.code === '23505') {
        toast.error("Este username já está em uso");
      } else {
        toast.error("Falha ao atualizar perfil");
        console.error(error);
      }
    } else {
      toast.success("Perfil atualizado com sucesso!");
    }
    setLoading(false);
  };

  const handleCancelPlan = async () => {
    setCancelLoading(true);
    try {
      await changePlan('free');
      toast.success("Plano cancelado com sucesso! Você agora está no plano Free.");
    } catch (error: any) {
      toast.error(error.message || "Falha ao cancelar o plano");
    } finally {
      setCancelLoading(false);
    }
  };

  const plans = [
    {
      name: "Free",
      price: "R$ 0",
      period: "/mês",
      features: ["1 cluster", "10 análises de IA/mês", "7 dias de histórico", "Suporte por email"],
      current: currentPlan === 'free',
      plan: 'free' as const,
    },
    {
      name: "Pro",
      price: "R$ 250",
      period: "/mês",
      features: ["10 clusters", "Análises de IA ilimitadas", "90 dias de histórico", "Auto-healing", "Suporte prioritário"],
      current: currentPlan === 'pro',
      plan: 'pro' as const,
      popular: true,
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
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              WhatsApp
              {currentPlan === 'pro' && (
                <Badge variant="secondary" className="ml-1 text-xs">PRO</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upgrade" className="gap-2">
              <Crown className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2">
              <Lock className="w-4 h-4" />
              Privacidade
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="data" className="gap-2">
                <Database className="w-4 h-4" />
                Dados
              </TabsTrigger>
            )}
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

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <MFASetup />
            
            <Card className="p-6 bg-card border-border">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Sessões Ativas</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Gerencie suas sessões ativas em diferentes dispositivos.
              </p>
              <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10">
                Encerrar Todas as Outras Sessões
              </Button>
            </Card>
          </TabsContent>

          {/* WhatsApp Tab */}
          <TabsContent value="whatsapp" className="space-y-6">
            <WhatsAppConfig />
            <WhatsAppApprovals />
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
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold">Seu Plano Contratado</h3>
                    <Badge variant="secondary" className="capitalize">
                      {subscription?.plan || 'free'}
                    </Badge>
                    {isTrialActive && (
                      <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                        Trial Pro - {daysLeftInTrial} dias restantes
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
                          {isTrialActive && <span className="text-xs text-muted-foreground ml-1">(trial)</span>}
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
                          {isTrialActive ? (
                            <>
                              Até {PLAN_LIMITS.pro.clusters}
                              <span className="text-xs text-muted-foreground ml-1">(trial)</span>
                            </>
                          ) : (
                            planLimits.clusters === Infinity ? 'Ilimitado' : `Até ${planLimits.clusters}`
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                      <Clock className="w-4 h-4 text-purple-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Histórico</p>
                        <p className="font-medium">
                          {planLimits.historyRetentionDays} dias
                          {isTrialActive && <span className="text-xs text-muted-foreground ml-1">(trial)</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isTrialActive && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-4">
                      <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Você está no período de teste com acesso aos recursos Pro. 
                        Após o término, seu plano será <strong>{subscription?.plan || 'free'}</strong> com limite de{' '}
                        <strong>{PLAN_LIMITS[subscription?.plan || 'free'].clusters} cluster</strong> e{' '}
                        <strong>{PLAN_LIMITS[subscription?.plan || 'free'].aiAnalysesPerMonth} análises de IA/mês</strong>.
                      </p>
                    </div>
                  )}
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

            {/* Cancel Plan Section */}
            {currentPlan === 'pro' && (
              <Card className="p-6 border-destructive/30 bg-destructive/5">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-destructive/20">
                    <XCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">Cancelar Plano Pro</h3>
                    <p className="text-muted-foreground mb-4">
                      Ao cancelar, você perderá acesso aos recursos premium como análises ilimitadas, 
                      auto-healing e suporte prioritário. Seu plano será revertido para o Free.
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="gap-2">
                          <XCircle className="w-4 h-4" />
                          Cancelar Plano Pro
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tem certeza que deseja cancelar?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação irá reverter seu plano para o Free. Você perderá acesso a:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>Análises de IA ilimitadas</li>
                              <li>Até 10 clusters (será limitado a 1)</li>
                              <li>Auto-healing automático</li>
                              <li>90 dias de histórico (será 7 dias)</li>
                              <li>Suporte prioritário</li>
                            </ul>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Manter Plano Pro</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleCancelPlan}
                            disabled={cancelLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {cancelLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Cancelando...
                              </>
                            ) : (
                              "Sim, cancelar plano"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-6">
            {/* Consent status */}
            <Card className="p-6 bg-card border-border">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Meus Consentimentos (LGPD)
              </h3>
              {userConsent ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Termos de Uso</p>
                        <p className="text-xs text-muted-foreground">
                          Aceito em {new Date(userConsent.consent_date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Política de Privacidade</p>
                        <p className="text-xs text-muted-foreground">
                          Aceita em {new Date(userConsent.consent_date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div>
                      <p className="text-sm font-medium">Comunicações de Marketing</p>
                      <p className="text-xs text-muted-foreground">
                        Receber novidades, atualizações e ofertas por e-mail
                      </p>
                    </div>
                    <Switch
                      checked={userConsent.marketing_consent}
                      onCheckedChange={handleToggleMarketing}
                      disabled={consentLoading}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum registro de consentimento encontrado. Faça logout e cadastre-se novamente para registrar seus consentimentos.
                </p>
              )}

              <div className="flex gap-3 mt-4 pt-4 border-t border-border/50">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/terms" target="_blank" className="gap-2">
                    <ExternalLink className="w-3 h-3" />
                    Termos de Uso
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/privacy" target="_blank" className="gap-2">
                    <ExternalLink className="w-3 h-3" />
                    Política de Privacidade
                  </Link>
                </Button>
              </div>
            </Card>

            {/* Data portability */}
            <Card className="p-6 bg-card border-border">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                Exportar Meus Dados
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                De acordo com o Art. 18 da LGPD, você tem direito à portabilidade dos seus dados.
                Baixe uma cópia de todos os seus dados cadastrados na plataforma em formato JSON.
              </p>
              <Button onClick={handleExportData} disabled={exportLoading} variant="outline" className="gap-2">
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exportLoading ? "Exportando..." : "Baixar meus dados"}
              </Button>
            </Card>

            {/* Delete account */}
            <Card className="p-6 border-destructive/30 bg-destructive/5">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Excluir Minha Conta
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                De acordo com o Art. 18 da LGPD, você tem direito à eliminação dos dados pessoais
                tratados com seu consentimento. Esta ação é <strong>irreversível</strong> e removerá
                permanentemente sua conta, clusters, configurações e histórico de dados.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Excluir minha conta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é <strong>irreversível</strong>. Todos os seus dados serão eliminados,
                      incluindo:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Perfil e configurações</li>
                        <li>Clusters e métricas</li>
                        <li>Histórico de incidentes</li>
                        <li>Registros de custos</li>
                        <li>Logs de auditoria</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={deleteAccountLoading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteAccountLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Excluindo...
                        </>
                      ) : (
                        "Sim, excluir minha conta"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-6">
            {/* AI Usage Widget */}
            <AIUsageWidget />

            {/* Demo Data Card */}
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/20">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Dados de Demonstração</h3>
                  <p className="text-muted-foreground mb-4">
                    Popule sua plataforma com dados realistas incluindo 8 clusters de múltiplos provedores,
                    incidentes detectados por IA com ações de auto-healing.
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleGenerateDemoData} 
                      disabled={demoLoading || demoDeleteLoading}
                      className="gap-2"
                    >
                      {demoLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {demoLoading ? 'Gerando...' : 'Gerar Dados Demo'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive"
                          disabled={demoLoading || demoDeleteLoading}
                          className="gap-2"
                        >
                          {demoDeleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                          {demoDeleteLoading ? 'Removendo...' : 'Remover Dados Demo'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover todos os dados demo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso irá deletar todos os clusters, incidentes, custos e PVCs marcados como demo. 
                            Seus dados reais serão mantidos intactos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteDemoData}>
                            Confirmar Remoção
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
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
