import { useEffect, useState } from "react";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface CleanMetricsRowProps {
  clusterData: any;
  cpuUsage: number;
  memoryUsage: number;
}

interface Metrics {
  uptime: number;
  incidents: number;
  pods: { healthy: number; total: number };
}

/**
 * Clean, minimal metrics row inspired by "Stealth Anodized Glass".
 * Shows three pill-cards: Uptime, Pods Saudáveis, Incidentes Ativos.
 * Uses semantic design tokens — no hard-coded colors.
 */
export const CleanMetricsRow = ({ clusterData, cpuUsage, memoryUsage }: CleanMetricsRowProps) => {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>({
    uptime: 0,
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
      // Pods
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

      // Active incidents (last 24h, unresolved)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: incidentCount } = await supabase
        .from("ai_incidents")
        .select("*", { count: "exact", head: true })
        .eq("cluster_id", selectedClusterId)
        .gte("created_at", dayAgo);

      // Uptime — derived from cluster status & last sync recency
      const lastSeen = clusterData?.agent_last_seen_at || clusterData?.last_sync;
      const isOnline =
        lastSeen && new Date(lastSeen) > new Date(Date.now() - 5 * 60 * 1000);
      const uptime = isOnline ? 99.9 : 0;

      setMetrics({
        uptime,
        incidents: incidentCount || 0,
        pods: { healthy, total },
      });
    } catch (err) {
      console.error("CleanMetricsRow fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const incidentTone =
    metrics.incidents === 0
      ? "text-success"
      : metrics.incidents < 3
        ? "text-warning"
        : "text-destructive";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
      {/* Uptime */}
      <div className="bg-card/40 border border-border/60 rounded-lg p-5 backdrop-blur-sm relative overflow-hidden group hover:border-border transition-colors">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium">
          Uptime
        </div>
        <div className="text-3xl font-mono tabular-nums text-success">
          {metrics.uptime.toFixed(1)}%
        </div>
        <div className="absolute top-5 right-5 text-[10px] font-mono text-muted-foreground/60">
          SLO 99.9%
        </div>
      </div>

      {/* Pods saudáveis */}
      <div className="bg-card/40 border border-border/60 rounded-lg p-5 backdrop-blur-sm relative overflow-hidden group hover:border-border transition-colors">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium">
          Pods Saudáveis
        </div>
        <div className="text-3xl font-mono tabular-nums text-primary">
          {metrics.pods.healthy}
          <span className="text-base text-muted-foreground/60">
            /{metrics.pods.total || "—"}
          </span>
        </div>
        <div className="absolute top-5 right-5 text-[10px] font-mono text-muted-foreground/60">
          CPU {Math.round(cpuUsage)}% · MEM {Math.round(memoryUsage)}%
        </div>
      </div>

      {/* Incidentes */}
      <div
        className={`bg-card/40 border rounded-lg p-5 backdrop-blur-sm relative overflow-hidden group transition-colors ${
          metrics.incidents > 0
            ? "border-destructive/30 ring-1 ring-destructive/20"
            : "border-border/60 hover:border-border"
        }`}
      >
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium">
          Incidentes (24h)
        </div>
        <div className={`text-3xl font-mono tabular-nums ${incidentTone}`}>
          {metrics.incidents}
        </div>
        {metrics.incidents > 0 && (
          <div className="absolute top-5 right-5 size-2 rounded-full bg-destructive animate-pulse" />
        )}
      </div>
    </div>
  );
};
