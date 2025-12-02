import { useSubscription } from '@/contexts/SubscriptionContext';
import { Clock, Crown, AlertTriangle, Lock, Zap, Sparkles } from 'lucide-react';
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

  // Free plan banner - Modern & Dynamic
  if (currentPlan === 'free') {
    return (
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/5 via-accent/10 to-primary/5 border-b border-primary/20">
        {/* Animated background effect */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,hsl(var(--primary)/0.1)_50%,transparent_100%)] animate-[shimmer_3s_ease-in-out_infinite]" 
             style={{ backgroundSize: '200% 100%' }} />
        
        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1 left-[10%] w-1 h-1 bg-primary/30 rounded-full animate-pulse" />
          <div className="absolute top-2 left-[30%] w-0.5 h-0.5 bg-accent/40 rounded-full animate-pulse delay-100" />
          <div className="absolute top-1 left-[60%] w-1 h-1 bg-primary/20 rounded-full animate-pulse delay-200" />
          <div className="absolute top-2 left-[80%] w-0.5 h-0.5 bg-accent/30 rounded-full animate-pulse delay-300" />
        </div>

        <div className="relative px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-sm animate-pulse" />
              <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
                <Zap className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">
                Plano Free
              </span>
              <span className="text-sm text-muted-foreground">
                Desbloqueie recursos avançados de IA e monitoramento
              </span>
            </div>
          </div>
          
          <Link 
            to="/pricing" 
            className="group relative flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-medium shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 hover:scale-105"
          >
            <Sparkles className="w-4 h-4 group-hover:animate-spin" />
            <span>Fazer Upgrade</span>
            <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>
      </div>
    );
  }

  return null;
};
