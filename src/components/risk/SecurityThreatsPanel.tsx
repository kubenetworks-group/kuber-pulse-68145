import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldAlert,
  ShieldOff,
  AlertTriangle,
  Container,
  Server,
  Network,
  Eye,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Shield,
  Clock,
  Target,
  Zap,
  FileWarning,
  Lightbulb,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SecurityThreat, ThreatStats } from "@/hooks/useSecurityThreats";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SecurityThreatsPanelProps {
  threats: SecurityThreat[];
  stats: ThreatStats;
  loading: boolean;
  scanning: boolean;
  onScan: () => void;
  onMitigate: (threatId: string, action: string) => void;
  onMarkFalsePositive: (threatId: string) => void;
  onUpdateStatus: (threatId: string, status: string) => void;
}

const severityConfig = {
  critical: { 
    color: "bg-red-500", 
    textColor: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    label: "Crítica",
    icon: ShieldOff 
  },
  high: { 
    color: "bg-orange-500", 
    textColor: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    label: "Alta",
    icon: AlertTriangle 
  },
  medium: { 
    color: "bg-yellow-500", 
    textColor: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    label: "Média",
    icon: AlertTriangle 
  },
  low: { 
    color: "bg-blue-500", 
    textColor: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    label: "Baixa",
    icon: Shield 
  },
};

const threatTypeConfig: Record<string, { icon: typeof Container; label: string }> = {
  privileged_container: { icon: Container, label: "Container Privilegiado" },
  host_network: { icon: Network, label: "Acesso à Rede do Host" },
  host_pid: { icon: Server, label: "Acesso ao PID do Host" },
  suspicious_process: { icon: Zap, label: "Processo Suspeito" },
  unauthorized_access: { icon: ShieldOff, label: "Acesso Não Autorizado" },
  malware_detected: { icon: FileWarning, label: "Malware Detectado" },
  network_anomaly: { icon: Network, label: "Anomalia de Rede" },
  brute_force: { icon: Target, label: "Força Bruta" },
};

function ThreatCard({ 
  threat, 
  onMitigate, 
  onMarkFalsePositive,
  onUpdateStatus
}: { 
  threat: SecurityThreat;
  onMitigate: (id: string, action: string) => void;
  onMarkFalsePositive: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[threat.severity];
  const typeConfig = threatTypeConfig[threat.threat_type] || { icon: AlertTriangle, label: threat.threat_type };
  const TypeIcon = typeConfig.icon;
  const SeverityIcon = config.icon;

  const affectedResources = threat.affected_resources || [];
  const aiAnalysis = threat.ai_analysis || {};
  const recommendations = aiAnalysis.mitigation_steps || [];

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-lg",
      config.bgColor,
      config.borderColor,
      "border"
    )}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={cn("p-2 rounded-lg", config.bgColor)}>
                  <SeverityIcon className={cn("h-5 w-5", config.textColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm truncate">{threat.title}</h3>
                    <Badge variant="outline" className={cn("text-xs", config.textColor, config.borderColor)}>
                      {config.label}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <TypeIcon className="h-3 w-3 mr-1" />
                      {typeConfig.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(threat.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {threat.status === 'active' && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    Ativo
                  </Badge>
                )}
                {threat.status === 'mitigated' && (
                  <Badge variant="outline" className="text-xs text-green-500 border-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Mitigado
                  </Badge>
                )}
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-4">
            {/* Description */}
            {threat.description && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                <p className="text-sm text-muted-foreground">{threat.description}</p>
              </div>
            )}

            {/* Affected Resources */}
            {affectedResources.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-destructive" />
                  Recursos Afetados
                </h4>
                <div className="grid gap-2">
                  {affectedResources.map((resource: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-background/80 border border-border text-xs space-y-1">
                      {resource.namespace && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Namespace:</span>
                          <code className="px-1.5 py-0.5 rounded bg-muted">{resource.namespace}</code>
                        </div>
                      )}
                      {resource.pod && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Pod:</span>
                          <code className="px-1.5 py-0.5 rounded bg-muted">{resource.pod}</code>
                        </div>
                      )}
                      {resource.container && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Container:</span>
                          <code className="px-1.5 py-0.5 rounded bg-muted">{resource.container}</code>
                        </div>
                      )}
                      {resource.node && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Node:</span>
                          <code className="px-1.5 py-0.5 rounded bg-muted">{resource.node}</code>
                        </div>
                      )}
                      {resource.image && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Imagem:</span>
                          <code className="px-1.5 py-0.5 rounded bg-muted text-xs break-all">{resource.image}</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy fields for backwards compatibility */}
            {!affectedResources.length && (threat.namespace || threat.pod_name || threat.container_name) && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-destructive" />
                  Recursos Afetados
                </h4>
                <div className="p-3 rounded-lg bg-background/80 border border-border text-xs space-y-1">
                  {threat.namespace && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Namespace:</span>
                      <code className="px-1.5 py-0.5 rounded bg-muted">{threat.namespace}</code>
                    </div>
                  )}
                  {threat.pod_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Pod:</span>
                      <code className="px-1.5 py-0.5 rounded bg-muted">{threat.pod_name}</code>
                    </div>
                  )}
                  {threat.container_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Container:</span>
                      <code className="px-1.5 py-0.5 rounded bg-muted">{threat.container_name}</code>
                    </div>
                  )}
                  {threat.node_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Node:</span>
                      <code className="px-1.5 py-0.5 rounded bg-muted">{threat.node_name}</code>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Analysis */}
            {aiAnalysis.recommendation && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Análise de IA
                </h4>
                <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                  <p className="text-sm">{aiAnalysis.recommendation}</p>
                  {aiAnalysis.confidence && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Confiança: {Math.round(aiAnalysis.confidence * 100)}%
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Recomendações
                </h4>
                <div className="space-y-2">
                  {recommendations.map((step: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 text-xs flex items-center justify-center font-medium">
                        {idx + 1}
                      </span>
                      <p className="text-sm">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Default recommendations if none provided */}
            {recommendations.length === 0 && threat.status === 'active' && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  O que verificar
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                    <ArrowRight className="h-4 w-4 text-green-500 mt-0.5" />
                    <p className="text-sm">Verificar os logs do container/pod afetado</p>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                    <ArrowRight className="h-4 w-4 text-green-500 mt-0.5" />
                    <p className="text-sm">Verificar se o comportamento é esperado para esta aplicação</p>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                    <ArrowRight className="h-4 w-4 text-green-500 mt-0.5" />
                    <p className="text-sm">Revisar as permissões e políticas de segurança</p>
                  </div>
                  {threat.threat_type === 'privileged_container' && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <ArrowRight className="h-4 w-4 text-orange-500 mt-0.5" />
                      <p className="text-sm">Considerar remover o modo privilegiado se não for necessário</p>
                    </div>
                  )}
                  {(threat.threat_type === 'host_network' || threat.threat_type === 'host_pid') && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <ArrowRight className="h-4 w-4 text-orange-500 mt-0.5" />
                      <p className="text-sm">Avaliar se o acesso ao host é realmente necessário</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {threat.status === 'active' && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-500 border-green-500/50 hover:bg-green-500/10"
                  onClick={() => onMitigate(threat.id, 'manual_review')}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Marcar como Resolvido
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdateStatus(threat.id, 'investigating')}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Investigando
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => onMarkFalsePositive(threat.id)}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Falso Positivo
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function SecurityThreatsPanel({
  threats,
  stats,
  loading,
  scanning,
  onScan,
  onMitigate,
  onMarkFalsePositive,
  onUpdateStatus,
}: SecurityThreatsPanelProps) {
  // Filter ONLY real attacks (is_attack === true) for the threats panel
  // Configuration risks (is_attack === false) should appear in the Risks tab
  const attackThreats = threats.filter(t => t.is_attack !== false);
  const activeThreats = attackThreats.filter(t => t.status === 'active');
  const criticalThreats = activeThreats.filter(t => t.severity === 'critical');
  const highThreats = activeThreats.filter(t => t.severity === 'high');
  const otherThreats = activeThreats.filter(t => t.severity !== 'critical' && t.severity !== 'high');
  const resolvedThreats = attackThreats.filter(t => t.status === 'mitigated' || t.status === 'false_positive');

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 animate-spin mb-3" />
            <p>Carregando ameaças...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeThreats.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-10">
          <div className="flex flex-col items-center justify-center">
            <div className="p-4 rounded-full bg-green-500/20 mb-4">
              <Shield className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-green-500 mb-2">Nenhuma Ameaça Ativa</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Não foram detectadas ameaças de segurança ativas no seu cluster. Continue monitorando regularmente.
            </p>
            <Button onClick={onScan} disabled={scanning} variant="outline">
              {scanning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Escaneando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Executar Varredura
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      <Card className={cn(
        "border-2",
        criticalThreats.length > 0 
          ? "border-red-500 bg-gradient-to-r from-red-950/50 to-background" 
          : "border-orange-500 bg-gradient-to-r from-orange-950/50 to-background"
      )}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-full",
                criticalThreats.length > 0 ? "bg-red-500/20 animate-pulse" : "bg-orange-500/20"
              )}>
                <ShieldAlert className={cn(
                  "h-8 w-8",
                  criticalThreats.length > 0 ? "text-red-500" : "text-orange-500"
                )} />
              </div>
              <div>
                <h2 className={cn(
                  "text-xl font-bold",
                  criticalThreats.length > 0 ? "text-red-500" : "text-orange-500"
                )}>
                  {criticalThreats.length > 0 ? "🚨 ALERTA DE SEGURANÇA!" : "⚠️ Ameaças Detectadas"}
                </h2>
                <p className="text-muted-foreground">
                  {activeThreats.length} ameaça{activeThreats.length > 1 ? 's' : ''} ativa{activeThreats.length > 1 ? 's' : ''} 
                  {criticalThreats.length > 0 && ` (${criticalThreats.length} crítica${criticalThreats.length > 1 ? 's' : ''})`}
                </p>
              </div>
            </div>
            <Button onClick={onScan} disabled={scanning} variant="outline" size="sm">
              {scanning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Escaneando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-red-500">{stats.critical}</p>
            <p className="text-xs text-muted-foreground">Críticas</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-orange-500">{stats.high}</p>
            <p className="text-xs text-muted-foreground">Altas</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-yellow-500">{stats.medium}</p>
            <p className="text-xs text-muted-foreground">Médias</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-green-500">{stats.mitigated}</p>
            <p className="text-xs text-muted-foreground">Resolvidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Threats Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Ativas ({activeThreats.length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Resolvidas ({resolvedThreats.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {/* Critical Threats */}
          {criticalThreats.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-red-500 flex items-center gap-2">
                <ShieldOff className="h-4 w-4" />
                Ameaças Críticas ({criticalThreats.length})
              </h3>
              <div className="space-y-3">
                {criticalThreats.map(threat => (
                  <ThreatCard
                    key={threat.id}
                    threat={threat}
                    onMitigate={onMitigate}
                    onMarkFalsePositive={onMarkFalsePositive}
                    onUpdateStatus={onUpdateStatus}
                  />
                ))}
              </div>
            </div>
          )}

          {/* High Threats */}
          {highThreats.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-orange-500 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Ameaças Altas ({highThreats.length})
              </h3>
              <div className="space-y-3">
                {highThreats.map(threat => (
                  <ThreatCard
                    key={threat.id}
                    threat={threat}
                    onMitigate={onMitigate}
                    onMarkFalsePositive={onMarkFalsePositive}
                    onUpdateStatus={onUpdateStatus}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Threats */}
          {otherThreats.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Outras Ameaças ({otherThreats.length})
              </h3>
              <div className="space-y-3">
                {otherThreats.map(threat => (
                  <ThreatCard
                    key={threat.id}
                    threat={threat}
                    onMitigate={onMitigate}
                    onMarkFalsePositive={onMarkFalsePositive}
                    onUpdateStatus={onUpdateStatus}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          {resolvedThreats.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma ameaça resolvida ainda.</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {resolvedThreats.map(threat => (
                  <ThreatCard
                    key={threat.id}
                    threat={threat}
                    onMitigate={onMitigate}
                    onMarkFalsePositive={onMarkFalsePositive}
                    onUpdateStatus={onUpdateStatus}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
