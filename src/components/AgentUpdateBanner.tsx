import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowUpCircle, Copy, X, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { toast } from "sonner";

interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_notes: string | null;
}

export function AgentUpdateBanner() {
  const { selectedClusterId } = useCluster();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showCommand, setShowCommand] = useState(false);

  useEffect(() => {
    if (selectedClusterId) {
      checkForUpdates();
    }
  }, [selectedClusterId]);

  const checkForUpdates = async () => {
    if (!selectedClusterId) return;

    try {
      // Get cluster's current agent version
      const { data: clusterData, error: clusterError } = await supabase
        .from('clusters')
        .select('agent_version, agent_update_available, agent_update_message')
        .eq('id', selectedClusterId)
        .single();

      if (clusterError || !clusterData) {
        console.log('Could not get cluster agent version');
        return;
      }

      // Get latest available version
      const { data: latestVersion } = await supabase
        .from('agent_versions')
        .select('version, release_notes')
        .eq('is_latest', true)
        .single();

      if (!latestVersion) {
        console.log('No latest version found');
        return;
      }

      const currentVersion = clusterData.agent_version || 'unknown';
      
      // Compare versions
      const compareVersions = (v1: string, v2: string): number => {
        if (!v1 || !v2 || v1 === 'unknown' || v2 === 'unknown') return -1;
        const normalize = (v: string) => v.replace(/^v/, '').split('.').map(Number);
        const [major1, minor1, patch1] = normalize(v1);
        const [major2, minor2, patch2] = normalize(v2);
        if (major1 !== major2) return major1 - major2;
        if (minor1 !== minor2) return minor1 - minor2;
        return patch1 - patch2;
      };

      const needsUpdate = currentVersion !== 'unknown' && 
        compareVersions(currentVersion, latestVersion.version) < 0;

      setUpdateInfo({
        current_version: currentVersion,
        latest_version: latestVersion.version,
        update_available: needsUpdate,
        release_notes: needsUpdate ? latestVersion.release_notes : null
      });
    } catch (error) {
      console.error('Error checking for agent updates:', error);
    }
  };

  const updateCommand = 'kubectl set image deployment/kodo-agent agent=ghcr.io/kubenetworks-group/kodo-agent:latest -n kodo';

  const copyCommand = () => {
    navigator.clipboard.writeText(updateCommand);
    toast.success('Comando copiado para a área de transferência!');
  };

  if (!updateInfo?.update_available || dismissed) return null;

  return (
    <Alert className="mb-4 border-blue-500/50 bg-blue-500/10 relative pr-10">
      <ArrowUpCircle className="h-4 w-4 text-blue-500 hidden sm:block" />
      <AlertTitle className="text-blue-400 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm sm:text-base">
        <span className="flex items-center gap-2">
          <ArrowUpCircle className="h-4 w-4 text-blue-500 sm:hidden" />
          Atualização Disponível
        </span>
        <span className="text-xs font-mono bg-blue-500/20 px-2 py-0.5 rounded w-fit">
          {updateInfo.current_version} → {updateInfo.latest_version}
        </span>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Uma nova versão do agente Kodo está disponível.
        </p>
        
        {showCommand ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Terminal className="h-3 w-3 flex-shrink-0" />
              <span>Execute no seu cluster:</span>
            </div>
            <div className="relative bg-muted/50 rounded-md">
              <pre className="text-[10px] sm:text-xs p-2 sm:p-3 font-mono overflow-x-auto pr-10 whitespace-pre-wrap break-all sm:whitespace-pre sm:break-normal">
                {updateCommand}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 sm:h-7 sm:w-7 hover:bg-blue-500/20"
                onClick={copyCommand}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="border-blue-500/50 hover:bg-blue-500/20 text-xs sm:text-sm h-8 sm:h-9"
            onClick={() => setShowCommand(true)}
          >
            <Terminal className="h-3 w-3 mr-2" />
            Ver Comando
          </Button>
        )}
      </AlertDescription>
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 hover:bg-blue-500/20"
        onClick={() => setDismissed(true)}
      >
        <X className="h-3 w-3" />
      </Button>
    </Alert>
  );
}
