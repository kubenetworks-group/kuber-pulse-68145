import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Crown, Sparkles } from 'lucide-react';
import { PlanType, PLAN_LIMITS } from '@/contexts/SubscriptionContext';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  plan: PlanType;
  isCurrentPlan: boolean;
  isTrialActive: boolean;
  onSelect: (plan: PlanType) => void;
  isLoading?: boolean;
}

const planDetails: Record<PlanType, { name: string; price: string; description: string; highlight?: boolean }> = {
  free: {
    name: 'Free',
    price: 'R$ 0',
    description: 'Para explorar a plataforma',
  },
  pro: {
    name: 'Pro',
    price: 'R$ 99/mês',
    description: 'Para equipes em crescimento',
    highlight: true,
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Sob consulta',
    description: 'Para grandes organizações',
  },
};

export const PlanCard = ({ plan, isCurrentPlan, isTrialActive, onSelect, isLoading }: PlanCardProps) => {
  const details = planDetails[plan];
  const limits = PLAN_LIMITS[plan];

  const features = [
    {
      name: 'Clusters',
      value: limits.clusters === Infinity ? 'Ilimitado' : `Até ${limits.clusters}`,
      included: true,
    },
    {
      name: 'Análises de IA por mês',
      value: limits.aiAnalysesPerMonth === Infinity ? 'Ilimitado' : `${limits.aiAnalysesPerMonth}`,
      included: true,
    },
    {
      name: 'Retenção de histórico',
      value: `${limits.historyRetentionDays} dias`,
      included: true,
    },
    {
      name: 'Auto-healing',
      value: limits.autoHealing ? 'Incluído' : 'Não incluído',
      included: limits.autoHealing,
    },
    {
      name: 'Suporte prioritário',
      value: plan === 'enterprise' ? 'Incluído' : 'Não incluído',
      included: plan === 'enterprise',
    },
    {
      name: 'SLA dedicado',
      value: plan === 'enterprise' ? 'Incluído' : 'Não incluído',
      included: plan === 'enterprise',
    },
  ];

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all",
      details.highlight && "border-primary shadow-lg scale-105",
      isCurrentPlan && "ring-2 ring-primary"
    )}>
      {details.highlight && (
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-bl-lg flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Mais popular
        </div>
      )}
      
      {isCurrentPlan && (
        <Badge className="absolute top-3 left-3" variant="secondary">
          Plano atual
        </Badge>
      )}

      <CardHeader className={cn("pt-8", isCurrentPlan && "pt-12")}>
        <CardTitle className="text-2xl flex items-center gap-2">
          {plan === 'enterprise' && <Crown className="w-5 h-5 text-primary" />}
          {details.name}
        </CardTitle>
        <CardDescription>{details.description}</CardDescription>
        <div className="mt-4">
          <span className="text-3xl font-bold">{details.price}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              {feature.included ? (
                <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <X className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <div>
                <span className={cn(
                  "text-sm",
                  !feature.included && "text-muted-foreground"
                )}>
                  {feature.name}
                </span>
                <p className="text-xs text-muted-foreground">{feature.value}</p>
              </div>
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          variant={details.highlight ? "default" : "outline"}
          disabled={isCurrentPlan || isLoading}
          onClick={() => onSelect(plan)}
        >
          {isLoading ? (
            "Processando..."
          ) : isCurrentPlan ? (
            isTrialActive ? "Em teste" : "Plano atual"
          ) : plan === 'enterprise' ? (
            "Falar com vendas"
          ) : (
            "Selecionar plano"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
