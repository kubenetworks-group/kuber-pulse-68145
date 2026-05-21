import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpCircle, CheckCircle, AlertTriangle, Loader2, Copy, Terminal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Design tokens (brand/status only) ───────────────────────────────────────

const C = {
  accent:  "#00E5A0",
  accentD: "rgba(0,229,160,0.12)",
  accentB: "rgba(0,229,160,0.25)",
  info:    "#4A9EFF",
  infoD:   "rgba(74,158,255,0.12)",
  infoB:   "rgba(74,158,255,0.25)",
  warn:    "#F5A623",
  warnD:   "rgba(245,166,35,0.12)",
  warnB:   "rgba(245,166,35,0.25)",
  crit:    "#FF4D4D",
  critD:   "rgba(255,77,77,0.12)",
  critB:   "rgba(255,77,77,0.25)",
} as const;

const MONO = "'JetBrains Mono','Geist Mono',monospace";

// ─── Release type config ──────────────────────────────────────────────────────

const RELEASE: Record<string, { label: string; color: string; dim: string; border: string }> = {
  major:  { label: "Major",  color: C.crit,   dim: C.critD,  border: C.critB  },
  minor:  { label: "Minor",  color: C.info,   dim: C.infoD,  border: C.infoB  },
  patch:  { label: "Patch",  color: C.accent, dim: C.accentD,border: C.accentB},
  hotfix: { label: "Hotfix", color: C.warn,   dim: C.warnD,  border: C.warnB  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface UpdateInfo {
  current_version: string;
  latest_version:  string;
  update_available: boolean;
  is_required:     boolean;
  release_notes:   string | null;
  release_type:    "major" | "minor" | "patch" | "hotfix" | null;
}

// ─── AgentUpdateButton ────────────────────────────────────────────────────────

export function AgentUpdateButton() {
  const { selectedClusterId } = useCluster();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [copied, setCopied]         = useState(false);

  useEffect(() => {
    if (!selectedClusterId) return;
    checkForUpdates();

    // Realtime: re-check immediately when cluster agent_version is updated
    const channel = supabase
      .channel(`agent-update-btn-${selectedClusterId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clusters", filter: `id=eq.${selectedClusterId}` },
        () => checkForUpdates()
      )
      .subscribe();

    // Polling fallback every 30s (covers manual kubectl updates)
    const poll = setInterval(checkForUpdates, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [selectedClusterId]);

  const checkForUpdates = async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    try {
      const { data: clusterData } = await supabase
        .from("clusters")
        .select("agent_version, agent_last_seen_at")
        .eq("id", selectedClusterId)
        .single();

      if (!clusterData?.agent_last_seen_at || !clusterData?.agent_version) {
        setUpdateInfo(null);
        return;
      }

      const { data: latestVersion } = await supabase
        .from("agent_versions")
        .select("version, release_notes")
        .eq("is_latest", true)
        .single();

      if (!latestVersion) return;

      const cmp = (v1: string, v2: string) => {
        const n = (v: string) => v.replace(/^v/, "").split(".").map(Number);
        const [a1, b1, c1] = n(v1), [a2, b2, c2] = n(v2);
        return a1 !== a2 ? a1 - a2 : b1 !== b2 ? b1 - b2 : c1 - c2;
      };

      const needsUpdate = cmp(clusterData.agent_version, latestVersion.version) < 0;

      const releaseType = (cur: string, lat: string): "major" | "minor" | "patch" | null => {
        const n = (v: string) => v.replace(/^v/, "").split(".").map(Number);
        const [a1, b1] = n(cur), [a2, b2] = n(lat);
        return a1 !== a2 ? "major" : b1 !== b2 ? "minor" : "patch";
      };

      setUpdateInfo({
        current_version:  clusterData.agent_version,
        latest_version:   latestVersion.version,
        update_available: needsUpdate,
        is_required:      false,
        release_notes:    needsUpdate ? latestVersion.release_notes : null,
        release_type:     needsUpdate ? releaseType(clusterData.agent_version, latestVersion.version) : null,
      });
    } catch (err) {
      console.error("Error checking for agent updates:", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerUpdate = async () => {
    if (!selectedClusterId || !updateInfo) return;
    setIsUpdating(true);
    try {
      const { data: cluster } = await supabase
        .from("clusters").select("user_id").eq("id", selectedClusterId).single();
      if (!cluster) throw new Error("Cluster not found");

      const { error } = await supabase.from("agent_commands").insert({
        cluster_id:    selectedClusterId,
        user_id:       cluster.user_id,
        command_type:  "self_update",
        command_params: {
          new_image:       `ghcr.io/kubenetworks-group/kodo-agent:${updateInfo.latest_version}`,
          namespace:       "kodo",
          deployment_name: "kodo-agent",
        },
        status: "pending",
      });
      if (error) throw error;

      await supabase.from("auto_heal_actions_log").insert({
        cluster_id:     selectedClusterId,
        user_id:        cluster.user_id,
        action_type:    "agent_update",
        trigger_reason: `Updating agent from ${updateInfo.current_version} to ${updateInfo.latest_version}`,
        action_details: {
          current_version: updateInfo.current_version,
          target_version:  updateInfo.latest_version,
          release_type:    updateInfo.release_type,
        },
        status: "pending",
      });

      toast.success("Comando de atualização enviado", {
        description: "O agente será atualizado em alguns segundos.",
      });
      setShowDialog(false);
      setUpdateInfo(null);
      setTimeout(checkForUpdates, 10_000);
    } catch (err: any) {
      toast.error("Erro ao atualizar agente", { description: err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const kubectlCmd = `kubectl set image deployment/kodo-agent \\\n  agent=ghcr.io/kubenetworks-group/kodo-agent:${updateInfo?.latest_version} \\\n  -n kodo`;

  const copyCmd = () => {
    if (!updateInfo) return;
    navigator.clipboard.writeText(
      `kubectl set image deployment/kodo-agent agent=ghcr.io/kubenetworks-group/kodo-agent:${updateInfo.latest_version} -n kodo`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Comando copiado!");
  };

  if (loading || !updateInfo?.update_available) return null;

  const rel = updateInfo.release_type ? RELEASE[updateInfo.release_type] : null;

  return (
    <>
      {/* ── Trigger button ── */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowDialog(true)}
              className="relative flex items-center justify-center w-8 h-8 rounded-lg border transition-colors duration-150 outline-none cursor-pointer"
              style={{ background: C.accentD, borderColor: C.accentB }}
            >
              <ArrowUpCircle className="w-4 h-4" style={{ color: C.accent }} />
              {/* Pulse dot */}
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: C.accent }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: C.accent }} />
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">Atualização disponível — {updateInfo.latest_version}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* ── Dialog ── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent
          className="w-[min(95vw,480px)] max-w-none p-0 gap-0 border border-border bg-card overflow-hidden rounded-xl"
          style={{ maxHeight: "min(90vh, 640px)" }}
        >
          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                  style={{ background: C.accentD, border: `1px solid ${C.accentB}` }}
                >
                  <ArrowUpCircle className="w-4 h-4" style={{ color: C.accent }} />
                </div>
                <div>
                  <DialogTitle className="text-sm font-semibold text-foreground leading-tight">
                    Atualizar Agente do Cluster
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    Nova versão disponível com melhorias e correções
                  </DialogDescription>
                </div>
              </div>
              {rel && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: rel.dim, color: rel.color, border: `1px solid ${rel.border}` }}
                >
                  {rel.label}
                </span>
              )}
            </div>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex flex-col gap-4 p-5 overflow-y-auto" style={{ maxHeight: "calc(min(90vh,640px) - 180px)" }}>

            {/* Version info */}
            <div className="rounded-lg border border-border bg-muted/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Informações da Versão
                </span>
              </div>
              <div className="px-4 py-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">Versão atual</span>
                  <span
                    className="text-xs text-foreground tabular-nums"
                    style={{ fontFamily: MONO }}
                  >
                    {updateInfo.current_version}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">Nova versão</span>
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ fontFamily: MONO, color: C.accent }}
                  >
                    {updateInfo.latest_version}
                  </span>
                </div>
              </div>
            </div>

            {/* Release notes */}
            {updateInfo.release_notes && (
              <div className="rounded-lg border border-border bg-muted/40 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Notas de Lançamento
                  </span>
                </div>
                <div className="px-4 py-3 max-h-32 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "inherit" }}>
                    {updateInfo.release_notes}
                  </pre>
                </div>
              </div>
            )}

            {/* Manual command */}
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: `1px solid ${C.infoB}`, background: C.infoD }}
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: C.infoB }}>
                <Terminal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.info }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.info }}>
                  Atualização Manual
                </span>
              </div>
              <div className="px-4 py-3 flex flex-col gap-2">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Execute no seu cluster para atualizar manualmente:
                </p>
                <div className="relative group">
                  <pre
                    className="text-[11px] bg-card rounded-md px-3 py-2.5 pr-9 overflow-x-auto leading-relaxed text-foreground"
                    style={{ fontFamily: MONO, border: "1px solid var(--border)" }}
                  >
                    {kubectlCmd}
                  </pre>
                  <button
                    onClick={copyCmd}
                    className={cn(
                      "absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded transition-all duration-150 outline-none cursor-pointer border-none",
                      copied ? "opacity-100" : "opacity-60 hover:opacity-100"
                    )}
                    style={{ background: copied ? C.accentD : "var(--muted)" }}
                    title="Copiar comando"
                  >
                    {copied
                      ? <CheckCircle className="w-3 h-3" style={{ color: C.accent }} />
                      : <Copy className="w-3 h-3 text-muted-foreground" />
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div
              className="flex items-start gap-3 rounded-lg px-4 py-3"
              style={{ background: C.warnD, border: `1px solid ${C.warnB}` }}
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: C.warn }} />
              <p className="text-[11px] leading-relaxed" style={{ color: C.warn }}>
                O agente será reiniciado durante a atualização, causando uma breve
                interrupção na coleta de métricas (aprox. 30 segundos).
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30 flex-shrink-0">
            <button
              onClick={() => setShowDialog(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-muted border border-border transition-colors cursor-pointer outline-none"
            >
              Cancelar
            </button>
            <button
              onClick={triggerUpdate}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer outline-none border-none"
              style={{ background: C.accent, color: "#000", boxShadow: isUpdating ? "none" : "0 2px 10px rgba(0,229,160,0.25)" }}
            >
              {isUpdating
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Atualizando…</>
                : <><CheckCircle className="w-3.5 h-3.5" />Confirmar Atualização</>
              }
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
