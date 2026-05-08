import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StorageChart } from "@/components/StorageChart";
import { PVCleanupRecommendations } from "@/components/PVCleanupRecommendations";
import { AIStorageRecommendations } from "@/components/AIStorageRecommendations";
import { useCluster } from "@/contexts/ClusterContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

interface PVC {
  id: string;
  name: string;
  namespace: string;
  status: string;
  requested_bytes: number;
  used_bytes: number;
  storage_class: string | null;
}

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

// Merge real usage from agent_metrics.pvcs into the PVC list from the pvcs table.
// The pvcs table row may have used_bytes=0 if the edge function is an older version,
// so we fall back to the raw metric_data for accuracy.
function mergeUsageFromMetrics(
  pvcs: PVC[],
  metricPVCs: Array<{ name: string; namespace: string; used_bytes?: number; capacity_bytes?: number }>
): PVC[] {
  if (!metricPVCs.length) return pvcs;

  // Build a lookup: "namespace/name" → metric entry
  const lookup = new Map<string, typeof metricPVCs[0]>();
  for (const mp of metricPVCs) {
    if (mp.namespace && mp.name) {
      lookup.set(`${mp.namespace}/${mp.name}`, mp);
    }
  }

  return pvcs.map(pvc => {
    const key = `${pvc.namespace}/${pvc.name}`;
    const metric = lookup.get(key);
    if (metric && (metric.used_bytes ?? 0) > 0 && pvc.used_bytes === 0) {
      return { ...pvc, used_bytes: metric.used_bytes! };
    }
    return pvc;
  });
}

const Storage = () => {
  const { t } = useTranslation();
  const { selectedClusterId, clusters } = useCluster();
  const [loading, setLoading] = useState(true);
  const [storageMetrics, setStorageMetrics] = useState({
    total: 0,
    allocated: 0,
    used: 0,
    available: 0,
    pvcs: [] as PVC[]
  });
  const [standalonePVs, setStandalonePVs] = useState<PersistentVolume[]>([]);

  const selectedCluster = clusters.find(c => c.id === selectedClusterId);

  useEffect(() => {
    if (selectedClusterId) {
      fetchStorageData();
    }
  }, [selectedClusterId]);

  // Real-time subscription for PVCs updates
  useEffect(() => {
    if (!selectedClusterId) return;

    const channel = supabase
      .channel('storage-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pvcs',
          filter: `cluster_id=eq.${selectedClusterId}`
        },
        () => {
          fetchStorageData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'persistent_volumes',
          filter: `cluster_id=eq.${selectedClusterId}`
        },
        () => {
          fetchStorageData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClusterId]);

  const fetchStorageData = async () => {
    setLoading(true);
    try {
      // Fetch cluster data
      const { data: cluster, error: clusterError } = await supabase
        .from('clusters')
        .select('storage_total_gb, storage_used_gb')
        .eq('id', selectedClusterId)
        .single();

      if (clusterError) {
        console.error('Error fetching cluster:', clusterError);
        return;
      }

      // Fetch PVCs for storage calculation
      const { data: pvcsData, error: pvcsError } = await supabase
        .from('pvcs')
        .select('id, name, namespace, status, requested_bytes, used_bytes, storage_class')
        .eq('cluster_id', selectedClusterId);

      if (pvcsError) {
        console.error('Error fetching PVCs:', pvcsError);
      } else if (pvcsData) {
        // Fetch latest raw PVC metric from agent_metrics.
        // The pvcs table used_bytes may be 0 if the edge function is an older version.
        // Falling back to the raw agent payload guarantees we show real usage.
        const { data: rawMetrics, error: rawError } = await supabase
          .from('agent_metrics')
          .select('metric_data, collected_at')
          .eq('cluster_id', selectedClusterId)
          .eq('metric_type', 'pvcs')
          .order('collected_at', { ascending: false })
          .limit(1);

        if (rawError) console.error('[Storage] agent_metrics query error:', rawError);

        const latestMetric = rawMetrics?.[0];
        const metricPVCs: Array<{ name: string; namespace: string; used_bytes?: number; capacity_bytes?: number }> =
          (latestMetric?.metric_data as any)?.pvcs ?? [];

        console.log('[Storage] pvcs from DB:', pvcsData?.map(p => ({ n: p.name, used: p.used_bytes })));
        console.log('[Storage] agent_metrics pvcs (collected_at:', latestMetric?.collected_at, '):', metricPVCs.map(p => ({ n: p.name, used: p.used_bytes })));

        // Merge real usage into the pvcs rows
        const enrichedPVCs = mergeUsageFromMetrics(pvcsData as PVC[], metricPVCs);

        const allocatedBytes = enrichedPVCs.reduce((sum, pvc) => sum + (pvc.requested_bytes || 0), 0);
        const usedBytes = enrichedPVCs.reduce((sum, pvc) => sum + (pvc.used_bytes || 0), 0);
        const physicalCapacityGB = cluster?.storage_total_gb || 0;
        const realUsedGB = usedBytes / (1024 ** 3);
        const allocatedGB = allocatedBytes / (1024 ** 3);
        const availableGB = Math.max(0, physicalCapacityGB - realUsedGB);

        setStorageMetrics({
          total: physicalCapacityGB,
          allocated: allocatedGB,
          used: realUsedGB,
          available: availableGB,
          pvcs: enrichedPVCs,
        });
      }

      // Fetch standalone PVs (Released, Available, Failed)
      const { data: pvsData, error: pvsError } = await supabase
        .from('persistent_volumes')
        .select('*')
        .eq('cluster_id', selectedClusterId);

      if (pvsError) {
        console.error('Error fetching standalone PVs:', pvsError);
      } else {
        setStandalonePVs(pvsData || []);
      }
    } catch (error) {
      console.error('Error fetching storage data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between animate-in slide-in-from-left duration-500">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent drop-shadow-sm">
              {t('common.storage')}
            </h1>
            {selectedCluster && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <p className="text-sm text-muted-foreground">
                  {selectedCluster.name}
                </p>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="absolute inset-0 w-12 h-12 rounded-full bg-primary/20 animate-ping" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Loading storage data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-700" style={{ animationDelay: '100ms' }}>
              <StorageChart
                total={storageMetrics.total}
                allocated={storageMetrics.allocated}
                used={storageMetrics.used}
                available={storageMetrics.available}
                pvcs={storageMetrics.pvcs}
              />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-5 duration-700" style={{ animationDelay: '200ms' }}>
              <PVCleanupRecommendations pvs={standalonePVs} clusterProvider={selectedCluster?.provider} />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-5 duration-700" style={{ animationDelay: '300ms' }}>
              <AIStorageRecommendations />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Storage;
