import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HardDrive, AlertTriangle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PersistentVolume {
  id: string;
  name: string;
  status: string;
  capacity_bytes: number;
  storage_class: string | null;
  reclaim_policy: string | null;
  claim_ref_namespace: string | null;
  claim_ref_name: string | null;
}

interface ReleasedPVsCardProps {
  pvs: PersistentVolume[];
  totalPVsCount: number;
}

const CINDER_MAX_VOLUMES = 200;

export const ReleasedPVsCard = ({ pvs, totalPVsCount }: ReleasedPVsCardProps) => {
  const { t } = useTranslation();

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'released':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'available':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const releasedPVs = pvs.filter(pv => pv.status?.toLowerCase() === 'released');
  const availablePVs = pvs.filter(pv => pv.status?.toLowerCase() === 'available');
  const failedPVs = pvs.filter(pv => pv.status?.toLowerCase() === 'failed');

  const totalCapacityBytes = pvs.reduce((sum, pv) => sum + (pv.capacity_bytes || 0), 0);
  const isNearLimit = totalPVsCount >= CINDER_MAX_VOLUMES * 0.8;

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary" />
            <CardTitle>Volumes Persistentes Não Alocados</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {pvs.length} PVs
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cinder Limit Alert */}
        {isNearLimit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção: Limite de Volumes Cinder</AlertTitle>
            <AlertDescription>
              Você está usando {totalPVsCount} de {CINDER_MAX_VOLUMES} volumes permitidos no Cinder.
              Com política Retain, volumes Released permanecem contando neste limite.
              Considere deletar volumes Released que não são mais necessários.
            </AlertDescription>
          </Alert>
        )}

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sobre Volumes Released</AlertTitle>
          <AlertDescription>
            Volumes com status "Released" foram liberados após deletar o PVC, mas permanecem
            devido à política de retenção (Retain). Eles continuam contando no limite de {CINDER_MAX_VOLUMES} volumes
            do Cinder e ocupam {formatBytes(totalCapacityBytes)} de storage.
          </AlertDescription>
        </Alert>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Released</p>
            <p className="text-2xl font-bold text-yellow-500">{releasedPVs.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-2xl font-bold text-green-500">{availablePVs.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-red-500">{failedPVs.length}</p>
          </div>
        </div>

        {/* PVs Table */}
        {pvs.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Capacidade</TableHead>
                  <TableHead>Storage Class</TableHead>
                  <TableHead>Política</TableHead>
                  <TableHead>PVC Anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pvs.map((pv) => (
                  <TableRow key={pv.id}>
                    <TableCell className="font-mono text-xs">{pv.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(pv.status)}>
                        {pv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatBytes(pv.capacity_bytes)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {pv.storage_class || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {pv.reclaim_policy || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {pv.claim_ref_name ? (
                        <div>
                          <div>{pv.claim_ref_name}</div>
                          <div className="text-[10px]">{pv.claim_ref_namespace}</div>
                        </div>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum PV Released, Available ou Failed encontrado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
