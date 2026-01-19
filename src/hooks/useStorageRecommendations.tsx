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

// Rate limit error state type
export interface RateLimitError {
  isRateLimited: boolean;
  message: string;
  retryAfter?: Date;
}

// This hook is a placeholder for future storage recommendations functionality
// The storage_recommendations table does not exist yet in the database
export function useStorageRecommendations() {
  const { selectedClusterId } = useCluster();
  const [recommendations, setRecommendations] = useState<StorageRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null);

  const clearRateLimitError = useCallback(() => {
    setRateLimitError(null);
  }, []);

  const fetchRecommendations = useCallback(async () => {
    if (!selectedClusterId) return;
    // Storage recommendations table doesn't exist yet
    // This is a placeholder for future implementation
    setRecommendations([]);
  }, [selectedClusterId]);

  const analyzeStorage = useCallback(async () => {
    if (!selectedClusterId) return null;

    setAnalyzing(true);
    setRateLimitError(null);
    
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
    } catch (error: any) {
      console.error('Error analyzing storage:', error);

      // Extract error message from various formats
      const errorMessage = error?.context?.body?.error || 
                           error?.message || 
                           (typeof error === 'string' ? error : "Falha ao analisar storage");

      const isRateLimited = errorMessage.includes('Limite de requisições') ||
                            errorMessage.includes('429') ||
                            errorMessage.includes('rate limit') ||
                            errorMessage.includes('Too Many Requests');
      
      const isPaymentRequired = errorMessage.includes('402') ||
                                errorMessage.includes('Payment required') ||
                                errorMessage.includes('credits');

      if (isRateLimited || isPaymentRequired) {
        // Set the rate limit state for UI display
        const retryTime = new Date();
        retryTime.setMinutes(retryTime.getMinutes() + 5);
        
        setRateLimitError({
          isRateLimited: true,
          message: isPaymentRequired 
            ? "Você atingiu o limite de uso gratuito de IA. Para continuar usando recursos de IA, considere fazer upgrade do seu plano."
            : "O limite de requisições de IA foi atingido temporariamente. Isso acontece para proteger o sistema e garantir qualidade para todos os usuários.",
          retryAfter: retryTime,
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
    rateLimitError,
    clearRateLimitError,
    analyzeStorage,
    updateRecommendationStatus,
    dismissRecommendation,
    refetch: fetchRecommendations,
  };
}
