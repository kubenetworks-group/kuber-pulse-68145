import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Shield, RefreshCw, CheckSquare, Square, Save, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// System namespaces are always excluded — user cannot enable them
const SYSTEM_NAMESPACES = new Set([
  "kube-system", "kube-public", "kube-node-lease",
  "calico-system", "calico-apiserver", "tigera-operator",
  "cilium", "cilium-system", "istio-system", "istio-operator",
  "linkerd", "linkerd-viz", "metallb-system", "ingress-nginx",
  "ingress", "cert-manager", "monitoring", "prometheus", "grafana",
  "lens-metrics", "flux-system", "argocd", "argo", "velero",
  "gatekeeper-system", "kyverno", "local-path-storage",
  "kodo", "kodo-agent",
]);

interface Props {
  clusterId: string;
}

export function NamespaceMonitoringConfig({ clusterId }: Props) {
  const { user } = useAuth();

  const [allNamespaces, setAllNamespaces]   = useState<string[]>([]);
  const [selected, setSelected]             = useState<Set<string>>(new Set());
  const [isAllMode, setIsAllMode]           = useState(true);   // null in DB = all
  const [loadingNs, setLoadingNs]           = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [dirty, setDirty]                   = useState(false);

  // ── Fetch available namespaces from agent metrics ──────────────────────
  const fetchNamespaces = useCallback(async () => {
    setLoadingNs(true);
    try {
      // Try rich namespace_resources metric first
      const { data: nsMetric } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", clusterId)
        .eq("metric_type", "namespace_resources")
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let names: string[] = [];

      if (nsMetric?.metric_data) {
        const nsList: any[] = (nsMetric.metric_data as any).namespaces ?? [];
        names = nsList.map((n: any) => n.name ?? n).filter(Boolean);
      } else {
        // Fallback: derive from pod_details
        const { data: podMetric } = await supabase
          .from("agent_metrics")
          .select("metric_data")
          .eq("cluster_id", clusterId)
          .eq("metric_type", "pod_details")
          .order("collected_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const pods: any[] = (podMetric?.metric_data as any)?.pods ?? [];
        names = [...new Set(pods.map((p: any) => p.namespace).filter(Boolean))];
      }

      setAllNamespaces(names.sort());
    } catch {
      toast.error("Erro ao buscar namespaces");
    } finally {
      setLoadingNs(false);
    }
  }, [clusterId]);

  // ── Fetch saved config ─────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    const { data } = await supabase
      .from("auto_heal_settings")
      .select("allowed_namespaces")
      .eq("cluster_id", clusterId)
      .maybeSingle();

    if (data?.allowed_namespaces === null || data?.allowed_namespaces === undefined) {
      setIsAllMode(true);
      setSelected(new Set());
    } else {
      setIsAllMode(false);
      setSelected(new Set(data.allowed_namespaces));
    }
    setDirty(false);
  }, [clusterId]);

  useEffect(() => {
    fetchNamespaces();
    fetchConfig();
  }, [fetchNamespaces, fetchConfig]);

  // ── User namespaces (non-system) ───────────────────────────────────────
  const userNamespaces = allNamespaces.filter(ns => !SYSTEM_NAMESPACES.has(ns));
  const systemList     = allNamespaces.filter(ns =>  SYSTEM_NAMESPACES.has(ns));

  // ── Handlers ──────────────────────────────────────────────────────────
  const toggleAll = () => {
    if (isAllMode) {
      // Switch to manual: pre-select all user namespaces
      setIsAllMode(false);
      setSelected(new Set(userNamespaces));
    } else {
      setIsAllMode(true);
      setSelected(new Set());
    }
    setDirty(true);
  };

  const toggleNs = (ns: string) => {
    if (isAllMode) {
      // Switch to manual with all user namespaces except the one just clicked
      const next = new Set(userNamespaces);
      next.delete(ns);
      setIsAllMode(false);
      setSelected(next);
    } else {
      const next = new Set(selected);
      if (next.has(ns)) next.delete(ns); else next.add(ns);
      setSelected(next);
      // If all user namespaces re-selected → switch back to allMode
      if ([...next].sort().join() === userNamespaces.sort().join()) {
        setIsAllMode(true);
        setSelected(new Set());
      }
    }
    setDirty(true);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const value = isAllMode ? null : [...selected];

      // Validate: at least one namespace must be selected in manual mode
      if (!isAllMode && selected.size === 0) {
        toast.error("Selecione ao menos um namespace, ou ative 'Todos'.");
        return;
      }

      const { error } = await supabase
        .from("auto_heal_settings")
        .upsert(
          {
            cluster_id: clusterId,
            user_id: user.id,
            allowed_namespaces: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "cluster_id" }
        );

      if (error) throw error;

      setDirty(false);
      toast.success(
        isAllMode
          ? "Agente monitorará todos os namespaces de usuário."
          : `Agente restrito a ${selected.size} namespace${selected.size > 1 ? "s" : ""}.`
      );
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const isChecked = (ns: string) => isAllMode || selected.has(ns);
  const checkedCount = isAllMode ? userNamespaces.length : selected.size;

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Namespaces monitorados
            </CardTitle>
            <CardDescription className="mt-1">
              Defina em quais namespaces o agente pode monitorar e executar ações automáticas.
              Namespaces de sistema são sempre excluídos.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => { fetchNamespaces(); fetchConfig(); }}>
            <RefreshCw className={cn("h-3.5 w-3.5", loadingNs && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loadingNs ? (
          <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Buscando namespaces do cluster...</span>
          </div>
        ) : userNamespaces.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Nenhum namespace de usuário encontrado. O agente precisa estar conectado.
          </div>
        ) : (
          <>
            {/* Select All toggle */}
            <button
              onClick={toggleAll}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors",
                isAllMode
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-border hover:border-primary/30 hover:bg-muted/40"
              )}
            >
              <div className="flex items-center gap-2.5">
                {isAllMode
                  ? <CheckSquare className="h-4 w-4 text-primary" />
                  : <Square      className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-medium">Todos os namespaces</span>
                <Badge variant={isAllMode ? "default" : "outline"} className="text-[10px]">
                  {userNamespaces.length} disponíveis
                </Badge>
              </div>
              {isAllMode && (
                <span className="text-xs text-primary">Ativo</span>
              )}
            </button>

            {/* Individual namespace list */}
            <ScrollArea className="h-[280px] rounded-lg border border-border">
              <div className="p-2 space-y-0.5">
                {userNamespaces.map(ns => (
                  <label
                    key={ns}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none",
                      isChecked(ns) ? "bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={isChecked(ns)}
                      onCheckedChange={() => toggleNs(ns)}
                      className="flex-shrink-0"
                    />
                    <span className={cn(
                      "text-sm font-mono flex-1",
                      isChecked(ns) ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {ns}
                    </span>
                    {isChecked(ns) && (
                      <span className="text-[10px] text-primary">monitorado</span>
                    )}
                  </label>
                ))}
              </div>
            </ScrollArea>

            {/* Counter */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {checkedCount} de {userNamespaces.length} namespace{userNamespaces.length > 1 ? "s" : ""} selecionado{checkedCount > 1 ? "s" : ""}
              </span>
              {!isAllMode && checkedCount < userNamespaces.length && (
                <button
                  className="text-primary hover:underline"
                  onClick={() => { setIsAllMode(true); setSelected(new Set()); setDirty(true); }}
                >
                  Selecionar todos
                </button>
              )}
            </div>

            {/* System namespaces info */}
            {systemList.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/60">
                <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">{systemList.length} namespaces de sistema</span> sempre excluídos:&nbsp;
                  {systemList.slice(0, 4).join(", ")}
                  {systemList.length > 4 && ` e mais ${systemList.length - 4}`}.
                </p>
              </div>
            )}

            {/* Save button */}
            <Button
              className="w-full gap-2"
              onClick={save}
              disabled={!dirty || saving}
            >
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                : <><Save className="h-4 w-4" />Salvar configuração</>}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
