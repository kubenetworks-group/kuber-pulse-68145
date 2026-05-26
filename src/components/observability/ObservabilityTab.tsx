import { GitBranch, BarChart2, Network, Terminal, RefreshCw, Clock } from "lucide-react";
import { TraceTimeline } from "@/components/observability/TraceTimeline";
import { ResourceUsageCharts } from "@/components/observability/ResourceUsageCharts";
import { ServicesOverview } from "@/components/observability/ServicesOverview";
import { PodLogViewer } from "@/components/observability/PodLogViewer";
import { ProblemTrendChart } from "@/components/risk/ProblemTrendChart";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { ClusterChange, UnstablePod, TrendData } from "@/hooks/useRiskAnalysis";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ObservabilityTabProps {
  changes: ClusterChange[];
  unstablePods: UnstablePod[];
  trends: TrendData[];
}

export function ObservabilityTab({ changes, unstablePods, trends }: ObservabilityTabProps) {
  const {
    pods, services,
    namespaceUsage, hasResourceData, loading, lastSync, refetch,
  } = useObservabilityData();

  const lastSyncFmt = lastSync
    ? format(new Date(lastSync), "HH:mm:ss", { locale: ptBR })
    : null;

  const errorPods   = pods.filter(p => ["Error", "CrashLoopBackOff", "OOMKilled", "Failed"].includes(p.status)).length;
  const runningPods = pods.filter(p => p.status === "Running").length;
  const totalSvcs   = services.length;
  const totalTraces = changes.length + unstablePods.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary + refresh bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center divide-x divide-border rounded-lg overflow-hidden border border-border bg-card">
          {[
            { label: "Traces",   value: totalTraces,  color: "#0F3CA5" },
            { label: "Pods OK",  value: runningPods,  color: "#16A34A" },
            { label: "Com erro", value: errorPods,    color: errorPods > 0 ? "#DC2626" : "var(--muted-foreground)" },
            { label: "Serviços", value: totalSvcs,    color: "#0F3CA5" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center px-4 py-2">
              <span className="font-medium tabular-nums leading-none"
                style={{ color, fontFamily: "'DM Mono', monospace", fontSize: 15 }}>
                {value}
              </span>
              <span className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider"
                style={{ fontFamily: "'Aileron', system-ui, sans-serif", fontWeight: 400 }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {lastSyncFmt && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              style={{ fontFamily: "'DM Mono', monospace" }}>
              <Clock className="w-3 h-3" />
              sync {lastSyncFmt}
            </span>
          )}
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            style={{ background: "none", border: "none", cursor: loading ? "not-allowed" : "pointer", padding: 0 }}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Sub-tabs — same shadcn pattern as Observability.tsx */}
      <Tabs defaultValue="trace" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="trace" className="gap-1.5 text-xs">
            <GitBranch className="w-3.5 h-3.5" />
            Traces
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-1.5 text-xs">
            <BarChart2 className="w-3.5 h-3.5" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5 text-xs">
            <Network className="w-3.5 h-3.5" />
            Serviços
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs">
            <Terminal className="w-3.5 h-3.5" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trace" className="space-y-4">
          <TraceTimeline changes={changes} unstablePods={unstablePods} />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-5">
          <ResourceUsageCharts
            namespaceUsage={namespaceUsage}
            loading={loading}
            hasResourceData={hasResourceData}
          />
          <ProblemTrendChart trends={trends} />
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <ServicesOverview services={services} loading={loading} />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <PodLogViewer pods={pods} onRefresh={refetch} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
