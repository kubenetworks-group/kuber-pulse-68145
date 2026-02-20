import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Network, Lock, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ServiceData {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string | null;
  ports: string;
}

interface ServicesOverviewProps {
  services: ServiceData[];
  loading: boolean;
}

const TypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "LoadBalancer": return <Globe className="w-3.5 h-3.5 text-blue-400" />;
    case "NodePort": return <ExternalLink className="w-3.5 h-3.5 text-yellow-400" />;
    case "ClusterIP": return <Lock className="w-3.5 h-3.5 text-green-400" />;
    default: return <Network className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

const typeColor = (type: string) => {
  switch (type) {
    case "LoadBalancer": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "NodePort": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
    case "ClusterIP": return "bg-green-500/10 text-green-400 border-green-500/30";
    default: return "";
  }
};

export const ServicesOverview = ({ services, loading }: ServicesOverviewProps) => {
  const typeCounts = services.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Network className="w-4 h-4 text-purple-400" />
            Services
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {Object.entries(typeCounts).map(([type, count]) => (
              <Badge key={type} variant="outline" className={`text-[10px] ${typeColor(type)}`}>
                {type}: {count}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : services.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Nenhum service encontrado
          </div>
        ) : (
          <div className="overflow-x-auto max-h-64">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Namespace</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Cluster IP</TableHead>
                  <TableHead className="text-xs">Portas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.slice(0, 20).map((svc, i) => (
                  <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-mono py-2">{svc.name}</TableCell>
                    <TableCell className="text-xs py-2">
                      <Badge variant="outline" className="text-[10px]">{svc.namespace}</Badge>
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      <div className="flex items-center gap-1.5">
                        <TypeIcon type={svc.type} />
                        {svc.type}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono py-2 text-muted-foreground">
                      {svc.clusterIP}
                    </TableCell>
                    <TableCell className="text-xs font-mono py-2 text-muted-foreground">
                      {svc.ports}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
