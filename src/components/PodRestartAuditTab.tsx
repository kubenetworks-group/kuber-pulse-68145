import { useState, useEffect } from "react";
import { useCluster } from "@/contexts/ClusterContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  RefreshCw,
  FileText,
  AlertTriangle,
  Clock,
  Terminal,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Loader2
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AuditLog {
  id: string;
  pod_name: string;
  namespace: string;
  container_name: string | null;
  restart_reason: string;
  previous_state: any;
  container_logs: string | null;
  exit_code: number | null;
  terminated_at: string | null;
  restart_count: number;
  analysis_summary: string | null;
  source: string | null;
  episode_key: string | null;
  created_at: string;
}

interface DailyReport {
  id: string;
  report_date: string;
  total_restarts: number;
  pods_affected: number;
  namespaces_affected: string[];
  top_restart_reasons: { reason: string; count: number }[];
  pods_summary: any[];
  ai_analysis: string | null;
  created_at: string;
}

export function PodRestartAuditTab() {
  const { selectedClusterId, clusters } = useCluster();
  const selectedCluster = clusters.find(c => c.id === selectedClusterId);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedClusterId) {
      fetchData();
    }
  }, [selectedClusterId]);

  // Realtime: auto-refresh when new audit records arrive or analysis_summary is populated
  useEffect(() => {
    if (!selectedClusterId) return;
    const channel = supabase
      .channel('pod-restart-audit-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pod_restart_audit',
          filter: `cluster_id=eq.${selectedClusterId}`,
        },
        () => fetchData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedClusterId]);

  const getCauseBadge = (reason: string, exitCode: number | null) => {
    if (exitCode === 137 || reason?.toLowerCase().includes('oom')) {
      return <Badge className="bg-red-900/40 text-red-300 border-red-700/50 text-[10px]">OOMKilled</Badge>;
    }
    if (reason?.toLowerCase().includes('crash') || reason?.toLowerCase().includes('backoff')) {
      return <Badge className="bg-orange-900/40 text-orange-300 border-orange-700/50 text-[10px]">CrashLoop</Badge>;
    }
    if (exitCode !== null && exitCode !== 0) {
      return <Badge className="bg-yellow-900/40 text-yellow-300 border-yellow-700/50 text-[10px]">Exit {exitCode}</Badge>;
    }
    return null;
  };

  const fetchData = async () => {
    if (!selectedClusterId) return;
    setLoading(true);

    try {
      // Fetch recent audit logs (last 7 days)
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data: logs } = await supabase
        .from('pod_restart_audit')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100);

      setAuditLogs(logs || []);

      // Fetch daily reports (last 30 days)
      const { data: reports } = await supabase
        .from('pod_restart_daily_reports')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('report_date', { ascending: false })
        .limit(30);

      // Cast the reports to proper type
      const typedReports: DailyReport[] = (reports || []).map(r => ({
        ...r,
        top_restart_reasons: (r.top_restart_reasons as any) || [],
        pods_summary: (r.pods_summary as any) || [],
      }));

      setDailyReports(typedReports);
    } catch (error) {
      console.error('Error fetching audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!selectedClusterId) return;
    setLoading(true);

    try {
      await supabase.functions.invoke('generate-restart-report', {
        body: { 
          cluster_id: selectedClusterId,
          report_date: new Date().toISOString().split('T')[0]
        }
      });
      await fetchData();
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLogExpand = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  const getReasonBadgeVariant = (reason: string) => {
    if (reason.includes('backoff') || reason.includes('crash')) return 'destructive';
    if (reason.includes('oom') || reason.includes('killed')) return 'destructive';
    if (reason.includes('restart')) return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Auditoria de Restarts</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            size="sm" 
            onClick={generateReport}
            disabled={loading}
          >
            <FileText className="h-4 w-4 mr-2" />
            Gerar Relatório
          </Button>
        </div>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs">
            <Terminal className="h-4 w-4 mr-2" />
            Logs de Auditoria ({auditLogs.length})
          </TabsTrigger>
          <TabsTrigger value="reports">
            <Calendar className="h-4 w-4 mr-2" />
            Relatórios Diários ({dailyReports.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhum log de auditoria encontrado nos últimos 7 dias.
                  </CardContent>
                </Card>
              ) : (
                auditLogs.map((log) => (
                  <Card key={log.id} className="overflow-hidden">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <CardHeader 
                          className="py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleLogExpand(log.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              <div>
                                <span className="font-medium">{log.namespace}/{log.pod_name}</span>
                                {log.container_name && (
                                  <span className="text-muted-foreground ml-2">
                                    ({log.container_name})
                                  </span>
                                )}
                              </div>
                              <Badge variant={getReasonBadgeVariant(log.restart_reason)}>
                                {log.restart_reason}
                              </Badge>
                              {getCauseBadge(log.restart_reason, log.exit_code)}
                              {log.source === 'auto' && (
                                <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-400">Auto</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              {log.exit_code !== null && (
                                <Badge variant="outline">Exit: {log.exit_code}</Badge>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                              {expandedLogs.has(log.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-3">
                          {log.previous_state && Object.keys(log.previous_state).length > 0 && (
                            <div className="p-3 bg-muted rounded-lg">
                              <h4 className="text-sm font-medium mb-2">Estado Anterior</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {log.previous_state.reason && (
                                  <div>
                                    <span className="text-muted-foreground">Razão:</span>{" "}
                                    {log.previous_state.reason}
                                  </div>
                                )}
                                {log.previous_state.exit_code !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Exit Code:</span>{" "}
                                    {log.previous_state.exit_code}
                                  </div>
                                )}
                                {log.previous_state.message && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Mensagem:</span>{" "}
                                    {log.previous_state.message}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {log.container_logs && (
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium">Logs do Container (pré-restart)</h4>
                              <pre className="p-3 bg-black text-green-400 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto font-mono">
                                {log.container_logs}
                              </pre>
                            </div>
                          )}

                          {!log.container_logs && (
                            <p className="text-sm text-muted-foreground italic">
                              Logs do container não disponíveis para este restart.
                            </p>
                          )}

                          {/* AI Analysis Section */}
                          {log.analysis_summary ? (
                            <div className="p-3 bg-blue-950/30 border border-blue-800/30 rounded-lg space-y-1">
                              <h4 className="text-sm font-medium flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4 text-blue-400" />
                                Análise da IA
                              </h4>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {log.analysis_summary}
                              </p>
                            </div>
                          ) : log.container_logs ? (
                            <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Análise da IA em andamento...
                            </p>
                          ) : null}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {dailyReports.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhum relatório diário encontrado. Clique em "Gerar Relatório" para criar um.
                  </CardContent>
                </Card>
              ) : (
                dailyReports.map((report) => (
                  <Card key={report.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(report.report_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </CardTitle>
                        <div className="flex gap-2">
                          <Badge variant="secondary">{report.total_restarts} restarts</Badge>
                          <Badge variant="outline">{report.pods_affected} pods</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {report.ai_analysis && (
                        <p className="text-sm text-muted-foreground">{report.ai_analysis}</p>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Top Motivos</h4>
                          <div className="space-y-1">
                            {report.top_restart_reasons?.slice(0, 5).map((r, i) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <span className="truncate">{r.reason}</span>
                                <Badge variant="outline" className="ml-2">{r.count}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2">Namespaces Afetados</h4>
                          <div className="flex flex-wrap gap-1">
                            {report.namespaces_affected?.map((ns, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{ns}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {report.pods_summary && report.pods_summary.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Pods com Mais Restarts</h4>
                          <div className="space-y-1">
                            {report.pods_summary.slice(0, 5).map((p: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                                <span className="font-mono text-xs">{p.namespace}/{p.pod_name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="destructive">{p.restart_count}x</Badge>
                                  {p.has_logs && (
                                    <Badge variant="outline" className="text-xs">
                                      <Terminal className="h-3 w-3 mr-1" />
                                      Logs
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
