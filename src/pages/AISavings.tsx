import { DashboardLayout } from "@/components/DashboardLayout";
import { AISavingsComparison } from "@/components/AISavingsComparison";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AISavings = () => {
  const { currentPlan, isTrialActive } = useSubscription();
  const navigate = useNavigate();
  const isPro = currentPlan === 'pro' && !isTrialActive;

  // Redirect free/trial users to pricing
  useEffect(() => {
    if (!isPro) {
      // Don't redirect, show upgrade prompt instead
    }
  }, [isPro]);

  if (!isPro) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Economia com IA
            </h1>
          </div>

          <Card className="border-dashed border-2">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-xl">Recurso exclusivo do plano PRO</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Visualize quanto você está economizando com a IA monitorando e otimizando seus clusters automaticamente.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✓ Análise detalhada de economia por incidente</li>
                <li>✓ Comparação de custos com e sem IA</li>
                <li>✓ Histórico completo de ações automatizadas</li>
                <li>✓ Métricas de downtime evitado</li>
              </ul>
              <Button onClick={() => navigate('/pricing')} className="mt-4">
                <Sparkles className="w-4 h-4 mr-2" />
                Fazer Upgrade para PRO
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Economia com IA
          </h1>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
          <AISavingsComparison />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AISavings;
