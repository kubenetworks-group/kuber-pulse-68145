import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Terminal, Server, Activity, AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface ClusterRow {
  id: string;
  name: string;
  provider: string;
  status: string;
  agent_version: string | null;
  agent_last_seen_at: string | null;
  agent_pod_name: string | null;
  agent_pod_namespace: string | null;
  agent_pod_phase: string | null;
  agent_container_restart_count: number | null;
  owner: { email: string; full_name: string | null } | null;
}

interface LogEntry {
  id: string;
  pod_name: string;
  pod_phase: string;
  container_state: string;
  container_restart_count: number;
  log_lines: string;
  collected_at: string;
}

interface ClusterDetail {
  cluster: ClusterRow;
  logs: LogEntry[];
}

export function AdminSupportTab() {
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<ClusterDetail | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.functions.invoke("admin-get-agent-logs", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      setClusters(data.clusters ?? []);
    } catch {
      toast.error("Erro ao carregar clusters");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  const openLogs = async (cluster: ClusterRow) => {
    setLogsLoading(true);
    setSelectedCluster(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/admin-get-agent-logs?cluster_id=${cluster.id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!resp.ok) throw new Error(await resp.text());
      const json = await resp.json();
      setSelectedCluster(json);
      setExpandedLog(json.logs?.[0]?.id ?? null);
    } catch {
      toast.error("Erro ao carregar logs");
    } finally {
      setLogsLoading(false);
    }
  };

  const podPhaseBadge = (phase: string | null) => {
    if (!phase) return <Badge variant="secondary">Desconhecido</Badge>;
    const v = phase.toLowerCase();
    if (v === "running") return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">{phase}</Badge>;
    if (v === "pending") return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">{phase}</Badge>;
    return <Badge variant="destructive">{phase}</Badge>;
  };

  const agentSeenStatus = (lastSeen: string | null) => {
    if (!lastSeen) return { label: "Nunca conectou", ok: false };
    const diff = Date.now() - new Date(lastSeen).getTime();
    const ok = diff < 5 * 60 * 1000; // 5 min
    return {
      label: formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: ptBR }),
      ok,
    };
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Suporte — Pods do Agente
            </CardTitle>
            <CardDescription>
              Visualize o status e logs do pod kodo-agent instalado no cluster do cliente, sem precisar acessar a conta dele.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchClusters} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando clusters...
            </div>
          ) : clusters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum cluster encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Cluster</TableHead>
                  <TableHead>Versão do Agente</TableHead>
                  <TableHead>Pod</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Restarts</TableHead>
                  <TableHead>Último contato</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clusters.map((c) => {
                  const seen = agentSeenStatus(c.agent_last_seen_at);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{c.owner?.email ?? "—"}</div>
                        {c.owner?.full_name && (
                          <div className="text-xs text-muted-foreground">{c.owner.full_name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{c.provider}</span>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{c.agent_version ?? "—"}</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">{c.agent_pod_name ?? "—"}</code>
                      </TableCell>
                      <TableCell>{podPhaseBadge(c.agent_pod_phase)}</TableCell>
                      <TableCell>
                        {c.agent_container_restart_count != null ? (
                          <span className={c.agent_container_restart_count > 3 ? "text-destructive font-bold" : ""}>
                            {c.agent_container_restart_count}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {seen.ok
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            : <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
                          <span className="text-xs">{seen.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => openLogs(c)}
                          disabled={logsLoading}
                        >
                          <Terminal className="h-3.5 w-3.5" />
                          Ver logs
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Logs modal */}
      <Dialog open={!!selectedCluster || logsLoading} onOpenChange={() => setSelectedCluster(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              {selectedCluster ? (
                <>
                  Logs do agente — <span className="text-primary">{selectedCluster.cluster.name}</span>
                  <span className="text-muted-foreground text-sm font-normal ml-1">
                    ({selectedCluster.cluster.owner?.email})
                  </span>
                </>
              ) : "Carregando logs..."}
            </DialogTitle>
          </DialogHeader>

          {logsLoading && (
            <div className="flex items-center justify-center flex-1 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Buscando logs do pod...
            </div>
          )}

          {selectedCluster && !logsLoading && (
            <div className="flex flex-col gap-3 flex-1 overflow-hidden">
              {/* Pod summary */}
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="rounded-lg border p-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Pod</p>
                  <code className="text-xs">{selectedCluster.cluster.agent_pod_name ?? "—"}</code>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Namespace</p>
                  <code className="text-xs">{selectedCluster.cluster.agent_pod_namespace ?? "kodo"}</code>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Fase</p>
                  {podPhaseBadge(selectedCluster.cluster.agent_pod_phase)}
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Restarts</p>
                  <span className={
                    (selectedCluster.cluster.agent_container_restart_count ?? 0) > 3
                      ? "text-destructive font-bold text-sm"
                      : "text-sm"
                  }>
                    {selectedCluster.cluster.agent_container_restart_count ?? 0}
                  </span>
                </div>
              </div>

              {/* Log snapshots */}
              {selectedCluster.logs.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <Activity className="h-8 w-8 mr-2 opacity-30" />
                  Nenhum log coletado ainda. O agente envia logs a cada 5 minutos.
                </div>
              ) : (
                <ScrollArea className="flex-1 rounded-lg border">
                  <div className="p-2 space-y-2">
                    {selectedCluster.logs.map((log) => (
                      <div key={log.id} className="rounded-md border overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        >
                          <div className="flex items-center gap-3 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="font-mono">
                              {format(new Date(log.collected_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </span>
                            {podPhaseBadge(log.pod_phase)}
                            <span className="text-xs text-muted-foreground">{log.container_state}</span>
                            {log.container_restart_count > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {log.container_restart_count} restarts
                              </Badge>
                            )}
                          </div>
                          {expandedLog === log.id
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        {expandedLog === log.id && (
                          <pre className="p-3 text-xs font-mono bg-background leading-relaxed whitespace-pre-wrap break-all overflow-auto max-h-96 text-green-400">
                            {log.log_lines || "(sem linhas de log)"}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
