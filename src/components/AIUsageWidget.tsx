import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/hooks/useCurrency";
import { Brain, Zap, DollarSign, TrendingUp, Loader2 } from "lucide-react";

interface UsageStats {
  dailyRequests: number;
  dailyLimit: number;
  monthlyTokens: {
    input: number;
    output: number;
  };
  monthlyCost: number;
  isLoading: boolean;
}

export const AIUsageWidget = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [stats, setStats] = useState<UsageStats>({
    dailyRequests: 0,
    dailyLimit: 500,
    monthlyTokens: { input: 0, output: 0 },
    monthlyCost: 0,
    isLoading: true,
  });

  useEffect(() => {
    if (user) {
      fetchUsageStats();
    }
  }, [user]);

  const fetchUsageStats = async () => {
    if (!user) return;

    try {
      // Fetch daily requests count
      const { data: dailyCount } = await supabase.rpc('get_user_daily_ai_requests', {
        p_user_id: user.id
      });

      // Fetch monthly cost
      const { data: monthlyCost } = await supabase.rpc('get_user_monthly_ai_cost', {
        p_user_id: user.id
      });

      // Fetch monthly token usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: tokenData } = await supabase
        .from('ai_usage_logs')
        .select('input_tokens, output_tokens')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString());

      const monthlyTokens = tokenData?.reduce(
        (acc, log) => ({
          input: acc.input + (log.input_tokens || 0),
          output: acc.output + (log.output_tokens || 0),
        }),
        { input: 0, output: 0 }
      ) || { input: 0, output: 0 };

      setStats({
        dailyRequests: dailyCount || 0,
        dailyLimit: 500, // Gemini 2.5 Flash free tier
        monthlyTokens,
        monthlyCost: monthlyCost || 0,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching AI usage stats:', error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const dailyUsagePercent = Math.min((stats.dailyRequests / stats.dailyLimit) * 100, 100);
  const isNearLimit = dailyUsagePercent >= 80;
  const isAtLimit = dailyUsagePercent >= 100;

  if (stats.isLoading) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Carregando estatísticas...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-purple-500/10 border-blue-500/20">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-blue-500/20">
          <Brain className="h-6 w-6 text-blue-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold">Uso de IA</h3>
            <Badge variant="secondary" className="text-xs">
              Gemini 2.5 Flash
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Daily Requests */}
            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Requisições Diárias</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-amber-500' : 'text-foreground'}`}>
                  {stats.dailyRequests}
                </span>
                <span className="text-sm text-muted-foreground">/ {stats.dailyLimit}</span>
              </div>
              <Progress 
                value={dailyUsagePercent} 
                className={`h-1.5 mt-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-amber-500' : ''}`}
              />
              {isNearLimit && !isAtLimit && (
                <p className="text-xs text-amber-500 mt-1">Próximo do limite diário</p>
              )}
              {isAtLimit && (
                <p className="text-xs text-destructive mt-1">Limite diário atingido</p>
              )}
            </div>

            {/* Input Tokens */}
            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Tokens de Entrada</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">
                  {formatTokens(stats.monthlyTokens.input)}
                </span>
                <span className="text-xs text-muted-foreground">este mês</span>
              </div>
            </div>

            {/* Output Tokens */}
            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Tokens de Saída</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">
                  {formatTokens(stats.monthlyTokens.output)}
                </span>
                <span className="text-xs text-muted-foreground">este mês</span>
              </div>
            </div>

            {/* Estimated Cost */}
            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Custo Estimado</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.monthlyCost, { sourceCurrency: 'USD' }).value}
                </span>
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
              {stats.monthlyCost === 0 && (
                <p className="text-xs text-emerald-500 mt-1">Usando tier gratuito</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            O Gemini 2.5 Flash oferece 500 requisições gratuitas por dia. Após esse limite, o sistema utiliza OpenAI como fallback.
          </p>
        </div>
      </div>
    </Card>
  );
};
