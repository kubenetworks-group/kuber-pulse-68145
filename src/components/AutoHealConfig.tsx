import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAutoHeal } from "@/hooks/useAutoHeal";
import { useCluster } from "@/contexts/ClusterContext";
import { Bot, Shield, Activity, Zap, RefreshCw, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AutoHealConfig() {
  const { selectedClusterId } = useCluster();
  const {
    settings,
    loading,
    saving,
    toggleAutoHeal,
    toggleSecurityAutoFix,
    toggleAnomaliesAutoFix,
    updateSeverityThreshold,
    updateScanInterval,
    triggerScanAndHeal,
  } = useAutoHeal();

  if (!selectedClusterId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione um cluster para configurar a Auto-Cura</p>
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
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isEnabled = settings?.enabled ?? false;

  return (
    <Card className={isEnabled ? "border-primary/50 bg-primary/5" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isEnabled ? "bg-primary/20" : "bg-muted"}`}>
              <Bot className={`h-5 w-5 ${isEnabled ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Auto-Cura Inteligente
                {isEnabled && (
                  <Badge variant="default" className="bg-green-500">
                    <Zap className="h-3 w-3 mr-1" />
                    Ativo
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                A IA monitora e corrige problemas automaticamente em tempo real
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={toggleAutoHeal}
            disabled={saving}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main toggle section */}
        <div className={`space-y-4 ${!isEnabled ? "opacity-50 pointer-events-none" : ""}`}>
          {/* Resources Auto-Fix */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-500" />
              <div>
                <Label className="font-medium">Ajuste de Recursos</Label>
                <p className="text-sm text-muted-foreground">
                  Ajustar limites de CPU e memoria de pods/containers automaticamente
                </p>
              </div>
            </div>
            <Switch
              checked={settings?.auto_apply_security ?? false}
              onCheckedChange={toggleSecurityAutoFix}
              disabled={saving || !isEnabled}
            />
          </div>

          {/* Anomalies Auto-Fix */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-orange-500" />
              <div>
                <Label className="font-medium">Correcoes de Pods e Jobs</Label>
                <p className="text-sm text-muted-foreground">
                  Reiniciar pods com falhas, containers com restarts e jobs com erro
                </p>
              </div>
            </div>
            <Switch
              checked={settings?.auto_apply_anomalies ?? false}
              onCheckedChange={toggleAnomaliesAutoFix}
              disabled={saving || !isEnabled}
            />
          </div>

          {/* Severity Threshold */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-purple-500" />
              <div>
                <Label className="font-medium">Nível Mínimo de Severidade</Label>
                <p className="text-sm text-muted-foreground">
                  Só agir automaticamente em problemas com severidade igual ou maior
                </p>
              </div>
            </div>
            <Select
              value={settings?.severity_threshold ?? 'high'}
              onValueChange={(value: any) => updateSeverityThreshold(value)}
              disabled={saving || !isEnabled}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixo</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scan Interval */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-green-500" />
              <div>
                <Label className="font-medium">Intervalo de Análise</Label>
                <p className="text-sm text-muted-foreground">
                  Frequência de varredura automática do cluster
                </p>
              </div>
            </div>
            <Select
              value={String(settings?.scan_interval_minutes ?? 5)}
              onValueChange={(value) => updateScanInterval(parseInt(value))}
              disabled={saving || !isEnabled}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 minuto</SelectItem>
                <SelectItem value="5">5 minutos</SelectItem>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Manual trigger button */}
        <Button
          onClick={triggerScanAndHeal}
          disabled={saving}
          className="w-full"
          variant={isEnabled ? "default" : "outline"}
        >
          <Zap className="h-4 w-4 mr-2" />
          Executar Análise e Correção Agora
        </Button>

        {/* Status info */}
        {isEnabled && (
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Próxima análise automática em{" "}
              <span className="font-medium text-foreground">
                {settings?.scan_interval_minutes ?? 5} minutos
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
