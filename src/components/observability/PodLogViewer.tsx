import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Search, Download, Copy, Loader2, FileText } from "lucide-react";
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
  const [tailLines, setTailLines] = useState("100");

  const fetchLogs = async (pod: PodData) => {
    if (!selectedClusterId || !user) return;
    setSelectedPod(pod);
    setDialogOpen(true);
    setLoadingLogs(true);
    setLogs("");

    try {
      // Create a command to fetch logs from the agent
      const { data, error } = await supabase.from("agent_commands").insert({
        cluster_id: selectedClusterId,
        user_id: user.id,
        command_type: "get_pod_logs",
        command_params: {
          pod_name: pod.name,
          namespace: pod.namespace,
          tail_lines: parseInt(tailLines),
        },
      }).select().single();

      if (error) throw error;

      // Poll for the result
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
          setLogs(result.logs || result.output || "Sem logs disponíveis");
          setLoadingLogs(false);
        } else if (cmd?.status === "failed") {
          const result = cmd?.result as any;
          setLogs(`Erro: ${result?.error || "Falha ao obter logs"}`);
          setLoadingLogs(false);
        } else if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setLogs("Timeout: O agente não respondeu a tempo. Verifique se o agente está ativo.");
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

  const highlightedLogs = logs;

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
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 linhas</SelectItem>
                  <SelectItem value="100">100 linhas</SelectItem>
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
                  onClick={() => fetchLogs(pod)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs font-mono truncate">{pod.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5">{pod.namespace}</Badge>
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
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                {selectedPod?.namespace}/{selectedPod?.name}
              </DialogTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyLogs} disabled={!logs}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={downloadLogs} disabled={!logs}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {loadingLogs ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Aguardando resposta do agente...</p>
                <p className="text-xs text-muted-foreground">O agente precisa estar ativo no cluster</p>
              </div>
            ) : (
              <pre className="text-xs font-mono bg-background/80 rounded-lg p-4 whitespace-pre-wrap break-all leading-relaxed text-foreground/90">
                {highlightedLogs || "Nenhum log disponível"}
              </pre>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
