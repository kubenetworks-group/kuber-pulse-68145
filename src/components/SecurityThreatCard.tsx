import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Terminal,
  Server,
  Network,
  Cpu,
  Box,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SecurityThreat } from '@/hooks/useSecurityThreats';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface SecurityThreatCardProps {
  threat: SecurityThreat;
  onMitigate?: (threatId: string, action: string) => void;
  onMarkFalsePositive?: (threatId: string) => void;
  onInvestigate?: (threatId: string) => void;
}

const threatTypeIcons: Record<string, any> = {
  ddos: Network,
  brute_force: ShieldAlert,
  port_scan: Network,
  suspicious_process: Terminal,
  crypto_mining: Cpu,
  privilege_escalation: ShieldAlert,
  data_exfiltration: Network,
  shell_injection: Terminal,
  unauthorized_access: Shield,
};

const threatTypeLabels: Record<string, string> = {
  ddos: 'Ataque DDoS',
  brute_force: 'Forca Bruta',
  port_scan: 'Varredura de Portas',
  suspicious_process: 'Processo Suspeito',
  crypto_mining: 'Crypto Mining',
  privilege_escalation: 'Escalacao de Privilegios',
  data_exfiltration: 'Exfiltracao de Dados',
  shell_injection: 'Injecao de Shell',
  unauthorized_access: 'Acesso Nao Autorizado',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  investigating: 'Investigando',
  mitigated: 'Mitigado',
  false_positive: 'Falso Positivo',
};

export function SecurityThreatCard({
  threat,
  onMitigate,
  onMarkFalsePositive,
  onInvestigate,
}: SecurityThreatCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const ThreatIcon = threatTypeIcons[threat.threat_type] || ShieldAlert;

  const getBorderColor = () => {
    switch (threat.severity) {
      case 'critical':
        return 'border-l-red-500';
      case 'high':
        return 'border-l-orange-500';
      case 'medium':
        return 'border-l-yellow-500';
      case 'low':
        return 'border-l-blue-500';
      default:
        return 'border-l-gray-500';
    }
  };

  const getBackgroundColor = () => {
    if (threat.mitigated) return 'bg-green-500/5';
    if (threat.false_positive) return 'bg-gray-500/5';
    switch (threat.severity) {
      case 'critical':
        return 'bg-red-500/5';
      case 'high':
        return 'bg-orange-500/5';
      case 'medium':
        return 'bg-yellow-500/5';
      case 'low':
        return 'bg-blue-500/5';
      default:
        return 'bg-gray-500/5';
    }
  };

  return (
    <Card className={`border-l-4 ${getBorderColor()} ${getBackgroundColor()}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-lg ${
                threat.severity === 'critical' ? 'bg-red-500/20' :
                threat.severity === 'high' ? 'bg-orange-500/20' :
                threat.severity === 'medium' ? 'bg-yellow-500/20' :
                'bg-blue-500/20'
              }`}>
                <ThreatIcon className={`w-5 h-5 ${
                  threat.severity === 'critical' ? 'text-red-400' :
                  threat.severity === 'high' ? 'text-orange-400' :
                  threat.severity === 'medium' ? 'text-yellow-400' :
                  'text-blue-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge className={severityColors[threat.severity]}>
                    {threat.severity.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">
                    {threatTypeLabels[threat.threat_type] || threat.threat_type}
                  </Badge>
                  <Badge variant={threat.mitigated ? 'default' : 'secondary'} className={
                    threat.mitigated ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    threat.false_positive ? 'bg-gray-500/20 text-gray-400' :
                    threat.status === 'investigating' ? 'bg-purple-500/20 text-purple-400' :
                    ''
                  }>
                    {statusLabels[threat.status] || threat.status}
                  </Badge>
                </div>
                <CardTitle className="text-base font-semibold leading-tight">
                  {threat.title}
                </CardTitle>
                {threat.description && (
                  <CardDescription className="mt-1 line-clamp-2">
                    {threat.description}
                  </CardDescription>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(threat.detected_at), 'dd/MM HH:mm', { locale: ptBR })}
              </span>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Container/Pod Info with Terminal Style */}
            {(threat.pod_name || threat.container_name) && (
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                <div className="flex items-center gap-2 mb-2 text-green-400">
                  <Terminal className="w-4 h-4" />
                  <span>Container Info</span>
                </div>
                <div className="space-y-1 text-gray-300">
                  {threat.namespace && (
                    <div>
                      <span className="text-gray-500">namespace:</span>{' '}
                      <span className="text-cyan-400">{threat.namespace}</span>
                    </div>
                  )}
                  {threat.pod_name && (
                    <div>
                      <span className="text-gray-500">pod:</span>{' '}
                      <span className="text-yellow-400">{threat.pod_name}</span>
                    </div>
                  )}
                  {threat.container_name && (
                    <div>
                      <span className="text-gray-500">container:</span>{' '}
                      <span className="text-orange-400">{threat.container_name}</span>
                    </div>
                  )}
                  {threat.node_name && (
                    <div>
                      <span className="text-gray-500">node:</span>{' '}
                      <span className="text-purple-400">{threat.node_name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Suspicious Command */}
            {threat.suspicious_command && (
              <div className="bg-red-950 border border-red-500/30 rounded-lg p-4 font-mono text-sm">
                <div className="flex items-center gap-2 mb-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Comando Suspeito Detectado</span>
                </div>
                <code className="text-red-300 break-all">
                  $ {threat.suspicious_command}
                </code>
              </div>
            )}

            {/* Network Info */}
            {(threat.source_ip || threat.affected_port || threat.connection_count) && (
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                <div className="flex items-center gap-2 mb-2 text-blue-400">
                  <Network className="w-4 h-4" />
                  <span>Network Activity</span>
                </div>
                <div className="space-y-1 text-gray-300">
                  {threat.source_ip && (
                    <div>
                      <span className="text-gray-500">source_ip:</span>{' '}
                      <span className="text-red-400">{threat.source_ip}</span>
                    </div>
                  )}
                  {threat.destination_ip && (
                    <div>
                      <span className="text-gray-500">dest_ip:</span>{' '}
                      <span className="text-orange-400">{threat.destination_ip}</span>
                    </div>
                  )}
                  {threat.affected_port && (
                    <div>
                      <span className="text-gray-500">port:</span>{' '}
                      <span className="text-yellow-400">{threat.affected_port}</span>
                    </div>
                  )}
                  {threat.connection_count && (
                    <div>
                      <span className="text-gray-500">connections:</span>{' '}
                      <span className="text-purple-400">{threat.connection_count}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Analysis */}
            {threat.ai_analysis && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3 text-primary">
                  <Shield className="w-4 h-4" />
                  <span className="font-semibold">Analise de IA</span>
                  {threat.ai_analysis.confidence && (
                    <Badge variant="outline" className="ml-auto">
                      Confianca: {Math.round(threat.ai_analysis.confidence * 100)}%
                    </Badge>
                  )}
                </div>

                {threat.ai_analysis.threat_score !== undefined && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Nivel de Ameaca</span>
                      <span className={
                        threat.ai_analysis.threat_score > 0.7 ? 'text-red-400' :
                        threat.ai_analysis.threat_score > 0.4 ? 'text-yellow-400' :
                        'text-green-400'
                      }>
                        {Math.round(threat.ai_analysis.threat_score * 100)}%
                      </span>
                    </div>
                    <Progress
                      value={threat.ai_analysis.threat_score * 100}
                      className={`h-2 ${
                        threat.ai_analysis.threat_score > 0.7 ? '[&>div]:bg-red-500' :
                        threat.ai_analysis.threat_score > 0.4 ? '[&>div]:bg-yellow-500' :
                        '[&>div]:bg-green-500'
                      }`}
                    />
                  </div>
                )}

                {threat.ai_analysis.recommendation && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-muted-foreground">Recomendacao:</span>
                    <p className="text-sm mt-1">{threat.ai_analysis.recommendation}</p>
                  </div>
                )}

                {threat.ai_analysis.indicators && threat.ai_analysis.indicators.length > 0 && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-muted-foreground">Indicadores:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {threat.ai_analysis.indicators.map((indicator, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {indicator}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {threat.ai_analysis.mitigation_steps && threat.ai_analysis.mitigation_steps.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Passos para Mitigacao:</span>
                    <ol className="list-decimal list-inside text-sm mt-1 space-y-1">
                      {threat.ai_analysis.mitigation_steps.map((step, idx) => (
                        <li key={idx} className="text-muted-foreground">{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {!threat.mitigated && !threat.false_positive && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {onInvestigate && threat.status === 'active' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onInvestigate(threat.id)}
                    className="gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Investigar
                  </Button>
                )}
                {onMitigate && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onMitigate(threat.id, 'manual_mitigation')}
                    className="gap-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Marcar como Mitigado
                  </Button>
                )}
                {onMarkFalsePositive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMarkFalsePositive(threat.id)}
                    className="gap-1 text-muted-foreground"
                  >
                    <XCircle className="w-4 h-4" />
                    Falso Positivo
                  </Button>
                )}
              </div>
            )}

            {/* Mitigated Info */}
            {threat.mitigated && threat.mitigated_at && (
              <div className="flex items-center gap-2 text-sm text-green-400 pt-2 border-t">
                <ShieldCheck className="w-4 h-4" />
                <span>
                  Mitigado em {format(new Date(threat.mitigated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  {threat.mitigation_action && ` - ${threat.mitigation_action}`}
                </span>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
