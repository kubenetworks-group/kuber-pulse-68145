import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Terminal, Search, Download, Copy, Loader2, FileText, AlertTriangle, RefreshCw, Filter, RotateCcw, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PodData {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  cpu: string;
  memory: string;
  node: string;
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
  const liveTailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolvedRef = useRef(false);

  // The displayed pods: prefer fresh local data fetched on demand, fall back to prop
  const pods = localPods ?? podsProp;

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
    } else if (cmd.status === "failed") {
      resolvedRef.current = true;
      const errMsg = (cmd.result as any)?.error || "Falha ao obter logs";
      setIsPermissionError(errMsg.includes("403") || errMsg.includes("Forbidden"));
      setLogs(`Erro: ${errMsg}`);
      setLoadingLogs(false);
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
      resolvedRef.current = false;
    }
  }, [dialogOpen]);

  const fetchLogs = async (pod: PodData, containerOverride?: string) => {
    if (!selectedClusterId || !user) return;
    setSelectedPod(pod);
    setDialogOpen(true);
    setLoadingLogs(true);
    setLogs("");
    setIsPermissionError(false);
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
      if (selectedPod) fetchLogs(selectedPod, selectedContainer);
      liveTailTimerRef.current = setInterval(() => {
        if (selectedPod) fetchLogs(selectedPod, selectedContainer);
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

  const renderLogLine = (line: string, idx: number) => {
    if (!line) return <div key={idx} className="h-[1em]" />;

    // Section separator  === ... ===
    if (line.startsWith("===")) {
      return (
        <div key={idx} className="flex items-center gap-2 mt-4 mb-2">
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
        <div key={idx} className="flex gap-2 leading-[1.6] min-w-0">
          <span className="shrink-0 w-3 font-bold text-center" style={{ color: lvlColor }}>{lvl}</span>
          <span className="shrink-0 tabular-nums" style={{ color: "#484f58" }}>{ts}</span>
          <span className="shrink-0 max-w-[18ch] truncate" style={{ color: "#484f58" }} title={src}>{src}</span>
          <span className="break-all" style={{ color: msgColor }}>{msg}</span>
        </div>
      );
    }

    // Generic error / warn / info coloring
    const isError = /\b(error|ERROR|FATAL|fatal|Exception|panic|CRIT)\b|^E\d{4}/.test(line);
    const isWarn  = /\b(warn|WARN|warning|WARNING)\b|^W\d{4}/.test(line);

    return (
      <div key={idx} className="leading-[1.6] break-all" style={{ color: isError ? "#ffa198" : isWarn ? "#e3b341" : "#e6edf3" }}>
        {line}
      </div>
    );
  };

  return (
    <>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-green-400" />
              Logs de Containers
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleRefresh}
                disabled={podsLoading || externalLoading}
                title="Atualizar lista de pods"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${podsLoading || externalLoading ? "animate-spin" : ""}`} />
                Atualizar pods
              </Button>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Restart alert banner — shown when any pod has restarts */}
          {pods.some((p) => p.restarts > 0) && (
            <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {pods.filter((p) => p.restarts > 0).length} pod(s) com restarts detectados.
                  O Monitor IA analisa a causa e registra o histórico automaticamente.
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 text-amber-500 hover:text-amber-400 shrink-0"
                onClick={() => navigate("/ai-monitor")}
              >
                Ver Auditoria
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Search + namespace filter row */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar pod por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            {namespaces.length > 1 && (
              <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
                <SelectTrigger className="w-44 h-9 text-xs gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Namespace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os namespaces</SelectItem>
                  {namespaces.map((ns) => (
                    <SelectItem key={ns} value={ns} className="text-xs font-mono">
                      {ns}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {filteredPods.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                Nenhum pod encontrado
              </div>
            ) : (
              filteredPods.map((pod, i) => (
                <div
                  key={`${pod.namespace}-${pod.name}-${i}`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => {
                    setSelectedContainer("");
                    setAvailableContainers([]);
                    fetchLogs(pod);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs font-mono truncate">{pod.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5">{pod.namespace}</Badge>
                    {pod.restarts > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5">
                        {pod.restarts} restarts
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={pod.status === "Running" ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {pod.status}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Ver Logs
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl" style={{ background: "#161b22", border: "1px solid #30363d" }}>
          <DialogHeader className="px-4 pt-3 pb-3 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <DialogTitle className="flex items-center gap-2 text-sm" style={{ color: "#e6edf3" }}>
                <Terminal className="w-4 h-4" style={{ color: "#3fb950" }} />
                <span className="font-mono">{selectedPod?.namespace}/{selectedPod?.name}</span>
              </DialogTitle>
              <div className="flex items-center gap-2">
                {availableContainers.length > 1 && (
                  <Select
                    value={selectedContainer}
                    onValueChange={(v) => {
                      setSelectedContainer(v);
                      if (selectedPod) fetchLogs(selectedPod, v);
                    }}
                  >
                    <SelectTrigger className="w-44 h-7 text-xs">
                      <SelectValue placeholder="Container" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContainers.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant={liveTail ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 text-xs gap-1.5 ${liveTail ? "bg-green-900/40 text-green-300 hover:bg-green-900/60 border border-green-700/50" : ""}`}
                  onClick={toggleLiveTail}
                  disabled={!selectedPod}
                >
                  <div className={`w-2 h-2 rounded-full ${liveTail ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
                  {liveTail ? "Live" : "Live Tail"}
                </Button>
                {lastUpdated && (
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
                <Button
                  variant="ghost" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => selectedPod && fetchLogs(selectedPod, selectedContainer)}
                  disabled={loadingLogs}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyLogs} disabled={!logs || loadingLogs}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={downloadLogs} disabled={!logs || loadingLogs}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {isPermissionError && (
            <div className="flex items-start gap-2 px-4 py-3 text-xs" style={{ background: "#1a1200", borderBottom: "1px solid #30363d", color: "#e3b341" }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Permissão ausente no ClusterRole</p>
                <p className="mt-0.5 opacity-80">Adicione <code className="px-1 rounded font-mono" style={{ background: "#0d1117", color: "#79c0ff" }}>pods/log</code> ao ClusterRole do kodo-agent.</p>
              </div>
            </div>
          )}

          {/* Terminal — always dark regardless of app theme */}
          <div
            className="flex-1 min-h-0 overflow-hidden"
            style={{ background: "#0d1117", margin: "0 16px 16px 16px", borderRadius: "8px", border: "1px solid #21262d" }}
          >
            {loadingLogs ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#3fb950" }} />
                <p className="text-sm" style={{ color: "#8b949e" }}>Aguardando resposta do agente...</p>
                <p className="text-xs" style={{ color: "#484f58" }}>O agente coleta os logs e retorna em até 30s</p>
              </div>
            ) : (
              <div
                className="h-full overflow-y-auto p-4 text-[11.5px] font-mono"
                style={{ color: "#e6edf3", scrollbarColor: "#30363d #0d1117" }}
              >
                {logs
                  ? logs.split("\n").map((line, idx) => renderLogLine(line, idx))
                  : <span style={{ color: "#484f58" }}>Nenhum log disponível</span>
                }
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
