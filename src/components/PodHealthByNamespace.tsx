import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import { Layers, ChevronDown, ChevronUp, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PodInfo {
  name: string;
  status: string;
  namespace: string;
}

interface NamespaceHealth {
  namespace: string;
  healthy: number;
  warning: number;
  critical: number;
  total: number;
  pods: PodInfo[];
}

const NAMESPACE_COLORS = [
  "var(--kodo-brand)", "#6366f1", "var(--kodo-warn)", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316",
  "#3b82f6", "#10b981",
];

const POD_STATUS_MAP: Record<string, string> = {
  Running: "healthy", Succeeded: "healthy",
  Pending: "warning", Unknown: "warning",
  Failed: "critical", CrashLoopBackOff: "critical",
  Error: "critical", ImagePullBackOff: "critical", ErrImagePull: "critical",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border/60 rounded-lg p-3 shadow-xl text-xs font-mono">
      <p className="font-semibold text-foreground mb-1.5">{d.name}</p>
      <p className="text-muted-foreground/70">
        Total: <span className="text-foreground">{d.value} pods</span>
      </p>
      <p className="text-muted-foreground/70">
        Share: <span className="text-foreground">{d.percentage}%</span>
      </p>
      <div className="flex gap-2 mt-2 pt-2 border-t border-border/40">
        <span style={{ color: "var(--kodo-brand)" }}>●{d.healthy}</span>
        {d.warning > 0 && <span style={{ color: "var(--kodo-warn)" }}>●{d.warning}</span>}
        {d.critical > 0 && <span style={{ color: "var(--kodo-crit)" }}>●{d.critical}</span>}
      </div>
    </div>
  );
};

const statusColor = (status: string) => {
  const h = POD_STATUS_MAP[status] || "warning";
  if (h === "healthy") return "var(--kodo-brand)";
  if (h === "critical") return "var(--kodo-crit)";
  return "var(--kodo-warn)";
};

const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  const h = POD_STATUS_MAP[status] || "warning";
  if (h === "healthy") return "default";
  if (h === "critical") return "destructive";
  return "secondary";
};

export const PodHealthByNamespace = () => {
  const { t } = useTranslation();
  const { selectedClusterId } = useCluster();
  const [namespaceData, setNamespaceData] = useState<NamespaceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [expandedNamespace, setExpandedNamespace] = useState<string | null>(null);

  useEffect(() => {
    if (selectedClusterId) fetchPodData();
  }, [selectedClusterId]);

  const fetchPodData = async () => {
    setLoading(true);
    try {
      const { data: metrics, error } = await supabase
        .from("agent_metrics")
        .select("*")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "pod_details")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!metrics || metrics.length === 0) {
        setNamespaceData([]);
        setLoading(false);
        return;
      }

      const metricData = metrics[0].metric_data as any;
      const pods = metricData?.pods || [];
      const nsMap = new Map<string, NamespaceHealth>();

      pods.forEach((pod: any) => {
        const ns = pod.namespace || "default";
        if (!nsMap.has(ns)) {
          nsMap.set(ns, { namespace: ns, healthy: 0, warning: 0, critical: 0, total: 0, pods: [] });
        }
        const d = nsMap.get(ns)!;
        d.total++;
        const status = pod.status || pod.phase || "Unknown";
        const h = POD_STATUS_MAP[status] || "warning";
        d.pods.push({ name: pod.name || "unknown", status, namespace: ns });
        if (h === "critical") d.critical++;
        else if (h === "warning") d.warning++;
        else d.healthy++;
      });

      setNamespaceData(Array.from(nsMap.values()).sort((a, b) => b.total - a.total));
    } catch (err) {
      console.error("Error fetching pod data:", err);
      setNamespaceData([]);
    } finally {
      setLoading(false);
    }
  };

  const totalPods = namespaceData.reduce((s, ns) => s + ns.total, 0);
  const healthyPods = namespaceData.reduce((s, ns) => s + ns.healthy, 0);
  const warningPods = namespaceData.reduce((s, ns) => s + ns.warning, 0);
  const criticalPods = namespaceData.reduce((s, ns) => s + ns.critical, 0);

  const pieData = namespaceData.map((ns, i) => ({
    name: ns.namespace,
    value: ns.total,
    healthy: ns.healthy,
    warning: ns.warning,
    critical: ns.critical,
    pods: ns.pods,
    percentage: totalPods > 0 ? ((ns.total / totalPods) * 100).toFixed(0) : "0",
    color: NAMESPACE_COLORS[i % NAMESPACE_COLORS.length],
  }));

  return (
    <Card className="overflow-hidden bg-card border-border/60 shadow-sm dark:bg-card/40 dark:shadow-none dark:backdrop-blur-sm">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2.5 rounded-xl shrink-0"
              style={{ background: "var(--kodo-brand-muted)", border: "1px solid var(--kodo-brand-border)" }}
            >
              <Layers className="w-4 h-4" style={{ color: "var(--kodo-brand)" }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-none">
                {t("dashboard.podHealthByNamespace")}
              </h3>
              {!loading && (
                <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">
                  {totalPods} pods · {namespaceData.length} namespaces
                </p>
              )}
            </div>
          </div>

          {/* Status pills */}
          {!loading && totalPods > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
              <span
                className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-md border"
                style={{ color: "var(--kodo-brand)", borderColor: "var(--kodo-brand-border)", background: "var(--kodo-brand-muted)" }}
              >
                <span className="size-1.5 rounded-full inline-block" style={{ background: "var(--kodo-brand)" }} />
                {healthyPods}
              </span>
              {warningPods > 0 && (
                <span
                  className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-md border"
                  style={{ color: "var(--kodo-warn)", borderColor: "var(--kodo-warn-border)", background: "var(--kodo-warn-muted)" }}
                >
                  <span className="size-1.5 rounded-full inline-block" style={{ background: "var(--kodo-warn)" }} />
                  {warningPods}
                </span>
              )}
              {criticalPods > 0 && (
                <span
                  className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-md border"
                  style={{ color: "var(--kodo-crit)", borderColor: "var(--kodo-crit-border)", background: "var(--kodo-crit-muted)" }}
                >
                  <span className="size-1.5 rounded-full inline-block" style={{ background: "var(--kodo-crit)" }} />
                  {criticalPods}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--kodo-brand)", borderTopColor: "transparent" }}
            />
          </div>
        ) : pieData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground/30">
            <Layers className="w-8 h-8 opacity-20" />
            <p className="text-xs font-mono">{t("common.noData")}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Donut chart */}
              <div className="relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={800}
                      paddingAngle={2}
                      onMouseEnter={(_, i) => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(undefined)}
                    >
                      {pieData.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={entry.color}
                          stroke="hsl(var(--background))"
                          strokeWidth={activeIndex === i ? 3 : 1}
                          style={{
                            filter: activeIndex === i ? `drop-shadow(0 0 6px ${entry.color}60)` : undefined,
                            cursor: "pointer",
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <div className="text-2xl font-mono font-bold text-foreground tabular-nums">
                    {totalPods}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mt-0.5">
                    Total Pods
                  </div>
                </div>
              </div>

              {/* Namespace list */}
              <ScrollArea className="h-[260px] pr-1">
                <div className="space-y-1.5">
                  {pieData.map((item, index) => (
                    <Collapsible
                      key={item.name}
                      open={expandedNamespace === item.name}
                      onOpenChange={() =>
                        setExpandedNamespace(expandedNamespace === item.name ? null : item.name)
                      }
                    >
                      <CollapsibleTrigger asChild>
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                            activeIndex === index || expandedNamespace === item.name
                              ? "border-border bg-muted/50 dark:bg-card/60"
                              : "border-border/40 bg-transparent hover:bg-muted/30 hover:border-border/60 dark:bg-card/20 dark:hover:bg-card/40"
                          }`}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseLeave={() => setActiveIndex(undefined)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                              className="w-2.5 h-2.5 rounded shrink-0"
                              style={{ background: item.color }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-mono font-medium text-foreground truncate">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {item.healthy > 0 && (
                                  <span className="text-[9px] font-mono" style={{ color: "var(--kodo-brand)" }}>
                                    ●{item.healthy}
                                  </span>
                                )}
                                {item.warning > 0 && (
                                  <span className="text-[9px] font-mono" style={{ color: "var(--kodo-warn)" }}>
                                    ●{item.warning}
                                  </span>
                                )}
                                {item.critical > 0 && (
                                  <span className="text-[9px] font-mono" style={{ color: "var(--kodo-crit)" }}>
                                    ●{item.critical}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p
                                className="text-sm font-mono font-semibold tabular-nums"
                                style={{ color: item.color }}
                              >
                                {item.percentage}%
                              </p>
                              <p className="text-[10px] font-mono text-muted-foreground/50">
                                {item.value} pods
                              </p>
                            </div>
                            {expandedNamespace === item.name ? (
                              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-4 mt-1.5 mb-1 p-2.5 rounded-lg bg-muted/40 border border-border/40 space-y-1 dark:bg-muted/20 dark:border-border/30">
                          <p className="text-[10px] font-mono text-muted-foreground/50 mb-2">
                            pods em {item.name}:
                          </p>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {item.pods.map((pod, pi) => (
                              <div
                                key={`${pod.name}-${pi}`}
                                className="flex items-center justify-between gap-2 p-1.5 rounded bg-background/30 border border-border/20"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <Circle
                                    className="w-2 h-2 shrink-0"
                                    fill="currentColor"
                                    style={{ color: statusColor(pod.status) }}
                                  />
                                  <span className="text-[10px] font-mono text-foreground/80 truncate">
                                    {pod.name}
                                  </span>
                                </div>
                                <Badge
                                  variant={statusBadgeVariant(pod.status)}
                                  className="text-[9px] px-1.5 py-0.5 h-auto shrink-0"
                                >
                                  {pod.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Bottom stats */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/40">
              {[
                { label: t("common.healthy"), count: healthyPods, color: "var(--kodo-brand)" },
                { label: t("common.warning"), count: warningPods, color: "var(--kodo-warn)" },
                { label: t("common.critical"), count: criticalPods, color: "var(--kodo-crit)" },
              ].map(({ label, count, color }) => (
                <div key={label} className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="size-1.5 rounded-full" style={{ background: color }} />
                    <span className="text-[10px] font-mono text-muted-foreground/60">{label}</span>
                  </div>
                  <p className="text-lg font-mono font-bold tabular-nums" style={{ color }}>
                    {count}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/40">
                    {totalPods > 0 ? ((count / totalPods) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
