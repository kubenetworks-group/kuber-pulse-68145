import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditLog } from "@/hooks/useAuditLog";

interface MFAFactor {
  id: string;
  friendly_name: string;
  factor_type: string;
  status: string;
  created_at: string;
}

export const MFASetup = () => {
  const { logAuditEvent } = useAuditLog();
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  
  // Enrollment state
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchFactors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      // Get verified TOTP factors
      const verifiedFactors = data.totp.filter(f => f.status === 'verified');
      setFactors(verifiedFactors as MFAFactor[]);
    } catch (err: any) {
      console.error('Error fetching MFA factors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFactors();
  }, []);

  const handleEnroll = async () => {
    setEnrolling(true);
    setError("");
    
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setEnrollDialogOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar configuração do 2FA");
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setError("Digite um código de 6 dígitos");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      // Challenge the factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      // Log audit event
      await logAuditEvent({
        action: 'settings_changed',
        resourceType: 'user',
        details: { action: 'mfa_enabled', factor_type: 'totp' }
      });

      toast.success("2FA ativado com sucesso!");
      setEnrollDialogOpen(false);
      setVerifyCode("");
      setQrCode("");
      setSecret("");
      fetchFactors();
    } catch (err: any) {
      setError(err.message || "Código inválido. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  const handleUnenroll = async () => {
    if (factors.length === 0) return;

    setUnenrolling(true);
    
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factors[0].id,
      });

      if (error) throw error;

      // Log audit event
      await logAuditEvent({
        action: 'settings_changed',
        resourceType: 'user',
        details: { action: 'mfa_disabled', factor_type: 'totp' }
      });

      toast.success("2FA desativado com sucesso");
      setDisableDialogOpen(false);
      fetchFactors();
    } catch (err: any) {
      toast.error(err.message || "Erro ao desativar 2FA");
    } finally {
      setUnenrolling(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMFAEnabled = factors.length > 0;

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={`p-6 ${isMFAEnabled ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${isMFAEnabled ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
            {isMFAEnabled ? (
              <ShieldCheck className="h-6 w-6 text-green-500" />
            ) : (
              <Shield className="h-6 w-6 text-amber-500" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold">Autenticação de Dois Fatores (2FA)</h3>
              <Badge variant={isMFAEnabled ? "default" : "secondary"} className={isMFAEnabled ? "bg-green-500" : ""}>
                {isMFAEnabled ? "Ativado" : "Desativado"}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4">
              {isMFAEnabled 
                ? "Sua conta está protegida com autenticação de dois fatores usando um aplicativo autenticador."
                : "Adicione uma camada extra de segurança à sua conta usando um aplicativo autenticador como Google Authenticator ou Authy."
              }
            </p>
            
            {isMFAEnabled ? (
              <Button 
                variant="outline" 
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={() => setDisableDialogOpen(true)}
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                Desativar 2FA
              </Button>
            ) : (
              <Button onClick={handleEnroll} disabled={enrolling}>
                {enrolling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Ativar 2FA
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Enrollment Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Configurar 2FA
            </DialogTitle>
            <DialogDescription>
              Use um aplicativo autenticador para escanear o QR code abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* QR Code */}
            {qrCode && (
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  <img src={qrCode} alt="QR Code para 2FA" className="w-48 h-48" />
                </div>
              </div>
            )}

            {/* Secret Key */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">
                Ou digite o código manualmente:
              </Label>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-xs break-all">
                  {secret}
                </code>
                <Button variant="outline" size="icon" onClick={copySecret}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Verify Code */}
            <div className="space-y-2">
              <Label htmlFor="verify-code">Digite o código do app:</Label>
              <Input
                id="verify-code"
                type="text"
                placeholder="000000"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleVerifyEnrollment} disabled={verifying || verifyCode.length !== 6}>
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Verificar e Ativar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation Dialog */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" />
              Desativar 2FA
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desativar a autenticação de dois fatores? Sua conta ficará menos segura.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleUnenroll} disabled={unenrolling}>
              {unenrolling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desativando...
                </>
              ) : (
                "Desativar 2FA"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
