import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Search, Download, Copy, Loader2, FileText, AlertTriangle, RefreshCw } from "lucide-react";
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
}

export const PodLogViewer = ({ pods }: PodLogViewerProps) => {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const [selectedPod, setSelectedPod] = useState<PodData | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tailLines, setTailLines] = useState("200");
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [availableContainers, setAvailableContainers] = useState<string[]>([]);
  const [isPermissionError, setIsPermissionError] = useState(false);

  const fetchLogs = async (pod: PodData, containerOverride?: string) => {
    if (!selectedClusterId || !user) return;
    setSelectedPod(pod);
    setDialogOpen(true);
    setLoadingLogs(true);
    setLogs("");
    setIsPermissionError(false);

    const container = containerOverride || selectedContainer || "";

    try {
      const { data, error } = await supabase.from("agent_commands").insert({
        cluster_id: selectedClusterId,
        user_id: user.id,
        command_type: "get_pod_logs",
        command_params: {
          pod_name: pod.name,
          namespace: pod.namespace,
          tail_lines: parseInt(tailLines),
          ...(container ? { container_name: container } : {}),
        },
      }).select().single();

      if (error) throw error;

      const commandId = data.id;
      let attempts = 0;
      const maxAttempts = 30;

      const poll = async () => {
        attempts++;
        const { data: cmd } = await supabase
          .from("agent_commands")
          .select("status, result")
          .eq("id", commandId)
          .single();

        if (cmd?.status === "completed" && cmd.result) {
          const result = cmd.result as any;
          const logText = result.logs || result.output || "Sem logs disponíveis.";

          // Update available containers list from result
          if (result.all_containers && Array.isArray(result.all_containers)) {
            setAvailableContainers(result.all_containers);
            if (!selectedContainer && result.container) {
              setSelectedContainer(result.container);
            }
          }

          // Detect permission error
          if (logText.includes("ERRO DE PERMISSÃO") || logText.includes("Forbidden")) {
            setIsPermissionError(true);
          }

          setLogs(logText);
          setLoadingLogs(false);
        } else if (cmd?.status === "failed") {
          const result = cmd?.result as any;
          const errMsg = result?.error || "Falha ao obter logs";
          setIsPermissionError(errMsg.includes("403") || errMsg.includes("Forbidden"));
          setLogs(`Erro: ${errMsg}`);
          setLoadingLogs(false);
        } else if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setLogs("Timeout: O agente não respondeu a tempo. Verifique se o agente está ativo no cluster.");
          setLoadingLogs(false);
        }
      };

      setTimeout(poll, 2000);
    } catch (err: any) {
      setLogs(`Erro: ${err.message}`);
      setLoadingLogs(false);
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

  const filteredPods = pods.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.namespace.toLowerCase().includes(search.toLowerCase())
  );

  // Color-code log lines
  const colorizeLog = (line: string): string => {
    if (line.includes("ERROR") || line.includes("FATAL") || line.includes("error") || line.includes("Error")) {
      return `\x1b[31m${line}\x1b[0m`; // red — handled in CSS classes below
    }
    return line;
  };

  const renderLogLine = (line: string, idx: number) => {
    const isError = /error|ERROR|FATAL|fatal|Exception|exception|panic/i.test(line);
    const isWarn = /warn|WARN|warning|WARNING/i.test(line);
    const isSeparator = line.startsWith("===");

    return (
      <div
        key={idx}
        className={
          isSeparator
            ? "text-blue-400 font-semibold mt-3 mb-1"
            : isError
            ? "text-red-400"
            : isWarn
            ? "text-yellow-400"
            : "text-foreground/85"
        }
      >
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
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar pod por nome ou namespace..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
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
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Terminal className="w-4 h-4 text-green-400" />
                <span className="font-mono">{selectedPod?.namespace}/{selectedPod?.name}</span>
              </DialogTitle>
              <div className="flex items-center gap-2">
                {/* Container selector (shown when multi-container) */}
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
                      {availableContainers.map(c => (
                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

          {/* Permission error banner */}
          {isPermissionError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-400 mx-0">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Permissão ausente no ClusterRole</p>
                <p className="mt-0.5">Adicione <code className="bg-background/60 px-1 rounded">pods/log</code> ao ClusterRole do kodo-agent e aplique novamente o YAML de configuração.</p>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 min-h-0 rounded-lg border bg-[#0d1117]">
            {loadingLogs ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-green-400" />
                <p className="text-sm text-muted-foreground">Aguardando resposta do agente...</p>
                <p className="text-xs text-muted-foreground/60">O agente no cluster está processando a requisição</p>
              </div>
            ) : (
              <div className="p-4 text-[11px] font-mono leading-5">
                {logs
                  ? logs.split("\n").map((line, idx) => renderLogLine(line, idx))
                  : <span className="text-muted-foreground">Nenhum log disponível</span>
                }
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
