import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Server, Cpu, HardDrive, Activity, Layers, Shield, RefreshCw } from "lucide-react";

interface NodeInfo {
  name: string;
  cpu: number;
  memory: string | number;
  memoryGB: number;
  memoryUsageGB?: number;
  cpuCapacity?: number;
  memoryCapacity?: number;
  cpuPercent?: number;
  memoryPercent?: number;
  status: string;
  pool: string;
  osImage?: string;
  kernelVersion?: string;
  containerRuntime?: string;
  labels?: Record<string, string>;
}

interface NodeDetailsCardProps {
  nodes: NodeInfo[];
  totalCPU: number;
  totalMemory: number;
  cpuUsage: number;
  memoryUsage: number;
  loading: boolean;
  collectedAt?: Date | null;
  onRefresh?: () => void;
}

function usageColor(pct: number): string {
  if (pct < 60) return "var(--kodo-brand)";
  if (pct < 80) return "var(--kodo-warn)";
  return "var(--kodo-crit)";
}

function ThinBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-[3px] rounded-full bg-foreground/10 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(value, 100)}%`, background: color }}
      />
    </div>
  );
}

export const NodeDetailsCard = ({
  nodes,
  totalCPU,
  totalMemory,
  cpuUsage,
  memoryUsage,
  loading,
  collectedAt,
  onRefresh,
}: NodeDetailsCardProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const [dataAge, setDataAge] = useState("");

  useEffect(() => {
    const update = () => {
      if (!collectedAt) { setDataAge(""); return; }
      const s = Math.floor((Date.now() - collectedAt.getTime()) / 1000);
      if (s < 60) setDataAge(`${s}s atrás`);
      else if (s < 3600) setDataAge(`${Math.floor(s / 60)}m atrás`);
      else setDataAge(`${Math.floor(s / 3600)}h atrás`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [collectedAt]);

  const handleRefresh = () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 1500);
  };

  if (loading) {
    return (
      <Card className="overflow-hidden bg-card/40 border-border/60">
        <div className="flex items-center justify-center h-56">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--kodo-brand)", borderTopColor: "transparent" }}
          />
        </div>
      </Card>
    );
  }

  const controlPlaneNodes = nodes.filter((n) => n.pool === "control-plane");
  const workerNodes = nodes.filter((n) => n.pool !== "control-plane");
  const readyCount = nodes.filter((n) => n.status === "Ready").length;

  const cpuCol = usageColor(cpuUsage);
  const memCol = usageColor(memoryUsage);

  const renderNodeCard = (node: NodeInfo) => {
    const isReady = node.status === "Ready";
    const nodeCpuPct = (node as any).cpuPercent || 0;
    const nodeMemPct = (node as any).memoryPercent || 0;
    const nodeAccent = isReady ? "var(--kodo-brand)" : "var(--kodo-crit)";

    return (
      <div
        key={node.name}
        className="relative bg-card border border-border/60 rounded-xl p-4 transition-all hover:border-border shadow-sm overflow-hidden dark:bg-card/40 dark:shadow-none"
        style={{ borderTopColor: nodeAccent, borderTopWidth: "2px" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{ background: nodeAccent }}
              />
              <span className="font-mono text-xs font-semibold truncate text-foreground/90">
                {node.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                style={{
                  color: nodeAccent,
                  borderColor: `${nodeAccent}40`,
                  background: `${nodeAccent}10`,
                }}
              >
                {node.status}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1 h-auto">
                <Layers className="w-2.5 h-2.5" />
                {node.pool}
              </Badge>
            </div>
          </div>
          <Activity
            className="w-4 h-4 shrink-0"
            style={{ color: nodeAccent, opacity: 0.7 }}
          />
        </div>

        {/* Resources */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                CPU
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-mono font-semibold tabular-nums" style={{ color: usageColor(nodeCpuPct) }}>
                {((node.cpu || 0) / 1000).toFixed(1)}
              </span>
              <span className="text-[10px] text-muted-foreground/50 font-mono">
                /{((((node as any).cpuCapacity || 0) / 1000).toFixed(0))} c
              </span>
            </div>
            <ThinBar value={nodeCpuPct} color={usageColor(nodeCpuPct)} />
            <span className="text-[10px] font-mono text-muted-foreground/50">{nodeCpuPct.toFixed(1)}%</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                RAM
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-mono font-semibold tabular-nums" style={{ color: usageColor(nodeMemPct) }}>
                {((node as any).memoryUsageGB || 0).toFixed(1)}
              </span>
              <span className="text-[10px] text-muted-foreground/50 font-mono">
                /{node.memoryGB.toFixed(0)} GB
              </span>
            </div>
            <ThinBar value={nodeMemPct} color={usageColor(nodeMemPct)} />
            <span className="text-[10px] font-mono text-muted-foreground/50">{nodeMemPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* System info */}
        {(node.osImage || node.kernelVersion) && (
          <div className="pt-2.5 border-t border-border/30 space-y-1.5">
            {node.osImage && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-muted-foreground/50 w-10 shrink-0">OS</span>
                <span className="text-muted-foreground/70 truncate bg-muted/20 px-1.5 py-0.5 rounded">
                  {node.osImage}
                </span>
              </div>
            )}
            {node.kernelVersion && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-muted-foreground/50 w-10 shrink-0">Kernel</span>
                <span className="text-muted-foreground/70 truncate bg-muted/20 px-1.5 py-0.5 rounded">
                  {node.kernelVersion}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="overflow-hidden bg-card border-border/60 shadow-sm dark:bg-card/40 dark:shadow-none dark:backdrop-blur-sm">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2.5 rounded-xl shrink-0"
              style={{ background: "var(--kodo-brand-muted)", border: "1px solid var(--kodo-brand-border)" }}
            >
              <Server className="w-4 h-4" style={{ color: "var(--kodo-brand)" }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-none">
                Node Infrastructure
              </h3>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">
                {nodes.length} nodes
                {dataAge && ` · ${dataAge}`}
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">sync</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-9 p-0.5 bg-muted/30 border border-border/40 rounded-lg">
            <TabsTrigger
              value="overview"
              className="text-xs font-mono gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="control-plane"
              className="text-xs font-mono gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Control Plane</span>
              <span className="sm:hidden">Control</span>
            </TabsTrigger>
            <TabsTrigger
              value="workers"
              className="text-xs font-mono gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
            >
              <Server className="w-3.5 h-3.5" />
              Workers
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4 mt-0">
            {/* CPU + Memory */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* CPU */}
              <div
                className="bg-card border border-border/60 rounded-xl p-4 transition-all shadow-sm dark:bg-card/40 dark:shadow-none"
                style={{ borderTopColor: cpuCol, borderTopWidth: "2px" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4" style={{ color: cpuCol }} />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                      CPU Total
                    </span>
                  </div>
                  <span
                    className="text-sm font-mono font-semibold tabular-nums"
                    style={{ color: cpuCol }}
                  >
                    {cpuUsage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-3xl font-mono font-bold tabular-nums" style={{ color: cpuCol }}>
                    {totalCPU}
                  </span>
                  <span className="text-sm text-muted-foreground/60 font-mono">cores</span>
                </div>
                <ThinBar value={cpuUsage} color={cpuCol} />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground/40 mt-1">
                  <span>0%</span>
                  <span>Utilização Atual</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Memory */}
              <div
                className="bg-card border border-border/60 rounded-xl p-4 transition-all shadow-sm dark:bg-card/40 dark:shadow-none"
                style={{ borderTopColor: memCol, borderTopWidth: "2px" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4" style={{ color: memCol }} />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                      Memória Total
                    </span>
                  </div>
                  <span
                    className="text-sm font-mono font-semibold tabular-nums"
                    style={{ color: memCol }}
                  >
                    {memoryUsage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-3xl font-mono font-bold tabular-nums" style={{ color: memCol }}>
                    {totalMemory.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground/60 font-mono">GB</span>
                </div>
                <ThinBar value={memoryUsage} color={memCol} />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground/40 mt-1">
                  <span>0%</span>
                  <span>Utilização Atual</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Nodes", value: nodes.length, color: "#94a3b8" },
                { label: "Ready", value: readyCount, color: "var(--kodo-brand)" },
                { label: "Control Plane", value: controlPlaneNodes.length, color: "#64748b" },
                { label: "Workers", value: workerNodes.length, color: "#475569" },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="bg-card border border-border/60 rounded-xl p-4 text-center transition-all shadow-sm dark:bg-card/40 dark:shadow-none"
                  style={{ borderTopColor: color, borderTopWidth: "2px" }}
                >
                  <div className="text-2xl font-mono font-bold tabular-nums" style={{ color }}>
                    {value}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 mt-1">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Control Plane */}
          <TabsContent value="control-plane" className="mt-0">
            {controlPlaneNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
                <Shield className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-mono">Nenhum node control plane</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <span className="text-xs font-mono text-muted-foreground/60">
                    {controlPlaneNodes.length} node{controlPlaneNodes.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {controlPlaneNodes.map(renderNodeCard)}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Workers */}
          <TabsContent value="workers" className="mt-0">
            {workerNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
                <Server className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-mono">Nenhum worker node</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <span className="text-xs font-mono text-muted-foreground/60">
                    {workerNodes.length} node{workerNodes.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {workerNodes.map(renderNodeCard)}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};
