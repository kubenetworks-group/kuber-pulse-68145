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


const Storage = () => {
  const { t } = useTranslation();
  const { selectedClusterId, clusters } = useCluster();
  const [loading, setLoading] = useState(true);
  const [debugSources, setDebugSources] = useState<{ pvcsTable: string; history: string; metrics: string } | null>(null);
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
        // Source 1: pvcs table (already has used_bytes if edge function is up-to-date)
        // Source 2: pvc_usage_history — flat table, easiest to query, most recent non-zero per PVC
        // Source 3: agent_metrics — raw JSON payload as last resort
        const [usageHistoryResult, rawMetricsResult] = await Promise.all([
          (supabase as any)
            .from('pvc_usage_history')
            .select('pvc_name, namespace, used_bytes, collected_at')
            .eq('cluster_id', selectedClusterId)
            .gt('used_bytes', 0)
            .order('created_at', { ascending: false })
            .limit(200),
          supabase
            .from('agent_metrics')
            .select('metric_data, collected_at')
            .eq('cluster_id', selectedClusterId)
            .eq('metric_type', 'pvcs')
            .order('created_at', { ascending: false })
            .limit(1),
        ]);

        if (usageHistoryResult.error) console.error('[Storage] pvc_usage_history error:', usageHistoryResult.error);
        if (rawMetricsResult.error) console.error('[Storage] agent_metrics error:', rawMetricsResult.error);

        // Build usage lookup from pvc_usage_history (most recent non-zero per PVC)
        const historyLookup = new Map<string, number>();
        for (const record of (usageHistoryResult.data || [])) {
          const key = `${record.namespace}/${record.pvc_name}`;
          if (!historyLookup.has(key)) {
            historyLookup.set(key, record.used_bytes);
          }
        }

        // Build usage lookup from agent_metrics raw payload (last resort)
        const latestMetric = rawMetricsResult.data?.[0];
        const metricPVCs: Array<{ name: string; namespace: string; used_bytes?: number }> =
          (latestMetric?.metric_data as any)?.pvcs ?? [];

        const pvcsSummary = pvcsData.map(p => `${p.name}=${p.used_bytes}`).join(', ');
        const historySummary = historyLookup.size > 0
          ? [...historyLookup.entries()].map(([k, v]) => `${k.split('/')[1]}=${v}`).join(', ')
          : 'vazio';
        const metricsSummary = metricPVCs.length > 0
          ? metricPVCs.map(p => `${p.name}=${p.used_bytes ?? 0}`).join(', ')
          : 'vazio';

        console.log('[Storage] pvcs table:', pvcsSummary);
        console.log('[Storage] pvc_usage_history lookup:', historySummary);
        console.log('[Storage] agent_metrics pvcs (', latestMetric?.collected_at, '):', metricsSummary);

        setDebugSources({ pvcsTable: pvcsSummary, history: historySummary, metrics: metricsSummary });

        // Merge: pvc_usage_history wins over pvcs.used_bytes, agent_metrics is last resort
        const enrichedPVCs = (pvcsData as PVC[]).map(pvc => {
          const key = `${pvc.namespace}/${pvc.name}`;
          // Try pvc_usage_history first
          const historyUsed = historyLookup.get(key);
          if (historyUsed && historyUsed > 0) {
            return { ...pvc, used_bytes: historyUsed };
          }
          // Try agent_metrics raw payload
          const metricEntry = metricPVCs.find(m => m.namespace === pvc.namespace && m.name === pvc.name);
          if (metricEntry && (metricEntry.used_bytes ?? 0) > 0) {
            return { ...pvc, used_bytes: metricEntry.used_bytes! };
          }
          // Fall back to whatever pvcs table has
          return pvc;
        });

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
            {debugSources && (
              <div className="text-[11px] font-mono bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-muted-foreground space-y-0.5">
                <p><span className="text-foreground/60">pvcs table:</span> {debugSources.pvcsTable}</p>
                <p><span className="text-foreground/60">usage history:</span> {debugSources.history}</p>
                <p><span className="text-foreground/60">agent metrics:</span> {debugSources.metrics}</p>
              </div>
            )}
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
