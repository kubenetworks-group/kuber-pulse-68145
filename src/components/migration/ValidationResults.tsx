import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, Globe, Server,
  HardDrive, Box, ArrowRight, Network,
  Wifi, WifiOff, ListChecks,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type ClusterMigration } from "@/services/migrationAnalysisService";

interface ValidationRecord {
  id: string;
  validation_type: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  namespace?: string;
  resource_name?: string;
  detail?: string;
  error_message?: string;
}

interface ValidationResultsProps {
  migration: ClusterMigration;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; order: number }> = {
  pod_health:           { label: "Saúde dos Pods",         icon: <Box className="w-3.5 h-3.5" />,     order: 1 },
  deployment_ready:     { label: "Deployments prontos",    icon: <Server className="w-3.5 h-3.5" />,  order: 2 },
  pvc_binding:          { label: "Binding de PVCs",        icon: <HardDrive className="w-3.5 h-3.5" />, order: 3 },
  service_connectivity: { label: "Conectividade Services", icon: <Network className="w-3.5 h-3.5" />, order: 4 },
  ingress_routing:      { label: "Roteamento Ingress",     icon: <Globe className="w-3.5 h-3.5" />,   order: 5 },
  custom:               { label: "Verificações extras",    icon: <ShieldCheck className="w-3.5 h-3.5" />, order: 6 },
};

function statusIcon(status: ValidationRecord["status"]) {
  if (status === "passed") return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
  if (status === "failed") return <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

function parseIngressDetail(
  detail?: string,
  resourceName?: string
): { host: string; path: string; service: string; endpoints: number } | null {
  if (!detail) return null;
  // Format: "{host}{path} → {svcName}: {N} endpoint(s)" or "Default backend → {svcName}: {N} endpoint(s)"
  const m = detail.match(/^(.+?)\s*→\s*(.+?):\s*(\d+)\s*endpoint/);
  if (!m) return null;

  const leftSide = m[1].trim();
  const service = m[2].trim();
  const endpoints = parseInt(m[3]);

  let host = resourceName ?? "*";
  let path = "/";

  if (leftSide !== "Default backend") {
    const slashIdx = leftSide.indexOf("/");
    if (slashIdx > 0) {
      host = leftSide.slice(0, slashIdx);
      path = leftSide.slice(slashIdx) || "/";
    } else {
      host = leftSide;
    }
  }

  return { host, path, service, endpoints };
}

export function ValidationResults({ migration }: ValidationResultsProps) {
  const [validations, setValidations] = useState<ValidationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!migration.id) return;

    supabase
      .from("migration_validations")
      .select("*")
      .eq("migration_id", migration.id)
      .order("ran_at" as never)
      .then(({ data }) => {
        setValidations((data ?? []) as unknown as ValidationRecord[]);
        setLoading(false);
      });

    const channel = supabase
      .channel(`validations:${migration.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "migration_validations", filter: `migration_id=eq.${migration.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setValidations((prev) => [...prev, payload.new as unknown as ValidationRecord]);
          } else if (payload.eventType === "UPDATE") {
            setValidations((prev) =>
              prev.map((v) => (v.id === payload.new.id ? (payload.new as unknown as ValidationRecord) : v))
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [migration.id]);

  if (migration.status !== "completed" && migration.status !== "validating" && validations.length === 0) {
    return null;
  }

  const passed = validations.filter((v) => v.status === "passed").length;
  const failed = validations.filter((v) => v.status === "failed").length;
  const total = validations.length;

  const ingressValidations = validations.filter((v) => v.validation_type === "ingress_routing");
  const ingressPassed = ingressValidations.every((v) => v.status === "passed") && ingressValidations.length > 0;
  const podPassed = validations
    .filter((v) => v.validation_type === "pod_health" || v.validation_type === "deployment_ready")
    .every((v) => v.status === "passed");

  const trafficReady =
    migration.current_step?.includes("tráfego pronto") ||
    (ingressPassed && podPassed && failed === 0 && total > 0);

  // Group validations by type
  const groups = Object.entries(TYPE_CONFIG)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([type, config]) => ({
      type,
      config,
      items: validations.filter((v) => v.validation_type === type),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* ── Traffic readiness banner ───────────────────────────────── */}
      {total > 0 && (
        <Card className={trafficReady
          ? "border-green-400 bg-green-50/60 dark:bg-green-950/20"
          : "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20"
        }>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              {trafficReady
                ? <Wifi className="w-7 h-7 text-green-500 shrink-0" />
                : <WifiOff className="w-7 h-7 text-amber-500 shrink-0" />}
              <div>
                <p className={`font-semibold text-sm ${trafficReady ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
                  {trafficReady
                    ? "Pronto para migrar IPs externos"
                    : failed > 0
                      ? `Não pronto — ${failed} verificaç${failed === 1 ? "ão falhou" : "ões falharam"}`
                      : "Aguardando validação completa"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {trafficReady
                    ? "Pods saudáveis, serviços acessíveis e Ingress roteando corretamente. Você pode migrar os IPs/DNS externos agora."
                    : failed > 0
                      ? "Corrija os problemas abaixo antes de migrar os IPs externos para evitar downtime."
                      : "Execute 'Executar Validação' para verificar o estado do cluster destino."}
                </p>
              </div>
              <div className="ml-auto text-right shrink-0">
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {total > 0 ? Math.round((passed / total) * 100) : 0}%
                </span>
                <p className="text-xs text-muted-foreground">{passed}/{total} OK</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Ingress → Service → Pod flow ──────────────────────────── */}
      {ingressValidations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Fluxo Ingress → Service → Pod
              {ingressPassed
                ? <Badge className="text-xs py-0 bg-green-100 text-green-700 border border-green-300 hover:bg-green-100">OK</Badge>
                : <Badge variant="destructive" className="text-xs py-0">Falhou</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ingressValidations.map((v, i) => {
                const parsed = parseIngressDetail(v.detail, v.resource_name);
                const ok = v.status === "passed";
                return (
                  <div key={v.id} className={`rounded-lg border p-3 ${ok ? "bg-green-50/40 border-green-200 dark:bg-green-950/10" : "bg-red-50/40 border-destructive/30 dark:bg-red-950/10"}`}>
                    {parsed ? (
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 font-mono">
                          <Globe className="w-3 h-3 text-primary" />
                          <span className="font-medium">{parsed.host ?? v.resource_name}</span>
                          {parsed.path !== "/" && <span className="text-muted-foreground">{parsed.path}</span>}
                        </div>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 font-mono">
                          <Network className="w-3 h-3 text-blue-500" />
                          <span>{parsed.service ?? "—"}</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded font-mono ${ok ? "bg-green-500/10" : "bg-destructive/10"}`}>
                          <Box className={`w-3 h-3 ${ok ? "text-green-500" : "text-destructive"}`} />
                          <span>{parsed.endpoints !== undefined ? `${parsed.endpoints} pod${parsed.endpoints !== 1 ? "s" : ""}` : "?"}</span>
                        </div>
                        <div className="ml-auto">
                          {ok
                            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                            : <XCircle className="w-4 h-4 text-destructive" />}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        {statusIcon(v.status)}
                        <span className="font-mono">{v.resource_name}</span>
                        {v.namespace && <Badge variant="outline" className="text-xs py-0">{v.namespace}</Badge>}
                        <span className="text-muted-foreground">{v.detail}</span>
                      </div>
                    )}
                    {v.status === "failed" && v.detail && !parsed && (
                      <p className="text-xs text-destructive mt-1 ml-5">{v.detail}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Grouped validation results ─────────────────────────────── */}
      {groups.filter(g => g.type !== "ingress_routing").length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Verificações de Integridade
              </span>
              <div className="flex gap-1.5">
                {passed > 0 && (
                  <Badge variant="outline" className="text-xs py-0 text-green-600 border-green-300">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" />{passed} OK
                  </Badge>
                )}
                {failed > 0 && (
                  <Badge variant="destructive" className="text-xs py-0">
                    <XCircle className="w-2.5 h-2.5 mr-1" />{failed} falhou
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {groups
                .filter((g) => g.type !== "ingress_routing")
                .map(({ type, config, items }) => {
                  const groupPassed = items.filter((v) => v.status === "passed").length;
                  const groupFailed = items.filter((v) => v.status === "failed").length;
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-muted-foreground">{config.icon}</span>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{config.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {groupPassed}/{items.length}
                          {groupFailed > 0 && <span className="text-destructive ml-1">({groupFailed} falhou)</span>}
                        </span>
                      </div>
                      <div className="space-y-1 pl-1">
                        {items.map((v) => (
                          <div key={v.id} className={`flex items-start gap-2 p-2 rounded-md border text-xs ${
                            v.status === "passed"
                              ? "bg-green-50/40 border-green-200/60 dark:bg-green-950/10"
                              : v.status === "failed"
                              ? "bg-red-50/40 border-destructive/20 dark:bg-red-950/10"
                              : "bg-muted/30 border-border"
                          }`}>
                            {statusIcon(v.status)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {v.resource_name && <span className="font-mono font-medium">{v.resource_name}</span>}
                                {v.namespace && <Badge variant="outline" className="text-xs py-0">{v.namespace}</Badge>}
                              </div>
                              {v.detail && <p className="text-muted-foreground mt-0.5 leading-snug">{v.detail}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Manual IP migration checklist ─────────────────────────── */}
      {trafficReady && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              Próximos passos — Migração de IPs externos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-xs text-muted-foreground">
              {[
                "Anote os IPs externos dos LoadBalancers no cluster destino (kubectl get svc -A)",
                "Configure o TTL do DNS para um valor baixo (ex: 60s) antes de alterar",
                "Atualize os registros DNS (A/CNAME) para apontar para os novos IPs",
                "Monitore os logs do cluster destino durante a transição",
                "Após propagação do DNS, remova os recursos no cluster de origem",
                "Restaure o TTL do DNS para o valor original",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-xs">
                    {i + 1}
                  </span>
                  <span className="leading-snug mt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!loading && total === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma validação executada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Após aplicar a migração, clique em "Executar Validação" para verificar a integridade do cluster destino.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
