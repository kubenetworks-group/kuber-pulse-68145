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
import { seedDemoData, deleteDemoData, generateAISavings } from "@/services/demoDataSeeder";
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
      const { error } = await supabase.rpc("delete_user_account" as any);
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
      const result = await seedDemoData();
      toast.success(`Gerado ${result.clusters} clusters, ${result.incidents} incidentes IA e ${result.agent_metrics} métricas!`);
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
      const result = await deleteDemoData();
      toast.success(`Removidos: ${result.clusters} clusters e ${result.incidents} incidentes demo`);
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
      const result = await generateAISavings();
      toast.success(`${result.savings_created} registros de economia com IA gerados para ${result.clusters_processed} clusters!`);
      setTimeout(() => window.location.href = '/costs', 2000);
    } catch (error: any) {
      toast.error(error.message || "Falha ao gerar dados de economia com IA");
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
      {/* ── Page header ── */}
      <div className="border-b bg-gradient-to-r from-slate-50/80 to-white dark:from-slate-900/80 dark:to-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-7 flex items-center gap-4">
          <div className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Configurações</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie sua conta e preferências</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <Tabs defaultValue="profile" className="flex flex-col lg:flex-row gap-8">

          {/* ── Sidebar ── */}
          <div className="lg:w-56 shrink-0 space-y-3">

            {/* Profile summary */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm text-center">
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 overflow-hidden flex items-center justify-center">
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    : <User className="w-6 h-6 text-slate-400" />}
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {profile.full_name || profile.username || 'Usuário'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
                <Badge variant="secondary" className="capitalize text-xs">
                  {currentPlan}{isTrialActive ? ' · Trial' : ''}
                </Badge>
              </div>
            </div>

            {/* Nav tabs */}
            <TabsList className="flex flex-col w-full h-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 gap-0.5">
              {([
                { value: 'profile',  icon: User,          label: 'Perfil',      badge: null },
                { value: 'security', icon: Shield,         label: 'Segurança',   badge: null },
                { value: 'whatsapp', icon: MessageSquare,  label: 'WhatsApp',    badge: currentPlan === 'pro' ? 'PRO' : null },
                { value: 'upgrade',  icon: Crown,          label: 'Planos',      badge: null },
                { value: 'privacy',  icon: Lock,           label: 'Privacidade', badge: null },
                ...(isAdmin ? [{ value: 'data', icon: Database, label: 'Dados', badge: null }] : []),
              ] as { value: string; icon: React.ElementType; label: string; badge: string | null }[]).map(({ value, icon: Icon, label, badge }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="w-full justify-start gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium
                    text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white
                    data-[state=active]:text-slate-900 dark:data-[state=active]:text-white
                    data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800
                    data-[state=active]:shadow-sm transition-all duration-150"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {badge && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{badge}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 min-w-0">

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-5 mt-0">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Foto de Perfil</h3>
              </div>
              {user && (
                <AvatarUpload
                  userId={user.id}
                  currentAvatarUrl={profile.avatar_url}
                  username={profile.username}
                  onAvatarChange={(url) => setProfile({ ...profile, avatar_url: url })}
                />
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800">
                  <User className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Informações do Perfil</h3>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</Label>
                  <Input type="email" value={user?.email || ""} disabled className="bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700" />
                  <p className="text-xs text-slate-400 flex items-center gap-1"><Lock className="w-3 h-3" />O email não pode ser alterado</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome Completo</Label>
                  <Input value={profile.full_name} disabled className="bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700" />
                  <p className="text-xs text-slate-400 flex items-center gap-1"><Lock className="w-3 h-3" />O nome completo não pode ser alterado</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</Label>
                  <Input value={profile.username} onChange={(e) => { setProfile({ ...profile, username: e.target.value }); validateUsername(e.target.value); }}
                    placeholder="meu_username" className={usernameError ? "border-destructive" : "border-slate-200 dark:border-slate-700"} />
                  {usernameError ? <p className="text-xs text-destructive">{usernameError}</p>
                    : <p className="text-xs text-slate-400">Seu identificador único na plataforma</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Empresa</Label>
                  <Input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                    placeholder="Minha Empresa Ltda." className="border-slate-200 dark:border-slate-700" />
                </div>
                <Button type="submit" disabled={loading || !!usernameError} className="gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <Info className="w-4 h-4 text-slate-500" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Informações da Conta</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-slate-500">ID do Usuário</span>
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 max-w-[220px] truncate">{user?.id}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-slate-500">Conta Criada</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : "N/A"}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-5 mt-0">
            <MFASetup />
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800">
                  <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Sessões Ativas</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Gerencie suas sessões ativas em diferentes dispositivos.</p>
              <Button variant="outline" className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/5">
                <XCircle className="w-4 h-4" />
                Encerrar Todas as Outras Sessões
              </Button>
            </div>
          </TabsContent>

          {/* WhatsApp Tab */}
          <TabsContent value="whatsapp" className="space-y-5 mt-0">
            <WhatsAppConfig />
            <WhatsAppApprovals />
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="upgrade" className="space-y-5 mt-0">
            <div className="rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/60 to-orange-50/30 dark:from-amber-900/20 dark:to-orange-900/10 p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800">
                  <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Seu Plano</h3>
                    <Badge variant="secondary" className="capitalize">{subscription?.plan || 'free'}</Badge>
                    {isTrialActive && <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400">Trial · {daysLeftInTrial}d</Badge>}
                    {isReadOnly && <Badge variant="destructive">Somente leitura</Badge>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <Brain className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400">Análises IA</p>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{subscription?.ai_analyses_used || 0} / {planLimits.aiAnalysesPerMonth === Infinity ? '∞' : planLimits.aiAnalysesPerMonth}</p>
                        {planLimits.aiAnalysesPerMonth !== Infinity && <Progress value={aiUsagePercent} className="h-1 mt-1" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <Server className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400">Clusters</p>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{isTrialActive ? `Até ${PLAN_LIMITS.pro.clusters} (trial)` : planLimits.clusters === Infinity ? 'Ilimitado' : `Até ${planLimits.clusters}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <Clock className="w-4 h-4 text-violet-500 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400">Histórico</p>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{planLimits.historyRetentionDays} dias</p>
                      </div>
                    </div>
                  </div>
                  {isTrialActive && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/40 mt-3">
                      <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">Após o trial, seu plano será <strong>{subscription?.plan || 'free'}</strong> com <strong>{PLAN_LIMITS[subscription?.plan || 'free'].clusters} cluster</strong> e <strong>{PLAN_LIMITS[subscription?.plan || 'free'].aiAnalysesPerMonth} análises/mês</strong>.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {plans.map((plan) => (
                <div key={plan.name} className={`relative rounded-2xl border p-6 shadow-sm ${plan.popular ? 'border-primary/40 bg-gradient-to-br from-primary/3 to-primary/8 dark:from-primary/10 dark:to-primary/5' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'} ${plan.current ? 'ring-2 ring-primary/30' : ''}`}>
                  {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-white bg-primary px-3 py-1 rounded-full">Mais Popular</span>}
                  <div className="mb-5">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                    <div className="mt-1"><span className="text-2xl font-black text-slate-900 dark:text-white">{plan.price}</span><span className="text-slate-400 text-sm">{plan.period}</span></div>
                  </div>
                  <ul className="space-y-2 mb-5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                        <div className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                        </div>{f}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={plan.current ? "outline" : plan.popular ? "default" : "secondary"} disabled={plan.current}>
                    {plan.current ? "Plano Atual" : "Escolher Plano"}
                  </Button>
                </div>
              ))}
            </div>

            {currentPlan === 'pro' && (
              <div className="rounded-2xl border border-red-200/60 dark:border-red-800/40 bg-red-50/40 dark:bg-red-900/10 p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800"><XCircle className="h-5 w-5 text-red-600 dark:text-red-400" /></div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Cancelar Plano Pro</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Ao cancelar, você perderá acesso aos recursos premium. Plano será revertido para Free.</p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="gap-2"><XCircle className="w-4 h-4" />Cancelar Plano Pro</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tem certeza que deseja cancelar?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação irá reverter seu plano para o Free. Você perderá acesso a: análises ilimitadas, até 10 clusters, auto-healing, 90 dias de histórico e suporte prioritário.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Manter Plano Pro</AlertDialogCancel>
                          <AlertDialogAction onClick={handleCancelPlan} disabled={cancelLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {cancelLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelando...</> : "Sim, cancelar plano"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-5 mt-0">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800"><FileText className="w-4 h-4 text-green-600 dark:text-green-400" /></div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Meus Consentimentos (LGPD)</h3>
              </div>
              {userConsent ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[{ label: 'Termos de Uso', date: userConsent.consent_date }, { label: 'Política de Privacidade', date: userConsent.consent_date }].map(({ label, date }) => (
                      <div key={label} className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5 text-emerald-600" /></div>
                        <div><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p><p className="text-xs text-slate-400">Aceito em {new Date(date).toLocaleDateString("pt-BR")}</p></div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <div><p className="text-sm font-medium text-slate-800 dark:text-slate-200">Comunicações de Marketing</p><p className="text-xs text-slate-400">Receber novidades e ofertas por e-mail</p></div>
                    <Switch checked={userConsent.marketing_consent} onCheckedChange={handleToggleMarketing} disabled={consentLoading} />
                  </div>
                </div>
              ) : <p className="text-sm text-slate-400">Nenhum registro de consentimento encontrado.</p>}
              <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <Button variant="outline" size="sm" asChild><Link to="/terms" target="_blank" className="gap-2"><ExternalLink className="w-3 h-3" />Termos de Uso</Link></Button>
                <Button variant="outline" size="sm" asChild><Link to="/privacy" target="_blank" className="gap-2"><ExternalLink className="w-3 h-3" />Política de Privacidade</Link></Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800"><Download className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Exportar Meus Dados</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">De acordo com o Art. 18 da LGPD, baixe uma cópia de todos os seus dados em formato JSON.</p>
              <Button onClick={handleExportData} disabled={exportLoading} variant="outline" className="gap-2">
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exportLoading ? "Exportando..." : "Baixar meus dados"}
              </Button>
            </div>

            <div className="rounded-2xl border border-red-200/60 dark:border-red-800/40 bg-red-50/40 dark:bg-red-900/10 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800"><Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" /></div>
                <h3 className="font-semibold text-red-700 dark:text-red-400">Excluir Minha Conta</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Esta ação é <strong>irreversível</strong> e removerá permanentemente sua conta, clusters, configurações e histórico.</p>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive" className="gap-2"><Trash2 className="w-4 h-4" />Excluir minha conta</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação é <strong>irreversível</strong>. Todos os dados serão eliminados: perfil, clusters, métricas, histórico de incidentes, registros de custos e logs de auditoria.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} disabled={deleteAccountLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deleteAccountLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</> : "Sim, excluir minha conta"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TabsContent>

          {/* Data Tab */}
          {isAdmin && (
            <TabsContent value="data" className="space-y-5 mt-0">
              <AIUsageWidget />
              <div className="rounded-2xl border border-blue-200/50 dark:border-blue-800/40 bg-gradient-to-br from-blue-50/60 to-indigo-50/30 dark:from-blue-900/20 dark:to-indigo-900/10 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800"><Database className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Dados de Demonstração</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Popule com 8 clusters, incidentes IA e ações de auto-healing realistas.</p>
                    <div className="flex gap-3">
                      <Button onClick={handleGenerateDemoData} disabled={demoLoading || demoDeleteLoading} className="gap-2">
                        {demoLoading && <Loader2 className="h-4 w-4 animate-spin" />}{demoLoading ? 'Gerando...' : 'Gerar Dados Demo'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={demoLoading || demoDeleteLoading} className="gap-2">
                            {demoDeleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}{demoDeleteLoading ? 'Removendo...' : 'Remover Dados Demo'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Remover todos os dados demo?</AlertDialogTitle><AlertDialogDescription>Isso irá deletar clusters, incidentes, custos e PVCs demo. Seus dados reais serão mantidos.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteDemoData}>Confirmar Remoção</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-200/50 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/60 to-green-50/30 dark:from-emerald-900/20 dark:to-green-900/10 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800"><Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Gerar Dados de Economia IA</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Dados realistas de economia gerada por IA baseados nos clusters existentes.</p>
                    <Button onClick={handleGenerateAISavings} disabled={savingsLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                      {savingsLoading && <Loader2 className="h-4 w-4 animate-spin" />}{savingsLoading ? 'Gerando...' : 'Gerar Dados de Economia'}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-violet-200/50 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/60 to-purple-50/30 dark:from-violet-900/20 dark:to-purple-900/10 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800"><GraduationCap className="h-5 w-5 text-violet-600 dark:text-violet-400" /></div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Tutorial de Boas-Vindas</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Reveja o tutorial interativo com todas as funcionalidades do Kodo.</p>
                    <Button onClick={() => navigate('/welcome')} variant="outline" className="gap-2"><GraduationCap className="h-4 w-4" />Ver Tutorial</Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          </div>{/* /content */}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
