import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";
import { ArrowRight, TrendingDown, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StorageClassPrice {
  name: string;
  pricePerGbMonth: number;
  iopsIncluded: number;
  throughputMbps: number;
  bestFor: string;
}

interface StorageClassMigration {
  pvc_id: string;
  pvc_name: string;
  current_class: string;
  recommended_class: string;
  current_cost: number;
  recommended_cost: number;
  savings: number;
  usage_pattern: string;
  iops_usage: number;
  reasoning: string;
}

interface StorageClassComparisonProps {
  migrations: StorageClassMigration[];
  onApplyMigration?: (pvcId: string) => void;
}

const STORAGE_CLASSES: Record<string, StorageClassPrice> = {
  gp3: {
    name: "gp3",
    pricePerGbMonth: 0.08,
    iopsIncluded: 3000,
    throughputMbps: 125,
    bestFor: "General purpose, balanced price/performance",
  },
  gp2: {
    name: "gp2",
    pricePerGbMonth: 0.10,
    iopsIncluded: 3000,
    throughputMbps: 128,
    bestFor: "Legacy general purpose",
  },
  io1: {
    name: "io1",
    pricePerGbMonth: 0.125,
    iopsIncluded: 0,
    throughputMbps: 1000,
    bestFor: "High IOPS workloads (databases)",
  },
  io2: {
    name: "io2",
    pricePerGbMonth: 0.125,
    iopsIncluded: 0,
    throughputMbps: 1000,
    bestFor: "Mission-critical high IOPS with durability",
  },
  st1: {
    name: "st1",
    pricePerGbMonth: 0.045,
    iopsIncluded: 500,
    throughputMbps: 500,
    bestFor: "Throughput-optimized (big data, logs)",
  },
  sc1: {
    name: "sc1",
    pricePerGbMonth: 0.015,
    iopsIncluded: 250,
    throughputMbps: 250,
    bestFor: "Cold storage, infrequent access",
  },
};

export function StorageClassComparison({
  migrations,
  onApplyMigration,
}: StorageClassComparisonProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();

  const totalSavings = migrations.reduce((sum, m) => sum + m.savings, 0);

  if (migrations.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {t("storage.storageClassComparison")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("storage.storageClassSubtitle")}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalSavings).value}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-4 w-4" />
              {t("storage.potentialMonthlySavings")}
            </div>
          </div>
        </div>

        {/* Storage Class Reference Table */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="text-sm font-medium mb-3">
            {t("storage.storageClassReference")}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.values(STORAGE_CLASSES).map((sc) => (
              <TooltipProvider key={sc.name}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-2 rounded border bg-background cursor-help">
                      <div className="font-mono font-bold text-sm">
                        {sc.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ${sc.pricePerGbMonth}/GB
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold">{sc.bestFor}</p>
                      <p className="text-xs">IOPS: {sc.iopsIncluded}</p>
                      <p className="text-xs">
                        Throughput: {sc.throughputMbps} MB/s
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>

        {/* Migration Recommendations */}
        <div className="space-y-3">
          {migrations.map((migration) => (
            <div
              key={migration.pvc_id}
              className="rounded-lg border p-4 space-y-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{migration.pvc_name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {migration.usage_pattern}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {migration.reasoning}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <Badge variant="secondary" className="font-mono">
                    {migration.current_class}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="default" className="font-mono">
                    {migration.recommended_class}
                  </Badge>
                </div>

                <div className="text-right">
                  <div className="text-sm text-muted-foreground line-through">
                    {formatCurrency(migration.current_cost).value}/mo
                  </div>
                  <div className="text-sm font-semibold text-primary">
                    {formatCurrency(migration.recommended_cost).value}/mo
                  </div>
                </div>

                <div className="text-right min-w-[100px]">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    -{formatCurrency(migration.savings).value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(
                      (migration.savings / migration.current_cost) *
                      100
                    ).toFixed(0)}
                    % {t("storage.savings")}
                  </div>
                </div>

                {onApplyMigration && (
                  <Button
                    size="sm"
                    onClick={() => onApplyMigration(migration.pvc_id)}
                  >
                    {t("storage.planMigration")}
                  </Button>
                )}
              </div>

              {migration.iops_usage > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  <span>
                    {t("storage.averageIops")}: {migration.iops_usage} IOPS
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
