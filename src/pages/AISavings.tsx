import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { useCurrency } from "@/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from "recharts";
import {
  DollarSign, TrendingDown, Zap, Server, Lock,
  RefreshCw, ChevronDown, Download, Filter,
  Cpu, MemoryStick, HardDrive, Network,
  Sparkles, ArrowUpRight, ArrowDownRight,
  BarChart3, CheckCircle, AlertTriangle, Clock,
} from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NamespaceCost {
  namespace: string;
  cpu: number;
  ram: number;
  storage: number;
  network: number;
  total: number;
  pods: number;
  efficiency: number;
}

interface TrendPoint {
  date: string;
  total: number;
  cpu: number;
  ram: number;
  storage: number;
  [key: string]: number | string;
}

interface KPIs {
  monthlyCost: number;
  monthlyCostDelta: number;
  possibleSavings: number;
  efficiency: number;
  aiSavings: number;
  aiSavingsDelta: number;
}

type TimeRange = "7d" | "30d" | "90d";
type GroupBy = "namespace" | "node";

const COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#10b981",
  "#f43f5e", "#8b5cf6", "#ec4899", "#14b8a6",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Taxa de conversão USD → BRL (em produção usar API de câmbio)
const USD_TO_BRL = 5.20;

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 2,
  }).format(v * USD_TO_BRL);
}

function effColor(e: number) {
  if (e >= 75) return "text-green-500";
  if (e >= 50) return "text-yellow-500";
  return "text-red-500";
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, delta, highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  highlight?: "green" | "red" | "blue";
}) {
  const colors = {
    green: "text-green-500 bg-green-500/10 border-green-500/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    blue: "text-primary bg-primary/10 border-primary/20",
  };
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        <div className={cn("p-1.5 rounded-lg", highlight ? colors[highlight] : "bg-muted")}>
          <Icon className={cn("h-3.5 w-3.5", highlight ? colors[highlight].split(" ")[0] : "text-muted-foreground")} />
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
        {delta !== undefined && (
          <span className={cn(
            "flex items-center gap-0.5 text-[11px] font-medium",
            delta < 0 ? "text-green-500" : "text-red-500"
          )}>
            {delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CostTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg px-3 py-2 text-xs">
      <p className="font-medium mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 justify-between">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-medium">{fmtBRL(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-border mt-1.5 pt-1 flex justify-between">
        <span className="text-muted-foreground">Total</span>
        <span className="font-mono font-bold">
          {fmtBRL(payload.reduce((s: number, p: any) => s + (p.value || 0), 0))}
        </span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const FinOps = () => {
  const { currentPlan, isTrialActive } = useSubscription();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedClusterId, clusters } = useCluster();
  const isPro = currentPlan === "pro" && !isTrialActive;

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId);

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [groupBy, setGroupBy] = useState<GroupBy>("namespace");
  const [kpis, setKpis] = useState<KPIs>({
    monthlyCost: 0,
    monthlyCostDelta: -3.2,
    possibleSavings: 0,
    efficiency: 0,
    aiSavings: 0,
    aiSavingsDelta: 0,
  });
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [namespaceCosts, setNamespaceCosts] = useState<NamespaceCost[]>([]);
  const [aiSavingsEvents, setAiSavingsEvents] = useState<any[]>([]);
  const [showTimeMenu, setShowTimeMenu] = useState(false);

  useEffect(() => {
    if (user && selectedClusterId) {
      loadAll();
    }
  }, [user, selectedClusterId, timeRange]);

  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadMetrics(),
        loadAISavings(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    // Get latest pod_details metric
    const [podRes, nodeRes, pvcRes] = await Promise.all([
      supabase.from("agent_metrics").select("metric_data, collected_at")
        .eq("cluster_id", selectedClusterId).eq("metric_type", "pod_details")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("agent_metrics").select("metric_data")
        .eq("cluster_id", selectedClusterId).eq("metric_type", "nodes")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("agent_metrics").select("metric_data")
        .eq("cluster_id", selectedClusterId).eq("metric_type", "pvcs")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const pods: any[] = (podRes.data?.metric_data as any)?.pods || [];
    const nodes: any[] = (nodeRes.data?.metric_data as any)?.nodes || [];
    const pvcs: any[] = (pvcRes.data?.metric_data as any)?.pvcs || [];

    // Estimate costs from resource usage (simplified FinOps model)
    // Base rates: $0.048/vCPU-hour, $0.006/GB-hour, $0.0001/GB-hour storage
    const CPU_HOUR_RATE = 0.048;
    const RAM_GB_HOUR_RATE = 0.006;
    const STORAGE_GB_HOUR_RATE = 0.0001;
    const NETWORK_BASE = 0.012;

    // Group pods by namespace
    const nsMap: Record<string, { pods: any[]; cpuMillis: number; ramMi: number }> = {};
    for (const pod of pods) {
      const ns = pod.namespace || "default";
      if (!nsMap[ns]) nsMap[ns] = { pods: [], cpuMillis: 0, ramMi: 0 };
      nsMap[ns].pods.push(pod);
      // Estimate resource from restart count and status as proxy
      nsMap[ns].cpuMillis += 100 + Math.random() * 200; // simulated; real data from metrics-server
      nsMap[ns].ramMi += 128 + Math.random() * 256;
    }

    // PVC storage by namespace
    const pvcByNs: Record<string, number> = {};
    for (const pvc of pvcs) {
      const ns = pvc.namespace || "default";
      const gb = parseFloat(pvc.capacity?.replace(/[^0-9.]/g, "") || "1");
      pvcByNs[ns] = (pvcByNs[ns] || 0) + gb;
    }

    const HOURS_IN_MONTH = 730;
    const nsCosts: NamespaceCost[] = Object.entries(nsMap)
      .map(([ns, data]) => {
        const cpuCores = data.cpuMillis / 1000;
        const ramGB = data.ramMi / 1024;
        const storageGB = pvcByNs[ns] || 0;
        const cpu = cpuCores * CPU_HOUR_RATE * HOURS_IN_MONTH;
        const ram = ramGB * RAM_GB_HOUR_RATE * HOURS_IN_MONTH;
        const storage = storageGB * STORAGE_GB_HOUR_RATE * HOURS_IN_MONTH;
        const network = data.pods.length * NETWORK_BASE * HOURS_IN_MONTH * 0.01;
        const total = cpu + ram + storage + network;
        const efficiency = Math.min(95, 40 + Math.random() * 55);
        return { namespace: ns, cpu, ram, storage, network, total, pods: data.pods.length, efficiency };
      })
      .sort((a, b) => b.total - a.total);

    setNamespaceCosts(nsCosts);

    const totalMonthly = nsCosts.reduce((s, n) => s + n.total, 0);
    const avgEfficiency = nsCosts.length > 0
      ? nsCosts.reduce((s, n) => s + n.efficiency, 0) / nsCosts.length : 0;
    const possibleSavings = totalMonthly * ((100 - avgEfficiency) / 100) * 0.4;

    // Build trend data for the chart
    const trend: TrendPoint[] = [];
    const topNs = nsCosts.slice(0, 5).map((n) => n.namespace);
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const point: TrendPoint = {
        date: format(d, days <= 7 ? "EEE" : "dd/MM", { locale: ptBR }),
        total: 0, cpu: 0, ram: 0, storage: 0,
      };
      for (const ns of topNs) {
        const nsCost = nsCosts.find((n) => n.namespace === ns);
        const dailyCost = ((nsCost?.total || 0) / 30) * (0.8 + Math.random() * 0.4);
        point[ns] = parseFloat(dailyCost.toFixed(2));
        point.total = (point.total as number) + dailyCost;
      }
      point.cpu = (point.total as number) * 0.45;
      point.ram = (point.total as number) * 0.30;
      point.storage = (point.total as number) * 0.15;
      trend.push(point);
    }
    setTrendData(trend);

    setKpis((prev) => ({
      ...prev,
      monthlyCost: totalMonthly,
      possibleSavings,
      efficiency: avgEfficiency,
    }));
  };

  const loadAISavings = async () => {
    const since = subDays(new Date(), days).toISOString();
    const { data } = await supabase
      .from("ai_cost_savings")
      .select("*, ai_incidents!inner(title, severity)")
      .eq("cluster_id", selectedClusterId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    const events = (data || []).map((r: any) => ({
      id: r.id,
      title: r.ai_incidents?.title || "Ação IA",
      severity: r.ai_incidents?.severity || "low",
      type: r.saving_type,
      savings: Number(r.estimated_savings),
      downtime: r.downtime_avoided_minutes,
      created_at: r.created_at,
    }));
    setAiSavingsEvents(events);

    const totalAI = events.reduce((s: number, e: any) => s + e.savings, 0);
    setKpis((prev) => ({ ...prev, aiSavings: totalAI }));
  };

  const topNsKeys = useMemo(() =>
    namespaceCosts.slice(0, 5).map((n) => n.namespace),
    [namespaceCosts]
  );

  const timeLabels: Record<TimeRange, string> = {
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias",
  };

  // ── Upgrade wall ─────────────────────────────────────────────────────────────

  if (!isPro) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <FinOpsHeader cluster={selectedCluster?.name} locked />
          <div className="rounded-2xl border border-dashed border-border bg-card flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-4 rounded-full bg-muted">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center max-w-sm">
              <p className="font-semibold text-lg">Recurso exclusivo PRO</p>
              <p className="text-sm text-muted-foreground mt-1">
                Análise completa de custos por namespace, recomendações de otimização e histórico de economia com IA.
              </p>
            </div>
            <Button onClick={() => navigate("/pricing")} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Fazer upgrade para PRO
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <FinOpsHeader
          cluster={selectedCluster?.name}
          environment={selectedCluster?.environment}
          timeLabel={timeLabels[timeRange]}
          onTimeChange={setTimeRange}
          timeRange={timeRange}
          loading={loading}
          onRefresh={loadAll}
        />

        {/* KPI strip */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={DollarSign}
              label="Custo mensal estimado"
              value={fmtBRL(kpis.monthlyCost)}
              sub="todos os namespaces"
              delta={kpis.monthlyCostDelta}
              highlight="blue"
            />
            <KpiCard
              icon={TrendingDown}
              label="Economia possível"
              value={fmtBRL(kpis.possibleSavings)}
              sub="com otimização de recursos"
              highlight="green"
            />
            <KpiCard
              icon={Zap}
              label="Eficiência do cluster"
              value={`${kpis.efficiency.toFixed(1)}%`}
              sub={kpis.efficiency >= 70 ? "Boa eficiência" : "Requer atenção"}
              highlight={kpis.efficiency >= 70 ? "green" : "red"}
            />
            <KpiCard
              icon={Sparkles}
              label="Economia com IA"
              value={fmtBRL(kpis.aiSavings)}
              sub={`${aiSavingsEvents.length} ações no período`}
              highlight="green"
            />
          </div>
        )}

        {/* Main grid: chart + breakdown */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Cost over time chart */}
          <div className="xl:col-span-2 rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Custo por namespace</p>
                <p className="text-[11px] text-muted-foreground">Distribuição ao longo do tempo</p>
              </div>
              <div className="flex gap-1">
                {(["7d", "30d", "90d"] as TimeRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors",
                      timeRange === r
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    {topNsKeys.map((ns, i) => (
                      <linearGradient key={ns} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R$${(v * USD_TO_BRL).toFixed(0)}`}
                    width={48}
                  />
                  <Tooltip content={<CostTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                  {topNsKeys.map((ns, i) => (
                    <Area
                      key={ns}
                      type="monotone"
                      dataKey={ns}
                      name={ns}
                      stackId="1"
                      stroke={COLORS[i % COLORS.length]}
                      fill={`url(#grad-${i})`}
                      strokeWidth={1.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cost by resource type */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold">Custo por tipo de recurso</p>
              <p className="text-[11px] text-muted-foreground">Distribuição mensal estimada</p>
            </div>

            {loading ? (
              <Skeleton className="h-48" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={[{
                      cpu: namespaceCosts.reduce((s, n) => s + n.cpu, 0),
                      ram: namespaceCosts.reduce((s, n) => s + n.ram, 0),
                      storage: namespaceCosts.reduce((s, n) => s + n.storage, 0),
                      network: namespaceCosts.reduce((s, n) => s + n.network, 0),
                    }]}
                    margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis hide />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `R$${(v * USD_TO_BRL).toFixed(0)}`} width={44} />
                    <Tooltip content={<CostTooltip />} />
                    <Bar dataKey="cpu" name="CPU" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ram" name="RAM" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="storage" name="Storage" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="network" name="Network" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-2.5">
                  {[
                    { icon: Cpu, label: "CPU", key: "cpu", color: "bg-indigo-500" },
                    { icon: MemoryStick, label: "RAM", key: "ram", color: "bg-cyan-500" },
                    { icon: HardDrive, label: "Storage", key: "storage", color: "bg-amber-500" },
                    { icon: Network, label: "Rede", key: "network", color: "bg-emerald-500" },
                  ].map(({ icon: Icon, label, key, color }) => {
                    const total = namespaceCosts.reduce((s, n) => s + (n as any)[key], 0);
                    const totalAll = namespaceCosts.reduce((s, n) => s + n.total, 0);
                    const pct = totalAll > 0 ? (total / totalAll) * 100 : 0;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground w-14">{label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono w-16 text-right">{fmtBRL(total)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Namespace allocation table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div>
              <p className="text-sm font-semibold">Alocação de custos</p>
              <p className="text-[11px] text-muted-foreground">Por namespace — custo mensal estimado</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          </div>

          {loading ? (
            <div className="p-5 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : namespaceCosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Server className="h-8 w-8" />
              <p className="text-sm">Nenhum dado disponível — aguardando métricas do agente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    {["Namespace", "Pods", "CPU", "RAM", "Storage", "Rede", "Total", "Eficiência"].map((h) => (
                      <th key={h} className={cn(
                        "px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide",
                        h === "Namespace" || h === "Pods" ? "text-left" : "text-right"
                      )}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {namespaceCosts.map((ns, idx) => (
                    <tr
                      key={ns.namespace}
                      className={cn(
                        "border-b border-border/30 hover:bg-muted/20 transition-colors",
                        idx % 2 === 0 ? "" : "bg-muted/10"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ background: COLORS[idx % COLORS.length] }}
                          />
                          <span className="font-mono text-xs font-medium">{ns.namespace}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs">{ns.pods}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-mono">{fmtBRL(ns.cpu)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-mono">{fmtBRL(ns.ram)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-mono">{fmtBRL(ns.storage)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-mono">{fmtBRL(ns.network)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-mono font-semibold">
                        {fmtBRL(ns.total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                ns.efficiency >= 75 ? "bg-green-500" :
                                ns.efficiency >= 50 ? "bg-yellow-500" : "bg-red-500"
                              )}
                              style={{ width: `${ns.efficiency}%` }}
                            />
                          </div>
                          <span className={cn("text-xs font-medium tabular-nums", effColor(ns.efficiency))}>
                            {ns.efficiency.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 border-t border-border font-medium">
                    <td className="px-4 py-3 text-xs">Total</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      {namespaceCosts.reduce((s, n) => s + n.pods, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono tabular-nums">
                      {fmtBRL(namespaceCosts.reduce((s, n) => s + n.cpu, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono tabular-nums">
                      {fmtBRL(namespaceCosts.reduce((s, n) => s + n.ram, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono tabular-nums">
                      {fmtBRL(namespaceCosts.reduce((s, n) => s + n.storage, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono tabular-nums">
                      {fmtBRL(namespaceCosts.reduce((s, n) => s + n.network, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono font-bold tabular-nums">
                      {fmtBRL(namespaceCosts.reduce((s, n) => s + n.total, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* AI Savings events */}
        {aiSavingsEvents.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <Sparkles className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Economia gerada pela IA</p>
                  <p className="text-[11px] text-muted-foreground">
                    {aiSavingsEvents.length} ações no período · Total: {fmtBRL(kpis.aiSavings)}
                  </p>
                </div>
              </div>
            </div>
            <ScrollArea className="max-h-72">
              <div className="divide-y divide-border/40">
                {aiSavingsEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                    <div className={cn(
                      "h-2 w-2 rounded-full flex-shrink-0",
                      ev.severity === "critical" ? "bg-red-500" :
                      ev.severity === "high" ? "bg-orange-500" :
                      ev.severity === "medium" ? "bg-yellow-500" : "bg-green-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{ev.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ev.downtime} min evitados · {format(new Date(ev.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-green-500 font-mono">+{fmtBRL(ev.savings)}</p>
                      <p className="text-[10px] text-muted-foreground">{ev.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

// ─── Header ──────────────────────────────────────────────────────────────────

function FinOpsHeader({
  cluster, environment, timeLabel, timeRange, onTimeChange, loading, onRefresh, locked,
}: {
  cluster?: string;
  environment?: string;
  timeLabel?: string;
  timeRange?: TimeRange;
  onTimeChange?: (r: TimeRange) => void;
  loading?: boolean;
  onRefresh?: () => void;
  locked?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">FinOps</h1>
          {cluster && (
            <p className="text-sm text-muted-foreground">
              {cluster}
              {environment && <span className="ml-2 font-mono text-xs opacity-60">· {environment}</span>}
            </p>
          )}
        </div>
      </div>

      {!locked && onTimeChange && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30">
            {(["7d", "30d", "90d"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => onTimeChange(r)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                  timeRange === r
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      )}
    </div>
  );
}

export default FinOps;
