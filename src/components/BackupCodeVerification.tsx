import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import kodoLogo from "@/assets/kodo-logo.png";

interface BackupCodeVerificationProps {
  onVerified: () => void;
  onCancel: () => void;
  onBackToMFA: () => void;
}

// Simple hash function for backup codes (client-side)
const hashCode = async (code: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const BackupCodeVerification = ({ onVerified, onCancel, onBackToMFA }: BackupCodeVerificationProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code || code.length < 8) {
      setError("Digite um código de backup válido");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Normalize code (uppercase, remove dashes)
      const normalizedCode = code.toUpperCase().replace(/-/g, '');
      const fullCode = normalizedCode.length === 8 
        ? `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}` 
        : code.toUpperCase();
      
      const codeHash = await hashCode(fullCode);

      // Find matching unused backup code
      const { data: backupCodes, error: fetchError } = await supabase
        .from('mfa_backup_codes')
        .select('id, code_hash')
        .eq('user_id', user.id)
        .eq('used', false);

      if (fetchError) throw fetchError;

      const matchingCode = backupCodes?.find(bc => bc.code_hash === codeHash);

      if (!matchingCode) {
        setError("Código inválido ou já utilizado");
        setLoading(false);
        return;
      }

      // Mark code as used
      const { error: updateError } = await supabase
        .from('mfa_backup_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', matchingCode.id);

      if (updateError) throw updateError;

      // Unenroll MFA factor to allow re-enrollment
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      if (factorsData?.totp?.[0]) {
        await supabase.auth.mfa.unenroll({ factorId: factorsData.totp[0].id });
      }

      onVerified();
    } catch (err: any) {
      console.error('Backup code verification error:', err);
      setError(err.message || "Erro ao verificar código");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  const formatCode = (value: string) => {
    // Remove non-alphanumeric characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Add dash after 4 characters
    if (cleaned.length > 4) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
    }
    return cleaned;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <img src={kodoLogo} alt="Kodo" className="h-12 w-auto" />
        </div>
        
        <Card className="border-border/50 bg-card/95 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Key className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Usar Código de Backup</CardTitle>
            <CardDescription>
              Digite um dos seus códigos de backup para recuperar o acesso à sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="backup-code">Código de Backup</Label>
              <Input
                id="backup-code"
                type="text"
                placeholder="XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                onKeyDown={handleKeyDown}
                maxLength={9}
                className="text-center text-xl tracking-widest font-mono uppercase"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground text-center">
                Este código será invalidado após o uso
              </p>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={handleVerify} 
                disabled={loading || code.length < 8}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Verificar e Entrar'
                )}
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={onBackToMFA}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Usar código do app
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={onCancel}
                className="w-full text-muted-foreground"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
