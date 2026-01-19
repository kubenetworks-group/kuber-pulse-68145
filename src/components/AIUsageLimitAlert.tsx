import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Zap, Clock, ArrowUpRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIUsageLimitAlertProps {
  title?: string;
  used: number;
  limit: number;
  resetAt: Date | null;
  featureName: string;
  onClose?: () => void;
  onRetry?: () => void;
  isLoading?: boolean;
  variant?: 'compact' | 'full';
}

export function AIUsageLimitAlert({
  title,
  used,
  limit,
  resetAt,
  featureName,
  onClose,
  onRetry,
  isLoading = false,
  variant = 'full',
}: AIUsageLimitAlertProps) {
  const isAtLimit = used >= limit;
  const usagePercentage = limit === Infinity ? 0 : (used / limit) * 100;
  
  const getTimeUntilReset = () => {
    if (!resetAt) return null;
    return formatDistanceToNow(resetAt, { addSuffix: true, locale: ptBR });
  };

  const getResetDateFormatted = () => {
    if (!resetAt) return null;
    return format(resetAt, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            {used}/{limit === Infinity ? '∞' : limit} {featureName}
          </span>
        </div>
        {isAtLimit && resetAt && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {getTimeUntilReset()}
          </span>
        )}
      </div>
    );
  }

  if (!isAtLimit) {
    return (
      <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/30">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Uso de {featureName}
          </span>
          <span className="font-medium">
            {used}/{limit === Infinity ? '∞' : limit}
          </span>
        </div>
        {limit !== Infinity && (
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                usagePercentage >= 90 ? 'bg-destructive' : 
                usagePercentage >= 70 ? 'bg-yellow-500' : 
                'bg-primary'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        )}
        {resetAt && limit !== Infinity && (
          <p className="text-xs text-muted-foreground mt-2">
            Renova {getTimeUntilReset()}
          </p>
        )}
      </div>
    );
  }

  return (
    <Alert className="border-amber-500/30 bg-amber-500/5 mb-4">
      <Zap className="h-5 w-5 text-amber-500" />
      <AlertTitle className="text-amber-600 dark:text-amber-400 font-semibold">
        {title || `Limite de ${featureName} atingido`}
      </AlertTitle>
      <AlertDescription className="mt-3 space-y-3">
        <p className="text-muted-foreground">
          Você utilizou <span className="font-semibold text-foreground">{used}/{limit}</span> {featureName} disponíveis no seu plano.
          {resetAt && (
            <>
              {" "}Seu limite será renovado{" "}
              <span className="font-medium text-foreground">{getResetDateFormatted()}</span>.
            </>
          )}
        </p>

        <div className="bg-background/60 rounded-lg p-3 border border-border/50">
          <p className="text-sm font-medium mb-1">💡 Dica</p>
          <p className="text-xs text-muted-foreground">
            Faça upgrade para o plano Pro e tenha acesso ilimitado a recursos de IA, 
            incluindo análises de storage, chat com assistente e muito mais.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {onClose && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="gap-1"
            >
              <X className="w-3 h-3" />
              Fechar
            </Button>
          )}
          <Link to="/pricing">
            <Button 
              size="sm" 
              className="gap-1 bg-gradient-primary hover:opacity-90"
            >
              <ArrowUpRight className="w-3 h-3" />
              Ver planos
            </Button>
          </Link>
          {onRetry && resetAt && new Date() >= resetAt && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={onRetry}
              disabled={isLoading}
            >
              Tentar novamente
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}