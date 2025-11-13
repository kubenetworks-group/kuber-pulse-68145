import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Clock, AlertTriangle, XCircle } from "lucide-react";

export const TrialBanner = () => {
  const { isTrialing, daysLeftInTrial, trialExpired, isExpired } = useSubscription();
  const navigate = useNavigate();

  if (!isTrialing && !isExpired) return null;

  const getVariant = () => {
    if (trialExpired || isExpired) return "destructive";
    if (daysLeftInTrial <= 5) return "destructive";
    if (daysLeftInTrial <= 10) return "default";
    return "default";
  };

  const getIcon = () => {
    if (trialExpired || isExpired) return <XCircle className="h-4 w-4" />;
    if (daysLeftInTrial <= 5) return <AlertTriangle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const getMessage = () => {
    if (trialExpired || isExpired) {
      return "Trial expirado - Escolha um plano para continuar";
    }
    if (daysLeftInTrial <= 5) {
      return `🚨 Últimos ${daysLeftInTrial} dias de trial!`;
    }
    if (daysLeftInTrial <= 10) {
      return `⚠️ Trial expira em ${daysLeftInTrial} dias - Assine agora`;
    }
    return `🎉 Trial ativo - ${daysLeftInTrial} dias restantes`;
  };

  return (
    <Alert variant={getVariant()} className="mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getIcon()}
          <AlertDescription>{getMessage()}</AlertDescription>
        </div>
        <Button
          size="sm"
          variant={trialExpired || isExpired ? "default" : "outline"}
          onClick={() => navigate('/pricing')}
        >
          Ver Planos
        </Button>
      </div>
    </Alert>
  );
};
