import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe2, ShieldCheck, ShieldOff, ArrowRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface IngressData {
  name: string;
  namespace: string;
  hosts: string[];
  tls: boolean;
  rules: { host: string; paths: string[] }[];
  className: string | null;
}

interface IngressOverviewProps {
  ingresses: IngressData[];
  loading: boolean;
}

export const IngressOverview = ({ ingresses, loading }: IngressOverviewProps) => {
  const tlsCount = ingresses.filter(i => i.tls).length;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-cyan-400" />
            Ingress
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/30">
              <ShieldCheck className="w-3 h-3 mr-1" /> TLS: {tlsCount}
            </Badge>
            {ingresses.length - tlsCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30">
                <ShieldOff className="w-3 h-3 mr-1" /> Sem TLS: {ingresses.length - tlsCount}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : ingresses.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <Globe2 className="w-8 h-8 text-muted-foreground/50" />
            Nenhum ingress encontrado
          </div>
        ) : (
          <div className="overflow-x-auto max-h-64">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Namespace</TableHead>
                  <TableHead className="text-xs">Hosts</TableHead>
                  <TableHead className="text-xs">Class</TableHead>
                  <TableHead className="text-xs">TLS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingresses.map((ing, i) => (
                  <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-mono py-2">{ing.name}</TableCell>
                    <TableCell className="text-xs py-2">
                      <Badge variant="outline" className="text-[10px]">{ing.namespace}</Badge>
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      <div className="flex flex-wrap gap-1">
                        {ing.hosts.map((host, j) => (
                          <span key={j} className="text-blue-400 font-mono text-[10px]">{host}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs py-2 text-muted-foreground">
                      {ing.className || "—"}
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      {ing.tls ? (
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                      ) : (
                        <ShieldOff className="w-4 h-4 text-orange-400" />
                      )}
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
