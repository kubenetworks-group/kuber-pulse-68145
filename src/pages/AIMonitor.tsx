import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AIIncidentCard } from "@/components/AIIncidentCard";
import { MetricCard } from "@/components/MetricCard";
import { Bot, Activity, CheckCircle, Clock, Sparkles, TrendingDown, Shield, Zap, Target, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";

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
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [savings, setSavings] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCluster, setSelectedCluster] = useState<string>("all");

  useEffect(() => {
    if (user) {
      fetchData();
      subscribeToIncidents();
    }
  }, [user]);

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

      // Fetch clusters for names
      const { data: clustersData, error: clustersError } = await supabase
        .from('clusters')
        .select('id, name');

      if (clustersError) throw clustersError;
      setClusters(clustersData || []);

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

  const handleExecuteAction = async (incidentId: string) => {
    toast({
      title: "Executing action...",
      description: "AI is performing the corrective action"
    });
    
    // In a real app, this would call an edge function
    // For now, simulate action execution
    setTimeout(() => {
      toast({
        title: "Action completed",
        description: "The incident has been resolved",
      });
      fetchData();
    }, 2000);
  };

  const filteredIncidents = incidents.filter(incident => {
    if (selectedCluster !== "all" && incident.cluster_id !== selectedCluster) return false;
    if (severityFilter !== "all" && incident.severity !== severityFilter) return false;
    if (statusFilter === "resolved" && !incident.resolved_at) return false;
    if (statusFilter === "pending" && incident.resolved_at) return false;
    return true;
  });

  const totalSavingsAmount = Array.from(savings.values()).reduce((sum, s) => sum + Number(s.estimated_savings), 0);

  // Stats baseadas no cluster selecionado
  const clusterIncidents = selectedCluster === "all" 
    ? incidents 
    : incidents.filter(i => i.cluster_id === selectedCluster);

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

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header com seletor de cluster */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
              {t('aiMonitor.title')}
            </h1>
            <p className="text-muted-foreground">
              Sistema de detecção e correção automática de incidentes com IA
            </p>
          </div>
          <Select value={selectedCluster} onValueChange={setSelectedCluster}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Selecione um cluster" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Todos os Clusters
                </div>
              </SelectItem>
              {clusters.map(cluster => (
                <SelectItem key={cluster.id} value={cluster.id}>
                  {cluster.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Grid com visualizações melhoradas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                IAs Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.activeAgents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Trabalhando neste cluster agora
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Taxa de Sucesso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{successRate}%</div>
              <Progress value={successRate} className="mt-2 h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {stats.resolved} de {stats.total} incidentes resolvidos
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                Economia Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">
                {formatCurrency(stats.totalSavings, { sourceCurrency: 'USD' }).value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Economizado até agora
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-warning" />
                Tempo Evitado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats.preventedDowntime}m</div>
              <p className="text-xs text-muted-foreground mt-1">
                Downtime prevenido pela IA
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Painel de ações da IA */}
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Ações Executadas pela IA
            </CardTitle>
            <CardDescription>
              Detalhamento das ações automáticas realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <Target className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{stats.actionsExecuted}</div>
                  <div className="text-sm text-muted-foreground">Ações Totais</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <Clock className="h-8 w-8 text-accent" />
                <div>
                  <div className="text-2xl font-bold">{stats.avgResolutionTime}m</div>
                  <div className="text-sm text-muted-foreground">Tempo Médio</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <TrendingDown className="h-8 w-8 text-success" />
                <div>
                  <div className="text-2xl font-bold">
                    {stats.total > 0 ? Math.round((stats.actionsExecuted / stats.total) * 100) : 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">Auto-corrigidos</div>
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
              Incidentes
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Ações Detalhadas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incidents" className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Severidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Severidades</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="low">Baixo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Incidents List */}
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Carregando incidentes...
                </div>
              ) : filteredIncidents.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum incidente detectado</h3>
                  <p className="text-muted-foreground">
                    A IA está monitorando seus clusters. Incidentes aparecerão aqui quando detectados.
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
                <CardTitle>Histórico de Ações da IA</CardTitle>
                <CardDescription>
                  Veja em detalhes o que a IA fez para resolver cada problema
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
                                {incident.resolved_at ? "Resolvido" : "Em Andamento"}
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
                                <span className="text-sm font-medium">O que a IA fez:</span>
                              </div>
                              <div className="text-sm space-y-2">
                                <div>
                                  <span className="font-medium text-primary">Causa Raiz: </span>
                                  <span>{incident.ai_analysis.root_cause}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-primary">Ação Tomada: </span>
                                  <span>{incident.auto_heal_action || "Análise em andamento"}</span>
                                </div>
                                {incident.action_result && (
                                  <div>
                                    <span className="font-medium text-primary">Resultado: </span>
                                    <span className="text-success">
                                      {JSON.stringify(incident.action_result)}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <span className="font-medium text-primary">Recomendação: </span>
                                  <span>{incident.ai_analysis.recommendation}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Timeline */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                          <span>
                            Detectado: {new Date(incident.created_at).toLocaleString('pt-BR')}
                          </span>
                          {incident.resolved_at && (
                            <span>
                              Resolvido: {new Date(incident.resolved_at).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
