import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Database, HardDrive, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StorageOverviewProps {
  totalGb: number;
  usedGb: number;
  availableGb: number;
  pvcCount: number;
}

export const StorageOverview = ({ totalGb, usedGb, availableGb, pvcCount }: StorageOverviewProps) => {
  const { t } = useTranslation();
  const usagePercent = totalGb > 0 ? (usedGb / totalGb) * 100 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('storage.totalStorage')}</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalGb.toFixed(1)} GB</div>
          <p className="text-xs text-muted-foreground">
            {pvcCount} {t('storage.pvcs')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('storage.usedStorage')}</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{usedGb.toFixed(1)} GB</div>
          <p className="text-xs text-muted-foreground">
            {usagePercent.toFixed(1)}% {t('storage.utilized')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('storage.availableStorage')}</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{availableGb.toFixed(1)} GB</div>
          <p className="text-xs text-muted-foreground">
            {t('storage.freeSpace')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('storage.usage')}</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={usagePercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {usagePercent < 70 ? t('storage.healthy') : usagePercent < 85 ? t('storage.warning') : t('storage.critical')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
