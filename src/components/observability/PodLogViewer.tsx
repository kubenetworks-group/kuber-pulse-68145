import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Terminal, Search, Download, Copy, Loader2, FileText, AlertTriangle,
  RefreshCw, Filter, RotateCcw, ExternalLink, Maximize2, Minimize2,
  Clock, WrapText, ChevronUp, ChevronDown, Layers, History,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ContainerInfo {
  name: string;
  ready: boolean;
  restart_count: number;
  state: { status: string; reason?: string; exit_code?: number };
  last_state?: { status: string; reason?: string; exit_code?: number };
  image?: string;
  liveness_probe?: boolean;
  readiness_probe?: boolean;
  startup_probe?: boolean;
  resources?: {
    limits?: { cpu?: number; memory?: number };
    requests?: { cpu?: number; memory?: number };
  };
}

interface PodCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

interface PodData {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  cpu: string;
  memory: string;
  node: string;
  controlled_by_kind?: string;
  controlled_by_name?: string;
  qos_class?: string;
  labels?: Record<string, string>;
  containers?: ContainerInfo[];
  created_at?: string;
  conditions?: PodCondition[];
}

interface PodLogViewerProps {
  pods: PodData[];
  onRefresh?: () => void;
  loading?: boolean;
}

export const PodLogViewer = ({ pods: podsProp, onRefresh, loading: externalLoading }: PodLogViewerProps) => {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [localPods, setLocalPods] = useState<PodData[] | null>(null);
  const [podsLoading, setPodsLoading] = useState(false);
  const [selectedPod, setSelectedPod] = useState<PodData | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState<string>("all");
  const [tailLines, setTailLines] = useState("200");
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [availableContainers, setAvailableContainers] = useState<string[]>([]);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const [liveTail, setLiveTail] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const liveTailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolvedRef = useRef(false);

  // Viewer options
  const [fullscreen, setFullscreen] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchRegex, setSearchRegex] = useState(false);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const [showPreviousLogs, setShowPreviousLogs] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const matchElemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Pod info panel state
  const [podInfoOpen, setPodInfoOpen] = useState(false);
  const [podInfoPod, setPodInfoPod] = useState<PodData | null>(null);

  const formatAge = (createdAt?: string): string => {
    if (!createdAt) return "—";
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d${hours % 24 > 0 ? `${hours % 24}h` : ""}`;
    if (hours > 0) return `${hours}h${mins % 60 > 0 ? `${mins % 60}m` : ""}`;
    return `${mins}m`;
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return "—";
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)}Gi`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)}Mi`;
    return `${Math.round(bytes / 1024)}Ki`;
  };

  const formatMillicores = (milli?: number): string => {
    if (!milli) return "—";
    return milli >= 1000 ? `${(milli / 1000).toFixed(1)}` : `${milli}m`;
  };

  // The displayed pods: prefer fresh local data fetched on demand, fall back to prop
  const pods = localPods ?? podsProp;

  // ── Previous container section filtering ────────────────────────────────────
  const allLogLines = useMemo(() => (logs ? logs.split("\n") : []), [logs]);

  // Detect if the response contains a "previous container" section
  const prevSectionStartIdx = useMemo(() =>
    allLogLines.findIndex(l => /CONTAINER ANTERIOR/i.test(l)),
    [allLogLines]
  );
  const hasPreviousLogs = prevSectionStartIdx !== -1;

  // When a new pod dialog opens, auto-show previous section if it has restarts
  useEffect(() => {
    if (selectedPod && selectedPod.restarts > 0) {
      setShowPreviousLogs(true);
    } else {
      setShowPreviousLogs(false);
    }
  }, [selectedPod?.name, selectedPod?.namespace]);

  // Strip previous container section when toggle is off
  const logLines = useMemo(() => {
    if (showPreviousLogs || prevSectionStartIdx === -1) return allLogLines;
    return allLogLines.slice(0, prevSectionStartIdx);
  }, [allLogLines, showPreviousLogs, prevSectionStartIdx]);

  // ── Search helpers ──────────────────────────────────────────────────────────

  const matchingLineIndices = useMemo(() => {
    if (!logSearch) return [];
    const indices: number[] = [];
    for (let i = 0; i < logLines.length; i++) {
      try {
        const flags = searchCaseSensitive ? "g" : "gi";
        const pattern = searchRegex
          ? logSearch
          : logSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(pattern, flags).test(logLines[i])) indices.push(i);
      } catch { /* invalid regex */ }
    }
    return indices;
  }, [logLines, logSearch, searchCaseSensitive, searchRegex]);

  const totalMatches = matchingLineIndices.length;
  const safeMatchIdx = totalMatches > 0 ? Math.min(currentMatchIdx, totalMatches - 1) : 0;

  const navigateMatch = useCallback((dir: 1 | -1) => {
    if (!totalMatches) return;
    setCurrentMatchIdx((prev) => {
      const next = (prev + dir + totalMatches) % totalMatches;
      return next;
    });
  }, [totalMatches]);

  // Scroll to active match when it changes
  useEffect(() => {
    if (!totalMatches) return;
    const lineIdx = matchingLineIndices[safeMatchIdx];
    const el = matchElemRefs.current.get(lineIdx);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [safeMatchIdx, matchingLineIndices, totalMatches]);

  // Reset search match index when query changes
  useEffect(() => { setCurrentMatchIdx(0); }, [logSearch, searchCaseSensitive, searchRegex]);

  // Highlight matching text in a string
  const highlightText = useCallback((text: string, activeMatch: boolean) => {
    if (!logSearch) return <>{text}</>;
    try {
      const flags = searchCaseSensitive ? "g" : "gi";
      const pattern = searchRegex
        ? logSearch
        : logSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(${pattern})`, flags);
      const parts = text.split(re);
      return (
        <>
          {parts.map((part, i) =>
            i % 2 === 1 ? (
              <mark
                key={i}
                style={{
                  background: activeMatch ? "#f5c518" : "#e3b34180",
                  color: "#000",
                  borderRadius: 2,
                  padding: "0 1px",
                }}
              >
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </>
      );
    } catch {
      return <>{text}</>;
    }
  }, [logSearch, searchCaseSensitive, searchRegex]);

  // Unique namespaces for the filter dropdown
  const namespaces = Array.from(new Set(pods.map((p) => p.namespace))).sort();

  // Send a send_metrics command to the agent so it pushes fresh data immediately,
  // then the realtime subscription in useObservabilityData picks up the new row.
  const refreshPods = useCallback(async () => {
    if (!selectedClusterId || !user) return;
    setPodsLoading(true);
    try {
      await supabase.from("agent_commands").insert({
        cluster_id: selectedClusterId,
        user_id: user.id,
        command_type: "send_metrics",
        command_params: {},
        status: "pending",
      });
      // onRefresh triggers a DB re-read after a brief delay for the agent to respond
      setTimeout(() => onRefresh?.(), 4000);
    } finally {
      // Keep spinner for 5s so user sees feedback
      setTimeout(() => setPodsLoading(false), 5000);
    }
  }, [selectedClusterId, user, onRefresh]);

  const handleRefresh = useCallback(() => {
    refreshPods();
    onRefresh?.();
  }, [refreshPods, onRefresh]);

  // Shared handler for when agent responds (used by both realtime and polling)
  const handleCommandResult = useCallback((cmd: { status: string; result: any }) => {
    if (resolvedRef.current) return;
    if (cmd.status === "completed" && cmd.result) {
      resolvedRef.current = true;
      const result = cmd.result as any;
      const logText = result.logs || result.output || "Sem logs disponíveis.";
      if (result.all_containers && Array.isArray(result.all_containers)) {
        setAvailableContainers(result.all_containers);
        if (result.container) setSelectedContainer((prev) => prev || result.container);
      }
      setIsPermissionError(logText.includes("ERRO DE PERMISSÃO") || logText.includes("Forbidden"));
      setLogs(logText);
      setLastUpdated(new Date());
      setLoadingLogs(false);
      setIsBackgroundRefreshing(false);
    } else if (cmd.status === "failed") {
      resolvedRef.current = true;
      const errMsg = (cmd.result as any)?.error || "Falha ao obter logs";
      setIsPermissionError(errMsg.includes("403") || errMsg.includes("Forbidden"));
      setLogs(`Erro: ${errMsg}`);
      setLoadingLogs(false);
      setIsBackgroundRefreshing(false);
    }
  }, []);

  // Realtime subscription — fires immediately when the agent updates the command
  useEffect(() => {
    if (!activeCommandId) return;
    resolvedRef.current = false;

    const channel = supabase
      .channel(`log-result-${activeCommandId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_commands", filter: `id=eq.${activeCommandId}` },
        (payload) => handleCommandResult(payload.new as any)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeCommandId, handleCommandResult]);

  // Polling fallback — checks every 5s in case the realtime notification is missed
  useEffect(() => {
    if (!activeCommandId) return;

    const poll = async () => {
      if (resolvedRef.current) return;
      const { data } = await supabase
        .from("agent_commands")
        .select("status, result")
        .eq("id", activeCommandId)
        .maybeSingle();
      if (data) handleCommandResult(data as any);
    };

    const interval = setInterval(poll, 5000);

    // Timeout after 90s if agent never responds
    const timeout = setTimeout(() => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      setLogs("Timeout: O agente não respondeu a tempo. Verifique se o agente está ativo no cluster.");
      setLoadingLogs(false);
    }, 90000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [activeCommandId, handleCommandResult]);

  // Clean up Live Tail when dialog closes
  useEffect(() => {
    if (!dialogOpen) {
      setLiveTail(false);
      if (liveTailTimerRef.current) {
        clearInterval(liveTailTimerRef.current);
        liveTailTimerRef.current = null;
      }
      setActiveCommandId(null);
      setLastUpdated(null);
      setIsBackgroundRefreshing(false);
      resolvedRef.current = false;
    }
  }, [dialogOpen]);

  const fetchLogs = async (pod: PodData, containerOverride?: string, backgroundRefresh = false) => {
    if (!selectedClusterId || !user) return;
    setSelectedPod(pod);
    setDialogOpen(true);

    if (backgroundRefresh) {
      // Keep existing logs visible; just spin the refresh icon subtly
      setIsBackgroundRefreshing(true);
    } else {
      setLoadingLogs(true);
      setLogs("");
      setIsPermissionError(false);
    }

    setActiveCommandId(null);
    resolvedRef.current = false;

    const container = containerOverride || selectedContainer || "";

    try {
      const { data, error } = await supabase
        .from("agent_commands")
        .insert({
          cluster_id: selectedClusterId,
          user_id: user.id,
          command_type: "get_pod_logs",
          command_params: {
            pod_name: pod.name,
            namespace: pod.namespace,
            tail_lines: parseInt(tailLines),
            ...(container ? { container_name: container } : {}),
          },
        })
        .select()
        .single();

      if (error) throw error;
      setActiveCommandId(data.id);
    } catch (err: any) {
      setLogs(`Erro: ${err.message}`);
      setLoadingLogs(false);
    }
  };

  const toggleLiveTail = () => {
    if (liveTail) {
      if (liveTailTimerRef.current) {
        clearInterval(liveTailTimerRef.current);
        liveTailTimerRef.current = null;
      }
      setLiveTail(false);
    } else {
      setLiveTail(true);
      // First fetch: foreground (no logs yet or user just enabled live tail)
      if (selectedPod) fetchLogs(selectedPod, selectedContainer);
      // Subsequent ticks: background refresh — keep old logs visible
      liveTailTimerRef.current = setInterval(() => {
        if (selectedPod) fetchLogs(selectedPod, selectedContainer, true);
      }, 15000);
    }
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(logs);
    toast.success("Logs copiados!");
  };

  const downloadLogs = () => {
    if (!selectedPod) return;
    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedPod.namespace}_${selectedPod.name}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredPods = pods.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.namespace.toLowerCase().includes(search.toLowerCase());
    const matchesNs = namespaceFilter === "all" || p.namespace === namespaceFilter;
    return matchesSearch && matchesNs;
  });

  const renderLogLine = (line: string, lineIdx: number) => {
    const isMatchLine = matchingLineIndices.includes(lineIdx);
    const isActiveMatch = isMatchLine && matchingLineIndices[safeMatchIdx] === lineIdx;

    const setRef = (el: HTMLDivElement | null) => {
      if (el && isMatchLine) matchElemRefs.current.set(lineIdx, el);
    };

    const wrapStyle: React.CSSProperties = wrapLines
      ? { wordBreak: "break-word", overflowWrap: "anywhere" }
      : { whiteSpace: "nowrap" };

    const matchBg = isActiveMatch
      ? "rgba(245,197,24,0.15)"
      : isMatchLine
      ? "rgba(245,197,24,0.06)"
      : undefined;

    if (!line) return <div key={lineIdx} className="h-[1em]" />;

    // Section separator  === ... ===
    if (line.startsWith("===")) {
      return (
        <div key={lineIdx} className="flex items-center gap-2 mt-4 mb-2">
          <span className="h-px flex-1" style={{ background: "#30363d" }} />
          <span className="text-[10px] font-semibold tracking-widest uppercase px-2" style={{ color: "#58a6ff" }}>
            {line.replace(/^=+\s*/, "").replace(/\s*=+$/, "")}
          </span>
          <span className="h-px flex-1" style={{ background: "#30363d" }} />
        </div>
      );
    }

    // Kubernetes structured log: I0516 16:40:28.918355    1 file.go:288] message
    const k8s = line.match(/^([IWEF])(\d{4} \d{2}:\d{2}:\d{2}\.\d+)\s+\d+\s+([^\]]+)\]\s*(.*)/s);
    if (k8s) {
      const [, lvl, ts, src, msg] = k8s;
      const lvlColor = lvl === "E" || lvl === "F" ? "#f47067" : lvl === "W" ? "#e3b341" : lvl === "I" ? "#3fb950" : "#8b949e";
      const msgColor = lvl === "E" || lvl === "F" ? "#ffa198" : lvl === "W" ? "#e3b341" : "#e6edf3";
      return (
        <div
          key={lineIdx}
          ref={setRef}
          className="min-w-0 mb-1 rounded-sm px-1"
          style={{ background: matchBg }}
        >
          <div className="flex items-center gap-1.5 leading-[1.4]">
            <span className="shrink-0 font-bold" style={{ color: lvlColor, width: "0.7rem" }}>{lvl}</span>
            {showTimestamps && (
              <span className="shrink-0 text-[10px] tabular-nums" style={{ color: "#484f58" }}>
                {highlightText(ts, isActiveMatch)}
              </span>
            )}
            <span className="shrink-0 text-[10px] truncate" style={{ color: "#484f58", maxWidth: "16ch" }} title={src}>{src}</span>
          </div>
          <div className="pl-3 leading-[1.5]" style={{ color: msgColor, ...wrapStyle }}>
            {highlightText(msg, isActiveMatch)}
          </div>
        </div>
      );
    }

    // Generic error / warn / info coloring
    const isError = /\b(error|ERROR|FATAL|fatal|Exception|panic|CRIT)\b|^E\d{4}/.test(line);
    const isWarn  = /\b(warn|WARN|warning|WARNING)\b|^W\d{4}/.test(line);
    const lineColor = isError ? "#ffa198" : isWarn ? "#e3b341" : "#e6edf3";

    return (
      <div
        key={lineIdx}
        ref={setRef}
        className="leading-[1.6] rounded-sm px-1"
        style={{ color: lineColor, background: matchBg, ...wrapStyle }}
      >
        {highlightText(line, isActiveMatch)}
      </div>
    );
  };

  return (
    <>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-full flex flex-col">
        {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Terminal className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold">Pods</span>
            {filteredPods.length > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">{filteredPods.length} itens</span>
            )}
          </div>

          {/* Restart alert inline */}
          {pods.some((p) => p.restarts > 0) && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-500">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>{pods.filter((p) => p.restarts > 0).length} pod(s) com restarts</span>
              <button onClick={() => navigate("/ai-monitor")} className="underline underline-offset-2 hover:text-amber-400 transition-colors">
                Ver Auditoria
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar pod..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-44 sm:w-56"
              />
            </div>
            {/* Namespace filter */}
            {namespaces.length > 1 && (
              <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
                <SelectTrigger className="h-8 text-xs w-36 gap-1.5">
                  <Filter className="w-3 h-3 text-muted-foreground" />
                  <SelectValue placeholder="Namespace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os namespaces</SelectItem>
                  {namespaces.map((ns) => (
                    <SelectItem key={ns} value={ns} className="text-xs font-mono">{ns}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Tail lines */}
            <Select value={tailLines} onValueChange={setTailLines}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 linhas</SelectItem>
                <SelectItem value="100">100 linhas</SelectItem>
                <SelectItem value="200">200 linhas</SelectItem>
                <SelectItem value="500">500 linhas</SelectItem>
                <SelectItem value="1000">1000 linhas</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleRefresh}
              disabled={podsLoading || externalLoading}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${podsLoading || externalLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-auto">
          {/* Header row */}
          <div
            className="sticky top-0 z-10 grid text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/50 px-4 py-2"
            style={{
              gridTemplateColumns: "minmax(180px,1fr) 110px 70px 90px 88px 72px 108px 120px 80px 82px 52px 92px",
              columnGap: "12px",
              background: "hsl(var(--card))",
            }}
          >
            <div>Name</div>
            <div>Namespace</div>
            <div className="text-right">CPU</div>
            <div className="text-right">Memory</div>
            <div>Containers</div>
            <div className="text-right">Restarts</div>
            <div>Controlled By</div>
            <div>Node</div>
            <div>QoS</div>
            <div>Status</div>
            <div>Age</div>
            <div />
          </div>

          {/* Data rows */}
          {filteredPods.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              Nenhum pod encontrado
            </div>
          ) : (
            filteredPods.map((pod, i) => {
              const containers: ContainerInfo[] = pod.containers || [];
              const statusColor =
                pod.status === "Running" ? "text-green-500" :
                pod.status === "Pending" ? "text-yellow-500" :
                pod.status === "Succeeded" ? "text-blue-400" :
                "text-red-400";
              const qosColor =
                pod.qos_class === "Guaranteed" ? "text-green-400" :
                pod.qos_class === "Burstable" ? "text-yellow-400" :
                "text-muted-foreground";

              return (
                <div
                  key={`${pod.namespace}-${pod.name}-${i}`}
                  className="grid items-center text-xs border-b border-border/20 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors group"
                  style={{
                    gridTemplateColumns: "minmax(180px,1fr) 110px 70px 90px 88px 72px 108px 120px 80px 82px 52px 92px",
                    columnGap: "12px",
                  }}
                  onClick={() => { setPodInfoPod(pod); setPodInfoOpen(true); }}
                >
                  {/* Name */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="font-mono truncate" title={pod.name}>{pod.name}</span>
                    {pod.restarts > 0 && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 shrink-0">{pod.restarts}↺</Badge>
                    )}
                  </div>
                  {/* Namespace */}
                  <div className="text-blue-400 truncate text-[11px]" title={pod.namespace}>{pod.namespace}</div>
                  {/* CPU */}
                  <div className="text-right tabular-nums text-muted-foreground">{pod.cpu}</div>
                  {/* Memory */}
                  <div className="text-right tabular-nums text-muted-foreground">{pod.memory}</div>
                  {/* Container squares */}
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {containers.length > 0 ? (
                      containers.map((c, ci) => {
                        const bg =
                          c.ready ? "#3fb950" :
                          c.state?.status === "waiting" ? "#e3b341" :
                          c.state?.status === "terminated" ? "#f47067" :
                          "#484f58";
                        return (
                          <div
                            key={ci}
                            title={`${c.name}: ${c.state?.status || "unknown"}`}
                            style={{ width: 10, height: 10, borderRadius: 2, background: bg, flexShrink: 0 }}
                          />
                        );
                      })
                    ) : (
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: "#484f58" }} />
                    )}
                  </div>
                  {/* Restarts */}
                  <div className={`text-right tabular-nums ${pod.restarts > 0 ? "text-amber-400 font-medium" : "text-muted-foreground"}`}>
                    {pod.restarts}
                  </div>
                  {/* Controlled By */}
                  <div className="truncate text-muted-foreground" title={pod.controlled_by_name || ""}>
                    {pod.controlled_by_kind || "—"}
                  </div>
                  {/* Node */}
                  <div className="truncate text-[11px] text-muted-foreground" title={pod.node}>{pod.node || "—"}</div>
                  {/* QoS */}
                  <div className={`truncate text-[11px] ${qosColor}`}>{pod.qos_class || "—"}</div>
                  {/* Status */}
                  <div className={`font-medium ${statusColor}`}>{pod.status}</div>
                  {/* Age */}
                  <div className="text-muted-foreground tabular-nums">{formatAge(pod.created_at)}</div>
                  {/* Actions */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContainer("");
                        setAvailableContainers([]);
                        fetchLogs(pod);
                      }}
                    >
                      <Terminal className="w-3 h-3" />
                      Ver Logs
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* ── Pod Info Dialog ───────────────────────────────────────────────── */}
      <Dialog open={podInfoOpen} onOpenChange={setPodInfoOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0" style={{ background: "#161b22", border: "1px solid #30363d" }}>
          <DialogHeader className="px-5 pt-4 pb-3 pr-12 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(63,185,80,0.15)" }}>
                <FileText className="w-4 h-4" style={{ color: "#3fb950" }} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm font-mono leading-tight" style={{ color: "#e6edf3" }}>
                  {podInfoPod?.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] font-mono" style={{ color: "#58a6ff" }}>{podInfoPod?.namespace}</span>
                  <span
                    className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      background: podInfoPod?.status === "Running" ? "rgba(63,185,80,0.15)" : "rgba(244,112,103,0.15)",
                      color: podInfoPod?.status === "Running" ? "#3fb950" : "#f47067",
                    }}
                  >
                    {podInfoPod?.status}
                  </span>
                  {podInfoPod && podInfoPod.restarts > 0 && (
                    <span className="text-[11px]" style={{ color: "#e3b341" }}>{podInfoPod.restarts} restart(s)</span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1.5 shrink-0"
                style={{ borderColor: "#30363d", color: "#8b949e" }}
                onClick={() => {
                  setPodInfoOpen(false);
                  if (podInfoPod) { setSelectedContainer(""); setAvailableContainers([]); fetchLogs(podInfoPod); }
                }}
              >
                <Terminal className="w-3 h-3" />
                Ver Logs
              </Button>
            </div>
          </DialogHeader>

          <div className="px-5 py-4 space-y-5" style={{ color: "#e6edf3" }}>
            {/* Overview grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Node", value: podInfoPod?.node || "—" },
                { label: "QoS", value: podInfoPod?.qos_class || "—" },
                { label: "Age", value: formatAge(podInfoPod?.created_at) },
                { label: "Controlled By", value: podInfoPod?.controlled_by_kind || "—", sub: podInfoPod?.controlled_by_name },
                { label: "CPU", value: podInfoPod?.cpu || "—" },
                { label: "Memory", value: podInfoPod?.memory || "—" },
              ].map(({ label, value, sub }) => (
                <div key={label} className="rounded-lg px-3 py-2" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                  <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#484f58" }}>{label}</div>
                  <div className="text-[12px] font-mono truncate" style={{ color: "#e6edf3" }} title={sub || value}>{value}</div>
                  {sub && <div className="text-[10px] truncate mt-0.5" style={{ color: "#8b949e" }} title={sub}>{sub}</div>}
                </div>
              ))}
            </div>

            {/* Labels */}
            {podInfoPod?.labels && Object.keys(podInfoPod.labels).length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#8b949e" }}>Labels</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(podInfoPod.labels).map(([k, v]) => (
                    <span key={k} className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "#21262d", border: "1px solid #30363d", color: "#79c0ff" }}>
                      {k}={v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Conditions */}
            {podInfoPod?.conditions && podInfoPod.conditions.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#8b949e" }}>Conditions</div>
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #21262d" }}>
                  {podInfoPod.conditions.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-3 px-3 py-2 text-[11px]" style={{ borderTop: ci > 0 ? "1px solid #21262d" : undefined, background: "#0d1117" }}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.status === "True" ? "#3fb950" : "#f47067" }} />
                      <span className="font-mono w-32 shrink-0" style={{ color: "#e6edf3" }}>{c.type}</span>
                      <span className="shrink-0" style={{ color: c.status === "True" ? "#3fb950" : "#f47067" }}>{c.status}</span>
                      {c.reason && <span className="text-[10px] truncate" style={{ color: "#8b949e" }}>{c.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Containers */}
            {podInfoPod?.containers && podInfoPod.containers.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#8b949e" }}>
                  Containers ({podInfoPod.containers.length})
                </div>
                <div className="space-y-2">
                  {podInfoPod.containers.map((c, ci) => {
                    const stateColor = c.ready ? "#3fb950" : c.state?.status === "waiting" ? "#e3b341" : "#f47067";
                    return (
                      <div key={ci} className="rounded-lg p-3" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stateColor }} />
                          <span className="text-[12px] font-mono font-semibold" style={{ color: "#e6edf3" }}>{c.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded ml-auto" style={{ background: "rgba(63,185,80,0.1)", color: stateColor }}>
                            {c.state?.status || "unknown"}
                            {c.state?.reason ? ` (${c.state.reason})` : ""}
                          </span>
                        </div>
                        {c.image && (
                          <div className="text-[10px] font-mono mb-2 truncate" style={{ color: "#8b949e" }} title={c.image}>{c.image}</div>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mb-2">
                          <div className="flex items-center gap-1.5">
                            <span style={{ color: "#484f58" }}>Restarts:</span>
                            <span style={{ color: c.restart_count > 0 ? "#e3b341" : "#8b949e" }}>{c.restart_count}</span>
                          </div>
                          {c.resources?.requests && (
                            <div className="flex items-center gap-1.5">
                              <span style={{ color: "#484f58" }}>Req:</span>
                              <span className="font-mono text-[10px]" style={{ color: "#8b949e" }}>
                                {formatMillicores(c.resources.requests.cpu)} CPU / {formatBytes(c.resources.requests.memory)} Mem
                              </span>
                            </div>
                          )}
                          {c.resources?.limits && (
                            <div className="flex items-center gap-1.5">
                              <span style={{ color: "#484f58" }}>Limit:</span>
                              <span className="font-mono text-[10px]" style={{ color: "#8b949e" }}>
                                {formatMillicores(c.resources.limits.cpu)} CPU / {formatBytes(c.resources.limits.memory)} Mem
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] pt-2" style={{ borderTop: "1px solid #21262d" }}>
                          <span style={{ color: "#484f58" }}>Probes:</span>
                          <span style={{ color: c.liveness_probe ? "#3fb950" : "#484f58" }}>
                            {c.liveness_probe ? "✓" : "✗"} Liveness
                          </span>
                          <span style={{ color: c.readiness_probe ? "#3fb950" : "#484f58" }}>
                            {c.readiness_probe ? "✓" : "✗"} Readiness
                          </span>
                          <span style={{ color: c.startup_probe ? "#3fb950" : "#484f58" }}>
                            {c.startup_probe ? "✓" : "✗"} Startup
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setFullscreen(false); }}>
        <DialogContent
          className={cn(
            "flex flex-col p-0 gap-0 overflow-hidden rounded-xl transition-all duration-200",
            fullscreen
              ? "fixed inset-2 max-w-none w-auto max-h-none translate-x-0 translate-y-0"
              : "w-[calc(100vw-1rem)] sm:max-w-5xl h-[85vh] max-h-[90vh]"
          )}
          style={{ background: "#161b22", border: "1px solid #30363d" }}
        >
          {/* ── Top bar: pod name + container selector + actions ────────────── */}
          <DialogHeader className="px-3 pt-2.5 pb-2.5 pr-12 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
            <div className="flex items-center gap-2 min-w-0">
              <Terminal className="w-3.5 h-3.5 shrink-0" style={{ color: "#3fb950" }} />
              <DialogTitle className="text-xs font-mono min-w-0 flex-1 truncate" style={{ color: "#e6edf3" }}>
                {selectedPod?.namespace}/{selectedPod?.name}
              </DialogTitle>

              {/* Container selector */}
              {availableContainers.length > 0 && (
                <Select
                  value={selectedContainer || "__all__"}
                  onValueChange={(v) => {
                    const val = v === "__all__" ? "" : v;
                    setSelectedContainer(val);
                    if (selectedPod) fetchLogs(selectedPod, val);
                  }}
                >
                  <SelectTrigger
                    className="h-6 text-[11px] gap-1 px-2 shrink-0"
                    style={{ minWidth: 120, maxWidth: 180, background: "#21262d", border: "1px solid #30363d", color: "#e6edf3" }}
                  >
                    <Layers className="w-3 h-3 shrink-0" style={{ color: "#58a6ff" }} />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">Todos os containers</SelectItem>
                    {availableContainers.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs font-mono">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Live tail indicator */}
              <button
                onClick={toggleLiveTail}
                disabled={!selectedPod}
                title={liveTail ? "Parar live tail" : "Iniciar live tail"}
                className={cn(
                  "flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors shrink-0",
                  liveTail
                    ? "text-green-300 border border-green-700/60"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                )}
                style={{ background: liveTail ? "rgba(63,185,80,0.12)" : undefined }}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", liveTail ? "bg-green-400 animate-pulse" : "bg-muted-foreground/50")} />
                {liveTail ? "LIVE" : "Live"}
              </button>

              {/* Refresh */}
              <button
                onClick={() => selectedPod && fetchLogs(selectedPod, selectedContainer, !!logs)}
                disabled={loadingLogs}
                title="Atualizar logs"
                className="flex items-center justify-center h-6 w-6 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
                style={{ color: "#8b949e" }}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", (loadingLogs || isBackgroundRefreshing) && "animate-spin")} />
              </button>

              {/* Fullscreen toggle */}
              <button
                onClick={() => setFullscreen((f) => !f)}
                title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
                className="flex items-center justify-center h-6 w-6 rounded hover:bg-white/10 transition-colors"
                style={{ color: "#8b949e" }}
              >
                {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </DialogHeader>

          {/* ── Search + toolbar bar ─────────────────────────────────────────── */}
          <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ borderBottom: "1px solid #21262d", background: "#0d1117" }}>
            {/* Search input */}
            <div className="flex items-center gap-1 flex-1 min-w-0 rounded px-2 h-7" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <Search className="w-3 h-3 shrink-0" style={{ color: "#484f58" }} />
              <input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigateMatch(e.shiftKey ? -1 : 1);
                  if (e.key === "Escape") setLogSearch("");
                }}
                placeholder="Buscar nos logs..."
                className="flex-1 min-w-0 bg-transparent outline-none text-[11.5px] font-mono"
                style={{ color: "#e6edf3" }}
              />
              {/* Case-sensitive toggle */}
              <button
                onClick={() => setSearchCaseSensitive((v) => !v)}
                title="Diferenciar maiúsculas (Aa)"
                className="flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold shrink-0 transition-colors"
                style={{
                  color: searchCaseSensitive ? "#e6edf3" : "#484f58",
                  background: searchCaseSensitive ? "#30363d" : "transparent",
                }}
              >
                Aa
              </button>
              {/* Regex toggle */}
              <button
                onClick={() => setSearchRegex((v) => !v)}
                title="Expressão regular (.*)"
                className="flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold shrink-0 transition-colors"
                style={{
                  color: searchRegex ? "#e6edf3" : "#484f58",
                  background: searchRegex ? "#30363d" : "transparent",
                  fontFamily: "monospace",
                }}
              >
                .*
              </button>
            </div>

            {/* Match counter + navigation */}
            {logSearch && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] tabular-nums" style={{ color: "#484f58", minWidth: 36, textAlign: "right" }}>
                  {totalMatches > 0 ? `${safeMatchIdx + 1}/${totalMatches}` : "0/0"}
                </span>
                <button
                  onClick={() => navigateMatch(-1)}
                  disabled={!totalMatches}
                  className="flex items-center justify-center h-6 w-5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                  style={{ color: "#8b949e" }}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => navigateMatch(1)}
                  disabled={!totalMatches}
                  className="flex items-center justify-center h-6 w-5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                  style={{ color: "#8b949e" }}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Divider */}
            <span className="h-4 w-px shrink-0" style={{ background: "#30363d" }} />

            {/* Timestamps toggle */}
            <button
              onClick={() => setShowTimestamps((v) => !v)}
              title="Mostrar/ocultar timestamps"
              className="flex items-center justify-center h-6 w-6 rounded transition-colors shrink-0"
              style={{
                color: showTimestamps ? "#58a6ff" : "#484f58",
                background: showTimestamps ? "rgba(88,166,255,0.12)" : "transparent",
              }}
            >
              <Clock className="w-3.5 h-3.5" />
            </button>

            {/* Wrap toggle */}
            <button
              onClick={() => setWrapLines((v) => !v)}
              title="Quebra de linha"
              className="flex items-center justify-center h-6 w-6 rounded transition-colors shrink-0"
              style={{
                color: wrapLines ? "#58a6ff" : "#484f58",
                background: wrapLines ? "rgba(88,166,255,0.12)" : "transparent",
              }}
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>

            {/* Previous container logs toggle — only shown when response has a prev section */}
            {hasPreviousLogs && (
              <button
                onClick={() => setShowPreviousLogs((v) => !v)}
                title={showPreviousLogs ? "Ocultar logs do container anterior" : "Mostrar logs do container anterior (último crash)"}
                className="flex items-center justify-center h-6 w-6 rounded transition-colors shrink-0"
                style={{
                  color: showPreviousLogs ? "#f47067" : "#484f58",
                  background: showPreviousLogs ? "rgba(244,112,103,0.12)" : "transparent",
                }}
              >
                <History className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Copy */}
            <button
              onClick={copyLogs}
              disabled={!logs || loadingLogs}
              title="Copiar logs"
              className="flex items-center justify-center h-6 w-6 rounded hover:bg-white/10 disabled:opacity-30 transition-colors shrink-0"
              style={{ color: "#8b949e" }}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            {/* Download */}
            <button
              onClick={downloadLogs}
              disabled={!logs || loadingLogs}
              title="Baixar logs"
              className="flex items-center justify-center h-6 w-6 rounded hover:bg-white/10 disabled:opacity-30 transition-colors shrink-0"
              style={{ color: "#8b949e" }}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Permission error ─────────────────────────────────────────────── */}
          {isPermissionError && (
            <div className="flex items-start gap-2 px-4 py-2.5 text-xs shrink-0" style={{ background: "#1a1200", borderBottom: "1px solid #30363d", color: "#e3b341" }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Permissão ausente no ClusterRole</p>
                <p className="mt-0.5 opacity-80">Adicione <code className="px-1 rounded font-mono" style={{ background: "#0d1117", color: "#79c0ff" }}>pods/log</code> ao ClusterRole do kodo-agent.</p>
              </div>
            </div>
          )}

          {/* ── Terminal ─────────────────────────────────────────────────────── */}
          <div className="flex-1 min-h-0 overflow-hidden mx-2 mb-2 sm:mx-3 sm:mb-3 mt-2 rounded-lg" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            {loadingLogs ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 min-h-[200px]">
                <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#3fb950" }} />
                <p className="text-sm" style={{ color: "#8b949e" }}>Aguardando resposta do agente...</p>
                <p className="text-xs" style={{ color: "#484f58" }}>O agente coleta os logs e retorna em até 30s</p>
              </div>
            ) : (
              <div
                ref={terminalRef}
                className="h-full overflow-y-auto p-2 sm:p-3 text-[11.5px] font-mono"
                style={{ color: "#e6edf3", scrollbarColor: "#30363d #0d1117" }}
              >
                {logs
                  ? logLines.map((line, idx) => renderLogLine(line, idx))
                  : <span style={{ color: "#484f58" }}>Nenhum log disponível</span>
                }
              </div>
            )}
          </div>

          {/* ── Status bar ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-3 py-1 shrink-0 text-[10px]" style={{ borderTop: "1px solid #21262d", color: "#484f58" }}>
            <div className="flex items-center gap-3">
              <span>{logLines.filter(Boolean).length} linhas</span>
              {hasPreviousLogs && !showPreviousLogs && (
                <button
                  onClick={() => setShowPreviousLogs(true)}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                  style={{ color: "#f47067" }}
                >
                  <History className="w-3 h-3" />
                  <span>container anterior oculto</span>
                </button>
              )}
              {lastUpdated && <span>atualizado {lastUpdated.toLocaleTimeString()}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span style={{ color: wrapLines ? "#58a6ff" : "#484f58" }}>wrap {wrapLines ? "on" : "off"}</span>
              <span style={{ color: showTimestamps ? "#58a6ff" : "#484f58" }}>ts {showTimestamps ? "on" : "off"}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
