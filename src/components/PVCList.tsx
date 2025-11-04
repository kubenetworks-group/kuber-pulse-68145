import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { Database } from "lucide-react";

interface PVC {
  id: string;
  name: string;
  namespace: string;
  storage_class: string;
  requested_bytes: number;
  used_bytes: number;
  status: string;
}

interface PVCListProps {
  pvcs: PVC[];
}

export const PVCList = ({ pvcs }: PVCListProps) => {
  const { t } = useTranslation();

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 ** 3);
    return gb.toFixed(2);
  };

  const getUsagePercent = (used: number, requested: number) => {
    if (requested === 0) return 0;
    return (used / requested) * 100;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'bound':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'lost':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (pvcs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('storage.pvcs')}
          </CardTitle>
          <CardDescription>{t('storage.noPvcsFound')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          {t('storage.pvcs')}
        </CardTitle>
        <CardDescription>{t('storage.pvcDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('storage.name')}</TableHead>
              <TableHead>{t('storage.namespace')}</TableHead>
              <TableHead>{t('storage.storageClass')}</TableHead>
              <TableHead>{t('storage.requested')}</TableHead>
              <TableHead>{t('storage.used')}</TableHead>
              <TableHead>{t('storage.usage')}</TableHead>
              <TableHead>{t('storage.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pvcs.map((pvc) => {
              const usagePercent = getUsagePercent(pvc.used_bytes, pvc.requested_bytes);
              return (
                <TableRow key={pvc.id}>
                  <TableCell className="font-medium">{pvc.name}</TableCell>
                  <TableCell>{pvc.namespace}</TableCell>
                  <TableCell>{pvc.storage_class || 'default'}</TableCell>
                  <TableCell>{formatBytes(pvc.requested_bytes)} GB</TableCell>
                  <TableCell>{formatBytes(pvc.used_bytes)} GB</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={usagePercent} className="w-20 h-2" />
                      <span className="text-sm text-muted-foreground">{usagePercent.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(pvc.status)}>{pvc.status}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
