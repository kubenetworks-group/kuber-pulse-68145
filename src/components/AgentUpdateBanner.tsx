import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpCircle, RefreshCw, CheckCircle, AlertTriangle, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { toast } from "sonner";

interface AgentVersion {
  version: string;
  release_notes: string;
  release_type: 'major' | 'minor' | 'patch' | 'hotfix';
  is_required: boolean;
}

export function AgentUpdateBanner() {
  const { selectedClusterId } = useCluster();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<AgentVersion | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (selectedClusterId) {
      checkForUpdates();
    }
  }, [selectedClusterId]);

  const checkForUpdates = async () => {
    if (!selectedClusterId) return;

    try {
      // Get cluster info
      const { data: cluster, error: clusterError } = await supabase
        .from('clusters')
        .select('agent_version, agent_update_available, agent_update_message')
        .eq('id', selectedClusterId)
        .single();

      if (clusterError) throw clusterError;

      setCurrentVersion(cluster.agent_version);
      setUpdateAvailable(cluster.agent_update_available || false);
      setReleaseNotes(cluster.agent_update_message);

      // Get latest version info
      const { data: latestVersionData } = await supabase
        .from('agent_versions')
        .select('*')
        .eq('is_latest', true)
        .single();

      if (latestVersionData) {
        setLatestVersion(latestVersionData as AgentVersion);
      }
    } catch (error) {
      console.error('Error checking for agent updates:', error);
    }
  };

  const triggerUpdate = async () => {
    if (!selectedClusterId) return;

    setIsUpdating(true);
    try {
      // Get cluster user_id
      const { data: cluster } = await supabase
        .from('clusters')
        .select('user_id')
        .eq('id', selectedClusterId)
        .single();

      if (!cluster) throw new Error('Cluster not found');

      // Create command to update agent
      const { error: commandError } = await supabase
        .from('agent_commands')
        .insert({
          cluster_id: selectedClusterId,
          user_id: cluster.user_id,
          command_type: 'self_update',
          command_params: {
            new_image: latestVersion ? `ghcr.io/kubenetworks-group/kodo-agent:${latestVersion.version}` : null,
            namespace: 'kodo',
            deployment_name: 'kodo-agent',
          },
          status: 'pending',
        });

      if (commandError) throw commandError;

      // Log the action
      await supabase
        .from('auto_heal_actions_log')
        .insert({
          cluster_id: selectedClusterId,
          user_id: cluster.user_id,
          action_type: 'agent_update',
          trigger_reason: `Updating agent from ${currentVersion} to ${latestVersion?.version}`,
          action_details: {
            current_version: currentVersion,
            target_version: latestVersion?.version,
            release_type: latestVersion?.release_type,
          },
          status: 'pending',
        });

      toast.success('Comando de atualização enviado', {
        description: 'O agente será atualizado em alguns segundos. A página será atualizada automaticamente.',
      });

      setShowDialog(false);

      // Clear update available flag
      await supabase
        .from('clusters')
        .update({
          agent_update_available: false,
          agent_update_message: null,
        })
        .eq('id', selectedClusterId);

      setUpdateAvailable(false);

      // Refresh the page after a delay to show new version
      setTimeout(() => {
        window.location.reload();
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

  if (!updateAvailable || dismissed || !currentVersion) return null;

  const releaseTypeColors = {
    major: 'bg-red-500',
    minor: 'bg-blue-500',
    patch: 'bg-green-500',
    hotfix: 'bg-orange-500',
  };

  const releaseTypeLabels = {
    major: 'Major',
    minor: 'Minor',
    patch: 'Patch',
    hotfix: 'Hotfix',
  };

  return (
    <>
      <Alert className="border-blue-500/50 bg-gradient-to-r from-blue-500/10 to-purple-500/10 mb-4">
        <ArrowUpCircle className="h-5 w-5 text-blue-500" />
        <AlertTitle className="flex items-center gap-2">
          Atualização do Agente Disponível
          {latestVersion && (
            <Badge className={releaseTypeColors[latestVersion.release_type]}>
              {releaseTypeLabels[latestVersion.release_type]}
            </Badge>
          )}
          {latestVersion?.is_required && (
            <Badge variant="destructive">Obrigatória</Badge>
          )}
        </AlertTitle>
        <AlertDescription className="mt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm">
                Versão atual: <span className="font-mono font-bold">{currentVersion}</span>
                {' '}&rarr;{' '}
                Nova versão: <span className="font-mono font-bold text-blue-400">{latestVersion?.version}</span>
              </p>
              {releaseNotes && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {releaseNotes.split('\n')[0]}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDialog(true)}
              >
                Ver Detalhes
              </Button>
              <Button
                size="sm"
                onClick={() => setShowDialog(true)}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar Agora
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-blue-500" />
              Atualizar Agente do Cluster
            </DialogTitle>
            <DialogDescription>
              Uma nova versão do agente está disponível com melhorias e correções de bugs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Informações da Versão</span>
                  {latestVersion && (
                    <Badge className={releaseTypeColors[latestVersion.release_type]}>
                      {releaseTypeLabels[latestVersion.release_type]}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Versão Atual:</span>
                  <span className="font-mono">{currentVersion}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nova Versão:</span>
                  <span className="font-mono text-blue-400">{latestVersion?.version}</span>
                </div>
              </CardContent>
            </Card>

            {releaseNotes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Notas de Lançamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                    {releaseNotes}
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
