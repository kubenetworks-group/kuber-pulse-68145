import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trash2,
  CheckCircle,
  X,
  Loader2,
  HardDrive,
  BarChart3,
  Clock,
  DollarSign,
  Database,
  AlertTriangle,
} from "lucide-react";
import { useStorageRecommendations, StorageRecommendation } from "@/hooks/useStorageRecommendations";
import { useCurrency } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const priorityConfig = {
  critical: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Critico' },
  high: { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Alto' },
  medium: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Medio' },
  low: { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Baixo' },
};

const typeConfig = {
  downsize: { icon: TrendingDown, label: 'Reduzir', color: 'text-green-500', bg: 'bg-green-500/10' },
  upsize: { icon: TrendingUp, label: 'Aumentar', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  maintain: { icon: CheckCircle, label: 'Manter', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  delete: { icon: Trash2, label: 'Deletar', color: 'text-red-500', bg: 'bg-red-500/10' },
};

interface RecommendationCardProps {
  recommendation: StorageRecommendation;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  formatCurrency: (value: number) => string;
}

const RecommendationCard = ({ recommendation, onAccept, onReject, formatCurrency }: RecommendationCardProps) => {
  const priority = priorityConfig[recommendation.priority];
  const type = typeConfig[recommendation.recommendation_type];
  const TypeIcon = type.icon;

  const savingsPercent = recommendation.current_size_gb > 0
    ? ((recommendation.current_size_gb - recommendation.recommended_size_gb) / recommendation.current_size_gb * 100)
    : 0;

  return (
    <Card className={cn(
      "border transition-all hover:shadow-md group",
      priority.border,
      recommendation.status !== 'pending' && "opacity-60"
    )}>
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          {/* Left side - PVC info and metrics */}
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" className={cn(priority.bg, priority.color, "text-xs")}>
                {priority.label}
              </Badge>
              <Badge variant="outline" className={cn(type.bg, "flex items-center gap-1 text-xs")}>
                <TypeIcon className={cn("w-3 h-3", type.color)} />
                {type.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {recommendation.namespace}
              </Badge>
            </div>

            {/* PVC Name */}
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-primary flex-shrink-0" />
              <h4 className="font-medium text-sm truncate">{recommendation.pvc_name}</h4>
            </div>

            {/* Size metrics */}
            <div className="grid grid-cols-3 gap-3 text-xs mb-3">
              <div className="p-2 rounded bg-muted/50">
                <span className="text-muted-foreground block">Atual</span>
                <span className="font-semibold">{recommendation.current_size_gb.toFixed(1)} GB</span>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <span className="text-muted-foreground block">Em Uso</span>
                <span className="font-semibold">{recommendation.current_usage_gb.toFixed(2)} GB</span>
              </div>
              <div className={cn("p-2 rounded", type.bg)}>
                <span className="text-muted-foreground block">Recomendado</span>
                <span className={cn("font-semibold", type.color)}>
                  {recommendation.recommended_size_gb.toFixed(1)} GB
                </span>
              </div>
            </div>

            {/* Usage Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Uso (avg / max / p95)</span>
                <span className="font-medium">
                  {recommendation.avg_usage_percent.toFixed(0)}% / {recommendation.max_usage_percent.toFixed(0)}% / {recommendation.p95_usage_percent.toFixed(0)}%
                </span>
              </div>
              <div className="relative">
                <Progress value={recommendation.avg_usage_percent} className="h-2" />
                {/* Max usage indicator */}
                <div
                  className="absolute top-0 h-2 w-0.5 bg-orange-500"
                  style={{ left: `${Math.min(recommendation.max_usage_percent, 100)}%` }}
                />
              </div>
              {recommendation.avg_usage_percent < 20 && (
                <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Uso muito baixo - otimizacao recomendada
                </p>
              )}
            </div>

            {/* AI Reasoning */}
            <div className="p-2 rounded bg-muted/30 border border-border/50">
              <div className="flex items-start gap-2">
                <Sparkles className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {recommendation.ai_reasoning}
                </p>
              </div>
            </div>
          </div>

          {/* Right side - Savings & Actions */}
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-3 lg:min-w-[140px]">
            {/* Savings */}
            {recommendation.potential_savings_month > 0 && (
              <div className="text-center lg:text-right p-2 rounded bg-green-500/10 border border-green-500/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Economia/mes
                </p>
                <p className="text-lg font-bold text-green-500">
                  {formatCurrency(recommendation.potential_savings_month)}
                </p>
                {savingsPercent > 0 && (
                  <p className="text-xs text-green-500/80">
                    -{savingsPercent.toFixed(0)}% storage
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            {recommendation.status === 'pending' ? (
              <div className="flex gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => onReject(recommendation.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Rejeitar</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        className="h-8 px-3 gap-1"
                        onClick={() => onAccept(recommendation.id)}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Aceitar
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Aceitar recomendacao</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <Badge
                variant={recommendation.status === 'accepted' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {recommendation.status === 'accepted' ? 'Aceita' :
                 recommendation.status === 'rejected' ? 'Rejeitada' : 'Aplicada'}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const AIStorageRecommendations = () => {
  const { t } = useTranslation();
  const {
    recommendations,
    loading,
    analyzing,
    stats,
    lastAnalysis,
    analyzeStorage,
    updateRecommendationStatus,
  } = useStorageRecommendations();
  const { formatCurrency } = useCurrency();

  const pendingRecommendations = recommendations.filter(r => r.status === 'pending');
  const hasRecommendations = pendingRecommendations.length > 0;

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50 hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Recomendacoes de IA para Storage</CardTitle>
              <CardDescription className="text-xs">
                Analise inteligente de uso de PVCs para otimizacao de custos
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastAnalysis && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {lastAnalysis.toLocaleDateString('pt-BR')} {lastAnalysis.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              onClick={analyzeStorage}
              disabled={analyzing}
              className="gap-2"
              size="sm"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  Analisar Storage
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Recomendacoes</p>
            <p className="text-2xl font-bold">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">
              {stats.downsizeCount} reduzir, {stats.deleteCount} deletar
            </p>
          </div>

          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Economia Potencial
            </p>
            <p className="text-2xl font-bold text-green-500">
              {formatCurrency(stats.totalSavings)}
            </p>
            <p className="text-xs text-muted-foreground">por mes</p>
          </div>

          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              Storage Recuperavel
            </p>
            <p className="text-2xl font-bold text-blue-500">
              {stats.totalStorageRecoverable.toFixed(1)} GB
            </p>
            <p className="text-xs text-muted-foreground">liberavel</p>
          </div>

          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              PVCs Otimizaveis
            </p>
            <p className="text-2xl font-bold text-orange-500">{stats.downsizeCount}</p>
            <p className="text-xs text-muted-foreground">para reduzir</p>
          </div>
        </div>

        {/* Recommendations List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando recomendacoes...</p>
          </div>
        ) : !hasRecommendations ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <HardDrive className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium mb-1">Nenhuma recomendacao pendente</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Clique em "Analisar Storage" para gerar recomendacoes baseadas no historico de uso dos ultimos 7 dias
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {pendingRecommendations.map(rec => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onAccept={(id) => updateRecommendationStatus(id, 'accepted')}
                onReject={(id) => updateRecommendationStatus(id, 'rejected')}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        )}

        {/* Help text */}
        {hasRecommendations && (
          <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
            Recomendacoes baseadas em analise de {recommendations[0]?.days_analyzed || 7} dias de historico de uso.
            Aceitar uma recomendacao nao aplica mudancas automaticamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
