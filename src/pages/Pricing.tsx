import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Pricing() {
  const { currentPlan, isTrialing } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const plans = [
    {
      slug: "starter",
      name: "Starter",
      description: "Ideal para startups",
      price: 497,
      features: [
        "1 cluster Kubernetes",
        "Análises IA ilimitadas",
        "Auto-healing básico",
        "Relatórios semanais",
        "Otimização de custos",
        "Suporte por email (48h)",
      ],
    },
    {
      slug: "growth",
      name: "Growth",
      description: "Para empresas em crescimento",
      price: 997,
      badge: "MAIS POPULAR",
      features: [
        "3 clusters Kubernetes",
        "Tudo do Starter",
        "Auto-healing avançado",
        "Relatórios diários",
        "Alertas customizados",
        "Acesso à API",
        "Suporte por email (24h)",
      ],
    },
    {
      slug: "enterprise",
      name: "Enterprise",
      description: "Para grandes operações",
      price: 2997,
      badge: "FULL POWER",
      features: [
        "Clusters ilimitados",
        "Tudo do Growth",
        "Relatórios em tempo real",
        "White-label",
        "SSO (Single Sign-On)",
        "SLA com uptime 99.9%",
        "Suporte telefônico (1h)",
        "Integrações customizadas",
      ],
    },
  ];

  const handleSubscribe = async (planSlug: string) => {
    try {
      setLoading(planSlug);

      // Get organization
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!org) {
        toast.error("Organização não encontrada");
        return;
      }

      // Call create-checkout-session
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan_slug: planSlug, organization_id: org.id },
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error("Erro ao criar sessão de checkout");
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Erro ao processar pagamento");
    } finally {
      setLoading(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Escolha o plano ideal para sua empresa</h1>
          <p className="text-xl text-muted-foreground">
            {isTrialing ? "Você está em trial. Escolha um plano para continuar após o período de teste." : "Trial grátis de 30 dias - Sem cartão de crédito"}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <Card key={plan.slug} className={plan.slug === 'growth' ? 'border-primary shadow-lg' : ''}>
              <CardHeader>
                {plan.badge && (
                  <Badge className="w-fit mb-2">{plan.badge}</Badge>
                )}
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">R$ {plan.price}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={currentPlan === plan.slug ? "outline" : "default"}
                  disabled={currentPlan === plan.slug || loading === plan.slug}
                  onClick={() => handleSubscribe(plan.slug)}
                >
                  {loading === plan.slug ? "Processando..." : currentPlan === plan.slug ? "Plano Atual" : "Assinar Agora"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="bg-card rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Perguntas Frequentes</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Como funciona o trial?</h3>
              <p className="text-muted-foreground">
                Você tem 30 dias para testar todas as funcionalidades do plano Starter sem compromisso.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Posso cancelar a qualquer momento?</h3>
              <p className="text-muted-foreground">
                Sim! Você pode cancelar sua assinatura a qualquer momento sem taxas de cancelamento.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Como funcionam os upgrades?</h3>
              <p className="text-muted-foreground">
                Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. O valor será ajustado proporcionalmente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
