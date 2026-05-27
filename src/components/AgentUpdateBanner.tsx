import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
    if (!selectedClusterId) return;
    checkForUpdates();
    // Reset dismiss when cluster changes so banner re-evaluates
    setDismissed(false);

    // Realtime: re-check when agent_version is updated in DB
    const channel = supabase
      .channel(`agent-update-banner-${selectedClusterId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clusters", filter: `id=eq.${selectedClusterId}` },
        () => {
          setDismissed(false);
          checkForUpdates();
        }
      )
      .subscribe();

    // Polling fallback every 30s
    const poll = setInterval(checkForUpdates, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [selectedClusterId]);

  const checkForUpdates = async () => {
    if (!selectedClusterId) return;

    try {
      // Get cluster's current agent version and last seen time
      const { data: clusterData, error: clusterError } = await supabase
        .from('clusters')
        .select('agent_version, agent_last_seen_at, agent_update_available, agent_update_message')
        .eq('id', selectedClusterId)
        .single();

      if (clusterError || !clusterData) {
        console.log('Could not get cluster agent version');
        return;
      }

      // Don't show update banner if agent has never connected
      if (!clusterData.agent_last_seen_at || !clusterData.agent_version) {
        console.log('Agent has never connected to this cluster');
        setUpdateInfo(null);
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

      const currentVersion = clusterData.agent_version;
      
      // Compare versions
      const compareVersions = (v1: string, v2: string): number => {
        if (!v1 || !v2) return 0;
        const normalize = (v: string) => v.replace(/^v/, '').split('.').map(Number);
        const [major1, minor1, patch1] = normalize(v1);
        const [major2, minor2, patch2] = normalize(v2);
        if (major1 !== major2) return major1 - major2;
        if (minor1 !== minor2) return minor1 - minor2;
        return patch1 - patch2;
      };

      const needsUpdate = compareVersions(currentVersion, latestVersion.version) < 0;

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

  const latestTag = updateInfo?.latest_version
    ? updateInfo.latest_version.startsWith('v') ? updateInfo.latest_version : `v${updateInfo.latest_version}`
    : 'latest';
  const updateCommand = `kubectl set image deployment/kodo-agent agent=ghcr.io/kubenetworks-group/kodo-agent:${latestTag} -n kodo`;

  const copyCommand = () => {
    navigator.clipboard.writeText(updateCommand);
    toast.success('Comando copiado para a área de transferência!');
  };

  if (!updateInfo?.update_available || dismissed) return null;

  return (
    <div
      className="rounded-xl border px-4 py-3 relative"
      style={{
        borderColor: "#0F3CA530",
        borderLeftColor: "#0F3CA5",
        borderLeftWidth: "3px",
        background: "#0F3CA508",
      }}
    >
      <button
        className="absolute top-2.5 right-2.5 h-6 w-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
        onClick={() => setDismissed(true)}
        aria-label="Dispensar"
      >
        <X className="h-3 w-3 text-muted-foreground/60" />
      </button>

      <div className="flex items-start gap-2.5 pr-8">
        <ArrowUpCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#0F3CA5" }} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-mono font-semibold" style={{ color: "#0F3CA5" }}>
              Atualização Disponível
            </span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
              style={{ color: "#0F3CA5", borderColor: "#0F3CA530", background: "#0F3CA510" }}
            >
              {updateInfo.current_version} → {updateInfo.latest_version}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">
            Nova versão do agente Kodo disponível
          </p>
        </div>
      </div>

      <div className="mt-3 ml-6">
        {showCommand ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/50">
              <Terminal className="h-3 w-3 shrink-0" />
              Execute no seu cluster:
            </div>
            <div className="relative bg-muted/30 rounded-lg border border-border/40">
              <pre
                className="text-[10px] p-2.5 pr-9 font-mono overflow-x-auto text-muted-foreground/80"
                style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}
              >
                {updateCommand}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 h-6 w-6 hover:bg-white/10"
                onClick={copyCommand}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all"
            onClick={() => setShowCommand(true)}
          >
            <Terminal className="h-3 w-3" />
            Ver Comando
          </button>
        )}
      </div>
    </div>
  );
}
