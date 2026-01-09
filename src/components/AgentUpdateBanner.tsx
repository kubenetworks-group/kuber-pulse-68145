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
      const { data: apiKey } = await supabase
        .from('agent_api_keys')
        .select('api_key')
        .eq('cluster_id', selectedClusterId)
        .eq('is_active', true)
        .single();

      if (!apiKey) return;

      const { data, error } = await supabase.functions.invoke('agent-check-update', {
        headers: {
          'x-agent-key': apiKey.api_key,
          'x-agent-version': 'v0.0.1',
        }
      });

      if (error) throw error;
      setUpdateInfo(data);
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
    <Alert className="mb-4 border-blue-500/50 bg-blue-500/10 relative">
      <ArrowUpCircle className="h-4 w-4 text-blue-500" />
      <AlertTitle className="text-blue-400 flex items-center gap-2">
        Atualização do Agente Disponível
        <span className="text-xs font-mono bg-blue-500/20 px-2 py-0.5 rounded">
          {updateInfo.current_version} → {updateInfo.latest_version}
        </span>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm text-muted-foreground">
          Uma nova versão do agente Kodo está disponível. Atualize para obter as últimas melhorias e correções.
        </p>
        
        {showCommand ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Terminal className="h-3 w-3" />
              Execute o comando abaixo no seu cluster:
            </div>
            <div className="relative bg-muted/50 rounded-md">
              <pre className="text-xs p-3 font-mono overflow-x-auto pr-12">
                {updateCommand}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7 hover:bg-blue-500/20"
                onClick={copyCommand}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Isso irá reiniciar o deployment do agente e baixar a imagem mais recente automaticamente.
            </p>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="border-blue-500/50 hover:bg-blue-500/20"
            onClick={() => setShowCommand(true)}
          >
            <Terminal className="h-3 w-3 mr-2" />
            Ver Comando de Atualização
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
