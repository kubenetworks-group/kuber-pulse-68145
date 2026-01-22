import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Shield, AlertTriangle, ExternalLink } from "lucide-react";
import { PublicExposure } from "@/hooks/useRiskAnalysis";

interface PublicExposuresWidgetProps {
  exposures: PublicExposure[];
}

export const PublicExposuresWidget = ({ exposures }: PublicExposuresWidgetProps) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ingress":
        return <Globe className="h-4 w-4" />;
      case "loadbalancer":
        return <ExternalLink className="h-4 w-4" />;
      case "nodeport":
        return <ExternalLink className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "ingress":
        return "Ingress";
      case "loadbalancer":
        return "LoadBalancer";
      case "nodeport":
        return "NodePort";
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-5 w-5 text-muted-foreground" />
          Exposições Públicas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {exposures.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-70" />
            <p className="text-sm font-medium text-green-500">Nenhuma exposição detectada</p>
            <p className="text-xs text-muted-foreground mt-1">
              O cluster não possui serviços expostos publicamente
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {exposures.map((exposure, index) => (
              <div
                key={`${exposure.name}-${index}`}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    {getTypeIcon(exposure.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{exposure.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {getTypeLabel(exposure.type)}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {exposure.namespace}
                    </span>
                    {exposure.hosts && exposure.hosts.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {exposure.hosts.map((host, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {host}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {exposure.hasNetworkPolicy ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                      <Shield className="h-3 w-3 mr-1" />
                      Protegido
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Sem Policy
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
