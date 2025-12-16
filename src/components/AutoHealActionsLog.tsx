import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAutoHeal, AutoHealAction } from "@/hooks/useAutoHeal";
import { useCluster } from "@/contexts/ClusterContext";
import { 
  Bot, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  Shield, 
  Activity,
  RefreshCw,
  Terminal,
  Scale,
  Server
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const actionTypeIcons: Record<string, React.ReactNode> = {
  'security_fix': <Shield className="h-4 w-4 text-blue-500" />,
  'restart_pod': <RefreshCw className="h-4 w-4 text-orange-500" />,
  'scale_deployment': <Scale className="h-4 w-4 text-purple-500" />,
  'apply_resource_limits': <Server className="h-4 w-4 text-green-500" />,
  'create_network_policy': <Shield className="h-4 w-4 text-cyan-500" />,
  'apply_rbac': <Shield className="h-4 w-4 text-indigo-500" />,
  'anomaly_fix': <Activity className="h-4 w-4 text-yellow-500" />,
  'execute_command': <Terminal className="h-4 w-4 text-gray-500" />,
};

const actionTypeLabels: Record<string, string> = {
  'security_fix': 'Correção de Segurança',
  'restart_pod': 'Reiniciar Pod',
  'scale_deployment': 'Escalar Deployment',
  'apply_resource_limits': 'Aplicar Resource Limits',
  'create_network_policy': 'Criar Network Policy',
  'apply_rbac': 'Aplicar RBAC',
  'anomaly_fix': 'Correção de Anomalia',
  'execute_command': 'Executar Comando',
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: {
    icon: <Clock className="h-4 w-4" />,
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    label: 'Pendente',
  },
  executing: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    label: 'Executando',
  },
  completed: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
    label: 'Concluído',
  },
  failed: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-red-500/10 text-red-500 border-red-500/20',
    label: 'Falhou',
  },
};

function ActionItem({ action }: { action: AutoHealAction }) {
  const status = statusConfig[action.status] || statusConfig.pending;
  const icon = actionTypeIcons[action.action_type] || <Bot className="h-4 w-4" />;
  const label = actionTypeLabels[action.action_type] || action.action_type;

  return (
    <div className="flex gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex-shrink-0 mt-1">
        <div className="p-2 rounded-full bg-background border">
          {icon}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-medium text-sm">{label}</h4>
            <p className="text-sm text-muted-foreground mt-0.5">
              {action.trigger_reason}
            </p>
          </div>
          <Badge variant="outline" className={status.color}>
            {status.icon}
            <span className="ml-1">{status.label}</span>
          </Badge>
        </div>

        {/* Action details */}
        {action.action_details && Object.keys(action.action_details).length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2 font-mono">
            {action.action_details.command && (
              <div>Comando: {action.action_details.command}</div>
            )}
            {action.action_details.target && (
              <div>Alvo: {action.action_details.target}</div>
            )}
            {action.action_details.namespace && (
              <div>Namespace: {action.action_details.namespace}</div>
            )}
          </div>
        )}

        {/* Result or error */}
        {action.status === 'completed' && action.result && (
          <div className="mt-2 text-xs text-green-600 dark:text-green-400">
            ✅ {typeof action.result === 'string' ? action.result : JSON.stringify(action.result)}
          </div>
        )}
        {action.status === 'failed' && action.error_message && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            ❌ {action.error_message}
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-2 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(action.created_at), { 
            addSuffix: true, 
            locale: ptBR 
          })}
          {action.completed_at && (
            <span className="ml-2">
              • Duração: {Math.round(
                (new Date(action.completed_at).getTime() - new Date(action.created_at).getTime()) / 1000
              )}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function AutoHealActionsLog() {
  const { selectedClusterId } = useCluster();
  const { actions, loading, fetchActions } = useAutoHeal();

  if (!selectedClusterId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione um cluster para ver o histórico de ações</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const completedActions = actions.filter(a => a.status === 'completed').length;
  const failedActions = actions.filter(a => a.status === 'failed').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Histórico de Ações Automáticas
            </CardTitle>
            <CardDescription>
              Todas as correções executadas automaticamente pela IA
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchActions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Concluídas:</span>
            <span className="font-medium">{completedActions}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Falhas:</span>
            <span className="font-medium">{failedActions}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">{actions.length}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {actions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma ação automática executada ainda</p>
            <p className="text-sm mt-1">
              Ative a auto-cura para começar a ver ações aqui
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {actions.map((action) => (
                <ActionItem key={action.id} action={action} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
