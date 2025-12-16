import { useSecurityThreats } from '@/hooks/useSecurityThreats';
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
  ArrowRight,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function SecurityThreatsWidget() {
  const navigate = useNavigate();
  const { threats, stats, loading, scanning, runSecurityScan } = useSecurityThreats();

  // Get only active threats for display
  const activeThreats = threats.filter(t => t.status === 'active').slice(0, 3);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'high':
        return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'low':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const threatTypeLabels: Record<string, string> = {
    ddos: 'DDoS',
    brute_force: 'Forca Bruta',
    port_scan: 'Port Scan',
    suspicious_process: 'Processo Suspeito',
    crypto_mining: 'Crypto Mining',
    privilege_escalation: 'Escalacao Privilegios',
    data_exfiltration: 'Exfiltracao Dados',
    shell_injection: 'Shell Injection',
    unauthorized_access: 'Acesso Nao Autorizado',
  };

  // Calculate security score (100 - threats impact)
  const calculateSecurityScore = () => {
    if (stats.total === 0) return 100;
    const impact = (stats.critical * 25) + (stats.high * 15) + (stats.medium * 5) + (stats.low * 1);
    return Math.max(0, 100 - Math.min(impact, 100));
  };

  const securityScore = calculateSecurityScore();

  const getScoreColor = () => {
    if (securityScore >= 80) return 'text-green-400';
    if (securityScore >= 60) return 'text-yellow-400';
    if (securityScore >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getProgressColor = () => {
    if (securityScore >= 80) return '[&>div]:bg-green-500';
    if (securityScore >= 60) return '[&>div]:bg-yellow-500';
    if (securityScore >= 40) return '[&>div]:bg-orange-500';
    return '[&>div]:bg-red-500';
  };

  return (
    <Card className={`border-l-4 ${
      stats.critical > 0 ? 'border-l-red-500 bg-red-500/5' :
      stats.high > 0 ? 'border-l-orange-500 bg-orange-500/5' :
      stats.active > 0 ? 'border-l-yellow-500 bg-yellow-500/5' :
      'border-l-green-500 bg-green-500/5'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {stats.critical > 0 ? (
              <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
            ) : stats.active > 0 ? (
              <Shield className="w-5 h-5 text-yellow-400" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-green-400" />
            )}
            <CardTitle className="text-lg">Seguranca do Cluster</CardTitle>
          </div>
          {stats.critical > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {stats.critical} Critica{stats.critical > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <CardDescription>
          Monitoramento em tempo real de ameacas de seguranca
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Security Score */}
        <div className="flex items-center gap-4">
          <div className={`text-3xl font-bold ${getScoreColor()}`}>
            {securityScore}%
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1">Score de Seguranca</div>
            <Progress value={securityScore} className={`h-2 ${getProgressColor()}`} />
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded bg-red-500/10">
            <div className="text-lg font-bold text-red-400">{stats.critical}</div>
            <div className="text-xs text-muted-foreground">Criticas</div>
          </div>
          <div className="p-2 rounded bg-orange-500/10">
            <div className="text-lg font-bold text-orange-400">{stats.high}</div>
            <div className="text-xs text-muted-foreground">Altas</div>
          </div>
          <div className="p-2 rounded bg-yellow-500/10">
            <div className="text-lg font-bold text-yellow-400">{stats.medium}</div>
            <div className="text-xs text-muted-foreground">Medias</div>
          </div>
          <div className="p-2 rounded bg-green-500/10">
            <div className="text-lg font-bold text-green-400">{stats.mitigated}</div>
            <div className="text-xs text-muted-foreground">Mitigadas</div>
          </div>
        </div>

        {/* Active Threats Preview */}
        {activeThreats.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Ameacas Ativas
            </div>
            {activeThreats.map((threat) => (
              <div
                key={threat.id}
                className="flex items-center justify-between p-2 rounded bg-background/50 border border-border"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge className={`text-xs ${getSeverityColor(threat.severity)}`}>
                    {threat.severity.charAt(0).toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {threatTypeLabels[threat.threat_type] || threat.threat_type}
                    </div>
                    {threat.pod_name && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Terminal className="w-3 h-3" />
                        {threat.namespace}/{threat.pod_name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(threat.detected_at), 'HH:mm', { locale: ptBR })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-green-400 opacity-50" />
            <p className="text-sm text-muted-foreground">
              Nenhuma ameaca ativa detectada
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={runSecurityScan}
            disabled={scanning || loading}
          >
            {scanning ? (
              <>
                <Activity className="w-4 h-4 mr-1 animate-spin" />
                Escaneando...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-1" />
                Escanear
              </>
            )}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => navigate('/ai-monitor')}
          >
            Ver Detalhes
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
