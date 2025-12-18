import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWhatsAppApprovals } from "@/hooks/useWhatsAppApprovals";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAutoHeal } from "@/hooks/useAutoHeal";
import { useCluster } from "@/contexts/ClusterContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Crown, 
  Phone,
  Shield,
  Clock
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function WhatsAppConfig() {
  const { currentPlan } = useSubscription();
  const { selectedClusterId } = useCluster();
  const { settings, saving, updateScanInterval } = useAutoHeal();
  const { profile, loading, verifying, sendVerificationCode, confirmVerification, toggleNotifications } = useWhatsAppApprovals();
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [approvalEnabled, setApprovalEnabled] = useState(false);
  const [approvalTimeout, setApprovalTimeout] = useState("30");

  const isPro = currentPlan === 'pro';

  // Fetch current settings when cluster changes
  useState(() => {
    if (settings) {
      const settingsAny = settings as any;
      setApprovalEnabled(settingsAny.require_whatsapp_approval ?? false);
      setApprovalTimeout(String(settingsAny.approval_timeout_minutes ?? 30));
    }
  });

  const handleSendCode = async () => {
    if (!phoneNumber) {
      toast.error("Digite um número de telefone");
      return;
    }
    const result = await sendVerificationCode(phoneNumber);
    if (result.success) {
      setShowCodeInput(true);
    }
  };

  const handleConfirmCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }
    const result = await confirmVerification(verificationCode);
    if (result.success) {
      setShowCodeInput(false);
      setVerificationCode("");
    }
  };

  const handleToggleApproval = async (enabled: boolean) => {
    if (!selectedClusterId) return;
    
    try {
      const { error } = await supabase
        .from('auto_heal_settings')
        .update({ require_whatsapp_approval: enabled })
        .eq('cluster_id', selectedClusterId);

      if (error) throw error;
      setApprovalEnabled(enabled);
      toast.success(enabled ? 'Aprovação via WhatsApp ativada' : 'Aprovação via WhatsApp desativada');
    } catch (error: any) {
      toast.error('Erro ao atualizar configuração');
    }
  };

  const handleTimeoutChange = async (value: string) => {
    if (!selectedClusterId) return;
    
    try {
      const { error } = await supabase
        .from('auto_heal_settings')
        .update({ approval_timeout_minutes: parseInt(value) })
        .eq('cluster_id', selectedClusterId);

      if (error) throw error;
      setApprovalTimeout(value);
      toast.success('Timeout atualizado');
    } catch (error: any) {
      toast.error('Erro ao atualizar timeout');
    }
  };

  if (!isPro) {
    return (
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Crown className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                WhatsApp Auto-Heal
                <Badge className="bg-amber-500">PRO</Badge>
              </CardTitle>
              <CardDescription>
                Aprove ou rejeite ações de auto-cura diretamente pelo WhatsApp
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm text-muted-foreground">
                Com o plano PRO, você pode:
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Receber alertas de problemas no WhatsApp
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Aprovar correções com uma mensagem
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Definir timeout para aprovações
                </li>
              </ul>
            </div>
            <Button className="w-full" variant="default">
              <Crown className="h-4 w-4 mr-2" />
              Fazer Upgrade para PRO
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isVerified = profile?.whatsapp_verified;

  return (
    <Card className={isVerified ? "border-green-500/30" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isVerified ? "bg-green-500/20" : "bg-muted"}`}>
              <MessageSquare className={`h-5 w-5 ${isVerified ? "text-green-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                WhatsApp Auto-Heal
                <Badge className="bg-amber-500">PRO</Badge>
                {isVerified && (
                  <Badge variant="outline" className="border-green-500 text-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verificado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Receba alertas e aprove correções pelo WhatsApp
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Phone Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Label className="font-medium">Número do WhatsApp</Label>
              {isVerified ? (
                <p className="text-sm text-green-600 font-medium">
                  {profile?.whatsapp_phone}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Configure seu número para receber notificações
                </p>
              )}
            </div>
            {isVerified && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
          </div>

          {!isVerified && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="+55 11 99999-9999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={verifying || showCodeInput}
                />
                <Button 
                  onClick={handleSendCode} 
                  disabled={verifying || !phoneNumber || showCodeInput}
                >
                  {verifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Verificar"
                  )}
                </Button>
              </div>

              {showCodeInput && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Código de 6 dígitos"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    disabled={verifying}
                  />
                  <Button 
                    onClick={handleConfirmCode} 
                    disabled={verifying || verificationCode.length !== 6}
                  >
                    {verifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Confirmar"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings (only visible when verified) */}
        {isVerified && (
          <div className="space-y-4 pt-4 border-t">
            {/* Enable Notifications */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                <div>
                  <Label className="font-medium">Notificações WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">
                    Receber alertas de problemas no cluster
                  </p>
                </div>
              </div>
              <Switch
                checked={profile?.whatsapp_notifications_enabled ?? false}
                onCheckedChange={toggleNotifications}
              />
            </div>

            {/* Require Approval */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-purple-500" />
                <div>
                  <Label className="font-medium">Exigir Aprovação</Label>
                  <p className="text-sm text-muted-foreground">
                    Pedir confirmação antes de executar auto-cura
                  </p>
                </div>
              </div>
              <Switch
                checked={approvalEnabled}
                onCheckedChange={handleToggleApproval}
                disabled={!selectedClusterId || saving}
              />
            </div>

            {/* Approval Timeout */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <Label className="font-medium">Timeout de Aprovação</Label>
                  <p className="text-sm text-muted-foreground">
                    Tempo limite para responder a solicitação
                  </p>
                </div>
              </div>
              <Select
                value={approvalTimeout}
                onValueChange={handleTimeoutChange}
                disabled={!selectedClusterId || saving}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutos</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
