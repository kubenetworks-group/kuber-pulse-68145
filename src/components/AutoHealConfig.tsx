import { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAutoHeal } from "@/hooks/useAutoHeal";
import { useCluster } from "@/contexts/ClusterContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Server, Network, HardDrive, Package,
  Play, RefreshCw, ChevronRight, AlertTriangle,
  ShieldCheck, ShieldOff, CheckCircle2, Circle,
  Settings2, Timer, Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OperationsRule {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface IngressController {
  name: string;
  namespace: string;
  pods_running: number;
  pods_total: number;
  type: "nginx" | "traefik" | "other";
}

interface OperationsRules {
  // Workloads
  restart_crashloop: boolean;
  restart_oomkilled: boolean;
  fix_failed_jobs: boolean;
  delete_stuck_terminating: boolean;
  // Resources
  adjust_cpu_memory: boolean;
  alert_no_limits: boolean;
  monitor_hpa: boolean;
  // Ingress
  restart_ingress_unhealthy: boolean;
  alert_cert_expiring: boolean;
  monitor_ingress_backends: boolean;
  alert_ingress_no_tls: boolean;
  // Storage
  alert_pvc_pending: boolean;
  alert_pvc_lost: boolean;
  monitor_pvc_usage: boolean;
}

const DEFAULT_RULES: OperationsRules = {
  restart_crashloop: true,
  restart_oomkilled: true,
  fix_failed_jobs: false,
  delete_stuck_terminating: false,
  adjust_cpu_memory: false,
  alert_no_limits: true,
  monitor_hpa: false,
  restart_ingress_unhealthy: false,
  alert_cert_expiring: true,
  monitor_ingress_backends: true,
  alert_ingress_no_tls: true,
  alert_pvc_pending: true,
  alert_pvc_lost: true,
  monitor_pvc_usage: false,
};

// ─── Rule row ─────────────────────────────────────────────────────────────────

function RuleRow({
  id, label, description, enabled, disabled, onChange,
}: {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onChange: (id: string, value: boolean) => void;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between py-3 px-1 gap-4",
      "border-b border-border/40 last:border-0",
      disabled && "opacity-40 pointer-events-none",
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={(v) => onChange(id, v)}
        className="flex-shrink-0"
      />
    </div>
  );
}

// ─── Category header ──────────────────────────────────────────────────────────

function CategoryHeader({
  icon: Icon, label, color, activeCount, totalCount,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  activeCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className={cn("p-1.5 rounded-md", color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {activeCount}/{totalCount}
      </span>
    </div>
  );
}

// ─── Ingress status panel ─────────────────────────────────────────────────────

function IngressStatusPanel({ clusterId }: { clusterId: string | null }) {
  const [controllers, setControllers] = useState<IngressController[]>([]);
  const [ingressCount, setIngressCount] = useState(0);
  const [tlsCount, setTlsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchIngressHealth = useCallback(async () => {
    if (!clusterId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", clusterId)
        .eq("metric_type", "pod_details")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const pods: any[] = (data?.metric_data as any)?.pods || [];
      const ingressNamespaces = ["ingress-nginx", "traefik", "nginx-ingress", "ingress", "kube-ingress"];

      const ingressPods = pods.filter((p) =>
        ingressNamespaces.includes(p.namespace) ||
        (p.name || "").toLowerCase().includes("ingress") ||
        (p.name || "").toLowerCase().includes("traefik")
      );

      // Group by controller type
      const grouped: Record<string, { running: number; total: number; type: "nginx" | "traefik" | "other"; ns: string }> = {};
      for (const pod of ingressPods) {
        const isTraefik = (pod.name || "").toLowerCase().includes("traefik") || pod.namespace === "traefik";
        const key = isTraefik ? "traefik" : "nginx";
        if (!grouped[key]) grouped[key] = { running: 0, total: 0, type: isTraefik ? "traefik" : "nginx", ns: pod.namespace };
        grouped[key].total++;
        if (pod.status === "Running" || pod.phase === "Running") grouped[key].running++;
      }

      const ctrs: IngressController[] = Object.entries(grouped).map(([name, info]) => ({
        name,
        namespace: info.ns,
        pods_running: info.running,
        pods_total: info.total,
        type: info.type,
      }));

      setControllers(ctrs);

      // Ingress resources
      const { data: ingressData } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", clusterId)
        .eq("metric_type", "ingresses")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const ingresses: any[] = (ingressData?.metric_data as any)?.ingresses || [];
      setIngressCount(ingresses.length);
      setTlsCount(ingresses.filter((i: any) => i.tls).length);
    } catch (e) {
      console.error("Error fetching ingress health:", e);
    } finally {
      setLoading(false);
    }
  }, [clusterId]);

  useEffect(() => { fetchIngressHealth(); }, [fetchIngressHealth]);

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controllers */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          Ingress Controllers
        </p>
        {controllers.length === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <Circle className="h-3 w-3 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">Nenhum detectado</span>
          </div>
        ) : (
          <div className="space-y-2">
            {controllers.map((c) => {
              const healthy = c.pods_running === c.pods_total && c.pods_total > 0;
              const degraded = c.pods_running > 0 && c.pods_running < c.pods_total;
              return (
                <div key={c.name} className="flex items-center gap-2.5">
                  <span className={cn(
                    "h-2 w-2 rounded-full flex-shrink-0",
                    healthy ? "bg-green-500" : degraded ? "bg-yellow-500 animate-pulse" : "bg-red-500 animate-pulse"
                  )} />
                  <span className="text-xs font-mono font-medium capitalize flex-1">{c.name}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {c.pods_running}/{c.pods_total}
                  </span>
                  {healthy ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ingress resources summary */}
      {ingressCount > 0 && (
        <div className="border-t border-border/50 pt-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Recursos Ingress
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{ingressCount} ingresses</span>
            <div className="flex items-center gap-2">
              {tlsCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-green-500">
                  <ShieldCheck className="h-3 w-3" />
                  {tlsCount} TLS
                </span>
              )}
              {ingressCount - tlsCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-orange-500">
                  <ShieldOff className="h-3 w-3" />
                  {ingressCount - tlsCount} sem TLS
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 text-[11px] text-muted-foreground hover:text-foreground justify-between px-2"
        onClick={() => window.location.href = "/observability"}
      >
        Ver detalhes de rede
        <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AutoHealConfig() {
  const { selectedClusterId } = useCluster();
  const {
    settings,
    loading,
    saving,
    toggleAutoHeal,
    toggleSecurityAutoFix,
    toggleAnomaliesAutoFix,
    updateSeverityThreshold,
    updateScanInterval,
    triggerScanAndHeal,
  } = useAutoHeal();

  // Extended rules stored in localStorage
  const rulesKey = `operations_rules_${selectedClusterId || "default"}`;
  const [rules, setRules] = useState<OperationsRules>(() => {
    try {
      const saved = localStorage.getItem(rulesKey);
      return saved ? { ...DEFAULT_RULES, ...JSON.parse(saved) } : DEFAULT_RULES;
    } catch {
      return DEFAULT_RULES;
    }
  });

  // Reload rules when cluster changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(rulesKey);
      setRules(saved ? { ...DEFAULT_RULES, ...JSON.parse(saved) } : DEFAULT_RULES);
    } catch {
      setRules(DEFAULT_RULES);
    }
  }, [rulesKey]);

  const updateRule = (id: string, value: boolean) => {
    setRules((prev) => {
      const next = { ...prev, [id]: value };
      localStorage.setItem(rulesKey, JSON.stringify(next));
      // Sync backbone toggles
      if (["restart_crashloop", "restart_oomkilled", "fix_failed_jobs", "delete_stuck_terminating"].includes(id)) {
        const anyWorkload = next.restart_crashloop || next.restart_oomkilled || next.fix_failed_jobs || next.delete_stuck_terminating;
        toggleAnomaliesAutoFix(anyWorkload);
      }
      if (["adjust_cpu_memory", "alert_no_limits", "monitor_hpa"].includes(id)) {
        const anyResource = next.adjust_cpu_memory || next.alert_no_limits || next.monitor_hpa;
        toggleSecurityAutoFix(anyResource);
      }
      return next;
    });
  };

  const isEnabled = settings?.enabled ?? false;

  const countActive = (keys: (keyof OperationsRules)[]) =>
    keys.filter((k) => rules[k]).length;

  if (!selectedClusterId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
        <Server className="h-10 w-10 opacity-30" />
        <p className="text-sm">Selecione um cluster para configurar as políticas</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  const workloadKeys: (keyof OperationsRules)[] = ["restart_crashloop", "restart_oomkilled", "fix_failed_jobs", "delete_stuck_terminating"];
  const resourceKeys: (keyof OperationsRules)[] = ["adjust_cpu_memory", "alert_no_limits", "monitor_hpa"];
  const ingressKeys: (keyof OperationsRules)[] = ["restart_ingress_unhealthy", "alert_cert_expiring", "monitor_ingress_backends", "alert_ingress_no_tls"];
  const storageKeys: (keyof OperationsRules)[] = ["alert_pvc_pending", "alert_pvc_lost", "monitor_pvc_usage"];

  return (
    <div className="space-y-4">
      {/* ── Global header ── */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-2 w-2 rounded-full",
            isEnabled ? "bg-green-500" : "bg-muted-foreground/40"
          )} />
          <span className="font-semibold text-sm">Políticas de Automação</span>
          {isEnabled && (
            <Badge variant="outline" className="text-[10px] h-5 px-2 border-green-500/40 text-green-600 bg-green-500/5">
              Ativo
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Switch
            checked={isEnabled}
            onCheckedChange={toggleAutoHeal}
            disabled={saving}
          />
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Accordion of rule categories */}
        <div className={cn(
          "lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden",
          !isEnabled && "opacity-60 pointer-events-none"
        )}>
          <Accordion type="multiple" defaultValue={["workloads", "ingress"]} className="divide-y divide-border/60">

            {/* Workloads */}
            <AccordionItem value="workloads" className="border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                <CategoryHeader
                  icon={Package}
                  label="Workloads"
                  color="bg-blue-500/10 text-blue-500"
                  activeCount={countActive(workloadKeys)}
                  totalCount={workloadKeys.length}
                />
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-2 pt-0">
                <RuleRow id="restart_crashloop" label="Reiniciar pods em CrashLoopBackOff" description="Reinicia automaticamente pods em loop de reinicialização" enabled={rules.restart_crashloop} onChange={updateRule} />
                <RuleRow id="restart_oomkilled" label="Reiniciar pods OOMKilled" description="Reinicia pods finalizados por falta de memória" enabled={rules.restart_oomkilled} onChange={updateRule} />
                <RuleRow id="fix_failed_jobs" label="Recriar jobs com erro" description="Reagenda jobs que falharam com exit code não-zero" enabled={rules.fix_failed_jobs} onChange={updateRule} />
                <RuleRow id="delete_stuck_terminating" label="Remover pods presos em Terminating" description="Força remoção de pods parados há mais de 10 minutos" enabled={rules.delete_stuck_terminating} onChange={updateRule} />
              </AccordionContent>
            </AccordionItem>

            {/* Resources */}
            <AccordionItem value="resources" className="border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                <CategoryHeader
                  icon={Settings2}
                  label="Recursos"
                  color="bg-purple-500/10 text-purple-500"
                  activeCount={countActive(resourceKeys)}
                  totalCount={resourceKeys.length}
                />
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-2 pt-0">
                <RuleRow id="adjust_cpu_memory" label="Ajustar limites de CPU e memória" description="Redimensiona requests/limits conforme uso real do container" enabled={rules.adjust_cpu_memory} onChange={updateRule} />
                <RuleRow id="alert_no_limits" label="Alertar pods sem resource limits" description="Notifica quando containers não têm limites definidos" enabled={rules.alert_no_limits} onChange={updateRule} />
                <RuleRow id="monitor_hpa" label="Monitorar HPA em maxReplicas" description="Alerta quando o autoscaler atingiu o limite máximo de réplicas" enabled={rules.monitor_hpa} onChange={updateRule} />
              </AccordionContent>
            </AccordionItem>

            {/* Ingress & Network */}
            <AccordionItem value="ingress" className="border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                <CategoryHeader
                  icon={Network}
                  label="Ingress & Rede"
                  color="bg-cyan-500/10 text-cyan-500"
                  activeCount={countActive(ingressKeys)}
                  totalCount={ingressKeys.length}
                />
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-2 pt-0">
                <RuleRow id="restart_ingress_unhealthy" label="Reiniciar ingress controller com falha" description="Reinicia pods do nginx/traefik quando não estão em Running" enabled={rules.restart_ingress_unhealthy} onChange={updateRule} />
                <RuleRow id="alert_cert_expiring" label="Alertar certificados TLS expirando" description="Notifica quando certificados vencem em menos de 30 dias" enabled={rules.alert_cert_expiring} onChange={updateRule} />
                <RuleRow id="monitor_ingress_backends" label="Monitorar backends sem endpoints" description="Detecta ingresses com hosts que não têm pods ativos" enabled={rules.monitor_ingress_backends} onChange={updateRule} />
                <RuleRow id="alert_ingress_no_tls" label="Alertar ingress sem TLS" description="Identifica rotas HTTP expostas sem configuração HTTPS" enabled={rules.alert_ingress_no_tls} onChange={updateRule} />
              </AccordionContent>
            </AccordionItem>

            {/* Storage */}
            <AccordionItem value="storage" className="border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                <CategoryHeader
                  icon={HardDrive}
                  label="Storage & Volumes"
                  color="bg-amber-500/10 text-amber-500"
                  activeCount={countActive(storageKeys)}
                  totalCount={storageKeys.length}
                />
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-2 pt-0">
                <RuleRow id="alert_pvc_pending" label="Alertar PVC em estado Pending" description="Notifica quando volumes persistentes não conseguem ser provisionados" enabled={rules.alert_pvc_pending} onChange={updateRule} />
                <RuleRow id="alert_pvc_lost" label="Alertar PVC em estado Lost" description="Detecta volumes cuja referência de storage foi perdida" enabled={rules.alert_pvc_lost} onChange={updateRule} />
                <RuleRow id="monitor_pvc_usage" label="Monitorar uso de PVC acima de 85%" description="Alerta quando a ocupação do volume se aproxima do limite" enabled={rules.monitor_pvc_usage} onChange={updateRule} />
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>

        {/* Right: Status panel + global config */}
        <div className="space-y-4">
          {/* Ingress health */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Network className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Saúde do Ingress
              </p>
            </div>
            <IngressStatusPanel clusterId={selectedClusterId} />
          </div>

          {/* Global config */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Configuração Global
            </p>

            {/* Severity */}
            <div className={cn(!isEnabled && "opacity-50 pointer-events-none")}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs font-medium">Severidade mínima</Label>
              </div>
              <Select
                value={settings?.severity_threshold ?? "high"}
                onValueChange={(v: any) => updateSeverityThreshold(v)}
                disabled={saving || !isEnabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="low">Baixa ou acima</SelectItem>
                  <SelectItem value="medium">Média ou acima</SelectItem>
                  <SelectItem value="high">Alta ou acima</SelectItem>
                  <SelectItem value="critical">Somente crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Interval */}
            <div className={cn(!isEnabled && "opacity-50 pointer-events-none")}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs font-medium">Intervalo de varredura</Label>
              </div>
              <Select
                value={String(settings?.scan_interval_minutes ?? 5)}
                onValueChange={(v) => updateScanInterval(parseInt(v))}
                disabled={saving || !isEnabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">A cada 1 minuto</SelectItem>
                  <SelectItem value="5">A cada 5 minutos</SelectItem>
                  <SelectItem value="15">A cada 15 minutos</SelectItem>
                  <SelectItem value="30">A cada 30 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Run now */}
            <Button
              onClick={triggerScanAndHeal}
              disabled={saving}
              size="sm"
              className="w-full gap-2"
            >
              <Play className="h-3.5 w-3.5" />
              Executar varredura agora
            </Button>

            {isEnabled && (
              <p className="text-[11px] text-center text-muted-foreground">
                Próxima varredura em{" "}
                <span className="font-medium text-foreground">
                  {settings?.scan_interval_minutes ?? 5} min
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
