import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Terminal,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Shield,
  Box,
  Server,
} from 'lucide-react';
import { SecurityThreat } from '@/hooks/useSecurityThreats';
import { toast } from '@/hooks/use-toast';

interface ContainerTerminalAlertProps {
  threats: SecurityThreat[];
  maxItems?: number;
}

export function ContainerTerminalAlert({ threats, maxItems = 5 }: ContainerTerminalAlertProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Filter threats that have container/pod info or suspicious commands
  const relevantThreats = threats
    .filter(t => t.pod_name || t.container_name || t.suspicious_command)
    .slice(0, maxItems);

  if (relevantThreats.length === 0) {
    return null;
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
      toast({
        title: 'Copiado!',
        description: 'Informacao copiada para a area de transferencia.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao copiar.',
        variant: 'destructive',
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400';
      case 'high':
        return 'text-orange-400';
      case 'medium':
        return 'text-yellow-400';
      case 'low':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse';
      case 'investigating':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'mitigated':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'false_positive':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <Card className="bg-gray-950 border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-green-400 font-mono">
            <Terminal className="w-5 h-5" />
            Alertas de Container
          </CardTitle>
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">
            {relevantThreats.filter(t => t.status === 'active').length} ativos
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {relevantThreats.map((threat) => (
          <div
            key={threat.id}
            className={`bg-gray-900 rounded-lg border ${
              threat.severity === 'critical' ? 'border-red-500/50' :
              threat.severity === 'high' ? 'border-orange-500/50' :
              'border-gray-700'
            }`}
          >
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className={`w-3 h-3 rounded-full ${
                    threat.severity === 'critical' ? 'bg-red-500' :
                    threat.severity === 'high' ? 'bg-orange-500' :
                    threat.severity === 'medium' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`} />
                  <div className="w-3 h-3 rounded-full bg-gray-600" />
                  <div className="w-3 h-3 rounded-full bg-gray-600" />
                </div>
                <span className={`font-mono text-xs ${getSeverityColor(threat.severity)}`}>
                  [{threat.severity.toUpperCase()}]
                </span>
                <Badge variant="outline" className={`text-xs ${getStatusBadgeColor(threat.status)}`}>
                  {threat.status}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                onClick={() => setExpanded(expanded === threat.id ? null : threat.id)}
              >
                {expanded === threat.id ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Terminal Content */}
            <div className="p-3 font-mono text-sm">
              {/* Threat Title */}
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 mt-0.5 ${getSeverityColor(threat.severity)}`} />
                <span className="text-gray-200">{threat.title}</span>
              </div>

              {/* Container Info */}
              <div className="space-y-1 text-xs">
                {threat.namespace && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-gray-400">kubectl get pod -n</span>
                    <span className="text-cyan-400">{threat.namespace}</span>
                    {threat.pod_name && (
                      <span className="text-yellow-400">{threat.pod_name}</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-auto"
                      onClick={() => handleCopy(
                        `kubectl get pod -n ${threat.namespace} ${threat.pod_name || ''}`,
                        `cmd-${threat.id}`
                      )}
                    >
                      {copied === `cmd-${threat.id}` ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </Button>
                  </div>
                )}

                {threat.container_name && (
                  <div className="flex items-center gap-2">
                    <Box className="w-3 h-3 text-orange-400" />
                    <span className="text-gray-400">container:</span>
                    <span className="text-orange-400">{threat.container_name}</span>
                  </div>
                )}

                {threat.node_name && (
                  <div className="flex items-center gap-2">
                    <Server className="w-3 h-3 text-purple-400" />
                    <span className="text-gray-400">node:</span>
                    <span className="text-purple-400">{threat.node_name}</span>
                  </div>
                )}
              </div>

              {/* Suspicious Command - Highlighted */}
              {threat.suspicious_command && (
                <div className="mt-3 p-2 bg-red-950/50 border border-red-500/30 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-red-400 text-xs flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Comando Suspeito:
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => handleCopy(threat.suspicious_command!, `sus-${threat.id}`)}
                    >
                      {copied === `sus-${threat.id}` ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </Button>
                  </div>
                  <code className="text-red-300 text-xs break-all">
                    $ {threat.suspicious_command}
                  </code>
                </div>
              )}

              {/* Expanded Details */}
              {expanded === threat.id && (
                <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
                  {threat.description && (
                    <div className="text-gray-300 text-xs">
                      <span className="text-gray-500"># </span>
                      {threat.description}
                    </div>
                  )}

                  {threat.ai_analysis?.recommendation && (
                    <div className="p-2 bg-green-950/30 border border-green-500/20 rounded">
                      <span className="text-green-400 text-xs">Recomendacao IA:</span>
                      <p className="text-gray-300 text-xs mt-1">
                        {threat.ai_analysis.recommendation}
                      </p>
                    </div>
                  )}

                  {threat.ai_analysis?.mitigation_steps && threat.ai_analysis.mitigation_steps.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-cyan-400 text-xs">Passos de Mitigacao:</span>
                      {threat.ai_analysis.mitigation_steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <span className="text-gray-500">{idx + 1}.</span>
                          <span className="text-gray-300">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                      onClick={() => handleCopy(
                        `kubectl describe pod ${threat.pod_name} -n ${threat.namespace}`,
                        `describe-${threat.id}`
                      )}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar kubectl describe
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                      onClick={() => handleCopy(
                        `kubectl logs ${threat.pod_name} -n ${threat.namespace} ${threat.container_name ? `-c ${threat.container_name}` : ''}`,
                        `logs-${threat.id}`
                      )}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar kubectl logs
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {threats.length > maxItems && (
          <div className="text-center pt-2">
            <span className="text-xs text-gray-500 font-mono">
              + {threats.length - maxItems} alertas adicionais
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
