import { useEffect, useState } from "react";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, HardDrive, Layers, Server, AlertTriangle } from "lucide-react";

interface CleanMetricsRowProps {
  clusterData: any;
  cpuUsage: number;
  memoryUsage: number;
  totalNodes: number;
  readyNodes: number;
}

interface Metrics {
  incidents: number;
  pods: { healthy: number; total: number };
}

function usageColor(pct: number): string {
  if (pct < 60) return "var(--kodo-brand)";
  if (pct < 80) return "var(--kodo-warn)";
  return "var(--kodo-crit)";
}

function UsageBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div className="mt-2.5 h-[3px] rounded-full bg-foreground/10 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

interface MetricCardProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  valueSuffix?: string;
  valueColor: string;
  sub: string;
  bar?: React.ReactNode;
  accent: string;
  pulse?: boolean;
}

function MetricCard({
  label,
  icon,
  value,
  valueSuffix,
  valueColor,
  sub,
  bar,
  accent,
  pulse,
}: MetricCardProps) {
  return (
    <div
      className="relative bg-card border border-border/60 rounded-xl p-4 overflow-hidden transition-all duration-200 hover:border-border shadow-sm group dark:bg-card/40 dark:shadow-none dark:backdrop-blur-sm"
      style={{ borderTopColor: accent, borderTopWidth: "2px" }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
          {label}
        </span>
        <span className="opacity-60 group-hover:opacity-100 transition-opacity">{icon}</span>
      </div>

      <div className="flex items-baseline gap-0.5 leading-none">
        <span
          className="text-2xl font-mono font-semibold tabular-nums"
          style={{ color: valueColor }}
        >
          {value}
        </span>
        {valueSuffix && (
          <span className="text-sm font-mono text-muted-foreground/40">{valueSuffix}</span>
        )}
      </div>

      {bar}

      <p className="text-[10px] font-mono text-muted-foreground/50 mt-1.5 truncate">{sub}</p>

      {pulse && (
        <span className="absolute top-3 right-3 size-1.5 rounded-full bg-red-500 animate-pulse" />
      )}
    </div>
  );
}

export const CleanMetricsRow = ({
  clusterData,
  cpuUsage,
  memoryUsage,
  totalNodes,
  readyNodes,
}: CleanMetricsRowProps) => {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>({
    incidents: 0,
    pods: { healthy: 0, total: 0 },
  });

  useEffect(() => {
    if (selectedClusterId && user) {
      void fetchMetrics();
    }
  }, [selectedClusterId, user]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { data: podsData } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "pods")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let healthy = 0;
      let total = 0;
      const md = podsData?.metric_data as any;
      if (Array.isArray(md)) {
        total = md.length;
        healthy = md.filter((p: any) => {
          const phase = p.status?.phase?.toLowerCase() || "";
          const allReady = (p.status?.containerStatuses || []).every((c: any) => c.ready);
          return phase === "running" && allReady;
        }).length;
      } else if (md && typeof md === "object" && md.total !== undefined) {
        total = md.total || 0;
        healthy = md.running || 0;
      }

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: incidentCount } = await supabase
        .from("ai_incidents")
        .select("*", { count: "exact", head: true })
        .eq("cluster_id", selectedClusterId)
        .gte("created_at", dayAgo);

      setMetrics({ incidents: incidentCount || 0, pods: { healthy, total } });
    } catch (err) {
      console.error("CleanMetricsRow fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // keep clusterData in scope (used for uptime in prior version, now just cluster check)
  void clusterData;

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const cpuPct = Math.round(cpuUsage);
  const memPct = Math.round(memoryUsage);
  const podPct = metrics.pods.total > 0
    ? Math.round((metrics.pods.healthy / metrics.pods.total) * 100)
    : 100;
  const nodePct = totalNodes > 0 ? Math.round((readyNodes / totalNodes) * 100) : 100;

  const cpuCol = usageColor(cpuPct);
  const memCol = usageColor(memPct);
  const podCol = podPct >= 90 ? "var(--kodo-brand)" : podPct >= 70 ? "var(--kodo-warn)" : "var(--kodo-crit)";
  const nodeCol = nodePct === 100 ? "var(--kodo-brand)" : "var(--kodo-warn)";
  const incidentCol = metrics.incidents === 0 ? "var(--kodo-brand)" : "var(--kodo-crit)";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
      <MetricCard
        label="CPU"
        icon={<Cpu className="w-3.5 h-3.5" style={{ color: cpuCol }} />}
        value={`${cpuPct}%`}
        valueColor={cpuCol}
        sub="uso atual"
        bar={<UsageBar value={cpuPct} color={cpuCol} />}
        accent={cpuCol}
      />

      <MetricCard
        label="Memória"
        icon={<HardDrive className="w-3.5 h-3.5" style={{ color: memCol }} />}
        value={`${memPct}%`}
        valueColor={memCol}
        sub="uso atual"
        bar={<UsageBar value={memPct} color={memCol} />}
        accent={memCol}
      />

      <MetricCard
        label="Pods"
        icon={<Layers className="w-3.5 h-3.5" style={{ color: podCol }} />}
        value={String(metrics.pods.healthy)}
        valueSuffix={`/${metrics.pods.total || "—"}`}
        valueColor={podCol}
        sub={`${podPct}% saudáveis`}
        bar={<UsageBar value={metrics.pods.healthy} max={Math.max(metrics.pods.total, 1)} color={podCol} />}
        accent={podCol}
      />

      <MetricCard
        label="Nodes"
        icon={<Server className="w-3.5 h-3.5" style={{ color: nodeCol }} />}
        value={String(readyNodes)}
        valueSuffix={`/${totalNodes || "—"}`}
        valueColor={nodeCol}
        sub={`${nodePct}% prontos`}
        bar={<UsageBar value={readyNodes} max={Math.max(totalNodes, 1)} color={nodeCol} />}
        accent={nodeCol}
      />

      <MetricCard
        label="Incidentes 24h"
        icon={<AlertTriangle className="w-3.5 h-3.5" style={{ color: incidentCol }} />}
        value={String(metrics.incidents)}
        valueColor={incidentCol}
        sub={metrics.incidents === 0 ? "tudo normal" : "requerem atenção"}
        accent={incidentCol}
        pulse={metrics.incidents > 0}
      />
    </div>
  );
};
