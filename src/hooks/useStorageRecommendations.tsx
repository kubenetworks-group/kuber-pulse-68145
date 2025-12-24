import { useState, useCallback } from "react";
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

// This hook is a placeholder for future storage recommendations functionality
// The storage_recommendations table does not exist yet in the database
export function useStorageRecommendations() {
  const { selectedClusterId } = useCluster();
  const [recommendations, setRecommendations] = useState<StorageRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!selectedClusterId) return;
    // Storage recommendations table doesn't exist yet
    // This is a placeholder for future implementation
    setRecommendations([]);
  }, [selectedClusterId]);

  const analyzeStorage = useCallback(async () => {
    if (!selectedClusterId) return null;

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-storage-recommendations', {
        body: { cluster_id: selectedClusterId }
      });

      if (error) throw error;

      const actionableCount = data?.actionable_count || 0;
      const totalSavings = data?.total_potential_savings || 0;

      toast({
        title: "Análise Concluída",
        description: actionableCount > 0
          ? `${actionableCount} recomendações geradas. Economia potencial: $${totalSavings.toFixed(2)}/mês`
          : "Nenhuma otimização necessária no momento",
      });

      setLastAnalysis(new Date());

      return data;
    } catch (error) {
      console.error('Error analyzing storage:', error);

      const errorMessage = error instanceof Error ? error.message : "Falha ao analisar storage";

      if (errorMessage.includes('402') || errorMessage.includes('429')) {
        toast({
          title: "Limite de API atingido",
          description: "Aguarde alguns minutos antes de tentar novamente",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro na Análise",
          description: errorMessage,
          variant: "destructive",
        });
      }

      return null;
    } finally {
      setAnalyzing(false);
    }
  }, [selectedClusterId]);

  const updateRecommendationStatus = useCallback(async (
    id: string,
    status: 'accepted' | 'rejected' | 'applied'
  ) => {
    // Placeholder - table doesn't exist yet
    const statusMessages = {
      accepted: "Recomendação aceita",
      rejected: "Recomendação rejeitada",
      applied: "Recomendação aplicada com sucesso",
    };

    toast({
      title: statusMessages[status],
    });
  }, []);

  const dismissRecommendation = useCallback(async (id: string) => {
    // Placeholder - table doesn't exist yet
    setRecommendations(prev => prev.filter(r => r.id !== id));
    toast({
      title: "Recomendação removida",
    });
  }, []);

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
