import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { toast } from "@/hooks/use-toast";

export interface StorageRecommendation {
  id: string;
  pvc_name: string;
  namespace: string;
  cluster_id: string;
  user_id: string;
  current_size_gb: number;
  recommended_size_gb: number;
  current_usage_gb: number;
  avg_usage_percent: number;
  max_usage_percent: number;
  p95_usage_percent: number;
  recommendation_type: 'downsize' | 'upsize' | 'maintain' | 'delete';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'accepted' | 'rejected' | 'applied';
  potential_savings_month: number;
  ai_reasoning: string;
  ai_confidence: number;
  days_analyzed: number;
  created_at: string;
  applied_at: string | null;
}

export interface StorageRecommendationStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  downsizeCount: number;
  upsizeCount: number;
  deleteCount: number;
  totalSavings: number;
  totalStorageRecoverable: number;
}

export function useStorageRecommendations() {
  const { selectedClusterId } = useCluster();
  const [recommendations, setRecommendations] = useState<StorageRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!selectedClusterId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('storage_recommendations')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Sort by priority and savings
      const sorted = (data || []).sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority as keyof typeof priorityOrder] -
                            priorityOrder[b.priority as keyof typeof priorityOrder];
        if (priorityDiff !== 0) return priorityDiff;
        return (b.potential_savings_month || 0) - (a.potential_savings_month || 0);
      });

      setRecommendations(sorted as StorageRecommendation[]);

      // Set last analysis date
      if (sorted.length > 0) {
        setLastAnalysis(new Date(sorted[0].created_at));
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedClusterId]);

  const analyzeStorage = useCallback(async () => {
    if (!selectedClusterId) return null;

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-storage-recommendations', {
        body: { cluster_id: selectedClusterId }
      });

      if (error) throw error;

      const actionableCount = data.actionable_count || 0;
      const totalSavings = data.total_potential_savings || 0;

      toast({
        title: "Analise Concluida",
        description: actionableCount > 0
          ? `${actionableCount} recomendacoes geradas. Economia potencial: $${totalSavings.toFixed(2)}/mes`
          : "Nenhuma otimizacao necessaria no momento",
      });

      await fetchRecommendations();
      setLastAnalysis(new Date());

      return data;
    } catch (error) {
      console.error('Error analyzing storage:', error);

      const errorMessage = error instanceof Error ? error.message : "Falha ao analisar storage";

      // Handle specific error codes
      if (errorMessage.includes('402') || errorMessage.includes('429')) {
        toast({
          title: "Limite de API atingido",
          description: "Aguarde alguns minutos antes de tentar novamente",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro na Analise",
          description: errorMessage,
          variant: "destructive",
        });
      }

      return null;
    } finally {
      setAnalyzing(false);
    }
  }, [selectedClusterId, fetchRecommendations]);

  const updateRecommendationStatus = useCallback(async (
    id: string,
    status: 'accepted' | 'rejected' | 'applied'
  ) => {
    try {
      const updateData: any = {
        status,
      };

      if (status === 'applied') {
        updateData.applied_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('storage_recommendations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setRecommendations(prev =>
        prev.map(r => r.id === id ? { ...r, status, applied_at: updateData.applied_at } : r)
      );

      const statusMessages = {
        accepted: "Recomendacao aceita",
        rejected: "Recomendacao rejeitada",
        applied: "Recomendacao aplicada com sucesso",
      };

      toast({
        title: statusMessages[status],
      });
    } catch (error) {
      console.error('Error updating recommendation:', error);
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Falha ao atualizar recomendacao",
        variant: "destructive",
      });
    }
  }, []);

  const dismissRecommendation = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('storage_recommendations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRecommendations(prev => prev.filter(r => r.id !== id));

      toast({
        title: "Recomendacao removida",
      });
    } catch (error) {
      console.error('Error dismissing recommendation:', error);
    }
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!selectedClusterId) return;

    const channel = supabase
      .channel(`storage-recommendations-${selectedClusterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'storage_recommendations',
          filter: `cluster_id=eq.${selectedClusterId}`
        },
        () => {
          fetchRecommendations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClusterId, fetchRecommendations]);

  // Initial fetch
  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Calculate stats
  const stats: StorageRecommendationStats = {
    total: recommendations.length,
    pending: recommendations.filter(r => r.status === 'pending').length,
    accepted: recommendations.filter(r => r.status === 'accepted').length,
    rejected: recommendations.filter(r => r.status === 'rejected').length,
    downsizeCount: recommendations.filter(r => r.recommendation_type === 'downsize' && r.status === 'pending').length,
    upsizeCount: recommendations.filter(r => r.recommendation_type === 'upsize' && r.status === 'pending').length,
    deleteCount: recommendations.filter(r => r.recommendation_type === 'delete' && r.status === 'pending').length,
    totalSavings: recommendations
      .filter(r => r.status === 'pending' && (r.recommendation_type === 'downsize' || r.recommendation_type === 'delete'))
      .reduce((sum, r) => sum + (r.potential_savings_month || 0), 0),
    totalStorageRecoverable: recommendations
      .filter(r => r.status === 'pending' && r.recommendation_type === 'downsize')
      .reduce((sum, r) => sum + Math.max(0, r.current_size_gb - r.recommended_size_gb), 0),
  };

  return {
    recommendations,
    loading,
    analyzing,
    stats,
    lastAnalysis,
    analyzeStorage,
    updateRecommendationStatus,
    dismissRecommendation,
    refetch: fetchRecommendations,
  };
}
