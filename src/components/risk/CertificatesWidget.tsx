import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { CertificateIssue } from "@/hooks/useRiskAnalysis";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CertificatesWidgetProps {
  issues: CertificateIssue[];
}

export const CertificatesWidget = ({ issues }: CertificatesWidgetProps) => {
  const getIssueLabel = (issue: string) => {
    switch (issue) {
      case "expiring_soon":
        return "Expirando";
      case "expired":
        return "Expirado";
      case "invalid":
        return "Inválido";
      default:
        return issue;
    }
  };

  const getIssueColor = (issue: string) => {
    switch (issue) {
      case "expired":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      case "expiring_soon":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      case "invalid":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatExpiry = (expiresAt: string) => {
    try {
      return formatDistanceToNow(new Date(expiresAt), { addSuffix: true, locale: ptBR });
    } catch {
      return expiresAt;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5 text-muted-foreground" />
          Certificados TLS
          {issues.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {issues.length} alertas
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-70" />
            <p className="text-sm font-medium text-green-500">Certificados em dia</p>
            <p className="text-xs text-muted-foreground mt-1">
              Nenhum certificado próximo de expirar ou com problemas
            </p>
            <p className="text-xs text-muted-foreground mt-3 max-w-sm mx-auto">
              <AlertTriangle className="h-3 w-3 inline mr-1 text-yellow-500" />
              Nota: Esta análise requer atualização do agente para coleta completa de certificados TLS
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-3">
              {issues.map((cert, index) => (
                <div
                  key={`${cert.namespace}-${cert.name}-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cert.name}</span>
                      <Badge variant="outline" className={getIssueColor(cert.issue)}>
                        {getIssueLabel(cert.issue)}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{cert.namespace}</span>
                  </div>
                  {cert.expiresAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatExpiry(cert.expiresAt)}
                    </div>
                  )}
                  {cert.daysUntilExpiry !== undefined && (
                    <Badge
                      variant="outline"
                      className={cert.daysUntilExpiry <= 7 ? "text-red-500" : "text-yellow-500"}
                    >
                      {cert.daysUntilExpiry} dias
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
