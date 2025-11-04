import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StorageOverview } from "@/components/StorageOverview";
import { PVCList } from "@/components/PVCList";
import { StorageRecommendations } from "@/components/StorageRecommendations";
import { StorageClassComparison } from "@/components/StorageClassComparison";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";

export default function Storage() {
  const { t } = useTranslation();
  const [clusters, setClusters] = useState<any[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string>("");
  const [pvcs, setPvcs] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [storageClassMigrations, setStorageClassMigrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchClusters();
  }, []);

  useEffect(() => {
    if (selectedClusterId) {
      fetchStorageData();
    }
  }, [selectedClusterId]);

  const fetchClusters = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clusters')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;

      setClusters(data || []);
      if (data && data.length > 0 && !selectedClusterId) {
        setSelectedClusterId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching clusters:', error);
      toast.error(t('storage.errorFetchingClusters'));
    }
  };

  const fetchStorageData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch PVCs
      const { data: pvcsData, error: pvcsError } = await supabase
        .from('pvcs')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .eq('user_id', user.id)
        .order('name');

      if (pvcsError) throw pvcsError;
      setPvcs(pvcsData || []);

      // Fetch recommendations
      const { data: recsData, error: recsError } = await supabase
        .from('storage_recommendations')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('potential_savings', { ascending: false });

      if (recsError) throw recsError;
      setRecommendations(recsData || []);
    } catch (error) {
      console.error('Error fetching storage data:', error);
      toast.error(t('storage.errorFetchingData'));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedClusterId) return;
    
    setAnalyzing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke('analyze-storage-optimization', {
        body: { cluster_id: selectedClusterId }
      });

      if (error) throw error;

      if (data?.storage_class_migrations) {
        setStorageClassMigrations(data.storage_class_migrations);
      }

      toast.success(t('storage.analysisComplete'));
      fetchStorageData();
    } catch (error) {
      console.error('Error analyzing storage:', error);
      toast.error(t('storage.errorAnalyzing'));
    } finally {
      setAnalyzing(false);
    }
  };

  const selectedCluster = clusters.find(c => c.id === selectedClusterId);
  const totalStorage = selectedCluster?.storage_total_gb || 0;
  const availableStorage = selectedCluster?.storage_available_gb || 0;
  const usedStorage = totalStorage - availableStorage;

  const pvcNames = pvcs.reduce((acc, pvc) => {
    acc[pvc.id] = pvc.name;
    return acc;
  }, {} as Record<string, string>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('storage.title')}</h1>
            <p className="text-muted-foreground">{t('storage.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedClusterId} onValueChange={setSelectedClusterId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('storage.selectCluster')} />
              </SelectTrigger>
              <SelectContent>
                {clusters.map((cluster) => (
                  <SelectItem key={cluster.id} value={cluster.id}>
                    {cluster.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={fetchStorageData} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={handleAnalyze} disabled={analyzing || !selectedClusterId}>
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t('storage.analyzeAI')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <StorageOverview
              totalGb={totalStorage}
              usedGb={usedStorage}
              availableGb={availableStorage}
              pvcCount={pvcs.length}
            />

            <StorageClassComparison
              migrations={storageClassMigrations}
              onApplyMigration={(pvcId) => {
                toast.info(t('storage.migrationPlanned'));
              }}
            />

            <StorageRecommendations
              recommendations={recommendations}
              pvcNames={pvcNames}
              onRecommendationUpdate={fetchStorageData}
            />

            <PVCList pvcs={pvcs} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
