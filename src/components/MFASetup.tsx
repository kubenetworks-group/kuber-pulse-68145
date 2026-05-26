import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, ShieldOff, Loader2, Copy, CheckCircle2, AlertTriangle, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditLog } from "@/hooks/useAuditLog";
import { BackupCodesDisplay } from "@/components/BackupCodesDisplay";

interface MFAFactor {
  id: string;
  friendly_name: string;
  factor_type: string;
  status: string;
  created_at: string;
}

// Google Authenticator SVG logo
const GoogleAuthenticatorIcon = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="12" fill="#4285F4"/>
    <rect width="48" height="48" rx="12" fill="url(#ga-grad)"/>
    <defs>
      <linearGradient id="ga-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285F4"/>
        <stop offset="1" stopColor="#1A73E8"/>
      </linearGradient>
    </defs>
    {/* Shield body */}
    <path d="M24 8L12 13V23C12 30.18 17.2 36.9 24 39C30.8 36.9 36 30.18 36 23V13L24 8Z" fill="white" fillOpacity="0.95"/>
    {/* Checkmark */}
    <path d="M20 24l3 3 6-6" stroke="#4285F4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const MFASetup = () => {
  const { logAuditEvent } = useAuditLog();
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);

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
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;
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
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factors[0].id });
      if (error) throw error;
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 2FA Card */}
      <div
        className="rounded-2xl border p-6"
        style={{
          background: isMFAEnabled
            ? 'linear-gradient(135deg, rgba(15,60,165,0.04) 0%, rgba(15,60,165,0.08) 100%)'
            : 'white',
          borderColor: isMFAEnabled ? 'rgba(15,60,165,0.2)' : 'rgba(0,0,0,0.07)',
        }}
      >
        <div className="flex items-start gap-5">
          {/* Status icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: isMFAEnabled ? 'rgba(15,60,165,0.12)' : 'rgba(0,0,0,0.05)',
            }}
          >
            {isMFAEnabled
              ? <ShieldCheck className="h-6 w-6" style={{ color: '#0F3CA5' }} />
              : <Shield className="h-6 w-6 text-slate-400" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-base font-semibold text-slate-900">
                Autenticação de Dois Fatores (2FA)
              </h3>
              <Badge
                style={isMFAEnabled
                  ? { background: '#0F3CA5', color: 'white', border: 'none' }
                  : { background: '#f1f5f9', color: '#64748b', border: 'none' }
                }
              >
                {isMFAEnabled ? "Ativado" : "Desativado"}
              </Badge>
            </div>

            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
              {isMFAEnabled
                ? "Sua conta está protegida. A cada login você precisará confirmar sua identidade no aplicativo autenticador."
                : "Adicione uma camada extra de segurança. A cada login você precisará confirmar sua identidade pelo aplicativo autenticador."
              }
            </p>

            {isMFAEnabled ? (
              /* Enabled state — show authenticator info + disable button */
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <GoogleAuthenticatorIcon size={36} />
                  <div>
                    <div className="text-sm font-medium text-slate-800">Google Authenticator</div>
                    <div className="text-xs text-slate-400">Aplicativo autenticador ativo</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisableDialogOpen(true)}
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Desativar 2FA
                </Button>
              </div>
            ) : (
              /* Disabled state — activation button with Google Auth logo */
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium uppercase tracking-wider"
                  style={{ fontFamily: "'DM Mono', monospace" }}>
                  Aplicativos suportados
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50">
                    <GoogleAuthenticatorIcon size={22} />
                    <span className="text-sm text-slate-700 font-medium">Google Authenticator</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50">
                    <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
                      <rect width="48" height="48" rx="12" fill="#E8403A"/>
                      <circle cx="24" cy="24" r="14" fill="white" fillOpacity="0.15"/>
                      <path d="M24 10C16.268 10 10 16.268 10 24s6.268 14 14 14 14-6.268 14-14S31.732 10 24 10zm0 4a10 10 0 110 20 10 10 0 010-20z" fill="white"/>
                      <circle cx="24" cy="24" r="5" fill="white"/>
                    </svg>
                    <span className="text-sm text-slate-700 font-medium">Authy</span>
                  </div>
                </div>

                <Button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="flex items-center gap-2.5 h-11 px-5 text-white font-semibold rounded-xl shadow-sm"
                  style={{ background: '#0F3CA5' }}
                >
                  {enrolling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Configurando...
                    </>
                  ) : (
                    <>
                      <GoogleAuthenticatorIcon size={20} />
                      Ativar com Google Authenticator
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backup Codes */}
      <BackupCodesDisplay isMFAEnabled={isMFAEnabled} />

      {/* Enrollment Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <GoogleAuthenticatorIcon size={24} />
              Configurar Google Authenticator
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR code com o Google Authenticator e confirme o código gerado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Steps */}
            <div className="space-y-2">
              {[
                "Abra o Google Authenticator no seu celular",
                "Toque em \"+\" e escolha \"Escanear QR code\"",
                "Escaneie o código abaixo",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                    style={{ background: '#0F3CA5' }}
                  >
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>

            {/* QR Code */}
            {qrCode && (
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <img src={qrCode} alt="QR Code para 2FA" className="w-48 h-48" />
                </div>
              </div>
            )}

            {/* Secret Key */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500" style={{ fontFamily: "'DM Mono', monospace" }}>
                Ou adicione manualmente:
              </Label>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs break-all text-slate-700">
                  {secret}
                </code>
                <Button variant="outline" size="icon" onClick={copySecret} className="flex-shrink-0">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Verification code */}
            <div className="space-y-2">
              <Label htmlFor="verify-code" className="text-sm font-medium">
                Código do aplicativo
              </Label>
              <Input
                id="verify-code"
                type="text"
                placeholder="000 000"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-[0.4em] font-mono h-12"
                autoComplete="one-time-code"
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
            <Button
              onClick={handleVerifyEnrollment}
              disabled={verifying || verifyCode.length !== 6}
              style={{ background: '#0F3CA5', color: 'white' }}
            >
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
            <DialogTitle className="flex items-center gap-2 text-red-600">
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
    </div>
  );
};
