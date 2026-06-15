import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Shield, RefreshCw, ChevronDown, Save, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const [allNamespaces, setAllNamespaces] = useState<string[]>([]);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [isAllMode, setIsAllMode]         = useState(true);
  const [loadingNs, setLoadingNs]         = useState(true);
  const [saving, setSaving]               = useState(false);
  const [dirty, setDirty]                 = useState(false);
  const [open, setOpen]                   = useState(false);

  const fetchNamespaces = useCallback(async () => {
    setLoadingNs(true);
    try {
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

  const userNamespaces = allNamespaces.filter(ns => !SYSTEM_NAMESPACES.has(ns));

  const toggleAll = () => {
    if (isAllMode) {
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
      const next = new Set(userNamespaces);
      next.delete(ns);
      setIsAllMode(false);
      setSelected(next);
    } else {
      const next = new Set(selected);
      if (next.has(ns)) next.delete(ns); else next.add(ns);
      setSelected(next);
      if ([...next].sort().join() === [...userNamespaces].sort().join()) {
        setIsAllMode(true);
        setSelected(new Set());
      }
    }
    setDirty(true);
  };

  const save = async () => {
    if (!user) return;
    if (!isAllMode && selected.size === 0) {
      toast.error("Selecione ao menos um namespace.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("auto_heal_settings")
        .upsert(
          { cluster_id: clusterId, user_id: user.id, allowed_namespaces: isAllMode ? null : [...selected], updated_at: new Date().toISOString() },
          { onConflict: "cluster_id" }
        );
      if (error) throw error;
      setDirty(false);
      setOpen(false);
      toast.success(isAllMode ? "Monitorando todos os namespaces." : `${selected.size} namespace${selected.size > 1 ? "s" : ""} configurado${selected.size > 1 ? "s" : ""}.`);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const isChecked = (ns: string) => isAllMode || selected.has(ns);
  const checkedCount = isAllMode ? userNamespaces.length : selected.size;

  const triggerLabel = isAllMode
    ? "Todos os namespaces"
    : checkedCount === 0
    ? "Nenhum namespace"
    : `${checkedCount} de ${userNamespaces.length} namespace${userNamespaces.length > 1 ? "s" : ""}`;

  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium flex-1">Namespaces monitorados</span>

          {loadingNs ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Buscando...</span>
            </div>
          ) : (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors",
                    "hover:bg-muted/50 focus:outline-none",
                    open ? "border-primary/50 bg-primary/5" : "border-border bg-background"
                  )}
                >
                  {isAllMode ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Badge variant="secondary" className="h-4 text-[10px] px-1.5 py-0">{checkedCount}</Badge>
                  )}
                  <span className={cn("font-mono text-xs", isAllMode ? "text-primary" : "text-foreground")}>
                    {triggerLabel}
                  </span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>
              </PopoverTrigger>

              <PopoverContent align="end" className="w-72 p-0" sideOffset={6}>
                <div className="p-2 border-b border-border">
                  <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer select-none">
                    <Checkbox
                      checked={isAllMode}
                      onCheckedChange={toggleAll}
                      className="flex-shrink-0"
                    />
                    <span className="text-sm font-medium">Todos os namespaces</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">{userNamespaces.length}</Badge>
                  </label>
                </div>

                <ScrollArea className="max-h-52">
                  <div className="p-2 space-y-0.5">
                    {userNamespaces.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                        Nenhum namespace encontrado. Aguarde o agente conectar.
                      </p>
                    ) : (
                      userNamespaces.map(ns => (
                        <label
                          key={ns}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer select-none"
                        >
                          <Checkbox
                            checked={isChecked(ns)}
                            onCheckedChange={() => toggleNs(ns)}
                            className="flex-shrink-0"
                          />
                          <span className="text-xs font-mono flex-1 truncate">{ns}</span>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <div className="p-2 border-t border-border flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {checkedCount} selecionado{checkedCount !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => { fetchNamespaces(); fetchConfig(); }}>
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button size="sm" className="h-7 text-xs px-3 gap-1.5" onClick={save} disabled={!dirty || saving}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
