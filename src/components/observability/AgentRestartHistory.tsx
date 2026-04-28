import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCw, ArrowUpCircle, AlertTriangle, ChevronDown, ChevronUp, History, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RestartEvent {
  id: string;
  action_type: string;
  trigger_reason: string;
  action_details: {
    restart_count?: number;
    exit_code?: number;
    restart_reason?: string;
    agent_version?: string;
    pod_name?: string;
    solution_applied?: string;
    triggered_by?: string;
    previous_logs?: string;
    from_version?: string;
    to_version?: string;
    current_version?: string;
    target_version?: string;
  };
  status: string;
  created_at: string;
  completed_at?: string;
}

const eventConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  agent_restart: {
    icon: <RotateCw className="w-4 h-4" />,
    label: "Restart",
    color: "text-orange-500",
  },
  agent_auto_update: {
    icon: <ArrowUpCircle className="w-4 h-4" />,
    label: "Auto-update",
    color: "text-blue-500",
  },
  agent_update: {
    icon: <ArrowUpCircle className="w-4 h-4" />,
    label: "Update manual",
    color: "text-blue-500",
  },
};

const triggeredByBadge: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  oom: { label: "OOMKilled", variant: "destructive" },
  crash: { label: "Crash", variant: "destructive" },
  auto_update: { label: "Atualização", variant: "default" },
  manual: { label: "Manual", variant: "secondary" },
  unknown: { label: "Desconhecido", variant: "outline" },
};

export const AgentRestartHistory = () => {
  const { selectedClusterId } = useCluster();
  const [events, setEvents] = useState<RestartEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedClusterId) return;
    fetchEvents();
  }, [selectedClusterId]);

  const fetchEvents = async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("auto_heal_actions_log")
        .select("id, action_type, trigger_reason, action_details, status, created_at, completed_at")
        .eq("cluster_id", selectedClusterId)
        .in("action_type", ["agent_restart", "agent_auto_update", "agent_update"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        setEvents(data as RestartEvent[]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!selectedClusterId) return null;

  const config = (type: string) => eventConfig[type] ?? eventConfig.agent_restart;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            Histórico de Eventos do Agent
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchEvents} disabled={loading}>
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && events.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Carregando histórico...</p>
        )}

        {!loading && events.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum evento de restart ou update registrado ainda.
          </p>
        )}

        <div className="space-y-2">
          {events.map((event) => {
            const cfg = config(event.action_type);
            const details = event.action_details || {};
            const triggeredBy = details.triggered_by || "unknown";
            const badge = triggeredByBadge[triggeredBy] ?? triggeredByBadge.unknown;
            const isExpanded = expandedId === event.id;
            const hasPrevLogs = !!details.previous_logs;

            return (
              <div
                key={event.id}
                className="border rounded-lg p-3 space-y-2 bg-card"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cfg.color}>{cfg.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{event.trigger_reason}</p>
                      <p
                        className="text-[10px] text-muted-foreground"
                        title={format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss")}
                      >
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
                      {badge.label}
                    </Badge>
                    {event.action_type === "agent_restart" && details.restart_count !== undefined && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        #{details.restart_count}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Solution applied */}
                {details.solution_applied && (
                  <div className="flex items-start gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{details.solution_applied}</span>
                  </div>
                )}

                {/* Version info for updates */}
                {(details.from_version || details.current_version) && (
                  <p className="text-[11px] text-muted-foreground">
                    {details.from_version || details.current_version}
                    {" → "}
                    {details.to_version || details.target_version || details.agent_version}
                  </p>
                )}

                {/* Expand/collapse previous logs */}
                {hasPrevLogs && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 w-full justify-start gap-1"
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? "Ocultar logs anteriores" : "Ver logs do container anterior"}
                  </Button>
                )}

                {isExpanded && details.previous_logs && (
                  <ScrollArea className="h-40 w-full rounded border bg-muted/30">
                    <pre className="text-[10px] p-2 font-mono whitespace-pre-wrap break-all leading-relaxed">
                      {details.previous_logs}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
