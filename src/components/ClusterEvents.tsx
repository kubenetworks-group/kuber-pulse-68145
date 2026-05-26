import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useTranslation } from "react-i18next";
import { AlertTriangle, XCircle, Radio } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KubernetesEvent {
  name?: string;
  namespace?: string;
  type: string;
  reason: string;
  message: string;
  count: number;
  first_time?: string;
  last_time?: string;
  firstTimestamp?: string;
  lastTimestamp?: string;
  involved_object?: { kind: string; name: string; namespace?: string };
  involvedObject?: { kind: string; name: string; namespace?: string };
  source?: string;
}

export const ClusterEvents = () => {
  const { t } = useTranslation();
  const { selectedClusterId } = useCluster();
  const [events, setEvents] = useState<KubernetesEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedClusterId) fetchEvents();
  }, [selectedClusterId]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data: metrics, error } = await supabase
        .from("agent_metrics")
        .select("*")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "events")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!metrics || metrics.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const metricData = metrics[0].metric_data as any;
      const eventsData = metricData?.events || [];

      const important = eventsData
        .map((e: KubernetesEvent) => ({
          ...e,
          lastTimestamp: e.last_time || e.lastTimestamp,
          firstTimestamp: e.first_time || e.firstTimestamp,
          involvedObject: e.involved_object || e.involvedObject,
          namespace:
            e.involved_object?.namespace ||
            e.involvedObject?.namespace ||
            e.namespace ||
            "default",
        }))
        .filter((e: KubernetesEvent) => e.type === "Warning" || e.type === "Error")
        .sort((a: KubernetesEvent, b: KubernetesEvent) => {
          const tA = a.lastTimestamp || a.last_time || "";
          const tB = b.lastTimestamp || b.last_time || "";
          return new Date(tB).getTime() - new Date(tA).getTime();
        })
        .slice(0, 20);

      setEvents(important);
    } catch (err) {
      console.error("Error fetching events:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts: string | undefined) => {
    if (!ts) return "—";
    const diffMs = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diffMs / 60000);
    const h = Math.floor(diffMs / 3600000);
    if (m < 1) return t("common.justNow");
    if (m < 60) return `${m}m ${t("common.ago")}`;
    if (h < 24) return `${h}h ${t("common.ago")}`;
    return new Date(ts).toLocaleString();
  };

  return (
    <Card className="overflow-hidden bg-card border-border/60 shadow-sm dark:bg-card/40 dark:shadow-none dark:backdrop-blur-sm">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl shrink-0"
            style={{ background: "var(--kodo-warn-muted)", border: "1px solid var(--kodo-warn-border)" }}
          >
            <Radio className="w-4 h-4" style={{ color: "var(--kodo-warn)" }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-none">
              {t("dashboard.clusterEvents")}
            </h3>
            {!loading && (
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">
                {events.length} evento{events.length !== 1 ? "s" : ""} recentes
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--kodo-warn)", borderTopColor: "transparent" }}
            />
          </div>
        ) : events.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground/30">
            <div
              className="size-2 rounded-full animate-pulse"
              style={{ background: "var(--kodo-brand)" }}
            />
            <p className="text-xs font-mono" style={{ color: "var(--kodo-brand)" }}>
              Nenhum evento crítico
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[380px] pr-1">
            <div className="space-y-2">
              {events.map((event, index) => {
                const isError = event.type === "Error";
                const accentColor = isError ? "var(--kodo-crit)" : "var(--kodo-warn)";
                const obj = event.involvedObject;

                return (
                  <div
                    key={`${event.namespace}-${event.name}-${index}`}
                    className="relative bg-muted/30 border border-border/50 rounded-lg p-3 hover:bg-muted/50 transition-all overflow-hidden dark:bg-card/30 dark:hover:bg-card/50"
                    style={{ borderLeftColor: accentColor, borderLeftWidth: "3px" }}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isError ? (
                          <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                        )}
                        <span
                          className="text-xs font-mono font-semibold"
                          style={{ color: accentColor }}
                        >
                          {event.reason}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 whitespace-nowrap">
                        {formatTimestamp(event.lastTimestamp)}
                      </span>
                    </div>

                    {/* Involved object */}
                    {obj && (
                      <p className="text-[11px] font-mono text-muted-foreground/60 mb-1.5 truncate">
                        {obj.kind}: {obj.name}
                      </p>
                    )}

                    {/* Message */}
                    <p className="text-xs text-foreground/80 leading-relaxed mb-2">
                      {event.message}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/40">
                      <span>ns:{event.namespace}</span>
                      {event.count > 1 && <span>×{event.count}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </Card>
  );
};
