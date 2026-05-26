import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AIUsageLimitAlert } from "@/components/AIUsageLimitAlert";
import {
  Sparkles, TrendingDown, TrendingUp, CheckCircle, X, Loader2,
  BarChart3, Clock, DollarSign, Cpu, AlertTriangle, ShieldAlert,
  MemoryStick, ArrowRight,
} from "lucide-react";
import { usePodRightsizing, PodRightsizingRecommendation } from "@/hooks/usePodRightsizing";
import { useCurrency } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

const priorityConfig = {
  critical: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Crítico' },
  high:     { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Alto' },
  medium:   { color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Médio' },
  low:      { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Baixo' },
};

const typeConfig: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  downsize_cpu:   { icon: TrendingDown, label: 'Reduzir CPU',    color: 'text-green-500',  bg: 'bg-green-500/10' },
  upsize_cpu:     { icon: TrendingUp,   label: 'Aumentar CPU',   color: 'text-orange-500', bg: 'bg-orange-500/10' },
  downsize_mem:   { icon: TrendingDown, label: 'Reduzir Memória', color: 'text-green-500', bg: 'bg-green-500/10' },
  upsize_mem:     { icon: TrendingUp,   label: 'Aumentar Mem',   color: 'text-orange-500', bg: 'bg-orange-500/10' },
  add_limits:     { icon: ShieldAlert,  label: 'Adicionar Limits', color: 'text-red-500',  bg: 'bg-red-500/10' },
  add_requests:   { icon: AlertTriangle,label: 'Adicionar Requests', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
};

interface CardProps {
  rec: PodRightsizingRecommendation;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  formatCurrency: (v: number) => { value: string };
}

const RecCard = ({ rec, onAccept, onReject, formatCurrency }: CardProps) => {
  const priority = priorityConfig[rec.priority];
  const type = typeConfig[rec.recommendation_type] ?? typeConfig.add_requests;
  const TypeIcon = type.icon;
  const isCPU = rec.recommendation_type.includes('cpu') || rec.recommendation_type === 'add_requests';
  const currentVal = isCPU ? rec.current_request_cpu : rec.current_request_mem;
  const recommendedVal = isCPU ? rec.recommended_request_cpu : rec.recommended_request_mem;

  return (
    <Card className={cn("border transition-all hover:shadow-md", priority.border)}>
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
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
              <Badge variant="outline" className="text-xs font-mono">{rec.namespace}</Badge>
            </div>

            {/* Pod / container name */}
            <div className="flex items-center gap-2 mb-3">
              {isCPU
                ? <Cpu className="w-4 h-4 text-primary flex-shrink-0" />
                : <MemoryStick className="w-4 h-4 text-primary flex-shrink-0" />}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{rec.pod_name}</p>
                {rec.container_name && rec.container_name !== 'main' && (
                  <p className="text-[11px] text-muted-foreground font-mono truncate">container: {rec.container_name}</p>
                )}
              </div>
            </div>

            {/* Request current → recommended */}
            {(currentVal || recommendedVal) && (
              <div className="flex items-center gap-2 mb-3">
                <div className="px-2.5 py-1 rounded bg-muted/50 text-xs font-mono font-medium">
                  {currentVal ?? '—'}
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className={cn("px-2.5 py-1 rounded text-xs font-mono font-medium", type.bg, type.color)}>
                  {recommendedVal ?? '—'}
                </div>
              </div>
            )}

            {/* Usage bar */}
            {rec.avg_usage_percent > 0 && (
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Uso (avg / max / p95)</span>
                  <span className="font-medium">
                    {rec.avg_usage_percent.toFixed(0)}% / {rec.max_usage_percent.toFixed(0)}% / {rec.p95_usage_percent.toFixed(0)}%
                  </span>
                </div>
                <div className="relative">
                  <Progress value={Math.min(rec.avg_usage_percent, 100)} className="h-2" />
                  <div
                    className="absolute top-0 h-2 w-0.5 bg-orange-500"
                    style={{ left: `${Math.min(rec.max_usage_percent, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            <div className="p-2 rounded bg-muted/30 border border-border/50">
              <div className="flex items-start gap-2">
                <Sparkles className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">{rec.ai_reasoning}</p>
              </div>
            </div>
          </div>

          {/* Savings + Actions */}
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-3 lg:min-w-[140px]">
            {rec.potential_savings_month > 0 && (
              <div className="text-center lg:text-right p-2 rounded bg-green-500/10 border border-green-500/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />Economia/mês
                </p>
                <p className="text-lg font-bold text-green-500">
                  {formatCurrency(rec.potential_savings_month).value}
                </p>
              </div>
            )}

            {rec.status === 'pending' ? (
              <div className="flex gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => onReject(rec.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Rejeitar</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" className="h-8 px-3 gap-1" onClick={() => onAccept(rec.id)}>
                        <CheckCircle className="w-4 h-4" />Aceitar
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Marcar como aceita</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <Badge variant={rec.status === 'accepted' ? 'default' : 'secondary'} className="text-xs">
                {rec.status === 'accepted' ? 'Aceita' : rec.status === 'rejected' ? 'Rejeitada' : 'Aplicada'}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const PodRightsizingRecommendations = () => {
  const {
    recommendations, loading, analyzing, stats, lastAnalysis,
    rateLimitError, clearRateLimitError, analyzeRightsizing,
    updateRecommendationStatus, refetch,
  } = usePodRightsizing();
  const { formatCurrency } = useCurrency();

  useEffect(() => { refetch(); }, [refetch]);

  const pending = recommendations.filter(r => r.status === 'pending');

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50 hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Cpu className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Rightsizing de Pods com IA</CardTitle>
              <CardDescription className="text-xs">
                Otimização de CPU e memória baseada em uso real dos últimos 7 dias
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastAnalysis && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {lastAnalysis.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button onClick={analyzeRightsizing} disabled={analyzing} className="gap-2" size="sm">
              {analyzing ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Analisando...</>
              ) : (
                <><BarChart3 className="w-4 h-4" />Analisar Pods</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {rateLimitError && (
          <AIUsageLimitAlert
            title="Limite temporário de IA atingido"
            message={rateLimitError.message}
            resetAt={rateLimitError.retryAfter || null}
            onClose={clearRateLimitError}
            onRetry={analyzeRightsizing}
            isLoading={analyzing}
            isApiRateLimit
          />
        )}

        {/* Stats summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Recomendações</p>
            <p className="text-2xl font-bold">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">
              {stats.downsizeCPU} CPU · {stats.downsizeMem} mem
            </p>
          </div>

          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />Economia Potencial
            </p>
            <p className="text-2xl font-bold text-green-500">
              {formatCurrency(stats.totalSavings).value}
            </p>
            <p className="text-xs text-muted-foreground">por mês</p>
          </div>

          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />Sem Limits
            </p>
            <p className="text-2xl font-bold text-red-500">{stats.addLimits}</p>
            <p className="text-xs text-muted-foreground">pods em risco</p>
          </div>

          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />Subutilizados
            </p>
            <p className="text-2xl font-bold text-orange-500">
              {stats.downsizeCPU + stats.downsizeMem}
            </p>
            <p className="text-xs text-muted-foreground">para reduzir</p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando recomendações...</p>
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <Cpu className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium mb-1">Nenhuma recomendação pendente</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Clique em "Analisar Pods" para gerar recomendações de rightsizing baseadas no uso real dos últimos 7 dias
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {pending.map(rec => (
              <RecCard
                key={rec.id}
                rec={rec}
                onAccept={(id) => updateRecommendationStatus(id, 'accepted')}
                onReject={(id) => updateRecommendationStatus(id, 'rejected')}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        )}

        {pending.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
            Análise baseada em 7 dias de histórico. Aceitar não aplica mudanças automaticamente —
            atualize os manifests ou Helm values conforme recomendado.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
