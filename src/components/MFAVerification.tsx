import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import kodoLogo from "@/assets/kodo-logo.png";
import { AnimatedParticles } from "@/components/AnimatedParticles";

interface MFAVerificationProps {
  onVerified: () => void;
  onCancel: () => void;
  onUseBackupCode?: () => void;
}

export const MFAVerification = ({ onVerified, onCancel, onUseBackupCode }: MFAVerificationProps) => {
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setError("Digite um código de 6 dígitos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // List factors to get the TOTP factor
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) throw factorsError;

      const totpFactor = factorsData.totp.find(f => f.status === 'verified');
      
      if (!totpFactor) {
        throw new Error("Nenhum fator de autenticação encontrado");
      }

      // Challenge the factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      onVerified();
    } catch (err: any) {
      setError(err.message || "Código inválido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  return (
    <div className="min-h-screen relative bg-background flex items-center justify-center p-4 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <AnimatedParticles />
      
      {/* Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      
      <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Header */}
        <div className="text-center space-y-6">
          <div className="inline-flex relative group">
            <div className="absolute inset-0 bg-gradient-primary rounded-full blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
            <img 
              src={kodoLogo} 
              alt="Kodo Logo" 
              className="w-20 h-20 object-contain relative z-10 drop-shadow-2xl"
            />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Verificação 2FA
              </span>
            </h1>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Shield className="w-4 h-4" />
              <p className="text-sm">Autenticação de Dois Fatores</p>
            </div>
          </div>
        </div>

        {/* Verification Card */}
        <Card className="p-6 bg-card/50 backdrop-blur-2xl border-border/50 shadow-2xl">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Digite o código de 6 dígitos do seu aplicativo autenticador
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mfa-code" className="sr-only">Código de verificação</Label>
              <Input
                id="mfa-code"
                type="text"
                placeholder="000000"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleKeyDown}
                className="text-center text-3xl tracking-[0.5em] font-mono h-14 bg-background/50"
                autoFocus
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Button 
                className="w-full bg-gradient-primary hover:opacity-90 h-12"
                onClick={handleVerify}
                disabled={loading || verifyCode.length !== 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar"
                )}
              </Button>
              
              {onUseBackupCode && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={onUseBackupCode}
                  disabled={loading}
                >
                  Usar código de backup
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={onCancel}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Abra seu aplicativo autenticador (Google Authenticator, Authy, etc.) para obter o código.
        </p>
      </div>
    </div>
  );
};
