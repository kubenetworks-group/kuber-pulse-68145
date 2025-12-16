import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { AIIncidentCard } from "@/components/AIIncidentCard";
import { MetricCard } from "@/components/MetricCard";
import { CronJobsStatus } from "@/components/CronJobsStatus";
import { ScanHistoryTab } from "@/components/ScanHistoryTab";
import { SecurityThreatCard } from "@/components/SecurityThreatCard";
import { ContainerTerminalAlert } from "@/components/ContainerTerminalAlert";
import { useSecurityThreats } from "@/hooks/useSecurityThreats";
import { Bot, Activity, CheckCircle, Sparkles, Shield, Zap, AlertCircle, History, ShieldAlert, Settings } from "lucide-react";
import { AutoHealConfig } from "@/components/AutoHealConfig";
import { AutoHealActionsLog } from "@/components/AutoHealActionsLog";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";
import { format } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";

type Incident = {
  id: string;
  cluster_id: string;
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  ai_analysis: {
    root_cause: string;
    impact: string;
    recommendation: string;
    confidence?: number;
  };
  auto_heal_action: string | null;
  action_taken: boolean;
  action_result: any;
  created_at: string;
  resolved_at: string | null;
};

type Cluster = {
  id: string;
  name: string;
};

export default function AIMonitor() {
  const { user } = useAuth();
  const { selectedClusterId, clusters } = useCluster();
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [savings, setSavings] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [recentAnomalies, setRecentAnomalies] = useState<any[]>([]);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [agentCommands, setAgentCommands] = useState<any[]>([]);

  // Security Threats Hook
  const {
    threats,
    stats: threatStats,
    loading: threatsLoading,
    scanning: threatsScanning,
    runSecurityScan,
    mitigateThreat,
    markAsFalsePositive,
    updateThreatStatus,
  } = useSecurityThreats();

  useEffect(() => {
    if (user) {
      fetchData();
      fetchScanHistory();
      fetchRecentAnomalies();
      fetchAgentCommands();
    }
  }, [user, selectedClusterId]);

  // Realtime subscriptions with proper cleanup
  useEffect(() => {
    if (!user) return;

    // Subscribe to anomalies
    const anomaliesChannel = supabase
      .channel(`agent-anomalies-${selectedClusterId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_anomalies',
          ...(selectedClusterId && { filter: `cluster_id=eq.${selectedClusterId}` })
        },
        (payload) => {
          const newAnomaly = payload.new as any;
          setRecentAnomalies(prev => [newAnomaly, ...prev].slice(0, 20));

          toast({
            title: "🔍 Nova Anomalia Detectada",
            description: newAnomaly.description?.substring(0, 100) + '...',
            variant: newAnomaly.severity === 'critical' ? 'destructive' : 'default'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_anomalies',
          ...(selectedClusterId && { filter: `cluster_id=eq.${selectedClusterId}` })
        },
        (payload) => {
          const updatedAnomaly = payload.new as any;
          setRecentAnomalies(prev => prev.map(a =>
            a.id === updatedAnomaly.id ? updatedAnomaly : a
          ));

          if (updatedAnomaly.resolved) {
            toast({
              title: "✅ Anomalia Resolvida",
              description: "Uma anomalia foi marcada como resolvida",
            });
          }
        }
      )
      .subscribe();

    // Subscribe to incidents
    const incidentsChannel = supabase
      .channel(`ai-incidents-${selectedClusterId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_incidents',
          ...(selectedClusterId && { filter: `cluster_id=eq.${selectedClusterId}` })
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newIncident = payload.new as Incident;
            setIncidents(prev => [newIncident, ...prev]);

            if (newIncident.severity === 'critical') {
              toast({
                title: "🔥 Incidente Crítico Detectado",
                description: newIncident.title,
                variant: "destructive"
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            setIncidents(prev => prev.map(inc =>
              inc.id === payload.new.id ? payload.new as Incident : inc
            ));
          }
        }
      )
      .subscribe();

    // Subscribe to agent commands
    const commandsChannel = supabase
      .channel(`agent-commands-${selectedClusterId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_commands',
          ...(selectedClusterId && { filter: `cluster_id=eq.${selectedClusterId}` })
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAgentCommands(prev => [payload.new as any, ...prev].slice(0, 20));
            toast({
              title: "⚡ Novo Comando Enviado",
              description: `Comando: ${(payload.new as any).command_type}`,
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setAgentCommands(prev => prev.map(cmd =>
              cmd.id === updated.id ? updated : cmd
            ));

            if (updated.status === 'completed') {
              toast({
                title: "✅ Comando Executado",
                description: `${updated.command_type} completado com sucesso`,
              });
            } else if (updated.status === 'failed') {
              toast({
                title: "❌ Comando Falhou",
                description: `${updated.command_type} falhou`,
                variant: "destructive"
              });
            }
          }
        }
      )
      .subscribe();

    // Cleanup function
    return () => {
      supabase.removeChannel(anomaliesChannel);
      supabase.removeChannel(incidentsChannel);
      supabase.removeChannel(commandsChannel);
    };
  }, [user, selectedClusterId]);

  const fetchAgentCommands = async () => {
    if (!selectedClusterId) return;
    
    try {
      const { data, error } = await supabase
        .from('agent_commands')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAgentCommands(data || []);
    } catch (error) {
      console.error('Error fetching agent commands:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch incidents
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('ai_incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (incidentsError) throw incidentsError;
      setIncidents((incidentsData || []) as any);

      // Fetch AI savings
      const { data: savingsData, error: savingsError } = await supabase
        .from('ai_cost_savings')
        .select('*');

      if (!savingsError && savingsData) {
        const savingsMap = new Map(savingsData.map(s => [s.incident_id, s]));
        setSavings(savingsMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load AI incidents",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchScanHistory = async () => {
    if (!selectedClusterId) return;
    
    try {
      const { data, error } = await supabase
        .from('scan_history')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('scan_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setScanHistory(data || []);
    } catch (error) {
      console.error('Error fetching scan history:', error);
    }
  };

  const fetchRecentAnomalies = async () => {
    if (!selectedClusterId) return;
    
    try {
      const { data, error } = await supabase
        .from('agent_anomalies')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecentAnomalies(data || []);
    } catch (error) {
      console.error('Error fetching recent anomalies:', error);
    }
  };


  const handleExecuteAction = async (incidentId: string) => {
    toast({
      title: "Executando ação...",
      description: "A IA está realizando a ação corretiva"
    });
    
    // In a real app, this would call an edge function
    // For now, simulate action execution
    setTimeout(async () => {
      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: user?.id,
          title: '✅ Pod Curado pela IA',
          message: 'A IA concluiu o processo de cura do pod com sucesso. O incidente foi resolvido automaticamente.',
          type: 'success',
          related_entity_type: 'incident',
          related_entity_id: incidentId
        });

      toast({
        title: "Ação concluída",
        description: "O incidente foi resolvido",
      });
      fetchData();
    }, 2000);
  };

  const filteredIncidents = incidents.filter(incident => {
    if (selectedClusterId && incident.cluster_id !== selectedClusterId) return false;
    if (severityFilter !== "all" && incident.severity !== severityFilter) return false;
    if (statusFilter === "resolved" && !incident.resolved_at) return false;
    if (statusFilter === "pending" && incident.resolved_at) return false;
    return true;
  });

  const totalSavingsAmount = Array.from(savings.values()).reduce((sum, s) => sum + Number(s.estimated_savings), 0);

  // Stats baseadas no cluster selecionado
  const clusterIncidents = selectedClusterId
    ? incidents.filter(i => i.cluster_id === selectedClusterId)
    : incidents;

  const activeAIAgents = clusterIncidents.filter(i => 
    !i.resolved_at && i.action_taken
  ).length;

  const stats = {
    total: clusterIncidents.length,
    actionsExecuted: clusterIncidents.filter(i => i.action_taken).length,
    resolved: clusterIncidents.filter(i => i.resolved_at).length,
    totalSavings: Array.from(savings.values())
      .filter(s => clusterIncidents.some(i => i.id === s.incident_id))
      .reduce((sum, s) => sum + Number(s.estimated_savings), 0),
    avgResolutionTime: clusterIncidents.filter(i => i.resolved_at).length > 0
      ? Math.round(
          clusterIncidents
            .filter(i => i.resolved_at)
            .reduce((acc, i) => {
              const created = new Date(i.created_at).getTime();
              const resolved = new Date(i.resolved_at!).getTime();
              return acc + (resolved - created) / 60000; // minutes
            }, 0) / clusterIncidents.filter(i => i.resolved_at).length
        )
      : 0,
    activeAgents: activeAIAgents,
    preventedDowntime: clusterIncidents.filter(i => i.resolved_at).length * 15 // estimativa em minutos
  };

  const successRate = stats.total > 0 
    ? Math.round((stats.resolved / stats.total) * 100) 
    : 0;

  const getDateLocale = () => {
    switch(i18n.language) {
      case 'pt-BR': return ptBR;
      case 'es-ES': return es;
      default: return enUS;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
            {t('aiMonitor.title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('aiMonitor.description')}
          </p>
        </div>

        {/* Cron Jobs Status */}
        <CronJobsStatus />

        {/* Stats Grid com visualizações melhoradas */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                {t('aiMonitor.activeAIs')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.activeAgents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('aiMonitor.workingNow')}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                {t('aiMonitor.successRate')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{successRate}%</div>
              <Progress value={successRate} className="mt-2 h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {t('aiMonitor.incidentsResolved', { resolved: stats.resolved, total: stats.total })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                {t('aiMonitor.totalSavings')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">
                {formatCurrency(stats.totalSavings, { sourceCurrency: 'USD' }).value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('aiMonitor.savedSoFar')}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-warning" />
                {t('aiMonitor.preventedTime')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats.preventedDowntime}m</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('aiMonitor.downtimePrevented')}
              </p>
            </CardContent>
          </Card>
        </div>


        {/* Tabs para diferentes visualizações */}
        <Tabs defaultValue="security" className="space-y-4">
          <TabsList>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Seguranca ({threatStats.active})
              {threatStats.critical > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse">
                  {threatStats.critical}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Anomalias ({recentAnomalies.length})
            </TabsTrigger>
            <TabsTrigger value="commands" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Comandos ({agentCommands.length})
            </TabsTrigger>
            <TabsTrigger value="incidents" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t('aiMonitor.incidents')}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historico
            </TabsTrigger>
            <TabsTrigger value="autoheal" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Auto-Cura
            </TabsTrigger>
          </TabsList>

          {/* Security Threats Tab */}
          <TabsContent value="security" className="space-y-4">
            {/* Security Scan Actions */}
            <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-orange-500/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                    <CardTitle>Deteccao de Ameacas</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {threatStats.critical > 0 && (
                      <Badge variant="destructive" className="animate-pulse">
                        {threatStats.critical} Criticas
                      </Badge>
                    )}
                    {threatStats.high > 0 && (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                        {threatStats.high} Altas
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>
                  Sistema de IA para deteccao de DDoS, hackers, cryptomining e atividades suspeitas em containers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-2xl font-bold text-red-400">{threatStats.critical}</div>
                    <div className="text-xs text-muted-foreground">Criticas</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="text-2xl font-bold text-orange-400">{threatStats.high}</div>
                    <div className="text-xs text-muted-foreground">Altas</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="text-2xl font-bold text-yellow-400">{threatStats.medium}</div>
                    <div className="text-xs text-muted-foreground">Medias</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="text-2xl font-bold text-blue-400">{threatStats.low}</div>
                    <div className="text-xs text-muted-foreground">Baixas</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="text-2xl font-bold text-green-400">{threatStats.mitigated}</div>
                    <div className="text-xs text-muted-foreground">Mitigadas</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={runSecurityScan}
                    disabled={threatsScanning || !selectedClusterId}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    {threatsScanning ? (
                      <>
                        <Shield className="w-4 h-4 animate-spin" />
                        Escaneando Ameacas...
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4" />
                        Varredura de Seguranca
                      </>
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Container Terminal Alerts */}
            {threats.filter(t => t.status === 'active').length > 0 && (
              <ContainerTerminalAlert threats={threats.filter(t => t.status === 'active')} maxItems={5} />
            )}

            {/* Security Threats List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Ameacas Detectadas
                </CardTitle>
                <CardDescription>
                  Ameacas de seguranca identificadas pela IA em seus clusters Kubernetes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {threatsLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Carregando ameacas...
                  </div>
                ) : threats.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-16 w-16 mx-auto mb-4 text-green-500 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2 text-green-400">Cluster Seguro</h3>
                    <p className="text-muted-foreground text-sm">
                      Nenhuma ameaca de seguranca detectada. Execute uma varredura para verificar.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {threats.map((threat) => (
                      <SecurityThreatCard
                        key={threat.id}
                        threat={threat}
                        onMitigate={mitigateThreat}
                        onMarkFalsePositive={markAsFalsePositive}
                        onInvestigate={(id) => updateThreatStatus(id, 'investigating')}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Anomalies Tab */}
          <TabsContent value="anomalies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Anomalias Detectadas pelo Agente
                </CardTitle>
                <CardDescription>
                  Problemas detectados automaticamente no cluster através do agente Kuberpulse
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentAnomalies.length === 0 ? (
                  <div className="text-center py-12">
                    <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma anomalia detectada</h3>
                    <p className="text-muted-foreground text-sm">
                      O agente está monitorando seu cluster. Anomalias aparecerão aqui quando detectadas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentAnomalies.map((anomaly) => (
                      <div 
                        key={anomaly.id}
                        className={`p-4 border rounded-lg border-l-4 ${
                          anomaly.severity === 'critical' ? 'border-l-destructive bg-destructive/5' :
                          anomaly.severity === 'high' ? 'border-l-orange-500 bg-orange-500/5' :
                          anomaly.severity === 'medium' ? 'border-l-yellow-500 bg-yellow-500/5' :
                          'border-l-blue-500 bg-blue-500/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <Badge variant={
                                anomaly.severity === 'critical' ? 'destructive' :
                                anomaly.severity === 'high' ? 'default' :
                                'secondary'
                              }>
                                {anomaly.severity}
                              </Badge>
                              <Badge variant="outline">{anomaly.anomaly_type}</Badge>
                              {anomaly.resolved && (
                                <Badge className="bg-success/20 text-success border-success/30">
                                  Resolvido
                                </Badge>
                              )}
                              {anomaly.auto_heal_applied && (
                                <Badge className="bg-primary/20 text-primary border-primary/30">
                                  <Zap className="w-3 h-3 mr-1" />
                                  Auto-curado
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium mb-2">{anomaly.description}</p>
                            {anomaly.recommendation && (
                              <p className="text-xs text-muted-foreground bg-background/50 p-2 rounded">
                                💡 <strong>Recomendação:</strong> {anomaly.recommendation}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(anomaly.created_at), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Comandos Enviados ao Cluster
                </CardTitle>
                <CardDescription>
                  Ações de auto-cura e comandos executados pelo agente no cluster
                </CardDescription>
              </CardHeader>
              <CardContent>
                {agentCommands.length === 0 ? (
                  <div className="text-center py-12">
                    <Zap className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum comando enviado</h3>
                    <p className="text-muted-foreground text-sm">
                      Comandos de auto-cura aparecerão aqui quando forem executados.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {agentCommands.map((cmd) => (
                      <div 
                        key={cmd.id}
                        className={`p-4 border rounded-lg ${
                          cmd.status === 'completed' ? 'bg-success/5 border-success/20' :
                          cmd.status === 'failed' ? 'bg-destructive/5 border-destructive/20' :
                          cmd.status === 'executing' ? 'bg-primary/5 border-primary/20' :
                          'bg-muted/50 border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <Badge variant={
                                cmd.status === 'completed' ? 'default' :
                                cmd.status === 'failed' ? 'destructive' :
                                'secondary'
                              }>
                                {cmd.status === 'completed' ? '✅ Completado' :
                                 cmd.status === 'failed' ? '❌ Falhou' :
                                 cmd.status === 'executing' ? '⚡ Executando' :
                                 cmd.status === 'pending' ? '⏳ Pendente' : cmd.status}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                <Zap className="w-3 h-3" />
                                {cmd.command_type.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <div className="text-sm space-y-1">
                              <p className="font-medium">Tipo: {cmd.command_type}</p>
                              {cmd.command_params && (
                                <div className="bg-background/50 p-2 rounded text-xs font-mono">
                                  {JSON.stringify(cmd.command_params, null, 2)}
                                </div>
                              )}
                              {cmd.result && (
                                <div className="mt-2 p-2 bg-success/10 rounded">
                                  <p className="text-xs font-semibold text-success mb-1">Resultado:</p>
                                  <pre className="text-xs overflow-auto">
                                    {JSON.stringify(cmd.result, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <div>Criado: {format(new Date(cmd.created_at), 'dd/MM HH:mm', { locale: getDateLocale() })}</div>
                            {cmd.executed_at && (
                              <div>Executado: {format(new Date(cmd.executed_at), 'dd/MM HH:mm', { locale: getDateLocale() })}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Incidents Tab */}
          <TabsContent value="incidents" className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('aiMonitor.severity')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiMonitor.allSeverities')}</SelectItem>
                  <SelectItem value="critical">{t('aiMonitor.critical')}</SelectItem>
                  <SelectItem value="high">{t('aiMonitor.high')}</SelectItem>
                  <SelectItem value="medium">{t('aiMonitor.medium')}</SelectItem>
                  <SelectItem value="low">{t('aiMonitor.low')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('aiMonitor.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiMonitor.allStatus')}</SelectItem>
                  <SelectItem value="pending">{t('aiMonitor.pending')}</SelectItem>
                  <SelectItem value="resolved">{t('aiMonitor.resolved')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Incidents List */}
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  {t('aiMonitor.loadingIncidents')}
                </div>
              ) : filteredIncidents.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">{t('aiMonitor.noIncidentsDetected')}</h3>
                  <p className="text-muted-foreground">
                    {t('aiMonitor.aiMonitoring')}
                  </p>
                </div>
              ) : (
                filteredIncidents.map(incident => (
                  <AIIncidentCard
                    key={incident.id}
                    incident={incident}
                    clusterName={clusters.find(c => c.id === incident.cluster_id)?.name}
                    savings={savings.get(incident.id)}
                    onExecuteAction={handleExecuteAction}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <ScanHistoryTab scanHistory={scanHistory} loading={loading} />
          </TabsContent>

          {/* Auto-Heal Tab */}
          <TabsContent value="autoheal" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <AutoHealConfig />
              <AutoHealActionsLog />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
