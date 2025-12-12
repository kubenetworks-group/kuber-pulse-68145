import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PlanCard } from '@/components/PlanCard';
import { ManageSubscription } from '@/components/ManageSubscription';
import { useSubscription, PlanType } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Clock, Brain, Server, Calendar, Sparkles, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Pricing() {
  const [searchParams] = useSearchParams();
  const { 
    subscription, 
    currentPlan, 
    isTrialActive, 
    daysLeftInTrial, 
    planLimits, 
    changePlan,
    isReadOnly,
    refetch
  } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);

  // Handle success/cancel redirects from Stripe
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Assinatura ativada com sucesso!');
      refetch();
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout cancelado');
    }
  }, [searchParams, refetch]);

  const handleSelectPlan = async (plan: PlanType) => {
    if (plan === 'free') {
      // Direct change to free (downgrade)
      setLoadingPlan(plan);
      try {
        const success = await changePlan(plan);
        if (success) {
          toast.success('Plano alterado para FREE com sucesso!');
        } else {
          toast.error('Erro ao alterar plano');
        }
      } catch (error) {
        toast.error('Erro ao processar sua solicitação');
      } finally {
        setLoadingPlan(null);
      }
      return;
    }

    // For pro plan, redirect to Stripe checkout
    setLoadingPlan(plan);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error('Erro ao iniciar checkout. Tente novamente.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const aiUsagePercent = planLimits.aiAnalysesPerMonth === Infinity 
    ? 0 
    : ((subscription?.ai_analyses_used || 0) / planLimits.aiAnalysesPerMonth) * 100;

  const hasStripeSubscription = !!subscription?.stripe_subscription_id;

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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Seu Status Atual
                </CardTitle>
                <CardDescription>
                  Informações sobre sua assinatura
                </CardDescription>
              </div>
              {hasStripeSubscription && <ManageSubscription />}
            </div>
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
                    {hasStripeSubscription && !isTrialActive && (
                      <Badge variant="default" className="text-xs flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Ativo
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
        <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto items-start">
          {(['free', 'pro'] as PlanType[]).map(plan => (
            <PlanCard
              key={plan}
              plan={plan}
              isCurrentPlan={currentPlan === plan && !isTrialActive}
              isTrialActive={isTrialActive}
              onSelect={handleSelectPlan}
              isLoading={loadingPlan === plan}
              hasStripeSubscription={hasStripeSubscription}
            />
          ))}
        </div>

        {/* FAQ or additional info */}
        <div className="max-w-2xl mx-auto text-center text-sm text-muted-foreground">
          <p>
            Plano Free não requer cartão de crédito. 
            O plano Pro requer cadastro de cartão para cobrança mensal.
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
