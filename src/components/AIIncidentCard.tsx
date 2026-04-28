import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Flame, AlertCircle, Info, Bot, CheckCircle, Clock, Play, Search, ListChecks, Terminal, History, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Incident = {
  id: string;
  cluster_id: string;
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  ai_analysis: {
    root_cause?: string;
    root_cause_analysis?: string;
    impact?: string;
    recommendation?: string;
    troubleshooting_steps?: string[];
    logs_excerpt?: string | null;
    historical_context?: string | null;
    action_already_taken?: string | null;
    confidence?: number;
    health_score?: number | null;
    needs_user_action?: boolean;
    user_action_reason?: string | null;
  };
  auto_heal_action: string | null;
  action_taken: boolean;
  action_result: {
    success: boolean;
    details: string;
    timestamp: string;
  } | null;
  created_at: string;
  resolved_at: string | null;
};

interface AIIncidentCardProps {
  incident: Incident;
  clusterName?: string;
  onExecuteAction?: (incidentId: string) => void;
}

const severityConfig = {
  critical: {
    icon: Flame,
    gradient: "from-red-500/20 to-red-600/20",
    border: "border-red-500/50",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    iconColor: "text-red-500"
  },
  high: {
    icon: AlertTriangle,
    gradient: "from-orange-500/20 to-orange-600/20",
    border: "border-orange-500/50",
    badge: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    iconColor: "text-orange-500"
  },
  medium: {
    icon: AlertCircle,
    gradient: "from-yellow-500/20 to-yellow-600/20",
    border: "border-yellow-500/50",
    badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    iconColor: "text-yellow-500"
  },
  low: {
    icon: Info,
    gradient: "from-blue-500/20 to-blue-600/20",
    border: "border-blue-500/50",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    iconColor: "text-blue-500"
  }
};

const actionTypeLabels: Record<string, string> = {
  restart_pod: "Restart Pod",
  delete_pod: "Delete Pod",
  scale_up: "Scale Up",
  scale_down: "Scale Down",
  clear_cache: "Clear Cache",
  rollback_deployment: "Rollback Deployment",
  rotate_certificate: "Rotate Certificate",
  optimize_resources: "Optimize Resources",
  update_deployment_resources: "Atualizar Recursos",
  update_deployment_image: "Atualizar Imagem",
};

export const AIIncidentCard = ({ incident, clusterName, onExecuteAction }: AIIncidentCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const config = severityConfig[incident.severity];
  const Icon = config.icon;

  const analysis = incident.ai_analysis || {} as any;
  const rootCause = analysis.root_cause_analysis || analysis.root_cause;
  const steps = analysis.troubleshooting_steps || [];
  const logsExcerpt = analysis.logs_excerpt;
  const historicalContext = analysis.historical_context;
  const actionAlreadyTaken = analysis.action_already_taken;
  const recommendation = analysis.recommendation;
  const confidence = analysis.confidence;
  const needsUserAction = (analysis as any).needs_user_action === true;
  const userActionReason = (analysis as any).user_action_reason;

  const getStatusInfo = () => {
    if (incident.resolved_at) {
      return { icon: CheckCircle, label: "Resolvido", color: "text-green-400" };
    }
    if (incident.action_taken) {
      return { icon: Clock, label: "Ação executada", color: "text-blue-400" };
    }
    return { icon: Clock, label: "Pendente", color: "text-yellow-400" };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  return (
    <Card className={cn(
      "overflow-hidden border transition-all hover:shadow-glow",
      config.border,
      "bg-gradient-to-br shadow-card",
      config.gradient
    )}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={cn("p-2.5 rounded-lg bg-background/50 shrink-0", config.iconColor)}>
            <Icon className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant="outline" className={config.badge}>
                {incident.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="bg-background/50 text-[11px]">
                {incident.incident_type.replace(/_/g, ' ')}
              </Badge>
              {clusterName && (
                <Badge variant="outline" className="bg-background/50 text-[11px]">
                  {clusterName}
                </Badge>
              )}
              {historicalContext && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[11px]">
                  Recorrente
                </Badge>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                <StatusIcon className={cn("h-3.5 w-3.5", status.color)} />
                <span>{status.label}</span>
              </div>
            </div>

            <h3 className="font-semibold text-sm mb-1">{incident.title}</h3>
            <p className="text-muted-foreground text-xs leading-relaxed">{incident.description}</p>
          </div>
        </div>

        {/* "Needs user action" banner */}
        {needsUserAction && (
          <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md px-2.5 py-2 mb-3">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <span className="font-medium">Requer ação manual: </span>
              {userActionReason || 'Este problema não pode ser corrigido automaticamente pela IA.'}
            </span>
          </div>
        )}

        {/* Action already taken (auto-heal result) */}
        {actionAlreadyTaken && (
          <div className="flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-md px-2.5 py-2 mb-3">
            <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span><span className="font-medium">Ação executada:</span> {actionAlreadyTaken}</span>
          </div>
        )}

        {/* AI Analysis toggle */}
        {(rootCause || steps.length > 0 || recommendation) && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full justify-between gap-2 text-xs h-8"
            >
              <span className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                Diagnóstico IA
                {confidence && <span className="text-muted-foreground">({Math.round(confidence * 100)}%)</span>}
              </span>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>

            {expanded && (
              <div className="space-y-3 text-xs animate-fade-in border-l-2 border-primary/30 pl-3">

                {/* Root cause analysis */}
                {rootCause && (
                  <div>
                    <div className="flex items-center gap-1 font-medium text-primary mb-1">
                      <Search className="h-3 w-3" />
                      Causa raiz
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{rootCause}</p>
                  </div>
                )}

                {/* Historical context */}
                {historicalContext && (
                  <div>
                    <div className="flex items-center gap-1 font-medium text-amber-400 mb-1">
                      <History className="h-3 w-3" />
                      Histórico
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{historicalContext}</p>
                  </div>
                )}

                {/* Troubleshooting steps */}
                {steps.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 font-medium text-green-400 mb-1.5">
                      <ListChecks className="h-3 w-3" />
                      Passos de resolução
                    </div>
                    <ol className="space-y-1.5">
                      {steps.map((step, i) => (
                        <li key={i} className="text-muted-foreground leading-relaxed">
                          {step.startsWith(`${i + 1}.`) ? step : `${i + 1}. ${step}`}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Fallback recommendation */}
                {!rootCause && !steps.length && recommendation && (
                  <div>
                    <span className="font-medium text-green-400">Recomendação:</span>
                    <p className="text-muted-foreground mt-1">{recommendation}</p>
                  </div>
                )}

                {/* Logs excerpt (collapsible) */}
                {logsExcerpt && (
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] px-1.5 gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => setLogsExpanded(!logsExpanded)}
                    >
                      <Terminal className="h-3 w-3" />
                      {logsExpanded ? "Ocultar logs analisados" : "Ver logs analisados"}
                      {logsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                    {logsExpanded && (
                      <ScrollArea className="h-36 mt-1 rounded border bg-muted/30">
                        <pre className="text-[10px] p-2 font-mono whitespace-pre-wrap break-all leading-relaxed">
                          {logsExcerpt}
                        </pre>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Auto-heal action */}
        {incident.auto_heal_action && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Ação sugerida:</span>
                <Badge variant="outline" className="bg-primary/10 text-xs">
                  {actionTypeLabels[incident.auto_heal_action] || incident.auto_heal_action}
                </Badge>
              </div>

              {!incident.action_taken && onExecuteAction && (
                <Button
                  size="sm"
                  onClick={() => onExecuteAction(incident.id)}
                  className="gap-1.5 h-7 text-xs"
                >
                  <Play className="h-3.5 w-3.5" />
                  Executar
                </Button>
              )}
            </div>

            {incident.action_result && (() => {
              const ar = incident.action_result as { status?: string; message?: string; details?: string; timestamp?: string };
              return (
              <div className="mt-2 p-2.5 rounded-lg bg-background/80 border border-border/50">
                <div className="flex items-center gap-1.5 mb-1">
                  {ar.status === 'command_sent' ? (
                    <Clock className="h-3.5 w-3.5 text-blue-400" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                  )}
                  <span className="text-xs font-medium">
                    {ar.status === 'command_sent' ? 'Comando enviado ao cluster' : 'Ação concluída'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ar.message || ar.details}
                </p>
                {ar.timestamp && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(ar.timestamp).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
              );
            })()}
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground flex justify-between">
          <span>Detectado: {new Date(incident.created_at).toLocaleString('pt-BR')}</span>
          {incident.resolved_at && (
            <span>Resolvido: {new Date(incident.resolved_at).toLocaleString('pt-BR')}</span>
          )}
        </div>
      </div>
    </Card>
  );
};
