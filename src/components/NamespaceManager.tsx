import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Layers,
  Plus,
  RefreshCw,
  Trash2,
  Shield,
  Box,
  Key,
  Network,
  Server,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Lock,
  ChevronRight,
  Bot,
  Eye,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Namespaces that cannot be deleted from the UI
const PROTECTED_NAMESPACES = new Set([
  "default", "kube-system", "kube-public", "kube-node-lease",
  "kodo", "kodo-agent", "calico-system", "calico-apiserver",
  "tigera-operator", "cilium", "cilium-system", "istio-system",
  "istio-operator", "linkerd", "linkerd-viz", "metallb-system",
  "ingress-nginx", "ingress", "cert-manager", "monitoring",
  "prometheus", "grafana", "lens-metrics", "flux-system",
  "argocd", "argo", "velero", "gatekeeper-system", "kyverno",
  "local-path-storage",
]);

// Namespaces that appear under "System" label
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

export interface NamespaceInfo {
  name: string;
  pods: number;
  pvcs: number;
  services: number;
  secrets: number;
  deployments: number;
  pod_list: string[];
  pvc_list: string[];
  service_list: string[];
  secret_list: string[];
  is_empty: boolean;
  is_protected: boolean;
  phase: string;
  created_at: string;
}

type FilterTab = "all" | "user" | "system" | "empty";

async function sendAgentCommand(
  clusterId: string,
  userId: string,
  commandType: string,
  params: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("agent_commands")
    .insert({
      cluster_id: clusterId,
      user_id: userId,
      command_type: commandType,
      command_params: params,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function NamespaceManager() {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();

  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Resources dialog (before delete)
  const [resourcesNs, setResourcesNs] = useState<NamespaceInfo | null>(null);

  // Delete confirm (single)
  const [deleteNs, setDeleteNs] = useState<NamespaceInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // ─── Data fetching ───────────────────────────────────────────────────────────

  const fetchNamespaces = useCallback(async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    try {
      // 1. Try the rich namespace_resources metric first (available after agent redeployment)
      const { data: nsData } = await supabase
        .from("agent_metrics")
        .select("metric_data, collected_at")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "namespace_resources")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (nsData?.metric_data) {
        const raw: NamespaceInfo[] =
          ((nsData.metric_data as any)?.namespaces as NamespaceInfo[]) || [];
        if (raw.length > 0) {
          setNamespaces(raw);
          setLastUpdated(new Date(nsData.collected_at));
          return;
        }
      }

      // 2. Fallback: derive namespaces from pod_details + pvcs metrics
      const [podRes, pvcRes] = await Promise.all([
        supabase
          .from("agent_metrics")
          .select("metric_data, collected_at")
          .eq("cluster_id", selectedClusterId)
          .eq("metric_type", "pod_details")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("agent_metrics")
          .select("metric_data")
          .eq("cluster_id", selectedClusterId)
          .eq("metric_type", "pvcs")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const pods: any[] = (podRes.data?.metric_data as any)?.pods || [];
      const pvcs: any[] = (pvcRes.data?.metric_data as any)?.pvcs || [];

      // Group pods by namespace
      const nsPods: Record<string, string[]> = {};
      for (const pod of pods) {
        const ns = pod.namespace || "default";
        if (!nsPods[ns]) nsPods[ns] = [];
        nsPods[ns].push(pod.name);
      }

      // Group PVCs by namespace
      const nsPvcs: Record<string, string[]> = {};
      for (const pvc of pvcs) {
        const ns = pvc.namespace || "default";
        if (!nsPvcs[ns]) nsPvcs[ns] = [];
        nsPvcs[ns].push(pvc.name);
      }

      // Combine all unique namespaces
      const allNs = new Set([...Object.keys(nsPods), ...Object.keys(nsPvcs)]);

      // Also add known system namespaces even if they have no workloads
      for (const sysNs of SYSTEM_NAMESPACES) {
        allNs.add(sysNs);
      }

      const derived: NamespaceInfo[] = Array.from(allNs)
        .sort((a, b) => {
          // user namespaces first, then system
          const aSystem = SYSTEM_NAMESPACES.has(a);
          const bSystem = SYSTEM_NAMESPACES.has(b);
          if (aSystem !== bSystem) return aSystem ? 1 : -1;
          return a.localeCompare(b);
        })
        .map((name) => {
          const podList = nsPods[name] || [];
          const pvcList = nsPvcs[name] || [];
          const isEmpty = podList.length === 0 && pvcList.length === 0;
          return {
            name,
            pods: podList.length,
            pvcs: pvcList.length,
            services: 0,
            secrets: 0,
            deployments: 0,
            pod_list: podList,
            pvc_list: pvcList,
            service_list: [],
            secret_list: [],
            is_empty: isEmpty,
            is_protected: PROTECTED_NAMESPACES.has(name),
            phase: "Active",
            created_at: "",
          };
        });

      setNamespaces(derived);
      if (podRes.data?.collected_at) setLastUpdated(new Date(podRes.data.collected_at));
    } catch (err) {
      console.error("Error fetching namespaces:", err);
      toast.error("Erro ao carregar namespaces");
    } finally {
      setLoading(false);
    }
  }, [selectedClusterId]);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const isSystem = (ns: NamespaceInfo) => SYSTEM_NAMESPACES.has(ns.name);
  const isProtected = (ns: NamespaceInfo) =>
    PROTECTED_NAMESPACES.has(ns.name) || ns.is_protected;

  const filtered = namespaces.filter((ns) => {
    if (filter === "user") return !isSystem(ns);
    if (filter === "system") return isSystem(ns);
    if (filter === "empty") return ns.is_empty && !isSystem(ns);
    return true;
  });

  const userNs = namespaces.filter((ns) => !isSystem(ns));
  const emptyNs = userNs.filter((ns) => ns.is_empty);

  // Selectable = non-protected user namespaces currently displayed
  const selectableFiltered = useMemo(
    () => filtered.filter((ns) => !isProtected(ns) && !isSystem(ns)),
    [filtered]
  );
  const allSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((ns) => selected.has(ns.name));
  const someSelected = selected.size > 0;

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableFiltered.map((ns) => ns.name)));
    }
  };

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const waitForCommand = useCallback(
    async (commandId: string, timeoutMs = 30_000): Promise<{ ok: boolean; error?: string }> => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const { data } = await supabase
          .from("agent_commands")
          .select("status, result")
          .eq("id", commandId)
          .maybeSingle();
        if (!data) continue;
        if (data.status === "completed") return { ok: true };
        if (data.status === "failed") {
          const res = data.result as any;
          return { ok: false, error: res?.error || "Comando falhou" };
        }
      }
      return { ok: false, error: "Timeout: agente não respondeu" };
    },
    []
  );

  const handleCreate = async () => {
    if (!newName.trim() || !selectedClusterId || !user) return;
    const ns = newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setCreating(true);
    try {
      const cmd = await sendAgentCommand(selectedClusterId, user.id, "create_namespace", {
        namespace: ns,
      });
      setShowCreate(false);
      setNewName("");
      const toastId = toast.loading(`Criando namespace "${ns}"...`);
      const result = await waitForCommand(cmd.id);
      if (result.ok) {
        toast.success(`Namespace "${ns}" criado com sucesso`, { id: toastId });
        setTimeout(fetchNamespaces, 1500);
      } else {
        toast.error(result.error || `Erro ao criar "${ns}"`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar namespace");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (ns: NamespaceInfo) => {
    if (!selectedClusterId || !user) return;
    setDeleting(true);
    setDeleteNs(null);
    setResourcesNs(null);
    try {
      const cmd = await sendAgentCommand(selectedClusterId, user.id, "delete_namespace", {
        namespace: ns.name,
      });
      const toastId = toast.loading(`Deletando namespace "${ns.name}"...`);
      const result = await waitForCommand(cmd.id);
      if (result.ok) {
        toast.success(`Namespace "${ns.name}" deletado com sucesso`, { id: toastId });
        setTimeout(fetchNamespaces, 1500);
      } else {
        toast.error(result.error || `Erro ao deletar "${ns.name}"`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao deletar namespace");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedClusterId || !user || selected.size === 0) return;
    setBulkDeleting(true);
    setShowBulkConfirm(false);
    const names = Array.from(selected);
    setSelected(new Set());
    const toastId = toast.loading(`Deletando ${names.length} namespace(s)...`);
    let success = 0;
    let failed = 0;
    await Promise.all(
      names.map(async (name) => {
        try {
          const cmd = await sendAgentCommand(selectedClusterId, user.id, "delete_namespace", {
            namespace: name,
          });
          const result = await waitForCommand(cmd.id);
          if (result.ok) success++;
          else failed++;
        } catch {
          failed++;
        }
      })
    );
    setBulkDeleting(false);
    if (failed === 0) {
      toast.success(`${success} namespace(s) deletado(s) com sucesso`, { id: toastId });
    } else if (success === 0) {
      toast.error(`Todos os ${failed} namespace(s) falharam — verifique as permissões RBAC`, { id: toastId });
    } else {
      toast.warning(`${success} deletado(s), ${failed} falharam`, { id: toastId });
    }
    setTimeout(fetchNamespaces, 1500);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Gerenciador de Namespaces</h2>
            {lastUpdated && (
              <p className="text-[11px] text-muted-foreground">
                Atualizado às {lastUpdated.toLocaleTimeString("pt-BR")}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8"
            onClick={fetchNamespaces}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Atualizar
          </Button>
          <Button
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setShowCreate(true)}
            disabled={!selectedClusterId}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo namespace
          </Button>
        </div>
      </div>

      {/* Stats mini-bar */}
      {!loading && namespaces.length > 0 && (
        <div className="flex items-center gap-6 text-sm">
          {[
            { label: "Total", value: namespaces.length, className: "text-foreground" },
            { label: "Usuário", value: userNs.length, className: "text-blue-500" },
            { label: "Vazios", value: emptyNs.length, className: "text-green-500" },
            {
              label: "Sistema",
              value: namespaces.length - userNs.length,
              className: "text-muted-foreground",
            },
          ].map(({ label, value, className }) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <span className={cn("text-xl font-semibold tabular-nums", className)}>
                {value}
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(
          [
            { id: "all", label: "Todos" },
            { id: "user", label: "Usuário" },
            { id: "empty", label: "Vazios" },
            { id: "system", label: "Sistema" },
          ] as { id: FilterTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "px-3 py-2 text-sm border-b-2 transition-colors",
              filter === tab.id
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-primary">
            {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setSelected(new Set())}
          >
            Limpar seleção
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs gap-1.5"
            onClick={() => setShowBulkConfirm(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Deletar selecionados
          </Button>
        </div>
      )}

      {/* Namespace list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando namespaces...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Layers className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {filter === "empty"
                ? "Nenhum namespace vazio de usuário"
                : "Nenhum namespace encontrado"}
            </p>
          </div>
        ) : (
          <>
            {/* Select-all header */}
            {selectableFiltered.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-muted/20">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  className="h-3.5 w-3.5"
                />
                <span className="text-[11px] text-muted-foreground">
                  Selecionar todos os namespaces de usuário ({selectableFiltered.length})
                </span>
              </div>
            )}
            <ScrollArea className="max-h-[520px]">
              <div className="divide-y divide-border/40">
                {filtered.map((ns) => {
                  const canSelect = !isProtected(ns) && !isSystem(ns);
                  return (
                    <NamespaceRow
                      key={ns.name}
                      ns={ns}
                      isSystem={isSystem(ns)}
                      isProtected={isProtected(ns)}
                      selected={selected.has(ns.name)}
                      canSelect={canSelect}
                      onToggleSelect={() => toggleSelect(ns.name)}
                      onViewResources={() => setResourcesNs(ns)}
                      onDeleteDirect={() => setDeleteNs(ns)}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Criar namespace
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome do namespace</label>
              <Input
                placeholder="meu-namespace"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Apenas letras minúsculas, números e hífens. O agente aplicará a criação no cluster.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="gap-1.5"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Resources dialog (view contents before delete) ── */}
      <Dialog open={!!resourcesNs} onOpenChange={(o) => !o && setResourcesNs(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Namespace:{" "}
              <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                {resourcesNs?.name}
              </code>
            </DialogTitle>
          </DialogHeader>

          {resourcesNs && (
            <div className="space-y-3 py-1">
              {/* Resource sections */}
              {[
                {
                  icon: Server,
                  label: "Pods",
                  items: resourcesNs.pod_list,
                  count: resourcesNs.pods,
                },
                {
                  icon: Box,
                  label: "PVCs",
                  items: resourcesNs.pvc_list,
                  count: resourcesNs.pvcs,
                },
                {
                  icon: Network,
                  label: "Serviços",
                  items: resourcesNs.service_list,
                  count: resourcesNs.services,
                },
                {
                  icon: Key,
                  label: "Secrets",
                  items: resourcesNs.secret_list,
                  count: resourcesNs.secrets,
                },
              ].map(({ icon: Icon, label, items, count }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {label}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] h-4 px-1.5",
                        count === 0
                          ? "text-green-500 border-green-500/30"
                          : "text-orange-500 border-orange-500/30"
                      )}
                    >
                      {count}
                    </Badge>
                  </div>
                  {items.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pl-5">
                      {items.map((item) => (
                        <span
                          key={item}
                          className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground pl-5">Nenhum</p>
                  )}
                </div>
              ))}

              {/* Warning if not empty */}
              {!resourcesNs.is_empty && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    Este namespace ainda possui recursos. Remova-os antes de deletar o namespace para
                    evitar perda de dados.
                  </span>
                </div>
              )}

              {resourcesNs.is_empty && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>Namespace vazio — pode ser deletado com segurança.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResourcesNs(null)}>
              Fechar
            </Button>
            {resourcesNs && !isProtected(resourcesNs) && (
              <Button
                variant="destructive"
                disabled={!resourcesNs.is_empty || deleting}
                className="gap-1.5"
                onClick={() => {
                  setDeleteNs(resourcesNs);
                  setResourcesNs(null);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Deletar namespace
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI monitoring scope ── */}
      {!loading && namespaces.length > 0 && (
        <AiMonitoringScope namespaces={namespaces} isSystem={isSystem} isProtected={isProtected} />
      )}

      {/* ── Bulk delete confirm ── */}
      <AlertDialog open={showBulkConfirm} onOpenChange={(o) => !o && setShowBulkConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar {selected.size} namespace(s)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Os seguintes namespaces serão permanentemente deletados:</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Array.from(selected).map((n) => (
                    <code key={n} className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                      {n}
                    </code>
                  ))}
                </div>
                <p className="text-destructive text-xs mt-1">Esta ação não pode ser desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Confirmar deleção em massa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteNs} onOpenChange={(o) => !o && setDeleteNs(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar namespace?</AlertDialogTitle>
            <AlertDialogDescription>
              O namespace{" "}
              <code className="font-mono bg-muted px-1 rounded">{deleteNs?.name}</code> será
              permanentemente deletado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteNs && handleDelete(deleteNs)}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Confirmar deleção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── AI monitoring scope section ───────────────────────────────────────────────

function AiMonitoringScope({
  namespaces,
  isSystem,
  isProtected,
}: {
  namespaces: NamespaceInfo[];
  isSystem: (ns: NamespaceInfo) => boolean;
  isProtected: (ns: NamespaceInfo) => boolean;
}) {
  // AI can monitor/act on user namespaces that are not system/essential cluster namespaces
  const monitorable = namespaces.filter((ns) => !isSystem(ns) && !isProtected(ns));
  const excluded = namespaces.filter((ns) => isSystem(ns) || isProtected(ns));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-muted/20">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Escopo de monitoramento da IA</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Namespaces onde a IA pode analisar e executar ações automatizadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
            {monitorable.length} disponíveis
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Monitorable namespaces */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-green-500" />
            <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
              Pode monitorar e agir
            </p>
          </div>
          {monitorable.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-5 italic">
              Nenhum namespace de usuário disponível
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pl-5">
              {monitorable.map((ns) => (
                <div
                  key={ns.name}
                  className="flex items-center gap-1.5 text-xs font-mono bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {ns.name}
                  {ns.pods > 0 && (
                    <span className="text-[10px] opacity-70">· {ns.pods}p</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Excluded namespaces */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Excluídos — infraestrutura essencial
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-5">
            {excluded.map((ns) => (
              <span
                key={ns.name}
                className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
              >
                {ns.name}
              </span>
            ))}
          </div>
        </div>

        {/* Explanation note */}
        <p className="text-[11px] text-muted-foreground border-t border-border/50 pt-3">
          A IA analisa e pode executar correções automáticas apenas nos namespaces marcados como
          disponíveis. Namespaces de sistema, infra e do próprio Kodo são sempre excluídos para
          evitar interferência em componentes críticos do cluster.
        </p>
      </div>
    </div>
  );
}

// ── NamespaceRow ─────────────────────────────────────────────────────────────

function NamespaceRow({
  ns,
  isSystem,
  isProtected,
  selected,
  canSelect,
  onToggleSelect,
  onViewResources,
  onDeleteDirect,
}: {
  ns: NamespaceInfo;
  isSystem: boolean;
  isProtected: boolean;
  selected: boolean;
  canSelect: boolean;
  onToggleSelect: () => void;
  onViewResources: () => void;
  onDeleteDirect: () => void;
}) {
  const resourceIcons = [
    { icon: Server, count: ns.pods, label: "pods" },
    { icon: Box, count: ns.pvcs, label: "pvcs" },
    { icon: Network, count: ns.services, label: "services" },
    { icon: Key, count: ns.secrets, label: "secrets" },
  ];

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors",
      selected && "bg-primary/5"
    )}>
      {/* Checkbox */}
      {canSelect ? (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          className="h-3.5 w-3.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="h-3.5 w-3.5 flex-shrink-0" />
      )}

      {/* Status dot */}
      <span
        className={cn(
          "h-2 w-2 rounded-full flex-shrink-0",
          ns.is_empty ? "bg-green-500" : isSystem ? "bg-slate-500" : "bg-blue-400"
        )}
      />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-mono font-medium">{ns.name}</span>
          {isSystem && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
              sistema
            </Badge>
          )}
          {isProtected && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 text-muted-foreground">
              <Lock className="h-2.5 w-2.5" />
              protegido
            </Badge>
          )}
          {ns.is_empty && !isSystem && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-green-500 border-green-500/30">
              <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
              vazio
            </Badge>
          )}
        </div>

        {/* Resource counts */}
        <div className="flex items-center gap-3 mt-1">
          {resourceIcons.map(({ icon: Icon, count, label }) => (
            <span
              key={label}
              className={cn(
                "flex items-center gap-1 text-[11px]",
                count > 0 ? "text-foreground/70" : "text-muted-foreground/50"
              )}
            >
              <Icon className="h-3 w-3" />
              {count}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isSystem || isProtected ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            disabled
          >
            <Shield className="h-3.5 w-3.5" />
          </Button>
        ) : ns.is_empty ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={onDeleteDirect}
          >
            <Trash2 className="h-3 w-3" />
            Deletar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs gap-1"
            onClick={onViewResources}
          >
            Ver recursos
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
