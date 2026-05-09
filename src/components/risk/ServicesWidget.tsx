import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Network, AlertTriangle, CheckCircle, Globe, Server } from "lucide-react";
import { ServiceData } from "@/hooks/useRiskAnalysis";

interface ServicesWidgetProps {
  services: ServiceData[];
}

const TYPE_COLOR: Record<string, string> = {
  ClusterIP:    "bg-blue-500/10 text-blue-400 border-blue-500/30",
  NodePort:     "bg-orange-500/10 text-orange-400 border-orange-500/30",
  LoadBalancer: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  ExternalName: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
};

const typeColor = (t: string) => TYPE_COLOR[t] ?? "bg-muted text-muted-foreground";

export const ServicesWidget = ({ services }: ServicesWidgetProps) => {
  if (!services || services.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5 text-muted-foreground" />
            Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum serviço encontrado ou dados ainda não disponíveis.
          </div>
        </CardContent>
      </Card>
    );
  }

  const unhealthy = services.filter((s) => s.hasNoEndpoints);
  const lbServices = services.filter((s) => s.type === "LoadBalancer");
  const nodePortServices = services.filter((s) => s.type === "NodePort");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="h-5 w-5 text-muted-foreground" />
          Services
          <Badge variant="secondary" className="ml-auto">
            {services.length} total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/30 p-2">
            <p className="text-lg font-semibold text-foreground">{services.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
          </div>
          <div className={`rounded-lg p-2 ${unhealthy.length > 0 ? "bg-red-500/10" : "bg-green-500/10"}`}>
            <p className={`text-lg font-semibold ${unhealthy.length > 0 ? "text-red-400" : "text-green-400"}`}>
              {unhealthy.length}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sem endpoints</p>
          </div>
          <div className={`rounded-lg p-2 ${lbServices.length + nodePortServices.length > 0 ? "bg-purple-500/10" : "bg-muted/30"}`}>
            <p className={`text-lg font-semibold ${lbServices.length + nodePortServices.length > 0 ? "text-purple-400" : "text-foreground"}`}>
              {lbServices.length + nodePortServices.length}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Expostos</p>
          </div>
        </div>

        {/* Service list */}
        <ScrollArea className="h-[220px] pr-4">
          <div className="space-y-2">
            {services.map((svc, i) => (
              <div
                key={`${svc.namespace}-${svc.name}-${i}`}
                className="p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {svc.hasNoEndpoints ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />
                    )}
                    <span className="text-xs font-medium truncate" title={svc.name}>
                      {svc.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeColor(svc.type)}`}>
                      {svc.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{svc.namespace}</span>
                  </div>
                </div>

                {/* Ports */}
                {svc.ports.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {svc.ports.map((p, pi) => (
                      <span
                        key={pi}
                        className="text-[10px] font-mono bg-background/50 border border-border/50 rounded px-1.5 py-0.5 text-muted-foreground"
                      >
                        {p.port}/{p.protocol.toLowerCase()}
                      </span>
                    ))}
                    {svc.endpointCount > 0 && (
                      <span className="text-[10px] text-green-500 ml-auto">
                        {svc.endpointCount} endpoint{svc.endpointCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {svc.hasNoEndpoints && (
                      <span className="text-[10px] text-red-400 ml-auto">sem endpoints</span>
                    )}
                  </div>
                )}

                {/* LB / External IPs */}
                {(svc.lbIngress.length > 0 || svc.externalIPs.length > 0) && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Globe className="h-3 w-3 shrink-0" />
                    <span className="truncate font-mono">
                      {[...svc.lbIngress, ...svc.externalIPs].join(", ")}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
