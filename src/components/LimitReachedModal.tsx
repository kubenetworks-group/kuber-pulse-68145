import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSubscription, PLAN_LIMITS, PlanType } from '@/contexts/SubscriptionContext';
import { Crown, Server, Brain, History, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LimitReachedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: 'clusters' | 'ai' | 'autohealing';
}

const limitInfo = {
  clusters: {
    icon: Server,
    title: 'Limite de Clusters Atingido',
    description: 'Você atingiu o número máximo de clusters para o seu plano.',
  },
  ai: {
    icon: Brain,
    title: 'Limite de Análises de IA Atingido',
    description: 'Você utilizou todas as análises de IA disponíveis neste mês.',
  },
  autohealing: {
    icon: Zap,
    title: 'Auto-healing não disponível',
    description: 'O recurso de auto-healing está disponível apenas nos planos Pro e Enterprise.',
  },
};

export const LimitReachedModal = ({ open, onOpenChange, limitType }: LimitReachedModalProps) => {
  const { currentPlan, subscription } = useSubscription();
  const navigate = useNavigate();
  const info = limitInfo[limitType];
  const Icon = info.icon;

  const getUpgradeOptions = (): PlanType[] => {
    if (currentPlan === 'free') return ['pro'];
    return [];
  };

  const getLimitValue = (plan: PlanType, type: string) => {
    const limits = PLAN_LIMITS[plan];
    switch (type) {
      case 'clusters':
        return limits.clusters === Infinity ? 'Ilimitado' : limits.clusters;
      case 'ai':
        return limits.aiAnalysesPerMonth === Infinity ? 'Ilimitado' : limits.aiAnalysesPerMonth;
      case 'autohealing':
        return limits.autoHealing ? 'Sim' : 'Não';
      default:
        return '-';
    }
  };

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Icon className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle>{info.title}</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {info.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground mb-2">Seu plano atual:</p>
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">{currentPlan}</span>
              <span className="text-sm text-muted-foreground">
                {limitType === 'clusters' && `${getLimitValue(currentPlan, 'clusters')} cluster(s)`}
                {limitType === 'ai' && `${subscription?.ai_analyses_used || 0}/${getLimitValue(currentPlan, 'ai')} análises usadas`}
                {limitType === 'autohealing' && `Auto-healing: ${getLimitValue(currentPlan, 'autohealing')}`}
              </span>
            </div>
          </div>

          {getUpgradeOptions().length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Faça upgrade para mais recursos:</p>
              {getUpgradeOptions().map(plan => (
                <div key={plan} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <span className="font-medium capitalize">{plan}</span>
                    <p className="text-xs text-muted-foreground">
                      {limitType === 'clusters' && `Até ${getLimitValue(plan, 'clusters')} clusters`}
                      {limitType === 'ai' && `${getLimitValue(plan, 'ai')} análises/mês`}
                      {limitType === 'autohealing' && 'Auto-healing incluído'}
                    </p>
                  </div>
                  <Crown className="w-4 h-4 text-primary" />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Fechar
            </Button>
            <Button onClick={handleUpgrade} className="flex-1 gap-2">
              <Crown className="w-4 h-4" />
              Ver Planos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
