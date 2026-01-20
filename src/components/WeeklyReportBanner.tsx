import { useState, useEffect } from "react";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  X, 
  HardDrive, 
  Heart, 
  AlertTriangle, 
  Bot, 
  Lightbulb,
  Server,
  Cpu,
  MemoryStick,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WeeklyReport {
  id: string;
  cluster_id: string;
  report_date: string;
  week_start: string;
  week_end: string;
  total_storage_gb: number;
  storage_used_gb: number;
  storage_available_gb: number;
  cluster_health_score: number;
  cluster_status: string;
  nodes_count: number;
  pods_count: number;
  pods_healthy: number;
  pods_unhealthy: number;
  total_incidents: number;
  critical_incidents: number;
  warning_incidents: number;
  resolved_incidents: number;
  total_agent_actions: number;
  auto_heals_applied: number;
  pods_restarted: number;
  resource_limits_applied: number;
  recommendations: string[];
  critical_issues: { type: string; message: string; count?: number }[];
  ai_summary: string;
  is_read: boolean;
}

export const WeeklyReportBanner = () => {
  const { selectedClusterId, clusters } = useCluster();
  const { user } = useAuth();
  const [unreadReport, setUnreadReport] = useState<WeeklyReport | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedCluster = clusters.find(c => c.id === selectedClusterId);

  useEffect(() => {
    if (selectedClusterId && user) {
      checkForUnreadReports();
    }
  }, [selectedClusterId, user]);

  const checkForUnreadReports = async () => {
    if (!selectedClusterId || !user) return;

    // Check if today is Friday or if there's an unread report
    const today = new Date();
    const isFriday = today.getDay() === 5;
    
    const { data: reports, error } = await supabase
      .from("weekly_reports")
      .select("*")
      .eq("cluster_id", selectedClusterId)
      .eq("user_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error && reports && reports.length > 0) {
      const report = reports[0] as unknown as WeeklyReport;
      setUnreadReport(report);
      setShowBanner(true);
    } else if (isFriday) {
      // Generate new report if it's Friday and no report exists for this week
      await generateReport();
    }
  };

  const generateReport = async () => {
    if (!selectedClusterId || !user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-weekly-report", {
        body: { clusterId: selectedClusterId, userId: user.id }
      });

      if (!error && data?.report) {
        setUnreadReport(data.report as WeeklyReport);
        setShowBanner(true);
      }
    } catch (err) {
      console.error("Error generating report:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!unreadReport) return;

    await supabase
      .from("weekly_reports")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", unreadReport.id);

    setShowBanner(false);
    setShowDialog(false);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return "bg-green-500/20";
    if (score >= 60) return "bg-yellow-500/20";
    return "bg-red-500/20";
  };

  if (!showBanner || !unreadReport) return null;

  return (
    <>
      {/* Banner */}
      <Card className="mb-4 p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/30 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                📊 Relatório Semanal Disponível
                <Badge variant="secondary" className="text-xs">Novo</Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                O resumo da semana {format(new Date(unreadReport.week_start), "dd/MM", { locale: ptBR })} - {format(new Date(unreadReport.week_end), "dd/MM", { locale: ptBR })} está pronto
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowDialog(true)} size="sm">
              Ver Relatório
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowBanner(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Full Report Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Relatório Semanal - {selectedCluster?.name}
            </DialogTitle>
            <DialogDescription>
              Semana de {format(new Date(unreadReport.week_start), "dd 'de' MMMM", { locale: ptBR })} a {format(new Date(unreadReport.week_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Health Score */}
              <Card className={`p-4 ${getHealthBg(unreadReport.cluster_health_score)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Heart className={`h-8 w-8 ${getHealthColor(unreadReport.cluster_health_score)}`} />
                    <div>
                      <h3 className="font-semibold">Saúde do Cluster</h3>
                      <p className="text-sm text-muted-foreground">Score geral de saúde</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-4xl font-bold ${getHealthColor(unreadReport.cluster_health_score)}`}>
                      {unreadReport.cluster_health_score}
                    </span>
                    <span className="text-lg text-muted-foreground">/100</span>
                  </div>
                </div>
                <Progress 
                  value={unreadReport.cluster_health_score} 
                  className="mt-4 h-2" 
                />
              </Card>

              {/* AI Summary */}
              {unreadReport.ai_summary && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Resumo da IA
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {unreadReport.ai_summary}
                  </p>
                </Card>
              )}

              {/* Critical Issues */}
              {unreadReport.critical_issues && unreadReport.critical_issues.length > 0 && (
                <Card className="p-4 border-destructive/30 bg-destructive/5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Problemas Críticos
                  </h3>
                  <ul className="space-y-2">
                    {unreadReport.critical_issues.map((issue, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-destructive" />
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Storage */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Storage</span>
                  </div>
                  <p className="text-2xl font-bold">{unreadReport.total_storage_gb.toFixed(1)} GB</p>
                  <p className="text-xs text-muted-foreground">
                    {unreadReport.storage_used_gb.toFixed(1)} GB usado
                  </p>
                </Card>

                {/* Nodes */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Nodes</span>
                  </div>
                  <p className="text-2xl font-bold">{unreadReport.nodes_count}</p>
                  <p className="text-xs text-muted-foreground">ativos</p>
                </Card>

                {/* Pods */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Pods</span>
                  </div>
                  <p className="text-2xl font-bold">{unreadReport.pods_count}</p>
                  <div className="flex gap-2 text-xs">
                    <span className="text-green-500">{unreadReport.pods_healthy} ok</span>
                    {unreadReport.pods_unhealthy > 0 && (
                      <span className="text-red-500">{unreadReport.pods_unhealthy} com erro</span>
                    )}
                  </div>
                </Card>

                {/* Incidents */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Incidentes</span>
                  </div>
                  <p className="text-2xl font-bold">{unreadReport.total_incidents}</p>
                  <div className="flex gap-2 text-xs">
                    {unreadReport.critical_incidents > 0 && (
                      <span className="text-red-500">{unreadReport.critical_incidents} críticos</span>
                    )}
                    <span className="text-green-500">{unreadReport.resolved_incidents} resolvidos</span>
                  </div>
                </Card>
              </div>

              {/* Agent Actions */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Ações do Agente
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-primary">{unreadReport.total_agent_actions}</p>
                    <p className="text-xs text-muted-foreground">Total de Ações</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-green-500">{unreadReport.pods_restarted}</p>
                    <p className="text-xs text-muted-foreground">Pods Reiniciados</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-blue-500">{unreadReport.resource_limits_applied}</p>
                    <p className="text-xs text-muted-foreground">Limites Aplicados</p>
                  </div>
                </div>
              </Card>

              {/* Recommendations */}
              {unreadReport.recommendations && unreadReport.recommendations.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Recomendações
                  </h3>
                  <ul className="space-y-2">
                    {unreadReport.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Fechar
            </Button>
            <Button onClick={markAsRead}>
              Marcar como Lido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
