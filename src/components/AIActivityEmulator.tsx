import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot, Play, Pause, RotateCcw, BarChart2, Shield, Zap,
  Search, CheckCircle2, AlertTriangle, TrendingDown,
  Lock, Database, Cpu, MemoryStick, HardDrive, Network,
  Sparkles, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type EventType = "scan" | "anomaly" | "analysis" | "decision" | "action" | "resolved" | "security" | "optimize";
type EventStatus = "running" | "completed" | "warning" | "error";

interface AIEvent {
  id: string;
  type: EventType;
  status: EventStatus;
  message: string;
  detail?: string;
  cluster: string;
  timestamp: Date;
  durationMs?: number;
}

// ── Event sequences ──────────────────────────────────────────────────────────

const CLUSTERS = [
  "prod-us-east-1", "prod-us-west-2", "prod-eu-west-1",
  "prod-asia-1", "staging-us-1", "staging-eu-1",
];

type EventSequence = Array<{
  type: EventType;
  status: EventStatus;
  message: string;
  detail?: string;
  delay: number; // ms after previous event
}>;

const SEQUENCES: EventSequence[] = [
  // High CPU
  [
    { type: "scan",     status: "running",   message: "Coletando métricas de CPU e memória",          detail: "Ciclo de coleta: 15s | Threshold: 80%",                delay: 0    },
    { type: "anomaly",  status: "warning",   message: "CPU acima de 87% por 15+ minutos",              detail: "Serviço: payment-service | Nó: worker-2",              delay: 2800 },
    { type: "analysis", status: "running",   message: "Analisando causa raiz da degradação",           detail: "Inspecionando logs, traces e top de processos...",      delay: 2200 },
    { type: "decision", status: "completed", message: "Causa: batch job sem resource limits",          detail: "Confidence: 91% | Padrão: recurring_peak",             delay: 3500 },
    { type: "action",   status: "running",   message: "Escalando horizontalmente: +2 réplicas",        detail: "payment-service: 3 → 5 pods",                         delay: 1800 },
    { type: "resolved", status: "completed", message: "CPU normalizada em 63% | Latência −38%",        detail: "Ação concluída em 4.2s | 5 pods healthy",             delay: 4000 },
  ],
  // CrashLoopBackOff
  [
    { type: "scan",     status: "running",   message: "Monitorando health checks e restarts",          detail: "Threshold: >5 restarts em 10 min",                     delay: 0    },
    { type: "anomaly",  status: "warning",   message: "auth-service em CrashLoopBackOff",              detail: "18 reinícios | Último exit code: 1",                   delay: 3000 },
    { type: "analysis", status: "running",   message: "Inspecionando logs do crash",                   detail: "Analisando stderr + eventos do kubelet...",             delay: 2500 },
    { type: "decision", status: "completed", message: "Detectado: DATABASE_URL ausente no env",        detail: "Confidence: 95% | Secret desatualizado",               delay: 4000 },
    { type: "action",   status: "running",   message: "Injetando secret correto e reiniciando pod",    detail: "Kubectl patch + delete pod em execução...",            delay: 2000 },
    { type: "resolved", status: "completed", message: "auth-service healthy | 0 restarts em 5min",    detail: "SLA restaurado | Incidente encerrado",                 delay: 3500 },
  ],
  // Memory leak
  [
    { type: "scan",     status: "running",   message: "Analisando uso de memória por workload",        detail: "Baseline: últimas 2h de dados",                        delay: 0    },
    { type: "anomaly",  status: "warning",   message: "nginx-ingress consumindo 94% de memória",       detail: "Taxa de crescimento: +1.2GB/h",                        delay: 2600 },
    { type: "analysis", status: "running",   message: "Verificando padrão de consumo",                 detail: "Comparando com versão anterior...",                    delay: 3000 },
    { type: "decision", status: "completed", message: "Memory leak em nginx-ingress v1.9.4",           detail: "Confidence: 88% | CVE-2024-7646 confirmado",           delay: 3800 },
    { type: "action",   status: "running",   message: "Reiniciando pods + pin para v1.9.5",           detail: "Rolling restart com zero downtime...",                 delay: 2200 },
    { type: "resolved", status: "completed", message: "Memória estabilizada em 47% | Leak eliminado", detail: "3 pods reiniciados | Alerta enviado ao time",          delay: 4500 },
  ],
  // Security
  [
    { type: "security", status: "running",   message: "Executando varredura de segurança",             detail: "Escopo: todos os namespaces de produção",              delay: 0    },
    { type: "anomaly",  status: "warning",   message: "Processo suspeito: nmap em container prod",    detail: "Namespace: production | Threat score: 0.91",           delay: 3500 },
    { type: "analysis", status: "running",   message: "Avaliando vetor de ataque e impacto",          detail: "Verificando network policies e RBAC...",               delay: 2800 },
    { type: "decision", status: "completed", message: "Port scan confirmado | Provável reconhecimento", detail: "Confidence: 94% | Indicator: unauthorized_tool",      delay: 3200 },
    { type: "action",   status: "running",   message: "Isolando container e bloqueando egress",       detail: "NetworkPolicy aplicada | Pod quarantenado...",         delay: 1500 },
    { type: "resolved", status: "completed", message: "Ameaça neutralizada | SecOps notificado",      detail: "Container isolado | Evidências preservadas",           delay: 3000 },
  ],
  // Storage
  [
    { type: "scan",     status: "running",   message: "Verificando capacidade de PVCs",               detail: "Threshold: 85% | Verificando 24 volumes...",           delay: 0    },
    { type: "anomaly",  status: "warning",   message: "PVC /data atingiu 92% de capacidade",          detail: "Projeção: disco cheio em ~6h",                         delay: 2400 },
    { type: "analysis", status: "running",   message: "Identificando tipo de dados no volume",        detail: "Scanning inode usage por diretório...",                delay: 2800 },
    { type: "decision", status: "completed", message: "85% são logs com mais de 30 dias",             detail: "Confidence: 97% | Seguro para limpeza",               delay: 3000 },
    { type: "action",   status: "running",   message: "Executando limpeza de logs antigos",           detail: "Removendo /var/log/*.gz com >30d...",                  delay: 2000 },
    { type: "resolved", status: "completed", message: "11.3GB liberados | PVC agora em 45%",         detail: "Log rotation configurada automaticamente",             delay: 3200 },
  ],
  // Cost optimization
  [
    { type: "optimize", status: "running",   message: "Analisando utilização de recursos (30 dias)",  detail: "8 clusters | 441 deployments analisados...",           delay: 0    },
    { type: "analysis", status: "running",   message: "Identificando recursos superprovisionados",    detail: "Comparando requests vs uso real...",                   delay: 3000 },
    { type: "decision", status: "completed", message: "12 pods com CPU request 3× acima do uso",     detail: "Economia potencial: $1,240/mês",                       delay: 4000 },
    { type: "action",   status: "running",   message: "Aplicando right-sizing em staging clusters",  detail: "Ajustando requests/limits gradualmente...",            delay: 2500 },
    { type: "resolved", status: "completed", message: "Recursos otimizados | Economia: $892/mês",    detail: "Produção pendente aprovação do time",                  delay: 3500 },
  ],
  // Node pressure
  [
    { type: "scan",     status: "running",   message: "Verificando pressão em nós do cluster",       detail: "Métricas: CPU, memória, disk, PID...",                 delay: 0    },
    { type: "anomaly",  status: "warning",   message: "worker-3: MemoryPressure ativo",              detail: "Memória disponível: 380Mi | Threshold: 500Mi",         delay: 2600 },
    { type: "analysis", status: "running",   message: "Avaliando pods candidatos à evicção",         detail: "Rankeando por prioridade e uso...",                    delay: 2200 },
    { type: "decision", status: "completed", message: "Evictar 3 pods BestEffort sem owners",        detail: "Libera 1.2GB | Risco de disrupção: baixo",            delay: 3200 },
    { type: "action",   status: "running",   message: "Drenando pods de baixa prioridade",           detail: "Graceful termination: 30s timeout...",                delay: 2000 },
    { type: "resolved", status: "completed", message: "Pressão removida | Nó healthy",              detail: "2.1GB liberados | 0 pods críticos afetados",           delay: 3500 },
  ],
];

// ── Visual config ────────────────────────────────────────────────────────────

const EVENT_META: Record<EventType, { Icon: React.ElementType; color: string; bg: string; label: string }> = {
  scan:     { Icon: Search,       color: "text-sky-400",    bg: "bg-sky-500/10",    label: "SCAN"     },
  anomaly:  { Icon: AlertTriangle,color: "text-amber-400",  bg: "bg-amber-500/10",  label: "ANOMALIA" },
  analysis: { Icon: Bot,          color: "text-violet-400", bg: "bg-violet-500/10", label: "ANÁLISE"  },
  decision: { Icon: Sparkles,     color: "text-indigo-400", bg: "bg-indigo-500/10", label: "DECISÃO"  },
  action:   { Icon: Zap,          color: "text-green-400",  bg: "bg-green-500/10",  label: "AÇÃO"     },
  resolved: { Icon: CheckCircle2, color: "text-emerald-400",bg: "bg-emerald-500/10",label: "RESOLVIDO"},
  security: { Icon: Shield,       color: "text-red-400",    bg: "bg-red-500/10",    label: "SECURITY" },
  optimize: { Icon: TrendingDown, color: "text-cyan-400",   bg: "bg-cyan-500/10",   label: "OTIMIZAR" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

let _uid = 0;
function uid() { return `ev-${++_uid}`; }

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Component ────────────────────────────────────────────────────────────────

interface AIActivityEmulatorProps {
  defaultActive?: boolean;
}

export function AIActivityEmulator({ defaultActive = false }: AIActivityEmulatorProps) {
  const [isActive, setIsActive] = useState(defaultActive);
  const [events, setEvents] = useState<AIEvent[]>([]);
  const [totalHeals, setTotalHeals] = useState(0);
  const [totalAnomalies, setTotalAnomalies] = useState(0);
  const [totalScans, setTotalScans] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const addEvent = useCallback((ev: AIEvent) => {
    setEvents(prev => {
      const next = [ev, ...prev].slice(0, 80);
      return next;
    });
    if (ev.type === "resolved" || ev.type === "action") setTotalHeals(h => h + 1);
    if (ev.type === "anomaly" || ev.type === "security") setTotalAnomalies(a => a + 1);
    if (ev.type === "scan" || ev.type === "optimize") setTotalScans(s => s + 1);
  }, []);

  const runSequence = useCallback((active: boolean) => {
    if (!active) return;
    const seq = pick(SEQUENCES);
    const cluster = pick(CLUSTERS);
    let accumulated = 0;

    seq.forEach((step) => {
      accumulated += step.delay + Math.random() * 800;
      const t = setTimeout(() => {
        addEvent({
          id: uid(),
          type: step.type,
          status: step.status,
          message: step.message,
          detail: step.detail,
          cluster,
          timestamp: new Date(),
        });
      }, accumulated);
      timeoutsRef.current.push(t);
    });

    // Schedule next sequence after this one finishes + pause
    const nextDelay = accumulated + 3000 + Math.random() * 5000;
    const t = setTimeout(() => runSequence(active), nextDelay);
    timeoutsRef.current.push(t);
  }, [addEvent]);

  useEffect(() => {
    if (isActive) {
      runSequence(true);
    } else {
      clearTimeouts();
    }
    return clearTimeouts;
  }, [isActive, runSequence, clearTimeouts]);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [events.length]);

  const handleToggle = () => {
    if (isActive) {
      clearTimeouts();
      setIsActive(false);
    } else {
      setIsActive(true);
    }
  };

  const handleReset = () => {
    clearTimeouts();
    setIsActive(false);
    setEvents([]);
    setTotalHeals(0);
    setTotalAnomalies(0);
    setTotalScans(0);
  };

  return (
    <Card className="border-border/50 bg-card/80">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              isActive ? "bg-green-500/15" : "bg-muted"
            )}>
              <Bot className={cn("w-4 h-4", isActive ? "text-green-400" : "text-muted-foreground")} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                IA em Tempo Real
                {isActive && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    AO VIVO
                  </span>
                )}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Demonstração do agente autônomo de Kubernetes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleReset}
              title="Resetar"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant={isActive ? "destructive" : "default"}
              className={cn(
                "h-7 text-[11px] px-3 gap-1.5",
                !isActive && "bg-green-600 hover:bg-green-700 text-white"
              )}
              onClick={handleToggle}
            >
              {isActive
                ? <><Pause className="w-3 h-3" /> Pausar</>
                : <><Play  className="w-3 h-3" /> Iniciar demo</>
              }
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: "Scans",      value: totalScans,     Icon: Search,       color: "text-sky-400"    },
            { label: "Anomalias",  value: totalAnomalies, Icon: AlertTriangle,color: "text-amber-400"  },
            { label: "Correções",  value: totalHeals,     Icon: CheckCircle2, color: "text-green-400"  },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="flex items-center gap-2 bg-muted/40 rounded-md px-2.5 py-1.5">
              <Icon className={cn("w-3.5 h-3.5 shrink-0", color)} />
              <div>
                <div className="text-[11px] font-mono font-semibold tabular-nums">{value}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Feed */}
        <div
          ref={feedRef}
          className="h-[340px] overflow-y-auto space-y-1 pr-1 font-mono text-[11px]"
          style={{ scrollbarWidth: "thin" }}
        >
          {events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Bot className="w-10 h-10 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium opacity-50">Agente inativo</p>
                <p className="text-xs opacity-30 mt-1">Clique em "Iniciar demo" para ver a IA em ação</p>
              </div>
            </div>
          ) : (
            events.map((ev) => {
              const meta = EVENT_META[ev.type];
              const { Icon } = meta;
              return (
                <div
                  key={ev.id}
                  className={cn(
                    "flex gap-2 items-start rounded-md px-2 py-1.5 border border-transparent transition-all",
                    ev.status === "running"   && "border-border/30 bg-muted/20 animate-pulse-subtle",
                    ev.status === "completed" && "opacity-80",
                    ev.status === "warning"   && "border-amber-500/20 bg-amber-500/5",
                    ev.status === "error"     && "border-red-500/20 bg-red-500/5",
                  )}
                >
                  {/* Icon badge */}
                  <div className={cn("shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5", meta.bg)}>
                    <Icon className={cn("w-3 h-3", meta.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("text-[9px] font-semibold tracking-widest", meta.color)}>
                        {meta.label}
                      </span>
                      <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
                      <span className="text-muted-foreground/60 text-[9px] truncate">
                        {ev.cluster}
                      </span>
                      <span className="ml-auto text-muted-foreground/40 text-[9px] tabular-nums shrink-0">
                        {fmt(ev.timestamp)}
                      </span>
                    </div>
                    <div className={cn(
                      "mt-0.5 leading-tight",
                      ev.status === "warning"   ? "text-amber-200" :
                      ev.status === "completed" ? "text-foreground/70" :
                      ev.status === "running"   ? "text-foreground/90" :
                      "text-foreground/60"
                    )}>
                      {ev.message}
                      {ev.status === "running" && (
                        <span className="ml-1 inline-flex gap-0.5">
                          {[0,1,2].map(i => (
                            <span
                              key={i}
                              className="w-0.5 h-0.5 rounded-full bg-current animate-bounce"
                              style={{ animationDelay: `${i * 150}ms` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                    {ev.detail && (
                      <div className="mt-0.5 text-[9px] text-muted-foreground/50 truncate">
                        {ev.detail}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer disclaimer */}
        <div className="mt-3 pt-2 border-t border-border/30 flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
          <Sparkles className="w-3 h-3 shrink-0" />
          <span>Modo demonstrativo — simulação do comportamento real do agente Kodo AI</span>
        </div>
      </CardContent>
    </Card>
  );
}
