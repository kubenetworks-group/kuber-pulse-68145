import { useCluster } from "@/contexts/ClusterContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Server } from "lucide-react";
import { useTranslation } from "react-i18next";

export const ClusterSelector = () => {
  const { t } = useTranslation();
  const { selectedClusterId, setSelectedClusterId, clusters, loading } = useCluster();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border">
        <Server className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
      </div>
    );
  }

  if (clusters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <Server className="w-4 h-4 text-muted-foreground shrink-0" />
      <Select value={selectedClusterId || undefined} onValueChange={setSelectedClusterId}>
        {/* width grows with content; capped so right-side buttons always stay visible */}
        <SelectTrigger className="w-auto min-w-[120px] max-w-[calc(100vw-120px)] sm:max-w-[360px] md:max-w-[480px] lg:max-w-none [&>span]:line-clamp-none [&>span]:overflow-visible [&>span]:whitespace-nowrap">
          <SelectValue placeholder={t('clusters.selectCluster')} />
        </SelectTrigger>
        <SelectContent>
          {clusters.map((cluster) => (
            <SelectItem key={cluster.id} value={cluster.id}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{cluster.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({cluster.provider} - {cluster.environment})
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
