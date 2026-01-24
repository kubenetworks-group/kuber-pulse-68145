import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  Container, 
  Network, 
  Server,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SecurityThreat } from "@/hooks/useSecurityThreats";

interface ConfigurationRisksWidgetProps {
  risks: SecurityThreat[];
  onResolve: (riskId: string, action: string) => void;
  onMarkFalsePositive: (riskId: string) => void;
}

const threatTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
  privilege_escalation: { icon: Shield, label: "Container Privilegiado", color: "text-orange-500" },
  unauthorized_access: { icon: Network, label: "Acesso Host Network/PID", color: "text-yellow-500" },
  port_scan: { icon: Server, label: "Porta Exposta", color: "text-blue-500" },
  misconfiguration: { icon: Settings, label: "Configuração Incorreta", color: "text-purple-500" },
  suspicious_process: { icon: Container, label: "Processo Suspeito", color: "text-gray-500" },
};

const severityConfig: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-500", label: "Crítico" },
  high: { bg: "bg-orange-500/10", text: "text-orange-500", label: "Alto" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-500", label: "Médio" },
  low: { bg: "bg-blue-500/10", text: "text-blue-500", label: "Baixo" },
};

export function ConfigurationRisksWidget({ 
  risks, 
  onResolve, 
  onMarkFalsePositive 
}: ConfigurationRisksWidgetProps) {
  const activeRisks = risks.filter(r => r.status === 'active');
  
  if (activeRisks.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-full bg-green-500/20 mb-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="font-semibold text-green-500 mb-1">Configuração Segura</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Nenhum risco de configuração detectado. Seus containers estão seguindo as melhores práticas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-orange-500" />
            Riscos de Configuração
          </CardTitle>
          <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
            {activeRisks.length} pendente{activeRisks.length > 1 ? 's' : ''}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Problemas de configuração que devem ser corrigidos para melhorar a segurança do cluster.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeRisks.slice(0, 10).map((risk) => {
          const typeConfig = threatTypeConfig[risk.threat_type] || threatTypeConfig.misconfiguration;
          const sevConfig = severityConfig[risk.severity] || severityConfig.medium;
          const IconComponent = typeConfig.icon;

          return (
            <div
              key={risk.id}
              className={cn(
                "p-4 rounded-lg border transition-colors",
                sevConfig.bg,
                "border-border hover:border-primary/30"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg bg-background", typeConfig.color)}>
                  <IconComponent className="h-4 w-4" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{risk.title || typeConfig.label}</span>
                    <Badge variant="outline" className={cn("text-xs", sevConfig.text)}>
                      {sevConfig.label}
                    </Badge>
                  </div>
                  
                  {/* Resource details */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                    {risk.namespace && (
                      <span className="bg-muted px-2 py-0.5 rounded">
                        ns: {risk.namespace}
                      </span>
                    )}
                    {risk.pod_name && (
                      <span className="bg-muted px-2 py-0.5 rounded">
                        pod: {risk.pod_name}
                      </span>
                    )}
                    {risk.container_name && (
                      <span className="bg-muted px-2 py-0.5 rounded">
                        container: {risk.container_name}
                      </span>
                    )}
                  </div>
                  
                  {risk.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {risk.description}
                    </p>
                  )}
                  
                  {/* Recommendation */}
                  {risk.ai_analysis?.recommendation && (
                    <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
                      <span className="font-medium">💡 Recomendação: </span>
                      {risk.ai_analysis.recommendation}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => onResolve(risk.id, 'manual_fix')}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Resolvido
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 text-muted-foreground"
                    onClick={() => onMarkFalsePositive(risk.id)}
                  >
                    Ignorar
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        
        {activeRisks.length > 10 && (
          <div className="text-center text-sm text-muted-foreground pt-2">
            +{activeRisks.length - 10} riscos adicionais
          </div>
        )}
      </CardContent>
    </Card>
  );
}