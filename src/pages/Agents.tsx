import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { toast } from "sonner";
import {
  Terminal, Copy, Trash2, Plus, Download, CheckCircle,
  AlertTriangle, Clock, Wifi, WifiOff, RefreshCw, ArrowUpCircle, KeyRound, ShieldAlert,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  accent:  "#00E5A0",
  accentD: "rgba(0,229,160,0.12)",
  accentB: "rgba(0,229,160,0.25)",
  warn:    "#F5A623",
  warnD:   "rgba(245,166,35,0.12)",
  warnB:   "rgba(245,166,35,0.25)",
  danger:  "#FF4D4D",
  dangerD: "rgba(255,77,77,0.12)",
  dangerB: "rgba(255,77,77,0.25)",
  muted:   "#8892A4",
} as const;

const MONO = "'JetBrains Mono','Geist Mono',monospace";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentKey {
  id: string;
  name: string;
  api_key_prefix: string;
  cluster_id: string;
  last_seen: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  clusters: {
    name: string;
    agent_version: string | null;
    agent_update_available: boolean | null;
    agent_last_seen_at: string | null;
  };
}

// ─── Semver helpers ───────────────────────────────────────────────────────────

function cmpSemver(v1: string, v2: string): number {
  const n = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [a1, b1, c1] = n(v1);
  const [a2, b2, c2] = n(v2);
  return a1 !== a2 ? a1 - a2 : b1 !== b2 ? b1 - b2 : c1 - c2;
}

// Returns true only when agentV is strictly older than latestV (proper semver, not string compare)
function isAgentOutdated(agentV: string, latestV: string): boolean {
  if (!agentV || !latestV) return false;
  return cmpSemver(agentV, latestV) < 0;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function getAgentStatus(agent: AgentKey, latestVersion?: string | null): {
  label: string; color: string; dim: string; border: string; pulse?: boolean
} {
  if (!agent.is_active) {
    return { label: "Inativo", color: C.muted, dim: "rgba(136,146,164,0.10)", border: "rgba(136,146,164,0.25)" };
  }

  // Prefer cluster-level last_seen (updated by agent heartbeat)
  const lastSeen = agent.clusters?.agent_last_seen_at ?? agent.last_seen;
  if (!lastSeen) {
    return { label: "Aguardando", color: C.warn, dim: C.warnD, border: C.warnB };
  }

  const minsAgo = (Date.now() - new Date(lastSeen).getTime()) / 60_000;

  if (minsAgo < 5) {
    // Only show "Desatualizado" if the agent version is truly behind the latest
    const agentV = (agent.clusters?.agent_version ?? "").replace(/^v/, "");
    const latestV = (latestVersion ?? "").replace(/^v/, "");
    const trulyOutdated = agent.clusters?.agent_update_available && isAgentOutdated(agentV, latestV);
    if (trulyOutdated) {
      return { label: "Desatualizado", color: C.warn, dim: C.warnD, border: C.warnB };
    }
    return { label: "Online", color: C.accent, dim: C.accentD, border: C.accentB, pulse: true };
  }
  if (minsAgo < 60) {
    return { label: `${Math.floor(minsAgo)}min atrás`, color: C.warn, dim: C.warnD, border: C.warnB };
  }
  return { label: "Offline", color: C.danger, dim: C.dangerD, border: C.dangerB };
}

function isLikelyAuthFailure(agent: AgentKey): boolean {
  const lastSeen = agent.clusters?.agent_last_seen_at ?? agent.last_seen;
  if (!lastSeen) return false;
  const hoursAgo = (Date.now() - new Date(lastSeen).getTime()) / 3_600_000;
  return hoursAgo > 6 && agent.is_active;
}

function formatVersion(v: string | null | undefined): string {
  if (!v) return "";
  return v.startsWith("v") ? v : `v${v}`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(iso).toLocaleString("pt-BR");
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ agent, latestVersion }: { agent: AgentKey; latestVersion?: string | null }) {
  const s = getAgentStatus(agent, latestVersion);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: s.dim, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.pulse
        ? <span className="relative flex w-1.5 h-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: s.color }} />
            <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ background: s.color }} />
          </span>
        : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
      }
      {s.label}
    </span>
  );
}

// ─── Agents ───────────────────────────────────────────────────────────────────

const Agents = () => {
  const { user } = useAuth();
  const { clusters } = useCluster();
  const [searchParams, setSearchParams] = useSearchParams();

  const [agentKeys, setAgentKeys]               = useState<AgentKey[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [creating, setCreating]                 = useState(false);
  const [newAgentName, setNewAgentName]         = useState("");
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [dialogOpen, setDialogOpen]             = useState(false);
  const [showApiKey, setShowApiKey]             = useState<string | null>(null);
  const [lastCreatedClusterId, setLastCreatedClusterId] = useState<string | null>(null);
  const [latestAgentVersion, setLatestAgentVersion]     = useState<string | null>(null);
  const [copiedId, setCopiedId]                 = useState<string | null>(null);

  // Open dialog if coming from Clusters page
  useEffect(() => {
    const clusterIdFromUrl = searchParams.get("cluster_id");
    if (clusterIdFromUrl && clusters.length > 0) {
      const exists = clusters.find(c => c.id === clusterIdFromUrl);
      if (exists) {
        setSelectedClusterId(clusterIdFromUrl);
        setDialogOpen(true);
        setSearchParams({});
      }
    }
  }, [searchParams, clusters, setSearchParams]);

  useEffect(() => {
    if (!user) return;
    fetchAgentKeys();
    fetchLatestVersion();

    // Realtime: re-fetch whenever agent_version or agent_update_available changes in clusters
    const channel = supabase
      .channel("agents-page-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clusters" },
        () => fetchAgentKeys(true)
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "agent_api_keys" },
        () => fetchAgentKeys(true)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchLatestVersion = async () => {
    const { data } = await supabase
      .from("agent_versions")
      .select("version")
      .eq("is_latest", true)
      .single();
    if (data?.version) setLatestAgentVersion(data.version);
  };

  const fetchAgentKeys = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_api_keys")
        .select(`
          id, name, cluster_id, api_key_prefix, is_active, last_seen, created_at, updated_at,
          clusters(name, agent_version, agent_update_available, agent_last_seen_at)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAgentKeys((data as any) || []);
    } catch (err) {
      console.error("Error fetching agent keys:", err);
      toast.error("Erro ao carregar agentes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const createAgentKey = async () => {
    if (!newAgentName.trim()) { toast.error("Digite um nome para o agente"); return; }
    if (!selectedClusterId)   { toast.error("Selecione um cluster"); return; }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-generate-key", {
        body: { cluster_id: selectedClusterId, name: newAgentName },
      });
      if (error) throw error;

      toast.success("API key criada com sucesso!");
      setShowApiKey(data.api_key.api_key);
      setLastCreatedClusterId(selectedClusterId);
      setDialogOpen(false);
      setNewAgentName("");
      setSelectedClusterId("");
      fetchAgentKeys();
    } catch (err) {
      console.error("Error creating agent key:", err);
      toast.error("Erro ao criar API key");
    } finally {
      setCreating(false);
    }
  };

  const deleteAgentKey = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar esta API key? O agente parará de funcionar.")) return;
    try {
      const { error } = await supabase.from("agent_api_keys").delete().eq("id", id);
      if (error) throw error;
      toast.success("API key deletada");
      fetchAgentKeys();
    } catch (err) {
      toast.error("Erro ao deletar API key");
    }
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copiado!");
  };

  const downloadYaml = (apiKey: string, clusterId: string) => {
    const imageTag = `ghcr.io/kubenetworks-group/kodo-agent:${latestAgentVersion ?? "v0.1.77"}`;
    const yaml = `apiVersion: v1
kind: Namespace
metadata:
  name: kodo
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kodo-agent
  namespace: kodo
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kodo-agent
rules:
- apiGroups: [""]
  resources: ["nodes","pods","events","namespaces","persistentvolumeclaims","persistentvolumes","secrets","resourcequotas","limitranges","services","configmaps","endpoints"]
  verbs: ["get","list","watch"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["delete"]
- apiGroups: ["apps"]
  resources: ["deployments","daemonsets","replicasets","statefulsets"]
  verbs: ["get","list","watch","update","patch"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["nodes","pods"]
  verbs: ["get","list","watch"]
- apiGroups: ["rbac.authorization.k8s.io"]
  resources: ["roles","rolebindings","clusterroles","clusterrolebindings"]
  verbs: ["get","list","watch"]
- apiGroups: ["networking.k8s.io"]
  resources: ["networkpolicies","ingresses","ingressclasses"]
  verbs: ["get","list","watch"]
- apiGroups: ["coordination.k8s.io"]
  resources: ["leases"]
  verbs: ["get","list","watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kodo-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kodo-agent
subjects:
- kind: ServiceAccount
  name: kodo-agent
  namespace: kodo
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: kodo-config
  namespace: kodo
data:
  API_ENDPOINT: "${import.meta.env.VITE_SUPABASE_URL}/functions/v1"
  COLLECT_INTERVAL: "15"
---
apiVersion: v1
kind: Secret
metadata:
  name: kodo-secret
  namespace: kodo
type: Opaque
stringData:
  API_KEY: "${apiKey}"
  CLUSTER_ID: "${clusterId}"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kodo-agent
  namespace: kodo
  labels:
    app: kodo-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kodo-agent
  template:
    metadata:
      labels:
        app: kodo-agent
    spec:
      serviceAccountName: kodo-agent
      containers:
      - name: agent
        image: ${imageTag}
        imagePullPolicy: Always
        envFrom:
        - configMapRef:
            name: kodo-config
        - secretRef:
            name: kodo-secret
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "128Mi"
            cpu: "200m"`;

    const blob = new Blob([yaml], { type: "text/yaml" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `kodo-agent-${clusterId}.yaml` });
    a.click();
    URL.revokeObjectURL(url);
    toast.success("YAML baixado com sucesso");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1
              className="text-foreground font-semibold leading-tight"
              style={{ fontFamily: MONO, fontSize: 20 }}
            >
              Agentes
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Gerencie agentes de monitoramento instalados nos seus clusters
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAgentKeys(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              Atualizar
            </button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <button
                  className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold transition-all hover:-translate-y-px cursor-pointer outline-none border-none"
                  style={{ background: C.accent, color: "#000", boxShadow: "0 2px 10px rgba(0,229,160,0.2)" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova API Key
                </button>
              </DialogTrigger>

              <DialogContent className="w-[min(95vw,420px)] max-w-none p-0 gap-0 border border-border bg-card rounded-xl">
                <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
                  <DialogTitle className="text-sm font-semibold">Gerar Nova API Key</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Crie uma API key para instalar o agente no seu cluster
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 p-5">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Nome do Agente</Label>
                    <Input
                      placeholder="Ex: production-agent"
                      value={newAgentName}
                      onChange={e => setNewAgentName(e.target.value)}
                      className="h-8 text-xs"
                      style={{ fontFamily: MONO }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Cluster</Label>
                    <select
                      className="h-8 w-full px-2.5 rounded-lg border border-border bg-muted text-xs text-foreground outline-none cursor-pointer"
                      value={selectedClusterId}
                      onChange={e => setSelectedClusterId(e.target.value)}
                    >
                      <option value="">Selecione um cluster</option>
                      {clusters.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {clusters.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">Conecte um cluster primeiro</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30">
                  <button
                    onClick={() => setDialogOpen(false)}
                    className="h-8 px-3.5 rounded-lg text-xs bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={createAgentKey}
                    disabled={creating || !newAgentName.trim() || !selectedClusterId}
                    className="h-8 px-3.5 rounded-lg text-xs font-semibold transition-all hover:-translate-y-px disabled:opacity-60 cursor-pointer outline-none border-none"
                    style={{ background: C.accent, color: "#000" }}
                  >
                    {creating ? "Gerando…" : "Gerar API Key"}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── New API key reveal ── */}
        {showApiKey && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${C.accentB}`, background: C.accentD }}
          >
            <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: C.accentB }}>
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.accent }} />
              <span className="text-sm font-semibold" style={{ color: C.accent }}>API Key Criada</span>
              <span className="text-xs text-muted-foreground ml-1">— copie agora, não será exibida novamente</span>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-xs overflow-x-auto"
                  style={{ fontFamily: MONO }}
                >
                  {showApiKey}
                </code>
                <button
                  onClick={() => copy(showApiKey, "newkey")}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted border border-border hover:bg-accent transition-colors cursor-pointer outline-none flex-shrink-0"
                >
                  {copiedId === "newkey"
                    ? <CheckCircle className="w-3.5 h-3.5" style={{ color: C.accent }} />
                    : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  }
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => lastCreatedClusterId && downloadYaml(showApiKey, lastCreatedClusterId)}
                  className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-lg text-xs font-semibold transition-all hover:-translate-y-px cursor-pointer outline-none border-none"
                  style={{ background: C.accent, color: "#000" }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar YAML de Deploy
                </button>
                <button
                  onClick={() => { setShowApiKey(null); setLastCreatedClusterId(null); }}
                  className="flex items-center justify-center h-8 px-4 rounded-lg text-xs bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Agent list ── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => (
              <div key={i} className="h-40 rounded-xl bg-muted/40 border border-border animate-pulse" />
            ))}
          </div>
        ) : agentKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 bg-card border border-border rounded-xl">
            <div className="p-4 rounded-xl bg-muted border border-border">
              <Terminal className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Nenhum agente configurado</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Crie uma API key e instale o agente no seu cluster para começar a monitorar
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {agentKeys.map(agent => {
              const version     = formatVersion(agent.clusters?.agent_version);
              const lastSeen    = agent.clusters?.agent_last_seen_at ?? agent.last_seen;
              const updateAvail = agent.clusters?.agent_update_available;
              const status      = getAgentStatus(agent, latestAgentVersion);
              const isOnline       = status.label === "Online";
              const kubectlCmd     = `kubectl set image deployment/kodo-agent agent=ghcr.io/kubenetworks-group/kodo-agent:${latestAgentVersion ?? "latest"} -n kodo`;
              const cmdId          = `cmd-${agent.id}`;
              const authFailure    = isLikelyAuthFailure(agent);
              const patchSecretId  = `patch-${agent.id}`;

              // Client-side guard: only show update banner if agent is strictly OLDER than latest.
              // Avoids false positives when agent version is newer than the DB-registered latest
              // (e.g. after a manual update before the DB migration runs).
              const agentVersionNorm = (agent.clusters?.agent_version ?? "").replace(/^v/, "");
              const latestVersionNorm = (latestAgentVersion ?? "").replace(/^v/, "");
              const effectiveUpdateAvail = updateAvail && isAgentOutdated(agentVersionNorm, latestVersionNorm);

              return (
                <div
                  key={agent.id}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                  style={{ borderLeftWidth: 3, borderLeftColor: status.color }}
                >
                  {/* ── Card header ── */}
                  <div className="flex items-start justify-between gap-4 px-5 py-4">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      {/* Name + badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-sm font-semibold text-foreground"
                          style={{ fontFamily: MONO }}
                        >
                          {agent.name}
                        </span>
                        <StatusBadge agent={agent} latestVersion={latestAgentVersion} />
                        {version && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground"
                            style={{ fontFamily: MONO }}
                          >
                            {version}
                          </span>
                        )}
                        {effectiveUpdateAvail && latestAgentVersion && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: C.accentD, color: C.accent, border: `1px solid ${C.accentB}` }}
                          >
                            <ArrowUpCircle className="w-2.5 h-2.5" />
                            {formatVersion(latestAgentVersion)} disponível
                          </span>
                        )}
                      </div>

                      {/* Cluster + timestamps */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Cluster: <span className="text-foreground">{agent.clusters?.name ?? "—"}</span></span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Criado {new Date(agent.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        {lastSeen && (
                          <span className="flex items-center gap-1">
                            {isOnline
                              ? <Wifi className="w-2.5 h-2.5" style={{ color: C.accent }} />
                              : <WifiOff className="w-2.5 h-2.5" />
                            }
                            Última conexão: {formatRelative(lastSeen)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => deleteAgentKey(agent.id)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted transition-colors cursor-pointer outline-none border-none bg-transparent flex-shrink-0"
                      title="Remover agente"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>

                  {/* ── Update banner ── */}
                  {effectiveUpdateAvail && (
                    <div
                      className="mx-5 mb-4 rounded-lg overflow-hidden"
                      style={{ border: `1px solid ${C.accentB}`, background: C.accentD }}
                    >
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: C.accentB }}>
                        <ArrowUpCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.accent }} />
                        <span className="text-xs font-semibold" style={{ color: C.accent }}>
                          Atualização disponível — {formatVersion(latestAgentVersion)}
                        </span>
                      </div>
                      <div className="px-4 py-3 flex flex-col gap-2">
                        <p className="text-[11px] text-muted-foreground">
                          Execute para atualizar o agente no cluster:
                        </p>
                        <div className="relative">
                          <code
                            className="block text-[11px] bg-card border border-border rounded-md px-3 py-2 pr-9 overflow-x-auto"
                            style={{ fontFamily: MONO }}
                          >
                            {kubectlCmd}
                          </code>
                          <button
                            onClick={() => copy(kubectlCmd, cmdId)}
                            className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded bg-muted border border-border hover:bg-accent transition-colors cursor-pointer outline-none border-none"
                          >
                            {copiedId === cmdId
                              ? <CheckCircle className="w-3 h-3" style={{ color: C.accent }} />
                              : <Copy className="w-3 h-3 text-muted-foreground" />
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Auth failure banner ── */}
                  {authFailure && (
                    <div
                      className="mx-5 mb-4 rounded-lg overflow-hidden"
                      style={{ border: `1px solid ${C.dangerB}`, background: C.dangerD }}
                    >
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: C.dangerB }}>
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.danger }} />
                        <span className="text-xs font-semibold" style={{ color: C.danger }}>
                          Chave API inválida — agente não consegue autenticar
                        </span>
                      </div>
                      <div className="px-4 py-3 flex flex-col gap-3">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          O agente está rodando no cluster mas retorna <code className="bg-card px-1 rounded" style={{ fontFamily: MONO }}>401 Invalid API key</code>.
                          A chave no deployment não corresponde ao banco de dados. Crie uma nova chave e atualize o secret no cluster:
                        </p>

                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                            1. Crie uma nova API Key acima e copie-a
                          </span>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                            2. Atualize o secret no cluster
                          </span>
                          <div className="relative">
                            <code
                              className="block text-[11px] bg-card border border-border rounded-md px-3 py-2 pr-9 overflow-x-auto"
                              style={{ fontFamily: MONO, color: C.danger }}
                            >
                              {`kubectl patch secret kodo-secret -n kodo -p '{"stringData":{"API_KEY":"<nova-chave>"}}'`}
                            </code>
                            <button
                              onClick={() => copy(`kubectl patch secret kodo-secret -n kodo -p '{"stringData":{"API_KEY":"<nova-chave>"}}'`, patchSecretId)}
                              className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded bg-muted border border-border hover:bg-accent transition-colors cursor-pointer outline-none border-none"
                            >
                              {copiedId === patchSecretId
                                ? <CheckCircle className="w-3 h-3" style={{ color: C.accent }} />
                                : <Copy className="w-3 h-3 text-muted-foreground" />
                              }
                            </button>
                          </div>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                            3. Reinicie o pod do agente
                          </span>
                          <div className="relative">
                            <code
                              className="block text-[11px] bg-card border border-border rounded-md px-3 py-2 pr-9 overflow-x-auto"
                              style={{ fontFamily: MONO, color: "hsl(var(--muted-foreground))" }}
                            >
                              kubectl rollout restart deployment/kodo-agent -n kodo
                            </code>
                            <button
                              onClick={() => copy("kubectl rollout restart deployment/kodo-agent -n kodo", `restart-${agent.id}`)}
                              className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded bg-muted border border-border hover:bg-accent transition-colors cursor-pointer outline-none border-none"
                            >
                              {copiedId === `restart-${agent.id}`
                                ? <CheckCircle className="w-3 h-3" style={{ color: C.accent }} />
                                : <Copy className="w-3 h-3 text-muted-foreground" />
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── API Key section ── */}
                  <div className="flex flex-col gap-3 px-5 pb-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        API Key (prefix)
                      </span>
                      <div className="flex items-center gap-2">
                        <code
                          className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-xs text-muted-foreground overflow-x-auto"
                          style={{ fontFamily: MONO }}
                        >
                          {agent.api_key_prefix || "kp_***..."}
                        </code>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                          Chave mostrada apenas na criação
                        </span>
                      </div>
                    </div>

                    {/* YAML download hint — only show when no auth failure (avoid duplicate noise) */}
                    {!authFailure && (
                      <div
                        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px]"
                        style={{ background: C.warnD, border: `1px solid ${C.warnB}`, color: C.warn }}
                      >
                        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: C.warn }} />
                        Para baixar o YAML de deploy, crie uma nova API key. A chave completa é exibida apenas no momento da criação.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default Agents;
