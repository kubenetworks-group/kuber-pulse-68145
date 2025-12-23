import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, Copy, CheckCircle2, Download, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditLog } from "@/hooks/useAuditLog";

interface BackupCodesDisplayProps {
  isMFAEnabled: boolean;
  onCodesGenerated?: () => void;
}

// Simple hash function for backup codes (client-side)
const hashCode = async (code: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Generate random backup code
const generateBackupCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0, O, 1, I
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const BackupCodesDisplay = ({ isMFAEnabled, onCodesGenerated }: BackupCodesDisplayProps) => {
  const { logAuditEvent } = useAuditLog();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [codesCount, setCodesCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const fetchCodesCount = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('mfa_backup_codes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('used', false);

      if (error) throw error;
      setCodesCount(count || 0);
    } catch (err: any) {
      console.error('Error fetching backup codes count:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateCodes = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Delete existing codes
      await supabase
        .from('mfa_backup_codes')
        .delete()
        .eq('user_id', user.id);

      // Generate 10 new codes
      const newCodes: string[] = [];
      const codeEntries = [];

      for (let i = 0; i < 10; i++) {
        const code = generateBackupCode();
        newCodes.push(code);
        const codeHash = await hashCode(code);
        codeEntries.push({
          user_id: user.id,
          code_hash: codeHash,
          code_prefix: code.substring(0, 4),
          used: false
        });
      }

      // Insert new codes
      const { error } = await supabase
        .from('mfa_backup_codes')
        .insert(codeEntries);

      if (error) throw error;

      setCodes(newCodes);
      setCodesCount(10);
      setShowDialog(true);
      setShowRegenerateConfirm(false);

      await logAuditEvent({
        action: 'settings_changed',
        resourceType: 'user',
        details: { action: 'backup_codes_generated', count: 10 }
      });

      toast.success('Códigos de backup gerados com sucesso!');
      onCodesGenerated?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar códigos de backup');
    } finally {
      setGenerating(false);
    }
  };

  const copyAllCodes = () => {
    const codesText = codes.join('\n');
    navigator.clipboard.writeText(codesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Códigos copiados!');
  };

  const downloadCodes = () => {
    const codesText = `Códigos de Backup - Kodo\n${'='.repeat(30)}\n\nGuarde estes códigos em um lugar seguro.\nCada código só pode ser usado uma vez.\n\n${codes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nGerado em: ${new Date().toLocaleString('pt-BR')}`;
    
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kodo-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Arquivo baixado!');
  };

  // Fetch codes count on mount if MFA is enabled
  useState(() => {
    if (isMFAEnabled) {
      fetchCodesCount();
    }
  });

  if (!isMFAEnabled) return null;

  return (
    <>
      <Card className="p-6 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-blue-500/20">
            <Key className="h-6 w-6 text-blue-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold">Códigos de Backup</h3>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : codesCount > 0 ? (
                <span className="text-sm text-muted-foreground">
                  ({codesCount} códigos disponíveis)
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mb-4">
              Códigos de uso único para recuperar acesso à sua conta caso perca o acesso ao aplicativo autenticador.
            </p>
            
            {codesCount === 0 ? (
              <Button onClick={generateCodes} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Gerar Códigos de Backup
                  </>
                )}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowRegenerateConfirm(true)} disabled={generating}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerar Códigos
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Show Generated Codes Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Seus Códigos de Backup
            </DialogTitle>
            <DialogDescription>
              Guarde estes códigos em um lugar seguro. Cada código só pode ser usado uma vez.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/30 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta é a única vez que você verá estes códigos. Salve-os agora!
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-2 py-4">
            {codes.map((code, index) => (
              <div 
                key={index}
                className="px-3 py-2 bg-muted rounded-md font-mono text-sm text-center"
              >
                {code}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={copyAllCodes}>
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </>
              )}
            </Button>
            <Button variant="outline" className="flex-1" onClick={downloadCodes}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowDialog(false)} className="w-full">
              Salvei meus códigos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Regenerar Códigos
            </DialogTitle>
            <DialogDescription>
              Isso irá invalidar todos os códigos de backup existentes. Você precisará salvar os novos códigos.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={generateCodes} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                'Regenerar Códigos'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
