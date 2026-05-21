import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Terminal,
  ChevronDown,
  ChevronUp,
  Bot,
  Clock,
  RotateCcw,
  FileText,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RemediationRecord {
  id: string;
  pod_name: string;
  namespace: string;
  container_name: string | null;
  restart_reason: string;
  exit_code: number | null;
  terminated_at: string | null;
  restart_count: number;
  analysis_summary: string | null;
  container_logs: string | null;
  remediation_status: string | null;
  remediation_action: string | null;
  remediation_result: any;
  remediation_at: string | null;
  episode_key: string | null;
  created_at: string;
}

export function PodRemediationPanel() {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const [records, setRecords] = useState<RemediationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<Set<string>>(new Set());

  const fetchRecords = useCallback(async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pod_restart_audit")
        .select("*")
        .eq("cluster_id", selectedClusterId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRecords((data || []) as RemediationRecord[]);
    } catch (err) {
      console.error("Error fetching remediation records:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedClusterId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Realtime: refresh when audit records are updated
  useEffect(() => {
    if (!selectedClusterId) return;
    const channel = supabase
      .channel(`pod-remediation-${selectedClusterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pod_restart_audit",
          filter: `cluster_id=eq.${selectedClusterId}`,
        },
        () => fetchRecords()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedClusterId, fetchRecords]);

  const pollCommandResult = async (commandId: string, recordId: string): Promise<boolean> => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data } = await supabase
        .from("agent_commands")
        .select("status, result")
        .eq("id", commandId)
        .maybeSingle();
      if (!data) continue;
      if (data.status === "completed") {
        await supabase
          .from("pod_restart_audit")
          .update({
            remediation_status: "fixed",
            remediation_result: data.result,
            remediation_at: new Date().toISOString(),
          })
          .eq("id", recordId);
        return true;
      }
      if (data.status === "failed") {
        const res = data.result as any;
        await supabase
          .from("pod_restart_audit")
          .update({
            remediation_status: "failed",
            remediation_result: data.result,
            remediation_at: new Date().toISOString(),
          })
          .eq("id", recordId);
        toast.error(`Falha ao reiniciar pod: ${res?.error || "erro desconhecido"}`);
        return false;
      }
    }
    await supabase
      .from("pod_restart_audit")
      .update({ remediation_status: "failed", remediation_result: { error: "Timeout" } })
      .eq("id", recordId);
    toast.error("Timeout: agente não respondeu");
    return false;
  };

  const handleApprove = async (record: RemediationRecord) => {
    if (!selectedClusterId || !user) return;
    setActing((prev) => new Set(prev).add(record.id));
    try {
      const proposal = record.remediation_result?.proposed ? record.remediation_result : null;
      const fixAction = proposal?.fix_action || "delete_pod";
      const actionLabel = proposal?.fix_description || `Reinício forçado do pod ${record.pod_name}`;

      await supabase
        .from("pod_restart_audit")
        .update({
          remediation_status: "executing",
          remediation_action: actionLabel,
          remediation_approved_by: user.id,
        })
        .eq("id", record.id);

      // Build command params based on the AI-proposed fix action
      let commandType = "delete_pod";
      let commandParams: Record<string, any> = { namespace: record.namespace, pod: record.pod_name };

      if (proposal?.fix_params && fixAction !== "delete_pod") {
        commandType = fixAction;
        commandParams = proposal.fix_params;
      }

      const { data: cmd, error: cmdError } = await supabase
        .from("agent_commands")
        .insert({
          cluster_id: selectedClusterId,
          user_id: user.id,
          command_type: commandType,
          command_params: commandParams,
          status: "pending",
        })
        .select()
        .single();

      if (cmdError || !cmd) throw cmdError;

      await supabase
        .from("pod_restart_audit")
        .update({ remediation_command_id: cmd.id })
        .eq("id", record.id);

      const toastId = toast.loading(`Aplicando correção em ${record.pod_name}...`);

      const ok = await pollCommandResult(cmd.id, record.id);
      if (ok) {
        toast.success(`Correção aplicada com sucesso em ${record.pod_name}`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (err: any) {
      await supabase
        .from("pod_restart_audit")
        .update({ remediation_status: "failed" })
        .eq("id", record.id);
      toast.error(err.message || "Erro ao executar remediação");
    } finally {
      setActing((prev) => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
      fetchRecords();
    }
  };

  const handleReject = async (record: RemediationRecord) => {
    await supabase
      .from("pod_restart_audit")
      .update({ remediation_status: "rejected", remediation_at: new Date().toISOString() })
      .eq("id", record.id);
    fetchRecords();
  };

  // Only show as "pending" if created within last 24h and not yet actioned
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pending = records.filter(
    (r) =>
      (r.remediation_status == null || r.remediation_status === "approved") &&
      new Date(r.created_at) > yesterday
  );
  const done = records.filter(
    (r) =>
      r.remediation_status === "fixed" ||
      r.remediation_status === "failed" ||
      r.remediation_status === "rejected" ||
      r.remediation_status === "executing" ||
      ((r.remediation_status == null) && new Date(r.created_at) <= yesterday)
  );

  const toggleLog = (id: string) =>
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const exitCodeColor = (code: number | null) => {
    if (code == null) return "text-muted-foreground";
    if (code === 0) return "text-green-500";
    if (code === 137 || code === 143) return "text-orange-500";
    return "text-red-500";
  };

  const exitCodeLabel = (code: number | null) => {
    if (code == null) return "?";
    if (code === 0) return "0 (OK)";
    if (code === 137) return "137 (OOMKill)";
    if (code === 143) return "143 (SIGTERM)";
    if (code === 1) return "1 (Error)";
    return `${code}`;
  };

  if (!selectedClusterId) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Bot className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Remediações de Pods</h3>
            <p className="text-[11px] text-muted-foreground">
              IA detectou problemas — aprove para reiniciar automaticamente
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs animate-pulse">
              {pending.length} aguardando aprovação
            </Badge>
          )}
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={fetchRecords} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-xl border border-border bg-card">
          <ShieldCheck className="h-8 w-8 text-green-500 opacity-70" />
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            Nenhum pod crítico detectado
          </p>
          <p className="text-[11px] text-muted-foreground">
            A IA não detectou pods com problemas recentes.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Pending approval ── */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {pending.length} pod(s) com problema — aguardando sua aprovação para reinício
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-card overflow-hidden divide-y divide-border/50">
                {pending.map((record) => (
                  <RemediationCard
                    key={record.id}
                    record={record}
                    expanded={expandedLogs.has(record.id)}
                    onToggleLog={() => toggleLog(record.id)}
                    acting={acting.has(record.id)}
                    onApprove={() => handleApprove(record)}
                    onReject={() => handleReject(record)}
                    exitCodeColor={exitCodeColor}
                    exitCodeLabel={exitCodeLabel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Done / history ── */}
          {done.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Histórico de remediações
              </p>
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
                <ScrollArea className="max-h-[400px]">
                  {done.map((record) => (
                    <RemediationHistoryRow
                      key={record.id}
                      record={record}
                      expanded={expandedLogs.has(record.id)}
                      onToggleLog={() => toggleLog(record.id)}
                      exitCodeColor={exitCodeColor}
                      exitCodeLabel={exitCodeLabel}
                    />
                  ))}
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pending card ─────────────────────────────────────────────────────────────

function RemediationCard({
  record,
  expanded,
  onToggleLog,
  acting,
  onApprove,
  onReject,
  exitCodeColor,
  exitCodeLabel,
}: {
  record: RemediationRecord;
  expanded: boolean;
  onToggleLog: () => void;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
  exitCodeColor: (c: number | null) => string;
  exitCodeLabel: (c: number | null) => string;
}) {
  const isExecuting = record.remediation_status === "executing";

  return (
    <div className="p-4 space-y-3">
      {/* Pod info row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-mono font-semibold">{record.pod_name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground">{record.namespace}</span>
              {record.container_name && (
                <span className="text-[11px] text-muted-foreground">· {record.container_name}</span>
              )}
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-orange-500 border-orange-500/30">
                {record.restart_count}x reiniciou
              </Badge>
              <span className={cn("text-[11px] font-mono font-medium", exitCodeColor(record.exit_code))}>
                exit {exitCodeLabel(record.exit_code)}
              </span>
            </div>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {record.terminated_at
            ? formatDistanceToNow(new Date(record.terminated_at), { addSuffix: true, locale: ptBR })
            : formatDistanceToNow(new Date(record.created_at), { addSuffix: true, locale: ptBR })}
        </span>
      </div>

      {/* AI analysis */}
      {record.analysis_summary ? (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-[12px] text-foreground/80 leading-relaxed">{record.analysis_summary}</p>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/40">
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0 animate-spin" />
          <p className="text-[12px] text-muted-foreground">Analisando causa do problema com IA...</p>
        </div>
      )}

      {/* Log toggle */}
      {record.container_logs && (
        <Collapsible open={expanded} onOpenChange={onToggleLog}>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] gap-1 text-muted-foreground">
              <Terminal className="h-3 w-3" />
              {expanded ? "Ocultar logs" : "Ver logs do container"}
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="max-h-40 mt-2">
              <pre className="text-[10px] font-mono leading-relaxed bg-black/30 p-2.5 rounded-lg whitespace-pre-wrap break-all text-green-400">
                {record.container_logs}
              </pre>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Proposed action */}
      {(() => {
        const proposal = record.remediation_result?.proposed ? record.remediation_result : null;
        const fixAction = proposal?.fix_action || "delete_pod";
        const fixDesc = proposal?.fix_description;
        const isPatch = fixAction === "patch_deployment";
        const isRestart = fixAction === "delete_pod";
        return (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 border border-border/60">
            <Zap className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Ação proposta:</span>{" "}
                {fixDesc || (isRestart ? "Reiniciar pod" : fixAction)}
              </p>
              {isPatch && proposal?.fix_params?.patch && (
                <code className="block text-[10px] font-mono bg-muted/60 px-2 py-1 rounded text-muted-foreground break-all">
                  kubectl patch deployment {proposal.fix_params.deployment_name} -n {proposal.fix_params.namespace} --patch '...'
                </code>
              )}
              {isRestart && (
                <code className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground">
                  kubectl delete pod {record.pod_name} -n {record.namespace}
                </code>
              )}
            </div>
          </div>
        );
      })()}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="gap-1.5 h-8 bg-green-600 hover:bg-green-700 text-white"
          onClick={onApprove}
          disabled={acting || isExecuting}
        >
          {acting || isExecuting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {isExecuting
            ? "Aplicando..."
            : record.remediation_result?.fix_action === "patch_deployment"
              ? "Aprovar correção"
              : "Aprovar reinício"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-muted-foreground hover:text-foreground"
          onClick={onReject}
          disabled={acting || isExecuting}
        >
          <XCircle className="h-3.5 w-3.5" />
          Rejeitar
        </Button>
      </div>
    </div>
  );
}

// ── History row ──────────────────────────────────────────────────────────────

function RemediationHistoryRow({
  record,
  expanded,
  onToggleLog,
  exitCodeColor,
  exitCodeLabel,
}: {
  record: RemediationRecord;
  expanded: boolean;
  onToggleLog: () => void;
  exitCodeColor: (c: number | null) => string;
  exitCodeLabel: (c: number | null) => string;
}) {
  const isFixed = record.remediation_status === "fixed";
  const isFailed = record.remediation_status === "failed";
  const isRejected = record.remediation_status === "rejected";
  const isExecuting = record.remediation_status === "executing";

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isFixed && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
          {isFailed && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
          {isRejected && <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
          {isExecuting && <Loader2 className="h-4 w-4 text-blue-400 shrink-0 animate-spin" />}
          <span className="text-sm font-mono font-medium">{record.pod_name}</span>
          <span className="text-[11px] text-muted-foreground">{record.namespace}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {record.restart_count}x
          </Badge>
          <span className={cn("text-[11px] font-mono", exitCodeColor(record.exit_code))}>
            exit {exitCodeLabel(record.exit_code)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isFixed && (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px] h-5">
              Corrigido
            </Badge>
          )}
          {isFailed && (
            <Badge variant="destructive" className="text-[10px] h-5">
              Falhou
            </Badge>
          )}
          {isRejected && (
            <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
              Rejeitado
            </Badge>
          )}
          {isExecuting && (
            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-[10px] h-5">
              Executando...
            </Badge>
          )}
          {record.remediation_at && (
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(record.remediation_at), "dd/MM HH:mm", { locale: ptBR })}
            </span>
          )}
        </div>
      </div>

      {/* Remediation report */}
      {(isFixed || isFailed) && (
        <Collapsible open={expanded} onOpenChange={onToggleLog}>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] gap-1 text-muted-foreground">
              <FileText className="h-3 w-3" />
              Ver relatório
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2 text-[11px]">
              {/* Root cause badge */}
              {record.remediation_result?.root_cause && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Causa raiz:</span>
                  <code className="text-[10px] font-mono bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded">
                    {record.remediation_result.root_cause}
                  </code>
                </div>
              )}
              {/* Problem */}
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                <p className="font-semibold text-foreground/70 mb-1 uppercase tracking-wide text-[10px]">Diagnóstico da IA</p>
                <p className="text-foreground/80 leading-relaxed">{record.analysis_summary}</p>
              </div>
              {/* Action taken */}
              {record.remediation_action && (
                <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <p className="font-semibold text-blue-400 mb-1 uppercase tracking-wide text-[10px]">Ação executada</p>
                  <p className="text-foreground/80">{record.remediation_action}</p>
                </div>
              )}
              {/* Patch applied */}
              {record.remediation_result?.fix_params?.patch && (
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                  <p className="font-semibold text-foreground/70 mb-1 uppercase tracking-wide text-[10px]">Patch aplicado</p>
                  <ScrollArea className="max-h-28">
                    <pre className="font-mono text-[10px] text-foreground/70 whitespace-pre-wrap break-all">
                      {JSON.stringify(record.remediation_result.fix_params.patch, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
              {/* Result */}
              {record.remediation_result && (
                <div className={cn(
                  "p-2.5 rounded-lg border",
                  isFixed ? "bg-green-500/5 border-green-500/10" : "bg-red-500/5 border-red-500/10"
                )}>
                  <p className={cn(
                    "font-semibold mb-1 uppercase tracking-wide text-[10px]",
                    isFixed ? "text-green-500" : "text-red-500"
                  )}>
                    {isFixed ? "Resultado" : "Erro"}
                  </p>
                  <pre className="text-foreground/80 whitespace-pre-wrap break-all font-mono text-[10px]">
                    {typeof record.remediation_result === "string"
                      ? record.remediation_result
                      : JSON.stringify(record.remediation_result, null, 2)}
                  </pre>
                </div>
              )}
              {/* Logs */}
              {record.container_logs && (
                <div className="p-2.5 rounded-lg bg-black/30 border border-border/40">
                  <p className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide text-[10px]">Logs do container (antes do crash)</p>
                  <ScrollArea className="max-h-32">
                    <pre className="font-mono text-[10px] text-green-400 whitespace-pre-wrap break-all leading-relaxed">
                      {record.container_logs}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
