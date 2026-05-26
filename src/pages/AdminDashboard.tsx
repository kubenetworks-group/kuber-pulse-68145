import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Server, Bot, AlertTriangle, Search, RefreshCw, Shield, Settings2, Clock, Database, FileText, ShieldAlert, Bell, Trash2, Loader2, Mail, SendHorizonal, Building2, BarChart2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AuditLogsTab } from "@/components/AuditLogsTab";
import { AdminClusterAlertsTab } from "@/components/AdminClusterAlertsTab";
import { SaasMetricsTab } from "@/components/SaasMetricsTab";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  subscription: {
    plan: string;
    status: string;
    trial_ends_at: string;
    ai_analyses_used: number;
    custom_cluster_limit: number | null;
  } | null;
  clusters_count: number;
  clusters: Array<{ id: string; name: string; status: string; provider: string }>;
  ai_incidents_count: number;
  anomalies_count: number;
  scans_count: number;
}

interface LeadData {
  id: string;
  email: string;
  company: string | null;
  cluster_size: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  created_at: string;
}

interface Totals {
  total_users: number;
  total_clusters: number;
  active_clusters: number;
  total_ai_incidents: number;
  total_anomalies: number;
  total_scans: number;
  plans: { free: number; pro: number; enterprise: number };
  statuses: { trialing: number; active: number; canceled: number };
}

const AdminDashboard = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Leads state
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);
  const [invitedEmails, setInvitedEmails] = useState<Set<string>>(new Set());

  // Form states
  const [trialDays, setTrialDays] = useState<string>("7");
  const [customClusterLimit, setCustomClusterLimit] = useState<string>("");
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-dashboard-data', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        console.error('Error fetching admin data:', error);
        toast.error("Erro ao carregar dados do admin");
        return;
      }

      setUsers(data.users);
      setTotals(data.totals);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error("Erro inesperado ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    setLeadsLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, email, company, cluster_size, utm_source, utm_campaign, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      toast.error('Erro ao carregar leads');
    } finally {
      setLeadsLoading(false);
    }
  };

  const inviteLead = async (leadId: string, email: string) => {
    setInvitingEmail(email);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Sessão expirada'); return; }

      const { data, error } = await supabase.functions.invoke('invite-lead', {
        body: { lead_id: leadId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        let detail = error.message ?? 'Erro desconhecido';
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore parse errors */ }
        toast.error(`Falha: ${detail}`);
        return;
      }

      if (data?.error) {
        toast.error(`Falha ao enviar convite: ${data.error}`);
        return;
      }

      setInvitedEmails(prev => new Set(prev).add(email));
      toast.success(`Convite enviado para ${email}`);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message ?? 'Desconhecido'}`);
    } finally {
      setInvitingEmail(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const executeAdminAction = async (action: string, value: string | number | null) => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-update-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          user_id: selectedUser.id,
          action,
          value,
        },
      });

      if (error) {
        console.error('Admin action error:', error);
        toast.error("Erro ao executar ação");
        return;
      }

      toast.success("Alteração realizada com sucesso!");
      await fetchData();
      setEditModalOpen(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error("Erro inesperado");
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (user: UserData) => {
    setSelectedUser(user);
    setTrialDays("7");
    setCustomClusterLimit(user.subscription?.custom_cluster_limit?.toString() || "");
    setSelectedPlan(user.subscription?.plan || "free");
    setSelectedStatus(user.subscription?.status || "trialing");
    setEditModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const { error } = await supabase.functions.invoke('admin-delete-user', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { user_id: selectedUser.id },
      });

      if (error) {
        console.error('Delete user error:', error);
        toast.error("Erro ao excluir usuário");
        return;
      }

      toast.success(`Usuário ${selectedUser.email} excluído com sucesso!`);
      setDeleteConfirmOpen(false);
      setEditModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error("Erro inesperado ao excluir usuário");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = planFilter === "all" || user.subscription?.plan === planFilter;
    const matchesStatus = statusFilter === "all" || user.subscription?.status === statusFilter;
    
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case "pro": return "default";
      case "enterprise": return "secondary";
      default: return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "trialing": return "secondary";
      case "canceled": return "destructive";
      default: return "outline";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  const getClusterLimitDisplay = (user: UserData) => {
    if (user.subscription?.custom_cluster_limit !== null && user.subscription?.custom_cluster_limit !== undefined) {
      return <span className="text-primary font-medium">{user.subscription.custom_cluster_limit}</span>;
    }
    switch (user.subscription?.plan) {
      case "pro": return "5";
      case "enterprise": return "∞";
      default: return "1";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Dashboard Admin</h1>
              <p className="text-muted-foreground">Monitoramento do MVP - Usuários e Métricas</p>
            </div>
          </div>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              Alertas
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="h-4 w-4" />
              Logs de Auditoria
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <ShieldAlert className="h-4 w-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-2" onClick={fetchLeads}>
              <Mail className="h-4 w-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <BarChart2 className="h-4 w-4" />
              Métricas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals?.total_users || 0}</div>
              <p className="text-xs text-muted-foreground">
                {totals?.statuses.trialing || 0} em trial · {totals?.statuses.active || 0} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clusters</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals?.total_clusters || 0}</div>
              <p className="text-xs text-muted-foreground">
                {totals?.active_clusters || 0} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Análises de IA</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals?.total_scans || 0}</div>
              <p className="text-xs text-muted-foreground">
                {totals?.total_ai_incidents || 0} incidentes detectados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Anomalias</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals?.total_anomalies || 0}</div>
              <p className="text-xs text-muted-foreground">
                Total detectadas pelo sistema
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Plan Distribution */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Plano Free</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals?.plans.free || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Plano Pro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals?.plans.pro || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Plano Enterprise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals?.plans.enterprise || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
            <CardDescription>Lista completa de usuários do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por email ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Planos</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="trialing">Trial</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Clusters</TableHead>
                      <TableHead className="text-center">Limite</TableHead>
                      <TableHead className="text-center">IA Uso</TableHead>
                      <TableHead>Trial Expira</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.full_name || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={getPlanBadgeVariant(user.subscription?.plan || "free")}>
                              {user.subscription?.plan || "free"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(user.subscription?.status || "trialing")}>
                              {user.subscription?.status || "trialing"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{user.clusters_count}</TableCell>
                          <TableCell className="text-center">{getClusterLimitDisplay(user)}</TableCell>
                          <TableCell className="text-center">{user.subscription?.ai_analyses_used || 0}</TableCell>
                          <TableCell>
                            {user.subscription?.trial_ends_at ? (
                              <span className={new Date(user.subscription.trial_ends_at) < new Date() ? "text-destructive" : ""}>
                                {format(new Date(user.subscription.trial_ends_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openEditModal(user)}
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Cluster Alerts Tab */}
          <TabsContent value="alerts">
            <AdminClusterAlertsTab />
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <AuditLogsTab />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Configurações de Segurança
                </CardTitle>
                <CardDescription>
                  Status das implementações de segurança do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-green-500" />
                      <span className="font-medium">RLS Ativado</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Todas as tabelas possuem Row Level Security habilitado
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-green-500" />
                      <span className="font-medium">API Keys Hash</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Chaves de API são armazenadas com hash SHA-256
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Audit Logging</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sistema de logs de auditoria implementado
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Security Alerts</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sistema de alertas de segurança implementado
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Leads — Solicitações de Demo
                  </CardTitle>
                  <CardDescription>
                    Usuários que solicitaram a demo. Clique em "Convidar" para liberar o acesso.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLeads} disabled={leadsLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${leadsLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Carregando leads...
                  </div>
                ) : leads.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhum lead ainda.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Cluster</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Recebido</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => {
                        const alreadyInvited = invitedEmails.has(lead.email);
                        return (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">{lead.company || '—'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                            <TableCell>
                              {lead.cluster_size ? (
                                <Badge variant="secondary">{lead.cluster_size} nós</Badge>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {lead.utm_source || lead.utm_campaign || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={alreadyInvited ? 'outline' : 'default'}
                                disabled={invitingEmail === lead.email || alreadyInvited}
                                onClick={() => inviteLead(lead.id, lead.email)}
                                className="gap-2"
                              >
                                {invitingEmail === lead.email ? (
                                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enviando...</>
                                ) : alreadyInvited ? (
                                  <><SendHorizonal className="h-3.5 w-3.5" />Enviado</>
                                ) : (
                                  <><SendHorizonal className="h-3.5 w-3.5" />Convidar</>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <SaasMetricsTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Usuário</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Trial Management */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Gerenciar Trial</Label>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Dias"
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                    className="w-24"
                    min="1"
                  />
                  <Button 
                    variant="default" 
                    onClick={() => executeAdminAction("set_trial_days", trialDays)}
                    disabled={actionLoading}
                    className="flex-1"
                  >
                    Definir para {trialDays} dias
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => executeAdminAction("extend_trial", trialDays)}
                    disabled={actionLoading}
                  >
                    + Extender
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Definir:</strong> configura trial para X dias a partir de hoje. <strong>Extender:</strong> adiciona X dias ao prazo atual.
              </p>
              <p className="text-xs text-muted-foreground">
                Trial atual expira em: {selectedUser?.subscription?.trial_ends_at 
                  ? format(new Date(selectedUser.subscription.trial_ends_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "N/A"
                }
              </p>
            </div>

            {/* Custom Cluster Limit */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Limite de Clusters</Label>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Limite (vazio = padrão do plano)"
                  value={customClusterLimit}
                  onChange={(e) => setCustomClusterLimit(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  onClick={() => executeAdminAction("set_cluster_limit", customClusterLimit || null)}
                  disabled={actionLoading}
                >
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para usar o limite padrão do plano. Atual: {selectedUser?.subscription?.custom_cluster_limit ?? "padrão"}
              </p>
            </div>

            {/* Change Plan */}
            <div className="space-y-3">
              <Label className="font-medium">Alterar Plano</Label>
              <div className="flex gap-2">
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={() => executeAdminAction("change_plan", selectedPlan)}
                  disabled={actionLoading || selectedPlan === selectedUser?.subscription?.plan}
                >
                  Alterar
                </Button>
              </div>
            </div>

            {/* Change Status */}
            <div className="space-y-3">
              <Label className="font-medium">Alterar Status</Label>
              <div className="flex gap-2">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trialing">Trial</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="readonly">Somente Leitura</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={() => executeAdminAction("change_status", selectedStatus)}
                  disabled={actionLoading || selectedStatus === selectedUser?.subscription?.status}
                >
                  Alterar
                </Button>
              </div>
            </div>

            {/* Delete User Section */}
            <div className="space-y-3 pt-4 border-t border-destructive/30">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <Label className="font-medium text-destructive">Zona de Perigo</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Esta ação é irreversível. Todos os dados do usuário serão permanentemente excluídos.
              </p>
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Usuário
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão de usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir permanentemente o usuário:
              <br />
              <strong className="text-foreground">{selectedUser?.email}</strong>
              <br /><br />
              Esta ação irá remover:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Todos os clusters e dados relacionados</li>
                <li>Histórico de análises e incidentes</li>
                <li>Configurações e preferências</li>
                <li>Logs de auditoria do usuário</li>
              </ul>
              <br />
              <strong className="text-destructive">Esta ação NÃO pode ser desfeita!</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sim, excluir usuário
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminDashboard;
