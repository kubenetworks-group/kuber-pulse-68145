import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCluster } from "@/contexts/ClusterContext";
import { useNodeMetrics } from "@/hooks/useNodeMetrics";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Server, 
  Box, 
  Cpu, 
  HardDrive,
  Activity,
  TrendingUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PodStatus {
  healthy: number;
  warning: number;
  critical: number;
  total: number;
}

interface ClusterStatusSummaryProps {
  clusterData: any;
}

export const ClusterStatusSummary = ({ clusterData }: ClusterStatusSummaryProps) => {
  const { selectedClusterId } = useCluster();
  const nodeMetrics = useNodeMetrics(selectedClusterId);
  const [podStatus, setPodStatus] = useState<PodStatus>({ healthy: 0, warning: 0, critical: 0, total: 0 });
  const [recentAnomalies, setRecentAnomalies] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedClusterId) {
      fetchPodStatus();
      fetchRecentAnomalies();
    }
  }, [selectedClusterId]);

  const fetchPodStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_metrics')
        .select('metric_data')
        .eq('cluster_id', selectedClusterId)
        .eq('metric_type', 'pods')
        .order('collected_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data?.metric_data) {
        const pods = Array.isArray(data.metric_data) ? data.metric_data : [];
        let healthy = 0, warning = 0, critical = 0;

        pods.forEach((pod: any) => {
          const phase = pod.status?.phase?.toLowerCase() || '';
          const containerStatuses = pod.status?.containerStatuses || [];
          const hasRestarts = containerStatuses.some((c: any) => c.restartCount > 3);
          const allReady = containerStatuses.every((c: any) => c.ready);

          if (phase === 'running' && allReady && !hasRestarts) {
            healthy++;
          } else if (phase === 'pending' || hasRestarts) {
            warning++;
          } else if (phase === 'failed' || phase === 'unknown') {
            critical++;
          } else {
            healthy++;
          }
        });

        setPodStatus({ healthy, warning, critical, total: pods.length });
      }
    } catch (error) {
      console.error('Error fetching pod status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentAnomalies = async () => {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { count, error } = await supabase
        .from('agent_anomalies')
        .select('*', { count: 'exact', head: true })
        .eq('cluster_id', selectedClusterId)
        .gte('created_at', oneDayAgo.toISOString())
        .eq('resolved', false);

      if (error) throw error;
      setRecentAnomalies(count || 0);
    } catch (error) {
      console.error('Error fetching anomalies:', error);
    }
  };

  const getOverallStatus = () => {
    if (!clusterData) return 'unknown';
    if (clusterData.status === 'offline' || podStatus.critical > 0 || recentAnomalies > 2) {
      return 'critical';
    }
    if (clusterData.status === 'warning' || podStatus.warning > 0 || recentAnomalies > 0) {
      return 'warning';
    }
    return 'healthy';
  };

  const overallStatus = getOverallStatus();

  const statusConfig = {
    healthy: {
      icon: CheckCircle2,
      label: 'Saudável',
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/30',
      description: 'Todos os sistemas operando normalmente'
    },
    warning: {
      icon: AlertTriangle,
      label: 'Atenção',
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/30',
      description: 'Alguns componentes precisam de atenção'
    },
    critical: {
      icon: XCircle,
      label: 'Crítico',
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      description: 'Problemas críticos detectados'
    },
    unknown: {
      icon: Activity,
      label: 'Conectando',
      color: 'text-muted-foreground',
      bg: 'bg-muted/10',
      border: 'border-muted/30',
      description: 'Aguardando dados do cluster'
    }
  };

  const config = statusConfig[overallStatus];
  const StatusIcon = config.icon;

  if (loading || nodeMetrics.loading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-border/50 bg-card/50 backdrop-blur-sm ${config.border} border`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Resumo do Cluster
          </CardTitle>
          <Badge 
            variant="outline" 
            className={`${config.bg} ${config.color} ${config.border} border`}
          >
            <StatusIcon className="h-3.5 w-3.5 mr-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Banner */}
        <div className={`p-4 rounded-lg ${config.bg} ${config.border} border flex items-center gap-3`}>
          <StatusIcon className={`h-8 w-8 ${config.color}`} />
          <div>
            <p className={`font-medium ${config.color}`}>{config.label}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Nodes */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Server className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Nodes</span>
            </div>
            <p className="text-2xl font-bold">{nodeMetrics.nodes.length}</p>
            <p className="text-xs text-success">
              {nodeMetrics.nodes.filter(n => n.status === 'Ready').length} ativos
            </p>
          </div>

          {/* Pods */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Box className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Pods</span>
            </div>
            <p className="text-2xl font-bold">{podStatus.total}</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-success">{podStatus.healthy} ok</span>
              {podStatus.warning > 0 && (
                <span className="text-warning">• {podStatus.warning} aviso</span>
              )}
              {podStatus.critical > 0 && (
                <span className="text-destructive">• {podStatus.critical} erro</span>
              )}
            </div>
          </div>

          {/* CPU */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">CPU</span>
            </div>
            <p className="text-2xl font-bold">{nodeMetrics.cpuUsage.toFixed(0)}%</p>
            <div className="w-full h-1.5 bg-muted rounded-full mt-1">
              <div 
                className={`h-full rounded-full transition-all ${
                  nodeMetrics.cpuUsage > 80 ? 'bg-destructive' : 
                  nodeMetrics.cpuUsage > 60 ? 'bg-warning' : 'bg-success'
                }`}
                style={{ width: `${Math.min(nodeMetrics.cpuUsage, 100)}%` }}
              />
            </div>
          </div>

          {/* Memory */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Memória</span>
            </div>
            <p className="text-2xl font-bold">{nodeMetrics.memoryUsage.toFixed(0)}%</p>
            <div className="w-full h-1.5 bg-muted rounded-full mt-1">
              <div 
                className={`h-full rounded-full transition-all ${
                  nodeMetrics.memoryUsage > 80 ? 'bg-destructive' : 
                  nodeMetrics.memoryUsage > 60 ? 'bg-warning' : 'bg-success'
                }`}
                style={{ width: `${Math.min(nodeMetrics.memoryUsage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Anomalies Alert */}
        {recentAnomalies > 0 && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-medium text-warning">
                {recentAnomalies} anomalia{recentAnomalies > 1 ? 's' : ''} detectada{recentAnomalies > 1 ? 's' : ''} nas últimas 24h
              </p>
              <p className="text-xs text-muted-foreground">
                Acesse o Monitor IA para mais detalhes
              </p>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Última atualização: agora</span>
          </div>
          {clusterData?.provider && (
            <span className="capitalize">{clusterData.provider} • {clusterData.environment}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
