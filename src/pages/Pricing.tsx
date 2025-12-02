import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PlanCard } from '@/components/PlanCard';
import { useSubscription, PlanType } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Clock, Brain, Server, Calendar, Sparkles } from 'lucide-react';

export default function Pricing() {
  const { 
    subscription, 
    currentPlan, 
    isTrialActive, 
    daysLeftInTrial, 
    planLimits, 
    changePlan,
    isReadOnly
  } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);

  const handleSelectPlan = async (plan: PlanType) => {
    if (plan === 'enterprise') {
      // Open contact form or email
      window.open('mailto:contato@kuberpulse.com?subject=Interesse no plano Enterprise', '_blank');
      return;
    }

    setLoadingPlan(plan);
    try {
      const success = await changePlan(plan);
      if (success) {
        toast.success(`Plano alterado para ${plan.toUpperCase()} com sucesso!`);
      } else {
        toast.error('Erro ao alterar plano');
      }
    } catch (error) {
      toast.error('Erro ao processar sua solicitação');
    } finally {
      setLoadingPlan(null);
    }
  };

  const aiUsagePercent = planLimits.aiAnalysesPerMonth === Infinity 
    ? 0 
    : ((subscription?.ai_analyses_used || 0) / planLimits.aiAnalysesPerMonth) * 100;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Escolha o plano ideal
          </h1>
          <p className="text-muted-foreground">
            Comece gratuitamente e escale conforme sua necessidade. 
            Todos os planos incluem acesso às funcionalidades básicas.
          </p>
        </div>

        {/* Current Status Card */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Seu Status Atual
            </CardTitle>
            <CardDescription>
              Informações sobre sua assinatura
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <p className="font-medium capitalize flex items-center gap-2">
                    {currentPlan}
                    {isTrialActive && (
                      <Badge variant="secondary" className="text-xs">
                        Em teste
                      </Badge>
                    )}
                    {isReadOnly && (
                      <Badge variant="destructive" className="text-xs">
                        Somente leitura
                      </Badge>
                    )}
                  </p>
                </div>
              </div>

              {isTrialActive && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Trial restante</p>
                    <p className="font-medium">{daysLeftInTrial} dias</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Brain className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Análises de IA</p>
                  <p className="font-medium">
                    {subscription?.ai_analyses_used || 0} / {planLimits.aiAnalysesPerMonth === Infinity ? '∞' : planLimits.aiAnalysesPerMonth}
                  </p>
                  {planLimits.aiAnalysesPerMonth !== Infinity && (
                    <Progress value={aiUsagePercent} className="h-1 mt-1" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Server className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Limite de clusters</p>
                  <p className="font-medium">
                    {planLimits.clusters === Infinity ? 'Ilimitado' : `Até ${planLimits.clusters}`}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto items-start">
          {(['free', 'pro', 'enterprise'] as PlanType[]).map(plan => (
            <PlanCard
              key={plan}
              plan={plan}
              isCurrentPlan={currentPlan === plan && !isTrialActive}
              isTrialActive={isTrialActive}
              onSelect={handleSelectPlan}
              isLoading={loadingPlan === plan}
            />
          ))}
        </div>

        {/* FAQ or additional info */}
        <div className="max-w-2xl mx-auto text-center text-sm text-muted-foreground">
          <p>
            Não é necessário cadastrar cartão de crédito. 
            Você pode fazer upgrade ou downgrade a qualquer momento.
          </p>
          <p className="mt-2">
            Precisa de ajuda? Entre em contato conosco em{' '}
            <a href="mailto:suporte@kuberpulse.com" className="text-primary hover:underline">
              suporte@kuberpulse.com
            </a>
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
