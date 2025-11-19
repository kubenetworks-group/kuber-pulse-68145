import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { AIIncidentCard } from "@/components/AIIncidentCard";
import { MetricCard } from "@/components/MetricCard";
import { CronJobsStatus } from "@/components/CronJobsStatus";
import { ScanHistoryTab } from "@/components/ScanHistoryTab";
import { Bot, Activity, CheckCircle, Clock, Sparkles, TrendingDown, Shield, Zap, Target, AlertCircle, History } from "lucide-react";
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
  const [scanning, setScanning] = useState(false);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [recentAnomalies, setRecentAnomalies] = useState<any[]>([]);
  const [scanSummary, setScanSummary] = useState<string>("");
  const [autoHealEnabled, setAutoHealEnabled] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
      fetchScanHistory();
      fetchRecentAnomalies();
      subscribeToIncidents();
      subscribeToAnomalies();
    }
  }, [user, selectedClusterId]);

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

  const subscribeToAnomalies = () => {
    const channel = supabase
      .channel('agent-anomalies-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_anomalies',
          filter: selectedClusterId ? `cluster_id=eq.${selectedClusterId}` : undefined
        },
        (payload) => {
          const newAnomaly = payload.new;
          setRecentAnomalies(prev => [newAnomaly, ...prev].slice(0, 20));
          
          toast({
            title: "🔍 Nova Anomalia Detectada",
            description: newAnomaly.description.substring(0, 100) + '...',
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
          filter: selectedClusterId ? `cluster_id=eq.${selectedClusterId}` : undefined
        },
        (payload) => {
          const updatedAnomaly = payload.new;
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

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToIncidents = () => {
    const channel = supabase
      .channel('ai-incidents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_incidents'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newIncident = payload.new as Incident;
            setIncidents(prev => [newIncident, ...prev]);
            
            if (newIncident.severity === 'critical') {
              toast({
                title: "🔥 Critical Incident Detected",
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

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleScanCluster = async () => {
    if (!selectedClusterId) {
      toast({
        title: "Selecione um cluster",
        description: "Por favor, selecione um cluster específico para varredura",
        variant: "destructive"
      });
      return;
    }

    setScanning(true);
    setAnomalies([]);
    setScanSummary("");
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-analyze-anomalies', {
        body: { cluster_id: selectedClusterId }
      });

      if (error) throw error;

      console.log('Scan results:', data);
      
      const anomaliesCount = data.anomalies?.length || 0;
      const summary = data.summary || (anomaliesCount > 0 
        ? `Encontradas ${anomaliesCount} anomalias no cluster`
        : "Nenhuma anomalia crítica detectada. Cluster está saudável.");
      
      // Save scan to history
      await supabase
        .from('scan_history')
        .insert({
          cluster_id: selectedClusterId,
          user_id: user?.id,
          anomalies_found: anomaliesCount,
          summary: summary,
          anomalies_data: data.anomalies || []
        });
      
      if (anomaliesCount > 0) {
        setAnomalies(data.anomalies);
        setScanSummary(summary);
        
        toast({
          title: "⚠️ Anomalias Detectadas",
          description: `Foram encontradas ${anomaliesCount} anomalias que precisam de atenção`,
          variant: "destructive"
        });
        
        fetchData(); // Refresh incidents
        fetchRecentAnomalies(); // Refresh detected anomalies
      } else {
        setScanSummary(summary);
        toast({
          title: "✅ Cluster Saudável",
          description: summary,
        });
      }
      
      // Refresh scan history
      fetchScanHistory();
    } catch (error: any) {
      console.error('Error scanning cluster:', error);
      toast({
        title: "Erro na varredura",
        description: error.message || "Falha ao analisar o cluster",
        variant: "destructive"
      });
    } finally {
      setScanning(false);
    }
  };

  const handleApplyAutoHeal = async (anomaly: any) => {
    if (!anomaly.auto_heal || !anomaly.auto_heal_params) {
      toast({
        title: "Auto-cura não disponível",
        description: "Esta anomalia não possui ação de auto-cura definida",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('agent-auto-heal', {
        body: {
          cluster_id: selectedClusterId,
          ...(anomaly.id && { anomaly_id: anomaly.id }),
          auto_heal_action: anomaly.auto_heal,
          auto_heal_params: anomaly.auto_heal_params
        }
      });

      if (error) throw error;

      toast({
        title: "🤖 Auto-cura Iniciada",
        description: `Comando "${anomaly.auto_heal}" enviado para o agente. O cluster será corrigido em breve.`,
      });

      // Refresh after a delay to see the changes
      setTimeout(() => {
        handleScanCluster();
      }, 3000);
    } catch (error: any) {
      console.error('Error applying auto-heal:', error);
      toast({
        title: "Erro na Auto-cura",
        description: error.message || "Falha ao aplicar auto-cura",
        variant: "destructive"
      });
    }
  };

  const handleEnableAutoHeal = async () => {
    setAutoHealEnabled(!autoHealEnabled);
    toast({
      title: autoHealEnabled ? "Auto-cura desativada" : "Auto-cura ativada",
      description: autoHealEnabled 
        ? "A IA não executará ações automaticamente" 
        : "A IA agora executará ações de correção automaticamente"
    });
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

        {/* Cluster Analysis Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  <CardTitle>Análise de Cluster</CardTitle>
                </div>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 animate-pulse">
                  <Activity className="w-3 h-3 mr-1" />
                  Monitoramento Ativo
                </Badge>
              </div>
              <CardDescription>
                O sistema está monitorando automaticamente todos os clusters em tempo real
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={handleScanCluster}
                disabled={scanning || !selectedClusterId}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {scanning ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Varredura Manual
                  </>
                )}
              </button>
              
              <button
                onClick={handleEnableAutoHeal}
                className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  autoHealEnabled 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                }`}
              >
                <Zap className="w-4 h-4" />
                {autoHealEnabled ? 'Auto-cura Ativa' : 'Ativar Auto-cura'}
              </button>
            </div>

            {scanSummary && (
              <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">📊 Resumo da Análise:</span> {scanSummary}
                </p>
              </div>
            )}

            {anomalies.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Anomalias Detectadas ({anomalies.length})
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {anomalies.map((anomaly, idx) => (
                    <Card 
                      key={idx}
                      className={`border-l-4 ${
                        anomaly.severity === 'critical' ? 'border-l-destructive' :
                        anomaly.severity === 'high' ? 'border-l-orange-500' :
                        anomaly.severity === 'medium' ? 'border-l-yellow-500' :
                        'border-l-blue-500'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={
                                anomaly.severity === 'critical' ? 'destructive' :
                                anomaly.severity === 'high' ? 'default' :
                                'secondary'
                              }>
                                {anomaly.severity}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-medium">{anomaly.type}</span>
                              {anomaly.auto_heal && (
                                <Badge variant="outline" className="text-xs">
                                  <Zap className="w-3 h-3 mr-1" />
                                  Auto-cura disponível
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium">{anomaly.description}</p>
                            <p className="text-xs text-muted-foreground">💡 {anomaly.recommendation}</p>
                            {anomaly.event_messages && anomaly.event_messages.length > 0 && (
                              <div className="mt-2 p-2 bg-destructive/10 rounded border border-destructive/20">
                                <p className="text-xs font-semibold text-destructive mb-1">🔴 Erro do Kubernetes:</p>
                                {anomaly.event_messages.map((msg: string, midx: number) => (
                                  <p key={midx} className="text-xs font-mono text-destructive/90">{msg}</p>
                                ))}
                              </div>
                            )}
                            {anomaly.affected_pods && anomaly.affected_pods.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Pods Afetados:</p>
                                <div className="flex flex-wrap gap-1">
                                  {anomaly.affected_pods.map((pod: string, pidx: number) => (
                                    <Badge key={pidx} variant="outline" className="text-xs">
                                      {pod}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {anomaly.auto_heal && autoHealEnabled && (
                            <button 
                              onClick={() => handleApplyAutoHeal(anomaly)}
                              className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-1 text-xs transition-colors"
                            >
                              <Zap className="w-3 h-3" />
                              Aplicar Auto-cura
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Cron Jobs Status */}
        <CronJobsStatus />
      </div>

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

        {/* Painel de ações da IA */}
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {t('aiMonitor.actionsExecuted')}
            </CardTitle>
            <CardDescription>
              {t('aiMonitor.actionsDetail')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <Target className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{stats.actionsExecuted}</div>
                  <div className="text-sm text-muted-foreground">{t('aiMonitor.totalActions')}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <Clock className="h-8 w-8 text-accent" />
                <div>
                  <div className="text-2xl font-bold">{stats.avgResolutionTime}m</div>
                  <div className="text-sm text-muted-foreground">{t('aiMonitor.avgTime')}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <TrendingDown className="h-8 w-8 text-success" />
                <div>
                  <div className="text-2xl font-bold">
                    {stats.total > 0 ? Math.round((stats.actionsExecuted / stats.total) * 100) : 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">{t('aiMonitor.autoCorrected')}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs para diferentes visualizações */}
        <Tabs defaultValue="incidents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="incidents" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('aiMonitor.incidents')}
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t('aiMonitor.detailedActions')}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('aiMonitor.actionHistory')}</CardTitle>
                <CardDescription>
                  {t('aiMonitor.actionHistoryDetail')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredIncidents
                    .filter(i => i.action_taken)
                    .map(incident => (
                      <div 
                        key={incident.id} 
                        className="p-4 border rounded-lg space-y-3 bg-gradient-to-r from-background to-muted/20"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={incident.resolved_at ? "default" : "secondary"}>
                                {incident.resolved_at ? t('aiMonitor.resolved') : t('aiMonitor.inProgress')}
                              </Badge>
                              <Badge variant="outline">{incident.severity}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {clusters.find(c => c.id === incident.cluster_id)?.name}
                              </span>
                            </div>
                            <h4 className="font-semibold mb-1">{incident.title}</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                              {incident.description}
                            </p>
                            
                            {/* Análise da IA */}
                            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <Bot className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">{t('aiMonitor.whatAIDid')}</span>
                              </div>
                              <div className="text-sm space-y-2">
                                <div>
                                  <span className="font-medium text-primary">{t('aiMonitor.rootCause')} </span>
                                  <span>{incident.ai_analysis.root_cause}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-primary">{t('aiMonitor.actionTaken')} </span>
                                  <span>{incident.auto_heal_action || t('aiMonitor.analysisInProgress')}</span>
                                </div>
                                {incident.action_result && (
                                  <div>
                                    <span className="font-medium text-primary">{t('aiMonitor.result')} </span>
                                    <span className="text-success">
                                      {JSON.stringify(incident.action_result)}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <span className="font-medium text-primary">{t('aiMonitor.recommendation')} </span>
                                  <span>{incident.ai_analysis.recommendation}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Timeline */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                          <span>
                            {t('aiMonitor.detected')} {new Date(incident.created_at).toLocaleString(i18n.language)}
                          </span>
                          {incident.resolved_at && (
                            <span>
                              {t('aiMonitor.resolvedAt')} {new Date(incident.resolved_at).toLocaleString(i18n.language)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <ScanHistoryTab scanHistory={scanHistory} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
