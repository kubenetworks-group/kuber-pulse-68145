import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Ticks every N ms to keep elapsed times current
function useTick(ms: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// For active commands: show precise elapsed time counting up (1s resolution)
function elapsedPrecise(from: Date): string {
  const secs = Math.floor((Date.now() - from.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  if (m < 60) return `${m}m ${s.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60), rm = m % 60;
  return `${h}h ${rm.toString().padStart(2, "0")}m`;
}

// For timeline (completed events): relative label updated every 30s
function relativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}
import {
  RotateCcw, BarChart2, Upload, Sliders, Camera, FileCode,
  Zap, CheckCircle2, XCircle, Eye, WifiOff, Bot,
  Shield, Activity, Clock, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AgentCommand {
  id: string;
  command_type: string;
  command_params: Record<string, any>;
  status: "pending" | "sent" | "executing" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
}

export interface AgentActivityPanelProps {
  clusterId: string | null;
  clusterName?: string;
  agentStatus: "online" | "recent" | "offline" | "never" | null;
  agentLastSeen: Date | null;
  successRate?: number;
  preventedDowntime?: number;
  totalIncidents?: number;
  recentAnomalies?: any[];
}

const CMD_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  restart_pod:                 { label: "Reiniciando pod",       Icon: RotateCcw, color: "text-amber-500"   },
  delete_pod:                  { label: "Removendo pod",         Icon: RotateCcw, color: "text-red-500"     },
  scale_deployment:            { label: "Escalando deployment",  Icon: BarChart2, color: "text-blue-500"    },
  update_deployment_image:     { label: "Atualizando imagem",    Icon: Upload,    color: "text-purple-500"  },
  update_deployment_resources: { label: "Ajustando recursos",    Icon: Sliders,   color: "text-orange-500" },
  collect_cluster_snapshot:    { label: "Capturando snapshot",   Icon: Camera,    color: "text-cyan-500"   },
  apply_manifests:             { label: "Aplicando manifesto",   Icon: FileCode,  color: "text-indigo-500" },
  get_pod_logs:                { label: "Logs coletados",        Icon: FileCode,  color: "text-slate-500"  },
  pod_logs:                    { label: "Logs coletados",        Icon: FileCode,  color: "text-slate-500"  },
  collect_logs:                { label: "Logs coletados",        Icon: FileCode,  color: "text-slate-500"  },
};

function cmdMeta(type: string) {
  if (CMD_META[type]) return CMD_META[type];
  // Format unknown types: "restart_pod" → "Restart pod"
  const label = type.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
  return { label, Icon: Zap, color: "text-primary" };
}

function cmdTarget(cmd: AgentCommand): string {
  const p = cmd.command_params ?? {};
  const name = p.pod_name || p.deployment_name || p.name || "";
  const ns   = p.namespace ? ` · ${p.namespace}` : "";
  return name ? `${name}${ns}` : "";
}

function ProgressBar({ color = "bg-primary" }: { color?: string }) {
  return (
    <div className="h-1 w-full bg-border overflow-hidden rounded-full">
      <div
        className={`h-full w-1/3 ${color} rounded-full`}
        style={{ animation: "activitySlide 1.6s ease-in-out infinite" }}
      />
      <style>{`@keyframes activitySlide{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, color = "text-primary",
}: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 rounded-xl bg-muted/40 border border-border/60 min-w-0">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${color} flex-shrink-0`} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium truncate">{label}</span>
      </div>
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function AgentActivityPanel({
  clusterId, clusterName, agentStatus, agentLastSeen,
  successRate = 0, preventedDowntime = 0, totalIncidents = 0, recentAnomalies = [],
}: AgentActivityPanelProps) {
  const [activeCommands, setActiveCommands]   = useState<AgentCommand[]>([]);
  const [recentCommands, setRecentCommands]   = useState<AgentCommand[]>([]);
  const [commandsToday, setCommandsToday]     = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 1-second tick for active command elapsed times; 30-second tick for timeline labels
  useTick(activeCommands.length > 0 ? 1000 : 30_000);
  useTick(30_000);

  const fetchCommands = async () => {
    if (!clusterId) return;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    // A command is "truly active" only if it was created within the last 10 minutes.
    // Anything older with a non-terminal status is a stale/abandoned command.
    const activeWindowISO = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Fetch ALL recent commands (last 7 days) in one query, then split client-side.
    // This avoids complex OR filters that PostgREST can misparse.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [allRecentRes, todayRes] = await Promise.all([
      supabase.from("agent_commands")
        .select("id,command_type,command_params,status,created_at,completed_at")
        .eq("cluster_id", clusterId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("agent_commands")
        .select("id", { count: "exact", head: true })
        .eq("cluster_id", clusterId)
        .gte("created_at", todayStart.toISOString()),
    ]);

    const all = (allRecentRes.data ?? []) as AgentCommand[];

    // Split client-side with precise logic
    const active = all.filter(c =>
      ["pending", "sent", "executing"].includes(c.status) &&
      c.created_at >= activeWindowISO
    );
    const recent = all
      .filter(c => !active.some(a => a.id === c.id))   // everything else for timeline
      .slice(0, 8);

    setActiveCommands(active);
    setRecentCommands(recent);
    setCommandsToday(todayRes.count ?? 0);
  };

  useEffect(() => {
    if (!clusterId) return;
    fetchCommands();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`activity-panel-${clusterId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_commands", filter: `cluster_id=eq.${clusterId}` }, fetchCommands)
      .subscribe();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [clusterId]);

  const isOffline = agentStatus === "offline" || agentStatus === "never" || !agentStatus;
  const isActive  = activeCommands.length > 0;

  // Build unified timeline: recent commands + recent anomalies merged by date
  const timeline: Array<{ id: string; time: Date; type: "command" | "anomaly"; state: "ok" | "failed" | "stale"; label: string; detail: string }> = [
    ...recentCommands.map(c => {
      const isStale = ["sent", "pending", "executing"].includes(c.status);
      const timeRef = c.completed_at ?? c.created_at;
      return {
        id: c.id,
        time: new Date(timeRef),
        type: "command" as const,
        state: isStale ? "stale" : c.status === "completed" ? "ok" : "failed",
        label: isStale
          ? "Não executado — agente estava offline"
          : cmdMeta(c.command_type).label,
        detail: cmdTarget(c),
      };
    }),
    ...recentAnomalies.slice(0, 4).map(a => ({
      id: a.id,
      time: new Date(a.created_at),
      type: "anomaly" as const,
      state: a.resolved ? "ok" : "failed",
      label: a.resolved ? "Anomalia resolvida" : "Anomalia detectada",
      detail: a.description?.substring(0, 60) ?? "",
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 6);

  // ── OFFLINE ──────────────────────────────────────────────────────────────
  if (isOffline) {
    return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-5 px-6 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted flex-shrink-0">
            <WifiOff className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-semibold">Agente desconectado</p>
            <p className="text-sm text-muted-foreground mt-1">
              {agentLastSeen
                ? `Último contato ${relativeTime(agentLastSeen)}`
                : "O agente Kodo nunca conectou neste cluster"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Instale o agente para ativar o monitoramento autônomo 24/7
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── STATUS RING ───────────────────────────────────────────────────────────
  const StatusRing = () => isActive ? (
    <div className="relative flex h-16 w-16 items-center justify-center flex-shrink-0">
      <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping" />
      <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40" />
      <div className="relative h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
        <Zap className="h-6 w-6 text-emerald-500" />
      </div>
    </div>
  ) : (
    <div className="relative flex h-16 w-16 items-center justify-center flex-shrink-0">
      <div className="absolute inset-0 rounded-full border-2 border-border" />
      <div
        className="absolute inset-0 rounded-full border-t-2 border-primary"
        style={{ animation: "spin 3s linear infinite" }}
      />
      <div className="relative h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
        <Eye className="h-6 w-6 text-primary" />
      </div>
    </div>
  );

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden transition-colors duration-500",
      isActive ? "border-emerald-200 dark:border-emerald-900/60" : "border-border"
    )}>
      {/* ── Top bar: status ──────────────────────────────────────────── */}
      <div className={cn(
        "px-6 py-4 flex items-center gap-4 border-b border-border/60",
        isActive ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-muted/20"
      )}>
        <StatusRing />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn("text-lg font-bold", isActive ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
              {isActive ? "Agente em ação" : "Monitorando"}
            </h2>
            {!isActive && (
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:border-emerald-800">
                24/7
              </Badge>
            )}
            {isActive && (
              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-300 dark:border-emerald-800">
                {activeCommands.length} em execução
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isActive
              ? `Executando ${activeCommands.length} comando${activeCommands.length > 1 ? "s" : ""} no cluster${clusterName ? ` ${clusterName}` : ""}`
              : `Agente em standby — analisando e protegendo${clusterName ? ` ${clusterName}` : " o cluster"} continuamente`
            }
          </p>
        </div>

        {/* Agent heartbeat badge */}
        <div className="flex-shrink-0 hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn(
            "h-2 w-2 rounded-full",
            agentStatus === "online"  ? "bg-emerald-500 animate-pulse" :
            agentStatus === "recent"  ? "bg-amber-500" : "bg-slate-400"
          )} />
          {agentStatus === "online"  ? "Online" :
           agentStatus === "recent"  ? `Ativo ${agentLastSeen ? relativeTime(agentLastSeen) : ""}` :
           "Desconectado"}
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-border/60">
        <StatCard icon={Bot}      label="Ações hoje"        value={commandsToday}           color="text-primary"       />
        <StatCard icon={CheckCircle2} label="Taxa de sucesso" value={`${successRate}%`}     color="text-emerald-500"   />
        <StatCard icon={Shield}   label="Downtime evitado"   value={`${preventedDowntime}m`} color="text-amber-500"   />
        <StatCard icon={Activity} label="Incidentes total"   value={totalIncidents}          color="text-blue-500"     />
      </div>

      {/* ── Active commands ──────────────────────────────────────────── */}
      {isActive && (
        <div className="px-6 py-4 space-y-3 border-b border-border/60">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Em execução agora</p>
          <div className="space-y-3">
            {activeCommands.map(cmd => {
              const { label, Icon, color } = cmdMeta(cmd.command_type);
              const target = cmdTarget(cmd);
              return (
                <div key={cmd.id} className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn("p-1.5 rounded-lg bg-background", color.replace("text-", "border-").replace("-500", "-200"))}>
                        <Icon className={cn("h-4 w-4", color)} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{label}</p>
                        {target && (
                          <code className="text-xs text-muted-foreground font-mono">{target}</code>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {elapsedPrecise(new Date(cmd.created_at))}
                    </div>
                  </div>
                  <ProgressBar color={color.replace("text-", "bg-")} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Timeline ─────────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {isActive ? "Atividade recente" : "Últimas atividades"}
        </p>

        {timeline.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-muted-foreground">
            <AlertTriangle className="h-4 w-4 opacity-40 flex-shrink-0" />
            <p className="text-sm">
              Nenhuma atividade registrada ainda. O agente vai agir automaticamente quando detectar anomalias.
            </p>
          </div>
        ) : (
          <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

            {timeline.map((item, i) => (
                <div key={item.id} className={cn("relative flex gap-3 py-2", i > 0 && "border-t border-border/40")}>
                  {/* Dot */}
                  <div className={cn(
                    "relative z-10 flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 mt-0.5",
                    item.state === "ok"    ? "bg-emerald-100 dark:bg-emerald-900/40" :
                    item.state === "stale" ? "bg-slate-100  dark:bg-slate-800/40"   :
                                            "bg-red-100    dark:bg-red-900/40"
                  )}>
                    {item.state === "ok"    ? <CheckCircle2  className="h-3 w-3 text-emerald-500"        /> :
                     item.state === "stale" ? <Clock         className="h-3 w-3 text-muted-foreground"   /> :
                                             <XCircle       className="h-3 w-3 text-red-500"            />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{item.label}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                        {relativeTime(item.time)}
                      </span>
                    </div>
                    {item.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.detail}</p>
                    )}
                  </div>
                </div>
            ))}
          </div>
        )}

        {/* Footer note */}
        {!isActive && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/60 border-t border-border/40 pt-3">
            <Eye className="h-3 w-3 flex-shrink-0" />
            O agente monitora CPU, memória, pods, eventos e segurança a cada 15–30 segundos e age automaticamente quando necessário.
          </div>
        )}
      </div>
    </div>
  );
}
