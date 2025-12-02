import { useSubscription } from '@/contexts/SubscriptionContext';
import { Clock, Crown, AlertTriangle, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const TrialBanner = () => {
  const { isTrialActive, daysLeftInTrial, isReadOnly, currentPlan, subscription } = useSubscription();

  // Don't show banner for active paid plans
  if (subscription?.status === 'active' && currentPlan !== 'free') {
    return null;
  }

  // Read-only mode banner
  if (isReadOnly) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/20">
        <div className="px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-medium">
              Modo somente leitura - Seu período de teste expirou
            </span>
          </div>
          <Link 
            to="/pricing" 
            className="text-sm font-medium text-destructive hover:underline flex items-center gap-1"
          >
            <Crown className="w-4 h-4" />
            Escolher plano
          </Link>
        </div>
      </div>
    );
  }

  // Trial active banner
  if (isTrialActive) {
    const isUrgent = daysLeftInTrial <= 7;
    
    return (
      <div className={cn(
        "border-b",
        isUrgent 
          ? "bg-amber-500/10 border-amber-500/20" 
          : "bg-primary/5 border-primary/20"
      )}>
        <div className="px-4 py-2 flex items-center justify-between gap-4">
          <div className={cn(
            "flex items-center gap-2",
            isUrgent ? "text-amber-600" : "text-primary"
          )}>
            {isUrgent ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {daysLeftInTrial === 1 
                ? "Último dia de teste!" 
                : `${daysLeftInTrial} dias restantes no período de teste`
              }
            </span>
          </div>
          <Link 
            to="/pricing" 
            className={cn(
              "text-sm font-medium hover:underline flex items-center gap-1",
              isUrgent ? "text-amber-600" : "text-primary"
            )}
          >
            <Crown className="w-4 h-4" />
            Ver planos
          </Link>
        </div>
      </div>
    );
  }

  // Free plan banner
  if (currentPlan === 'free') {
    return (
      <div className="bg-muted/50 border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-sm">
              Plano gratuito - Funcionalidades limitadas
            </span>
          </div>
          <Link 
            to="/pricing" 
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            <Crown className="w-4 h-4" />
            Fazer upgrade
          </Link>
        </div>
      </div>
    );
  }

  return null;
};
