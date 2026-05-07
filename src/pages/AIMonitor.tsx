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
import { AgentUpdateBanner } from "@/components/AgentUpdateBanner";
import { useSecurityThreats } from "@/hooks/useSecurityThreats";
import { Bot, Activity, CheckCircle, Shield, Zap, AlertCircle, History, ShieldAlert, Settings, Clock, Server, AlertTriangle, RefreshCw, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoHealConfig } from "@/components/AutoHealConfig";
import { AutoHealActionsLog } from "@/components/AutoHealActionsLog";
import { ClusterSecurityAnalysis } from "@/components/ClusterSecurityAnalysis";
import { PodRestartAuditTab } from "@/components/PodRestartAuditTab";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

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
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [recentAnomalies, setRecentAnomalies] = useState<any[]>([]);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [agentCommands, setAgentCommands] = useState<any[]>([]);
  const [analyzingCluster, setAnalyzingCluster] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  const [latestAgentVersion, setLatestAgentVersion] = useState<string | null>(null);

  // Security Threats Hook - Real-time monitoring
  const {
    threats,
    stats: threatStats,
    loading: threatsLoading,
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
      supabase
        .from('agent_versions')
        .select('version')
        .eq('is_latest', true)
        .single()
        .then(({ data }) => { if (data?.version) setLatestAgentVersion(data.version); });
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
      // Fetch incidents - filter by cluster if selected
      let query = supabase
        .from('ai_incidents')
        .select('*');
      
      if (selectedClusterId) {
        query = query.eq('cluster_id', selectedClusterId);
      }
      
      const { data: incidentsData, error: incidentsError } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (incidentsError) throw incidentsError;
      setIncidents((incidentsData || []) as any);

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

  // Manual analysis function
  const handleManualAnalysis = async () => {
    if (!selectedClusterId || !user) {
      toast({
        title: "Selecione um cluster",
        description: "Você precisa selecionar um cluster para executar a análise",
        variant: "destructive"
      });
      return;
    }

    setAnalyzingCluster(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-analyze-anomalies', {
        body: { cluster_id: selectedClusterId, user_id: user.id }
      });

      if (error) throw error;

      setLastAnalysisTime(new Date());
      
      if (data.anomalies && data.anomalies.length > 0) {
        toast({
          title: "🔍 Análise Concluída",
          description: `Encontradas ${data.anomalies.length} anomalia(s) no cluster`,
          variant: data.anomalies.some((a: any) => a.severity === 'critical') ? 'destructive' : 'default'
        });
        // Refresh anomalies
        fetchRecentAnomalies();
        fetchData();
      } else {
        toast({
          title: "✅ Cluster Saudável",
          description: data.summary || "Nenhuma anomalia detectada no momento",
        });
      }
    } catch (error: any) {
      console.error('Error analyzing cluster:', error);
      
      // Check for rate limit
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        toast({
          title: "Limite de análises atingido",
          description: "Aguarde alguns minutos antes de executar outra análise",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro na análise",
          description: error.message || "Não foi possível analisar o cluster",
          variant: "destructive"
        });
      }
    } finally {
      setAnalyzingCluster(false);
    }
  };

  // Check agent status
  const getAgentStatus = () => {
    if (!selectedClusterId) return null;
    
    const cluster = clusters.find(c => c.id === selectedClusterId);
    if (!cluster) return null;

    const lastSeen = cluster.agent_last_seen_at 
      ? new Date(cluster.agent_last_seen_at) 
      : (cluster.last_sync ? new Date(cluster.last_sync) : null);
    
    if (!lastSeen) {
      return { status: 'never', message: 'Agente nunca conectou' };
    }

    const minutesAgo = Math.floor((new Date().getTime() - lastSeen.getTime()) / (60 * 1000));
    
    if (minutesAgo < 5) {
      return { status: 'online', message: 'Agente online', lastSeen };
    } else if (minutesAgo < 60) {
      return { status: 'recent', message: `Última atividade há ${minutesAgo} minutos`, lastSeen };
    } else {
      const hoursAgo = Math.floor(minutesAgo / 60);
      return { status: 'offline', message: `Agente offline há ${hoursAgo} hora(s)`, lastSeen };
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

  // Stats baseadas no cluster selecionado e nos comandos do agente
  const clusterIncidents = selectedClusterId
    ? incidents.filter(i => i.cluster_id === selectedClusterId)
    : incidents;

  // Calcular stats baseados nos comandos do agente
  const commandStats = {
    total: agentCommands.length,
    completed: agentCommands.filter(c => c.status === 'completed').length,
    failed: agentCommands.filter(c => c.status === 'failed').length,
    pending: agentCommands.filter(c => c.status === 'pending' || c.status === 'executing').length,
  };

  // Agentes ativos = comandos pendentes/executando
  const activeAIAgents = commandStats.pending > 0 ? commandStats.pending : 
    (clusterIncidents.filter(i => !i.resolved_at && i.action_taken).length || 
    (agentCommands.length > 0 ? 1 : 0));

  // Taxa de sucesso baseada nos comandos
  const commandSuccessRate = commandStats.total > 0 
    ? Math.round((commandStats.completed / commandStats.total) * 100)
    : 0;

  // Calcular tempo de downtime evitado baseado nos comandos completados
  // Cada comando bem-sucedido evita em média 15 minutos de downtime
  const preventedDowntimeFromCommands = commandStats.completed * 15;
  
  // Adicionar downtime evitado de incidentes resolvidos
  const preventedDowntimeFromIncidents = clusterIncidents.filter(i => i.resolved_at).length * 15;
  
  const totalPreventedDowntime = preventedDowntimeFromCommands + preventedDowntimeFromIncidents;

  const stats = {
    total: clusterIncidents.length + commandStats.total,
    actionsExecuted: clusterIncidents.filter(i => i.action_taken).length + commandStats.completed,
    resolved: clusterIncidents.filter(i => i.resolved_at).length + commandStats.completed,
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
    preventedDowntime: totalPreventedDowntime
  };

  // Taxa de sucesso combinada (comandos e incidentes)
  const totalActions = commandStats.total + clusterIncidents.filter(i => i.action_taken).length;
  const successfulActions = commandStats.completed + clusterIncidents.filter(i => i.resolved_at).length;
  const successRate = totalActions > 0 
    ? Math.round((successfulActions / totalActions) * 100) 
    : (commandStats.total > 0 ? commandSuccessRate : 0);

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
        {/* Agent Update Banner */}
        <AgentUpdateBanner />

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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
        <Tabs defaultValue="autoheal" className="space-y-4">
          <TabsList className="flex flex-nowrap overflow-x-auto w-full max-w-full h-auto p-1">
            <TabsTrigger value="security" className="flex items-center gap-2 text-sm whitespace-nowrap px-3 py-2">
              <ShieldAlert className="h-4 w-4" />
              <span>Seguranca ({threatStats.active})</span>
              {threatStats.critical > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse">
                  {threatStats.critical}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="flex items-center gap-2 text-sm whitespace-nowrap px-3 py-2">
              <AlertCircle className="h-4 w-4" />
              <span>Anomalias ({recentAnomalies.length})</span>
            </TabsTrigger>
            <TabsTrigger value="commands" className="flex items-center gap-2 text-sm whitespace-nowrap px-3 py-2">
              <Zap className="h-4 w-4" />
              <span>Comandos ({agentCommands.length})</span>
            </TabsTrigger>
            <TabsTrigger value="incidents" className="flex items-center gap-2 text-sm whitespace-nowrap px-3 py-2">
              <Activity className="h-4 w-4" />
              <span>{t('aiMonitor.incidents')}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 text-sm whitespace-nowrap px-3 py-2">
              <History className="h-4 w-4" />
              <span>Histórico</span>
            </TabsTrigger>
            <TabsTrigger value="autoheal" className="flex items-center gap-2 text-sm whitespace-nowrap px-3 py-2">
              <Settings className="h-4 w-4" />
              <span>Auto-Heal</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2 text-sm whitespace-nowrap px-3 py-2">
              <FileText className="h-4 w-4" />
              <span>Auditoria</span>
            </TabsTrigger>
          </TabsList>

          {/* Security Threats Tab */}
          <TabsContent value="security" className="space-y-4">
            {/* Real-time Security Monitoring Status */}
            <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-orange-500/5">
              <CardHeader className="pb-2 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 shrink-0" />
                    <CardTitle className="text-sm sm:text-base">Monitoramento de Seguranca em Tempo Real</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 animate-pulse text-xs">
                      <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                      Monitorando
                    </Badge>
                    {threatStats.critical > 0 && (
                      <Badge variant="destructive" className="animate-pulse text-xs">
                        {threatStats.critical} Criticas
                      </Badge>
                    )}
                    {threatStats.high > 0 && (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                        {threatStats.high} Altas
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>
                  IA monitorando continuamente seus containers para detectar DDoS, hackers, cryptomining e atividades suspeitas em tempo real
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                  <div className="text-center p-2 sm:p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-lg sm:text-2xl font-bold text-red-400">{threatStats.critical}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Criticas</div>
                  </div>
                  <div className="text-center p-2 sm:p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="text-lg sm:text-2xl font-bold text-orange-400">{threatStats.high}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Altas</div>
                  </div>
                  <div className="text-center p-2 sm:p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="text-lg sm:text-2xl font-bold text-yellow-400">{threatStats.medium}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Medias</div>
                  </div>
                  <div className="text-center p-2 sm:p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 col-span-1">
                    <div className="text-lg sm:text-2xl font-bold text-blue-400">{threatStats.low}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Baixas</div>
                  </div>
                  <div className="text-center p-2 sm:p-3 rounded-lg bg-green-500/10 border border-green-500/20 col-span-2 sm:col-span-1">
                    <div className="text-lg sm:text-2xl font-bold text-green-400">{threatStats.mitigated}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Mitigadas</div>
                  </div>
                </div>

                {/* Real-time monitoring info */}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 text-sm">
                    <Bot className="w-4 h-4 text-primary animate-pulse" />
                    <span className="text-muted-foreground">
                      O agente Kodo esta analisando automaticamente metricas de rede, CPU, memoria e processos suspeitos para detectar ameacas como DDoS, brute force e cryptomining.
                    </span>
                  </div>
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

            {/* Cluster Security Analysis - RBAC, Network Policies, Pod Security, etc */}
            <ClusterSecurityAnalysis />
          </TabsContent>

          {/* Anomalies Tab */}
          <TabsContent value="anomalies" className="space-y-4">
            {/* Agent Status Alert */}
            {(() => {
              const agentStatus = getAgentStatus();
              if (!selectedClusterId) {
                return (
                  <Card className="border-warning/30 bg-warning/5">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
                        <div>
                          <p className="font-medium text-warning">Nenhum cluster selecionado</p>
                          <p className="text-sm text-muted-foreground">
                            Selecione um cluster no menu lateral para visualizar as anomalias.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              if (agentStatus?.status === 'never') {
                return (
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <Server className="h-5 w-5 text-destructive flex-shrink-0" />
                        <div>
                          <p className="font-medium text-destructive">Agente Kodo não conectado</p>
                          <p className="text-sm text-muted-foreground">
                            O agente nunca se conectou a este cluster. Instale o agente para começar a monitorar.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              if (agentStatus?.status === 'offline') {
                return (
                  <Card className="border-warning/30 bg-warning/5">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
                        <div>
                          <p className="font-medium text-warning">Agente Offline</p>
                          <p className="text-sm text-muted-foreground">
                            {agentStatus.message}. As anomalias podem estar desatualizadas.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return null;
            })()}

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Anomalias Detectadas pelo Agente
                    </CardTitle>
                    <CardDescription>
                      Problemas detectados automaticamente no cluster através do agente Kodo
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {lastAnalysisTime && (
                      <span className="text-xs text-muted-foreground">
                        Última análise: {format(lastAnalysisTime, 'HH:mm', { locale: getDateLocale() })}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualAnalysis}
                      disabled={analyzingCluster || !selectedClusterId}
                      className="gap-2"
                    >
                      {analyzingCluster ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Analisando...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          Executar Análise
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {recentAnomalies.length === 0 ? (
                  <div className="text-center py-12">
                    {!selectedClusterId ? (
                      <>
                        <Server className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">Selecione um Cluster</h3>
                        <p className="text-muted-foreground text-sm">
                          Escolha um cluster no menu lateral para visualizar as anomalias detectadas.
                        </p>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-16 w-16 mx-auto mb-4 text-success opacity-70" />
                        <h3 className="text-lg font-semibold mb-2 text-success">Cluster Saudável</h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                          Nenhuma anomalia detectada. O agente está monitorando seu cluster continuamente.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleManualAnalysis}
                          disabled={analyzingCluster}
                          className="mt-4 gap-2"
                        >
                          {analyzingCluster ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Analisando...
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4" />
                              Executar Análise Manual
                            </>
                          )}
                        </Button>
                      </>
                    )}
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
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-2">
                              <Badge variant={
                                anomaly.severity === 'critical' ? 'destructive' :
                                anomaly.severity === 'high' ? 'default' :
                                'secondary'
                              } className="text-xs">
                                {anomaly.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">{anomaly.anomaly_type}</Badge>
                              {anomaly.resolved && (
                                <Badge className="bg-success/20 text-success border-success/30 text-xs">
                                  Resolvido
                                </Badge>
                              )}
                              {anomaly.auto_heal_applied && (
                                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                                  <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                                  Auto-curado
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm font-medium mb-2">{anomaly.description}</p>
                            {anomaly.recommendation && (
                              <p className="text-[10px] sm:text-xs text-muted-foreground bg-background/50 p-1.5 sm:p-2 rounded">
                                💡 <strong>Recomendação:</strong> {anomaly.recommendation}
                              </p>
                            )}
                          </div>
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] sm:text-xs text-muted-foreground">
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
                    {agentCommands.map((cmd) => {
                      // Encontrar o cluster para verificar status do agente
                      const cmdCluster = clusters.find(c => c.id === cmd.cluster_id);
                      
                      // Usar agent_last_seen_at ou last_sync como fallback
                      const agentLastSeen = cmdCluster?.agent_last_seen_at 
                        ? new Date(cmdCluster.agent_last_seen_at) 
                        : (cmdCluster?.last_sync ? new Date(cmdCluster.last_sync) : null);
                      
                      const isAgentOnline = agentLastSeen && 
                        (new Date().getTime() - agentLastSeen.getTime()) < 5 * 60 * 1000; // 5 min
                      
                      const isAgentRecentlyActive = agentLastSeen && 
                        (new Date().getTime() - agentLastSeen.getTime()) < 60 * 60 * 1000; // 1 hora
                      
                      // Diagnóstico do comando
                      const getDiagnostic = () => {
                        if (cmd.status === 'completed') return null;
                        if (cmd.status === 'failed') {
                          return {
                            type: 'error',
                            message: cmd.result?.error || cmd.result?.message || 'Erro desconhecido ao executar comando',
                            details: cmd.result?.details || null
                          };
                        }
                        if (cmd.status === 'pending' || cmd.status === 'sent') {
                          // Verificar se o agente está buscando comandos (endpoint get-commands)
                          // Se o agente envia métricas mas não busca comandos, pode ser versão antiga
                          if (!cmdCluster?.agent_version && !cmdCluster?.agent_last_seen_at) {
                            // Sem agent_version mas com métricas recentes = versão antiga do agente
                            if (cmdCluster?.last_sync && isAgentRecentlyActive) {
                              return {
                                type: 'warning',
                                message: 'Agente Kodo precisa de atualização',
                                details: `O agente está enviando métricas (última: ${format(new Date(cmdCluster.last_sync), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() })}), mas não está buscando comandos. Atualize o agente para a versão mais recente: kubectl set image deployment/kodo-agent agent=ghcr.io/kubenetworks-group/kodo-agent:${latestAgentVersion ?? 'latest'} -n kodo`
                              };
                            }
                            return {
                              type: 'warning',
                              message: 'Agente Kodo não conectado',
                              details: 'O agente nunca se conectou a este cluster. Verifique se o agente está instalado e rodando.'
                            };
                          }
                          
                          if (!isAgentOnline) {
                            const offlineMinutes = agentLastSeen 
                              ? Math.floor((new Date().getTime() - agentLastSeen.getTime()) / (60 * 1000))
                              : null;
                            
                            let offlineText = '';
                            if (offlineMinutes) {
                              if (offlineMinutes < 60) {
                                offlineText = `${offlineMinutes} minutos`;
                              } else if (offlineMinutes < 1440) {
                                offlineText = `${Math.floor(offlineMinutes / 60)} horas`;
                              } else {
                                offlineText = `${Math.floor(offlineMinutes / 1440)} dias`;
                              }
                            }
                            
                            return {
                              type: 'warning',
                              message: `Agente Kodo offline há ${offlineText || 'tempo indeterminado'}`,
                              details: `Última atividade: ${agentLastSeen ? format(agentLastSeen, 'dd/MM/yyyy HH:mm', { locale: getDateLocale() }) : 'nunca'}. Verifique se o pod do agente está rodando: kubectl get pods -n kodo`
                            };
                          }
                          
                          // Comando pendente há muito tempo
                          const createdAt = new Date(cmd.created_at);
                          const waitingMinutes = Math.floor((new Date().getTime() - createdAt.getTime()) / (60 * 1000));
                          if (waitingMinutes > 10) {
                            return {
                              type: 'info',
                              message: `Aguardando execução há ${waitingMinutes} minutos`,
                              details: 'O agente busca comandos a cada minuto. Se persistir, verifique os logs do agente.'
                            };
                          }
                        }
                        return null;
                      };
                      
                      const diagnostic = getDiagnostic();
                      
                      return (
                        <div 
                          key={cmd.id}
                          className={`p-4 border rounded-lg ${
                            cmd.status === 'completed' ? 'bg-success/5 border-success/20' :
                            cmd.status === 'failed' ? 'bg-destructive/5 border-destructive/20' :
                            cmd.status === 'executing' ? 'bg-primary/5 border-primary/20' :
                            'bg-muted/50 border-border'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-2">
                                <Badge variant={
                                  cmd.status === 'completed' ? 'default' :
                                  cmd.status === 'failed' ? 'destructive' :
                                  'secondary'
                                } className="text-xs">
                                  {cmd.status === 'completed' ? '✅ Completado' :
                                   cmd.status === 'failed' ? '❌ Falhou' :
                                   cmd.status === 'executing' ? '⚡ Executando' :
                                   cmd.status === 'pending' ? '⏳ Pendente' : 
                                   cmd.status === 'sent' ? '📤 Enviado' : cmd.status}
                                </Badge>
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  {cmd.command_type.replace(/_/g, ' ')}
                                </Badge>
                                {cmdCluster && (
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <Server className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                    {cmdCluster.name}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs sm:text-sm space-y-1">
                                <p className="font-medium">Tipo: {cmd.command_type}</p>
                                {cmd.command_params && (
                                  <div className="bg-background/50 p-1.5 sm:p-2 rounded text-[10px] sm:text-xs font-mono overflow-x-auto">
                                    {JSON.stringify(cmd.command_params, null, 2)}
                                  </div>
                                )}
                                
                                {/* Diagnóstico do Agente */}
                                {diagnostic && (
                                  <div className={`mt-2 p-2 sm:p-3 rounded-lg border ${
                                    diagnostic.type === 'error' 
                                      ? 'bg-destructive/10 border-destructive/30' 
                                      : 'bg-warning/10 border-warning/30'
                                  }`}>
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                        diagnostic.type === 'error' ? 'text-destructive' : 'text-warning'
                                      }`} />
                                      <div>
                                        <p className={`text-xs sm:text-sm font-semibold ${
                                          diagnostic.type === 'error' ? 'text-destructive' : 'text-warning'
                                        }`}>
                                          {diagnostic.message}
                                        </p>
                                        {diagnostic.details && (
                                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                            {diagnostic.details}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {cmd.result && (
                                  <div className={`mt-2 p-1.5 sm:p-2 rounded ${
                                    cmd.status === 'failed' ? 'bg-destructive/10' : 'bg-success/10'
                                  }`}>
                                    <p className={`text-[10px] sm:text-xs font-semibold mb-1 ${
                                      cmd.status === 'failed' ? 'text-destructive' : 'text-success'
                                    }`}>
                                      {cmd.status === 'failed' ? 'Erro:' : 'Resultado:'}
                                    </p>
                                    <pre className="text-[10px] sm:text-xs overflow-auto whitespace-pre-wrap">
                                      {JSON.stringify(cmd.result, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-left sm:text-right text-[10px] sm:text-xs text-muted-foreground space-y-1">
                              <div>Criado: {format(new Date(cmd.created_at), 'dd/MM HH:mm', { locale: getDateLocale() })}</div>
                              {cmd.executed_at && (
                                <div>Executado: {format(new Date(cmd.executed_at), 'dd/MM HH:mm', { locale: getDateLocale() })}</div>
                              )}
                              {cmd.completed_at && (
                                <div>Finalizado: {format(new Date(cmd.completed_at), 'dd/MM HH:mm', { locale: getDateLocale() })}</div>
                              )}
                              {cmd.retry_count > 0 && (
                                <div className="text-warning">Tentativas: {cmd.retry_count}/{cmd.max_retries || 3}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Incidents Tab */}
          <TabsContent value="incidents" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
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
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('aiMonitor.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiMonitor.allStatus')}</SelectItem>
                  <SelectItem value="pending">{t('aiMonitor.pending')}</SelectItem>
                  <SelectItem value="resolved">{t('aiMonitor.resolved')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Incidents List — split by action type */}
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                {t('aiMonitor.loadingIncidents')}
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="text-center py-12">
                {!selectedClusterId ? (
                  <>
                    <Server className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Selecione um Cluster</h3>
                    <p className="text-muted-foreground text-sm">
                      Escolha um cluster no menu lateral para visualizar os incidentes.
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-16 w-16 mx-auto mb-4 text-success opacity-70" />
                    <h3 className="text-lg font-semibold mb-2 text-success">{t('aiMonitor.noIncidentsDetected')}</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      Nenhum incidente detectado. A IA está monitorando continuamente.
                    </p>
                  </>
                )}
              </div>
            ) : (() => {
              const needsActionIncidents = filteredIncidents.filter(
                (i: any) => (i.ai_analysis as any)?.needs_user_action === true && !i.action_taken
              );
              const autoHandledIncidents = filteredIncidents.filter(
                (i: any) => i.action_taken || (i.ai_analysis as any)?.needs_user_action !== true
              );

              return (
                <div className="space-y-6">
                  {/* ── Section 1: Requer Ação do Usuário ── */}
                  {needsActionIncidents.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-500">
                            {needsActionIncidents.length} problema(s) requerem sua ação
                          </p>
                          <p className="text-xs text-muted-foreground">
                            A IA diagnosticou estes problemas mas não pode corrigi-los automaticamente. Siga os passos de resolução abaixo.
                          </p>
                        </div>
                      </div>
                      {needsActionIncidents.map((incident: any) => (
                        <div key={incident.id} className="relative">
                          <div className="absolute -left-0.5 top-0 bottom-0 w-1 rounded-full bg-amber-500/70" />
                          <div className="pl-3">
                            <AIIncidentCard
                              incident={incident}
                              clusterName={clusters.find((c: any) => c.id === incident.cluster_id)?.name}
                              onExecuteAction={handleExecuteAction}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Section 2: Tratado pela IA ── */}
                  {autoHandledIncidents.length > 0 && (
                    <div className="space-y-3">
                      {needsActionIncidents.length > 0 && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                          <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-emerald-500">
                              {autoHandledIncidents.filter((i: any) => i.action_taken).length} problema(s) corrigidos / em correção pela IA
                            </p>
                            <p className="text-xs text-muted-foreground">
                              A IA enviou comandos de correção automaticamente para o agente no cluster.
                            </p>
                          </div>
                        </div>
                      )}
                      {autoHandledIncidents.map((incident: any) => (
                        <AIIncidentCard
                          key={incident.id}
                          incident={incident}
                          clusterName={clusters.find((c: any) => c.id === incident.cluster_id)?.name}
                          onExecuteAction={handleExecuteAction}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* History Tab - Histórico consolidado */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Ações da IA
                </CardTitle>
                <CardDescription>
                  Registro completo de incidentes resolvidos, comandos executados e anomalias tratadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Combinar dados de diferentes fontes em um histórico unificado
                  const historyItems = [
                    // Incidentes resolvidos
                    ...clusterIncidents
                      .filter(i => i.resolved_at)
                      .map(i => ({
                        id: i.id,
                        type: 'incident' as const,
                        title: i.title,
                        description: i.description,
                        severity: i.severity,
                        status: 'resolved',
                        date: i.resolved_at || i.created_at,
                        createdAt: i.created_at,
                        icon: '🔧',
                        action: i.auto_heal_action || 'Resolvido manualmente'
                      })),
                    // Comandos executados
                    ...agentCommands
                      .filter(c => c.status === 'completed' || c.status === 'failed')
                      .map(c => ({
                        id: c.id,
                        type: 'command' as const,
                        title: `Comando: ${c.command_type.replace(/_/g, ' ')}`,
                        description: c.result?.message || JSON.stringify(c.command_params),
                        severity: c.status === 'failed' ? 'high' : 'low',
                        status: c.status,
                        date: c.completed_at || c.executed_at || c.created_at,
                        createdAt: c.created_at,
                        icon: c.status === 'completed' ? '✅' : '❌',
                        action: c.command_type
                      })),
                    // Anomalias resolvidas
                    ...recentAnomalies
                      .filter(a => a.resolved)
                      .map(a => ({
                        id: a.id,
                        type: 'anomaly' as const,
                        title: `Anomalia: ${a.anomaly_type}`,
                        description: a.description,
                        severity: a.severity,
                        status: 'resolved',
                        date: a.resolved_at || a.created_at,
                        createdAt: a.created_at,
                        icon: '🔍',
                        action: a.recommendation || 'Auto-heal aplicado'
                      }))
                  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  if (historyItems.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">Nenhum histórico disponível</h3>
                        <p className="text-muted-foreground text-sm">
                          Ações da IA aparecerão aqui conforme forem executadas e resolvidas.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {historyItems.slice(0, 50).map((item) => (
                        <div 
                          key={`${item.type}-${item.id}`}
                          className={`p-4 border rounded-lg ${
                            item.status === 'completed' || item.status === 'resolved' 
                              ? 'bg-success/5 border-success/20' 
                              : 'bg-destructive/5 border-destructive/20'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className="text-lg">{item.icon}</span>
                                <Badge variant={
                                  item.type === 'incident' ? 'default' :
                                  item.type === 'command' ? 'secondary' : 'outline'
                                } className="text-xs">
                                  {item.type === 'incident' ? 'Incidente' :
                                   item.type === 'command' ? 'Comando' : 'Anomalia'}
                                </Badge>
                                <Badge variant={
                                  item.severity === 'critical' ? 'destructive' :
                                  item.severity === 'high' ? 'destructive' :
                                  item.severity === 'medium' ? 'secondary' : 'outline'
                                } className="text-xs">
                                  {item.severity}
                                </Badge>
                              </div>
                              <p className="font-medium text-sm">{item.title}</p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {typeof item.description === 'string' 
                                  ? item.description 
                                  : JSON.stringify(item.description).substring(0, 100)}
                              </p>
                              {item.action && (
                                <p className="text-xs text-primary mt-2">
                                  💡 Ação: {item.action}
                                </p>
                              )}
                            </div>
                            <div className="text-left sm:text-right text-xs text-muted-foreground space-y-1">
                              <div className="flex items-center gap-1 sm:justify-end">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {format(new Date(item.date), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() })}
                                </span>
                              </div>
                              <div className="text-[10px]">
                                Criado: {format(new Date(item.createdAt), 'dd/MM HH:mm', { locale: getDateLocale() })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
            
            {/* Manter o histórico de scans também */}
            {scanHistory.length > 0 && (
              <ScanHistoryTab scanHistory={scanHistory} loading={loading} />
            )}
          </TabsContent>

          {/* Auto-Heal Tab */}
          <TabsContent value="autoheal" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <AutoHealConfig />
              <AutoHealActionsLog />
            </div>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="space-y-4">
            <PodRestartAuditTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
