import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowUpCircle, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { toast } from "sonner";

interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  is_required: boolean;
  release_notes: string | null;
  release_type: 'major' | 'minor' | 'patch' | 'hotfix' | null;
}

export function AgentUpdateButton() {
  const { selectedClusterId } = useCluster();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedClusterId) {
      checkForUpdates();
    }
  }, [selectedClusterId]);

  const checkForUpdates = async () => {
    if (!selectedClusterId) return;

    setLoading(true);
    try {
      // Get API key for this cluster to check update
      const { data: apiKey } = await supabase
        .from('agent_api_keys')
        .select('api_key')
        .eq('cluster_id', selectedClusterId)
        .eq('is_active', true)
        .single();

      if (!apiKey) {
        setLoading(false);
        return;
      }

      // Call edge function to check update
      const { data, error } = await supabase.functions.invoke('agent-check-update', {
        headers: {
          'x-agent-key': apiKey.api_key,
          'x-agent-version': 'v0.0.1', // This would come from actual agent
        }
      });

      if (error) throw error;

      setUpdateInfo(data);
    } catch (error) {
      console.error('Error checking for agent updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerUpdate = async () => {
    if (!selectedClusterId || !updateInfo) return;

    setIsUpdating(true);
    try {
      const { data: cluster } = await supabase
        .from('clusters')
        .select('user_id')
        .eq('id', selectedClusterId)
        .single();

      if (!cluster) throw new Error('Cluster not found');

      const { error: commandError } = await supabase
        .from('agent_commands')
        .insert({
          cluster_id: selectedClusterId,
          user_id: cluster.user_id,
          command_type: 'self_update',
          command_params: {
            new_image: `ghcr.io/kubenetworks-group/kodo-agent:${updateInfo.latest_version}`,
            namespace: 'kodo',
            deployment_name: 'kodo-agent',
          },
          status: 'pending',
        });

      if (commandError) throw commandError;

      await supabase
        .from('auto_heal_actions_log')
        .insert({
          cluster_id: selectedClusterId,
          user_id: cluster.user_id,
          action_type: 'agent_update',
          trigger_reason: `Updating agent from ${updateInfo.current_version} to ${updateInfo.latest_version}`,
          action_details: {
            current_version: updateInfo.current_version,
            target_version: updateInfo.latest_version,
            release_type: updateInfo.release_type,
          },
          status: 'pending',
        });

      toast.success('Comando de atualização enviado', {
        description: 'O agente será atualizado em alguns segundos.',
      });

      setShowDialog(false);
      setUpdateInfo(null);

      setTimeout(() => {
        checkForUpdates();
      }, 10000);

    } catch (error: any) {
      console.error('Error triggering agent update:', error);
      toast.error('Erro ao atualizar agente', {
        description: error.message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading || !updateInfo?.update_available) return null;

  const releaseTypeColors: Record<string, string> = {
    major: 'bg-red-500',
    minor: 'bg-blue-500',
    patch: 'bg-green-500',
    hotfix: 'bg-orange-500',
  };

  const releaseTypeLabels: Record<string, string> = {
    major: 'Major',
    minor: 'Minor',
    patch: 'Patch',
    hotfix: 'Hotfix',
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20"
              onClick={() => setShowDialog(true)}
            >
              <ArrowUpCircle className="h-5 w-5 text-blue-500" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Atualização do agente disponível: {updateInfo.latest_version}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-blue-500" />
              Atualizar Agente do Cluster
            </DialogTitle>
            <DialogDescription>
              Uma nova versão do agente está disponível com melhorias e correções.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Informações da Versão</span>
                  {updateInfo.release_type && (
                    <Badge className={releaseTypeColors[updateInfo.release_type]}>
                      {releaseTypeLabels[updateInfo.release_type]}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Versão Atual:</span>
                  <span className="font-mono">{updateInfo.current_version}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nova Versão:</span>
                  <span className="font-mono text-blue-400">{updateInfo.latest_version}</span>
                </div>
              </CardContent>
            </Card>

            {updateInfo.release_notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Notas de Lançamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                    {updateInfo.release_notes}
                  </pre>
                </CardContent>
              </Card>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                O agente será reiniciado durante a atualização. Isso pode causar uma breve
                interrupção na coleta de métricas (aproximadamente 30 segundos).
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={triggerUpdate} disabled={isUpdating} className="gap-2">
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Confirmar Atualização
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
