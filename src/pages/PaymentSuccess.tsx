import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Simple celebration without confetti for now
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Assinatura ativada com sucesso!</CardTitle>
          <CardDescription>
            Sua assinatura foi processada e está ativa. Aproveite todos os recursos do Kodo!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">ID da Sessão:</p>
            <p className="text-xs font-mono">{sessionId}</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate('/')} className="w-full">
              Ir para Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate('/settings/billing')} className="w-full">
              Ver Detalhes da Assinatura
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
