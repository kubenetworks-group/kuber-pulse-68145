import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCluster } from "@/contexts/ClusterContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Activity,
  TrendingUp,
  Wifi,
  WifiOff,
  Shield,
  Server,
  Box
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PodStatus {
  healthy: number;
  warning: number;
  critical: number;
  total: number;
}

interface AttentionItem {
  type: 'agent' | 'pods' | 'anomaly' | 'security';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  icon: typeof AlertTriangle;
}

interface ClusterStatusSummaryProps {
  clusterData: any;
}

export const ClusterStatusSummary = ({ clusterData }: ClusterStatusSummaryProps) => {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const [podStatus, setPodStatus] = useState<PodStatus>({ healthy: 0, warning: 0, critical: 0, total: 0 });
  const [recentAnomalies, setRecentAnomalies] = useState(0);
  const [securityThreats, setSecurityThreats] = useState({ critical: 0, high: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedClusterId && user) {
      fetchPodStatus();
      fetchRecentAnomalies();
      fetchSecurityThreats();
    }
  }, [selectedClusterId, user]);

  const fetchPodStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_metrics')
        .select('metric_data')
        .eq('cluster_id', selectedClusterId)
        .eq('metric_type', 'pods')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data?.metric_data) {
        const md = data.metric_data as any;
        let healthy = 0, warning = 0, critical = 0, total = 0;

        if (Array.isArray(md)) {
          // Full pod list format
          md.forEach((pod: any) => {
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
          total = md.length;
        } else if (md.total !== undefined) {
          // Summary object format: { total, running, pending, failed }
          healthy = md.running || 0;
          warning = md.pending || 0;
          critical = md.failed || 0;
          total = md.total || 0;
        }

        setPodStatus({ healthy, warning, critical, total });
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

  const fetchSecurityThreats = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('security_threats')
        .select('severity')
        .eq('cluster_id', selectedClusterId)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      const critical = data?.filter(t => t.severity === 'critical').length || 0;
      const high = data?.filter(t => t.severity === 'high').length || 0;
      
      setSecurityThreats({ critical, high });
    } catch (error) {
      console.error('Error fetching security threats:', error);
    }
  };

  // Check if agent is offline (last seen more than 5 minutes ago)
  const isAgentOffline = () => {
    if (!clusterData?.agent_last_seen_at && !clusterData?.last_sync) return true;
    const lastSeen = new Date(clusterData.agent_last_seen_at || clusterData.last_sync);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeen < fiveMinutesAgo;
  };

  // Build attention items list
  const getAttentionItems = (): AttentionItem[] => {
    const items: AttentionItem[] = [];

    // Agent offline
    if (isAgentOffline()) {
      items.push({
        type: 'agent',
        severity: 'critical',
        title: 'Agente Offline',
        description: 'O agente Kodo não está enviando métricas. Verifique a conexão do cluster.',
        icon: WifiOff
      });
    }

    // Security threats
    if (securityThreats.critical > 0) {
      items.push({
        type: 'security',
        severity: 'critical',
        title: `${securityThreats.critical} Ameaça${securityThreats.critical > 1 ? 's' : ''} Crítica${securityThreats.critical > 1 ? 's' : ''}`,
        description: 'Ameaças de segurança críticas detectadas. Ação imediata recomendada.',
        icon: Shield
      });
    } else if (securityThreats.high > 0) {
      items.push({
        type: 'security',
        severity: 'warning',
        title: `${securityThreats.high} Ameaça${securityThreats.high > 1 ? 's' : ''} Alta${securityThreats.high > 1 ? 's' : ''}`,
        description: 'Ameaças de segurança de alta severidade detectadas.',
        icon: Shield
      });
    }

    // Critical pods
    if (podStatus.critical > 0) {
      items.push({
        type: 'pods',
        severity: 'critical',
        title: `${podStatus.critical} Pod${podStatus.critical > 1 ? 's' : ''} em Falha`,
        description: 'Pods em estado crítico ou com falha. Verifique os logs.',
        icon: Box
      });
    } else if (podStatus.warning > 0) {
      items.push({
        type: 'pods',
        severity: 'warning',
        title: `${podStatus.warning} Pod${podStatus.warning > 1 ? 's' : ''} com Problemas`,
        description: 'Pods pendentes ou com muitos restarts.',
        icon: Box
      });
    }

    // Anomalies
    if (recentAnomalies > 0) {
      items.push({
        type: 'anomaly',
        severity: recentAnomalies > 2 ? 'critical' : 'warning',
        title: `${recentAnomalies} Anomalia${recentAnomalies > 1 ? 's' : ''} Detectada${recentAnomalies > 1 ? 's' : ''}`,
        description: 'Comportamentos anômalos detectados nas últimas 24h.',
        icon: Activity
      });
    }

    return items;
  };

  const attentionItems = getAttentionItems();

  const getOverallStatus = () => {
    if (!clusterData) return 'unknown';
    
    // Check for critical items
    const hasCritical = attentionItems.some(item => item.severity === 'critical');
    if (hasCritical || clusterData.status === 'offline') {
      return 'critical';
    }
    
    // Check for warning items
    const hasWarning = attentionItems.some(item => item.severity === 'warning');
    if (hasWarning || clusterData.status === 'warning') {
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

  if (loading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
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

        {/* Attention Items - Show specific issues */}
        {attentionItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Itens que precisam de atenção:</p>
            {attentionItems.map((item, index) => {
              const ItemIcon = item.icon;
              const isCritical = item.severity === 'critical';
              
              return (
                <div 
                  key={index}
                  className={`p-3 rounded-lg flex items-start gap-3 ${
                    isCritical 
                      ? 'bg-destructive/10 border border-destructive/30' 
                      : 'bg-warning/10 border border-warning/30'
                  }`}
                >
                  <ItemIcon className={`h-5 w-5 mt-0.5 ${
                    isCritical ? 'text-destructive' : 'text-warning'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${
                        isCritical ? 'text-destructive' : 'text-warning'
                      }`}>
                        {item.title}
                      </p>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 ${
                          isCritical 
                            ? 'bg-destructive/20 text-destructive border-destructive/30' 
                            : 'bg-warning/20 text-warning border-warning/30'
                        }`}
                      >
                        {item.type === 'agent' && 'Agente'}
                        {item.type === 'pods' && 'Pods'}
                        {item.type === 'security' && 'Segurança'}
                        {item.type === 'anomaly' && 'Anomalia'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Agent Status Indicator */}
        {!isAgentOffline() && (
          <div className="flex items-center gap-2 text-xs text-success">
            <Wifi className="h-3.5 w-3.5" />
            <span>Agente Kodo conectado e enviando métricas</span>
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
