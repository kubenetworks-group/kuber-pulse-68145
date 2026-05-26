import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { toast } from "@/hooks/use-toast";

export interface PodRightsizingRecommendation {
  id: string;
  pod_name: string;
  namespace: string;
  container_name: string;
  cluster_id: string;
  user_id: string;
  recommendation_type: 'downsize_cpu' | 'upsize_cpu' | 'downsize_mem' | 'upsize_mem' | 'add_limits' | 'add_requests';
  resource_type: 'cpu' | 'memory' | 'both';
  priority: 'low' | 'medium' | 'high' | 'critical';
  current_request_cpu: string | null;
  recommended_request_cpu: string | null;
  current_limit_cpu: string | null;
  current_request_mem: string | null;
  recommended_request_mem: string | null;
  current_limit_mem: string | null;
  avg_usage_percent: number;
  max_usage_percent: number;
  p95_usage_percent: number;
  potential_savings_month: number;
  ai_reasoning: string;
  status: 'pending' | 'accepted' | 'rejected' | 'applied';
  created_at: string;
}

export interface PodRightsizingStats {
  total: number;
  pending: number;
  downsizeCPU: number;
  upsizeCPU: number;
  downsizeMem: number;
  addLimits: number;
  addRequests: number;
  totalSavings: number;
  criticalCount: number;
}

export interface RateLimitError {
  isRateLimited: boolean;
  message: string;
  retryAfter?: Date;
}

export function usePodRightsizing() {
  const { selectedClusterId } = useCluster();
  const [recommendations, setRecommendations] = useState<PodRightsizingRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null);

  const clearRateLimitError = useCallback(() => setRateLimitError(null), []);

  const fetchRecommendations = useCallback(async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pod_rightsizing_recommendations')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('potential_savings_month', { ascending: false });

      if (error) throw error;
      setRecommendations((data as PodRightsizingRecommendation[]) ?? []);
    } catch (err) {
      console.error('Error fetching pod rightsizing recommendations:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedClusterId]);

  const analyzeRightsizing = useCallback(async () => {
    if (!selectedClusterId) return null;
    setAnalyzing(true);
    setRateLimitError(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-pod-rightsizing', {
        body: { cluster_id: selectedClusterId },
      });

      if (error) throw error;

      const count = data?.recommendations_count || 0;
      const savings = data?.total_potential_savings || 0;

      toast({
        title: "Análise Concluída",
        description: count > 0
          ? `${count} recomendações de rightsizing geradas. Economia potencial: $${savings.toFixed(2)}/mês`
          : "Nenhuma otimização necessária no momento",
      });

      setLastAnalysis(new Date());
      await fetchRecommendations();
      return data;
    } catch (error: any) {
      const errorMessage = error?.context?.body?.error || error?.message || "Falha ao analisar pods";
      const isRateLimited = errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('Limite de requisições');
      const isPaymentRequired = errorMessage.includes('402') || errorMessage.includes('Payment required');

      if (isRateLimited || isPaymentRequired) {
        const retryTime = new Date();
        retryTime.setMinutes(retryTime.getMinutes() + 5);
        setRateLimitError({
          isRateLimited: true,
          message: isPaymentRequired
            ? "Você atingiu o limite de uso gratuito de IA. Considere fazer upgrade do seu plano."
            : "O limite de requisições de IA foi atingido temporariamente. Tente novamente em alguns minutos.",
          retryAfter: retryTime,
        });
      } else {
        toast({ title: "Erro na Análise", description: errorMessage, variant: "destructive" });
      }
      return null;
    } finally {
      setAnalyzing(false);
    }
  }, [selectedClusterId, fetchRecommendations]);

  const updateRecommendationStatus = useCallback(async (id: string, status: 'accepted' | 'rejected' | 'applied') => {
    const { error } = await supabase
      .from('pod_rightsizing_recommendations')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar a recomendação", variant: "destructive" });
      return;
    }

    setRecommendations(prev => prev.filter(r => r.id !== id));
    const messages = { accepted: "Recomendação aceita", rejected: "Recomendação rejeitada", applied: "Recomendação aplicada" };
    toast({ title: messages[status] });
  }, []);

  const PRIORITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

  const stats: PodRightsizingStats = {
    total: recommendations.length,
    pending: recommendations.filter(r => r.status === 'pending').length,
    downsizeCPU: recommendations.filter(r => r.recommendation_type === 'downsize_cpu').length,
    upsizeCPU: recommendations.filter(r => r.recommendation_type === 'upsize_cpu').length,
    downsizeMem: recommendations.filter(r => r.recommendation_type === 'downsize_mem').length,
    addLimits: recommendations.filter(r => r.recommendation_type === 'add_limits').length,
    addRequests: recommendations.filter(r => r.recommendation_type === 'add_requests').length,
    totalSavings: recommendations
      .filter(r => r.recommendation_type.startsWith('downsize'))
      .reduce((sum, r) => sum + (r.potential_savings_month || 0), 0),
    criticalCount: recommendations.filter(r => r.priority === 'critical').length,
  };

  return {
    recommendations,
    loading,
    analyzing,
    stats,
    lastAnalysis,
    rateLimitError,
    clearRateLimitError,
    analyzeRightsizing,
    updateRecommendationStatus,
    refetch: fetchRecommendations,
  };
}
