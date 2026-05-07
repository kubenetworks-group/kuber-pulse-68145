import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Bell, Check, Plus, RefreshCw, Send, Trash2, X, Info, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

interface Cluster {
  id: string;
  name: string;
  user_id: string;
  status: string;
  provider: string;
  agent_version: string | null;
}

interface ClusterAlert {
  id: string;
  cluster_id: string;
  user_id: string;
  title: string;
  message: string;
  alert_type: string;
  action_type: string | null;
  action_params: Record<string, unknown> | null;
  dismissed: boolean;
  dismissed_at: string | null;
  created_at: string;
  expires_at: string | null;
  created_by: string;
  cluster?: Cluster;
}

const ALERT_TYPES = [
  { value: 'info', label: 'Informação', icon: Info, color: 'bg-blue-500' },
  { value: 'warning', label: 'Aviso', icon: AlertTriangle, color: 'bg-yellow-500' },
  { value: 'error', label: 'Erro', icon: AlertCircle, color: 'bg-red-500' },
  { value: 'update', label: 'Atualização', icon: RefreshCw, color: 'bg-purple-500' },
];

const ACTION_TYPES = [
  { value: 'none', label: 'Nenhuma ação' },
  { value: 'update_agent', label: 'Solicitar atualização do agente' },
  { value: 'restart_agent', label: 'Solicitar reinício do agente' },
  { value: 'view_docs', label: 'Ver documentação' },
];

export const AdminClusterAlertsTab = () => {
  const { user } = useAuth();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [alerts, setAlerts] = useState<ClusterAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [latestAgentVersion, setLatestAgentVersion] = useState<string | null>(null);
  
  // Form states
  const [selectedClusterId, setSelectedClusterId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [alertType, setAlertType] = useState("info");
  const [actionType, setActionType] = useState("none");

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch latest agent version
      const { data: latestVer } = await supabase
        .from('agent_versions')
        .select('version')
        .eq('is_latest', true)
        .single();
      if (latestVer?.version) setLatestAgentVersion(latestVer.version);

      // Fetch all clusters (admin can see all)
      const { data: clustersData, error: clustersError } = await supabase
        .from('clusters')
        .select('id, name, user_id, status, provider, agent_version')
        .order('name');

      if (clustersError) throw clustersError;
      setClusters(clustersData || []);

      // Fetch all alerts (admin can see all)
      const { data: alertsData, error: alertsError } = await supabase
        .from('admin_cluster_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (alertsError) throw alertsError;
      
      // Map cluster info to alerts
      const alertsWithClusters = (alertsData || []).map(alert => ({
        ...alert,
        cluster: clustersData?.find(c => c.id === alert.cluster_id)
      }));
      
      setAlerts(alertsWithClusters as ClusterAlert[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAlert = async () => {
    if (!selectedClusterId || !title || !message) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const cluster = clusters.find(c => c.id === selectedClusterId);
    if (!cluster) {
      toast.error("Cluster não encontrado");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('admin_cluster_alerts')
        .insert({
          cluster_id: selectedClusterId,
          user_id: cluster.user_id,
          title,
          message,
          alert_type: alertType,
          action_type: actionType !== 'none' ? actionType : null,
          action_params: actionType !== 'none' ? { type: actionType } : null,
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success("Alerta enviado com sucesso!");
      setCreateModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating alert:', error);
      toast.error("Erro ao enviar alerta");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('admin_cluster_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      toast.success("Alerta removido");
      fetchData();
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast.error("Erro ao remover alerta");
    }
  };

  const resetForm = () => {
    setSelectedClusterId("");
    setTitle("");
    setMessage("");
    setAlertType("info");
    setActionType("none");
  };

  const getAlertTypeConfig = (type: string) => {
    return ALERT_TYPES.find(t => t.value === type) || ALERT_TYPES[0];
  };

  const getAlertBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'update': return 'default';
      default: return 'outline';
    }
  };

  // Quick action to send update alert
  const sendUpdateAlert = (cluster: Cluster) => {
    setSelectedClusterId(cluster.id);
    setTitle("Atualização do Agente Kodo Disponível");
    setMessage(`Há uma nova versão do agente Kodo disponível. Por favor, atualize seu agente para garantir compatibilidade e acesso às últimas funcionalidades.\n\nComando para atualizar:\nkubectl set image deployment/kodo-agent agent=ghcr.io/kubenetworks-group/kodo-agent:${latestAgentVersion ?? 'latest'} -n kodo`);
    setAlertType("update");
    setActionType("update_agent");
    setCreateModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Alertas para Clusters</h2>
          <p className="text-muted-foreground">Envie notificações personalizadas para clusters específicos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Alerta
          </Button>
        </div>
      </div>

      {/* Quick Actions - Clusters needing update */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Ações Rápidas - Clusters com Agente Desatualizado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {clusters
              .filter(c => !c.agent_version || c.agent_version !== 'v0.0.50')
              .map(cluster => (
                <Button
                  key={cluster.id}
                  variant="outline"
                  size="sm"
                  onClick={() => sendUpdateAlert(cluster)}
                >
                  <Send className="h-3 w-3 mr-1" />
                  {cluster.name}
                  {cluster.agent_version && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {cluster.agent_version}
                    </Badge>
                  )}
                </Button>
              ))}
            {clusters.filter(c => !c.agent_version || c.agent_version !== 'v0.0.50').length === 0 && (
              <p className="text-sm text-muted-foreground">Todos os clusters estão atualizados ✓</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alertas</CardTitle>
          <CardDescription>Alertas enviados para os clusters</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum alerta enviado ainda</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cluster</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => {
                    const typeConfig = getAlertTypeConfig(alert.alert_type);
                    const IconComponent = typeConfig.icon;
                    
                    return (
                      <TableRow key={alert.id}>
                        <TableCell>
                          <Badge variant={getAlertBadgeVariant(alert.alert_type)} className="gap-1">
                            <IconComponent className="h-3 w-3" />
                            {typeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {alert.cluster?.name || 'Cluster removido'}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <p className="font-medium truncate">{alert.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {alert.dismissed ? (
                            <Badge variant="outline" className="text-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Lido
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAlert(alert.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Alert Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Novo Alerta</DialogTitle>
            <DialogDescription>
              Envie uma notificação para um cluster específico
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cluster">Cluster *</Label>
              <Select value={selectedClusterId} onValueChange={setSelectedClusterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cluster" />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map(cluster => (
                    <SelectItem key={cluster.id} value={cluster.id}>
                      {cluster.name} ({cluster.provider})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alertType">Tipo de Alerta</Label>
              <Select value={alertType} onValueChange={setAlertType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Atualização do Agente Disponível"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem *</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva o alerta em detalhes..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actionType">Ação Sugerida</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma ação (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateAlert} disabled={sending}>
              {sending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Alerta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
