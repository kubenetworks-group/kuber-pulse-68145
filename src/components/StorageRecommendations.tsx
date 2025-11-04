import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { Lightbulb, TrendingDown, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/useCurrency";

interface Recommendation {
  id: string;
  recommendation_type: string;
  current_size_gb: number;
  recommended_size_gb: number;
  potential_savings: number;
  usage_percentage: number;
  days_analyzed: number;
  reasoning: string;
  status: string;
  pvc_id: string;
}

interface StorageRecommendationsProps {
  recommendations: Recommendation[];
  pvcNames: Record<string, string>;
  onRecommendationUpdate: () => void;
}

export const StorageRecommendations = ({ 
  recommendations, 
  pvcNames,
  onRecommendationUpdate 
}: StorageRecommendationsProps) => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'resize_down':
        return <TrendingDown className="h-4 w-4" />;
      case 'resize_up':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getRecommendationColor = (type: string) => {
    switch (type) {
      case 'resize_down':
        return 'default';
      case 'resize_up':
        return 'secondary';
      case 'underutilized':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const handleApply = async (recommendationId: string) => {
    try {
      const { error } = await supabase
        .from('storage_recommendations')
        .update({ status: 'applied', applied_at: new Date().toISOString() })
        .eq('id', recommendationId);

      if (error) throw error;

      toast.success(t('storage.recommendationApplied'));
      onRecommendationUpdate();
    } catch (error) {
      console.error('Error applying recommendation:', error);
      toast.error(t('storage.errorApplying'));
    }
  };

  const handleDismiss = async (recommendationId: string) => {
    try {
      const { error } = await supabase
        .from('storage_recommendations')
        .update({ status: 'dismissed' })
        .eq('id', recommendationId);

      if (error) throw error;

      toast.success(t('storage.recommendationDismissed'));
      onRecommendationUpdate();
    } catch (error) {
      console.error('Error dismissing recommendation:', error);
      toast.error(t('storage.errorDismissing'));
    }
  };

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            {t('storage.aiRecommendations')}
          </CardTitle>
          <CardDescription>{t('storage.noRecommendations')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          {t('storage.aiRecommendations')}
        </CardTitle>
        <CardDescription>{t('storage.recommendationsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec) => (
          <div key={rec.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-1">
                  {getRecommendationIcon(rec.recommendation_type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{pvcNames[rec.pvc_id] || 'Unknown PVC'}</h4>
                    <Badge variant={getRecommendationColor(rec.recommendation_type)}>
                      {t(`storage.${rec.recommendation_type}`)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {t('storage.currentSize')}: <strong>{rec.current_size_gb.toFixed(1)} GB</strong>
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-muted-foreground">
                      {t('storage.recommendedSize')}: <strong>{rec.recommended_size_gb.toFixed(1)} GB</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {t('storage.usage')}: <strong>{rec.usage_percentage.toFixed(1)}%</strong>
                    </span>
                    {rec.potential_savings > 0 && (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {t('storage.potentialSavings')}: {formatCurrency(rec.potential_savings).value}/mês
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {rec.status === 'pending' && (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => handleApply(rec.id)}
                  className="flex items-center gap-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  {t('storage.apply')}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleDismiss(rec.id)}
                  className="flex items-center gap-1"
                >
                  <XCircle className="h-4 w-4" />
                  {t('storage.dismiss')}
                </Button>
              </div>
            )}
            {rec.status === 'applied' && (
              <Badge variant="default">{t('storage.applied')}</Badge>
            )}
            {rec.status === 'dismissed' && (
              <Badge variant="secondary">{t('storage.dismissed')}</Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
