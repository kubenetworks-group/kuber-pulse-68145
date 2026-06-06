import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { CreateAccessDrawer } from "@/components/access/CreateAccessDrawer";
import { AccessAuditDrawer } from "@/components/access/AccessAuditDrawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  KeyRound, Plus, Eye, Code2, Settings2, MoreHorizontal,
  ScrollText, Ban, Globe, Lock, Loader2, Users, CheckCircle2,
  Clock, Copy, ShieldCheck, FileKey, Cpu, Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseKubeconfigUsers, AUTH_TYPE_LABELS, type KubeUser, type KubeAuthType } from "@/lib/parseKubeconfig";

// ── Types ────────────────────────────────────────────────────────────────────

interface AccessGrant {
  id: string;
  grantee_name: string;
  grantee_email: string | null;
  access_role: string;
  namespace: string | null;
  status: string;
  notes: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  serviceaccount_name: string;
  kubeconfig_yaml: string | null;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  viewer:    { icon: Eye,        label: "Leitura",     color: "text-sky-400",    bg: "bg-sky-500/10"    },
  developer: { icon: Code2,      label: "Dev",         color: "text-violet-400", bg: "bg-violet-500/10" },
  operator:  { icon: Settings2,  label: "Operador",    color: "text-amber-400",  bg: "bg-amber-500/10"  },
  admin:     { icon: ShieldCheck, label: "Admin",      color: "text-green-400",  bg: "bg-green-500/10"  },
};

const STATUS_META: Record<string, { label: string; dotColor: string; badgeCn: string }> = {
  active:  { label: "Ativo",    dotColor: "bg-green-400",  badgeCn: "border-green-500/30 text-green-400 bg-green-500/8"  },
  revoked: { label: "Revogado", dotColor: "bg-red-400",    badgeCn: "border-red-500/30 text-red-400 bg-red-500/8"        },
  expired: { label: "Expirado", dotColor: "bg-amber-400",  badgeCn: "border-amber-500/30 text-amber-400 bg-amber-500/8"  },
};

const AUTH_TYPE_META: Record<KubeAuthType, { icon: React.ElementType; label: string }> = {
  "token":              { icon: KeyRound,  label: "Token"              },
  "client-certificate": { icon: FileKey,   label: "Certificado"        },
  "exec":               { icon: Cpu,       label: "Exec Plugin"        },
  "gcp-plugin":         { icon: Webhook,   label: "GCP Plugin"         },
  "aws-plugin":         { icon: Webhook,   label: "AWS Plugin (EKS)"   },
  "unknown":            { icon: KeyRound,  label: "Desconhecido"       },
};

function relTime(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClusterAccess() {
  const { user } = useAuth();
  const { selectedClusterId, clusters } = useCluster();

  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [kubeUsers, setKubeUsers] = useState<KubeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [auditGrant, setAuditGrant] = useState<AccessGrant | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AccessGrant | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [showKubeconfigId, setShowKubeconfigId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [namespaces, setNamespaces] = useState<string[]>([]);

  const selectedCluster = clusters.find(c => c.id === selectedClusterId);

  // ── Parse kubeconfig users whenever cluster changes ───────────────────────
  useEffect(() => {
    const configFile = (selectedCluster as any)?.config_file ?? "";
    setKubeUsers(parseKubeconfigUsers(configFile));
  }, [selectedCluster]);

  // ── Fetch Kodo grants ─────────────────────────────────────────────────────
  const fetchGrants = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const q = supabase
      .from("cluster_access_grants")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (selectedClusterId) q.eq("cluster_id", selectedClusterId);
    const { data } = await q;
    setGrants((data as AccessGrant[]) ?? []);
    setLoading(false);
  }, [user, selectedClusterId]);

  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  // ── Pull namespaces from latest namespace_usage metric ───────────────────
  useEffect(() => {
    if (!selectedClusterId) return;
    supabase
      .from("agent_metrics")
      .select("metric_data")
      .eq("cluster_id", selectedClusterId)
      .eq("metric_type", "namespace_usage")
      .order("collected_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        const nsList: string[] = (data?.metric_data as any)?.namespaces?.map((n: any) => n.namespace) ?? [];
        setNamespaces(nsList.filter(n => !["kube-system","kube-public","kube-node-lease","kodo-access"].includes(n)));
      });
  }, [selectedClusterId]);

  // ── Revoke ────────────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await supabase.functions.invoke("revoke-cluster-access", {
        body: { access_grant_id: revokeTarget.id },
      });
      if (res.error || res.data?.error) throw new Error(res.error?.message ?? res.data?.error);
      toast({ title: "Acesso revogado", description: `${revokeTarget.grantee_name} não tem mais acesso ao cluster.` });
      setRevokeTarget(null);
      fetchGrants();
    } catch (err: any) {
      toast({ title: "Erro ao revogar", description: err.message, variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  };

  const handleCopyYaml = async (grant: AccessGrant) => {
    if (!grant.kubeconfig_yaml) return;
    await navigator.clipboard.writeText(grant.kubeconfig_yaml);
    setCopiedId(grant.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copiado!" });
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    builtIn: kubeUsers.length,
    active:  grants.filter(g => g.status === "active").length,
    revoked: grants.filter(g => g.status === "revoked").length,
  };

  // ── Shared table header ───────────────────────────────────────────────────
  const TableHeader = () => (
    <div
      className="hidden md:grid px-4 py-2.5 border-b border-border/50 text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
      style={{ gridTemplateColumns: "1fr 160px 160px 130px 110px 120px 44px" }}
    >
      <div>Colaborador / Usuário</div>
      <div>Função / Acesso</div>
      <div>Autenticação</div>
      <div>Namespace</div>
      <div>Status</div>
      <div>Criado</div>
      <div />
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Controle de Acesso
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie quem tem acesso ao cluster
              {selectedCluster && <span className="font-medium text-foreground"> {(selectedCluster as any).name}</span>}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} disabled={!selectedClusterId}>
            <Plus className="w-4 h-4 mr-2" />
            Criar novo acesso
          </Button>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: ShieldCheck, label: "Usuários do Cluster",  value: stats.builtIn, color: "text-green-400",  bg: "bg-green-500/10"  },
            { icon: CheckCircle2, label: "Acessos Kodo Ativos", value: stats.active,  color: "text-sky-400",    bg: "bg-sky-500/10"    },
            { icon: Ban,          label: "Revogados",           value: stats.revoked, color: "text-red-400",    bg: "bg-red-500/10"    },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <Card key={label} className="border-border/50 bg-card/80">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", bg)}>
                  <Icon className={cn("w-5 h-5", color)} />
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── No cluster ── */}
        {!selectedClusterId && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-2 text-amber-400 text-sm">
              <KeyRound className="w-4 h-4 shrink-0" />
              Selecione um cluster no seletor acima para gerenciar acessos.
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 1 — Usuários do kubeconfig (built-in / importados)
        ════════════════════════════════════════════════════════════════════ */}
        {selectedClusterId && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Usuários do Cluster (kubeconfig importado)</h2>
              <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400 bg-green-500/8">
                {kubeUsers.length} usuário{kubeUsers.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Usuários definidos no arquivo kubeconfig original do cluster. Estes acessos existem diretamente no cluster e não são gerenciados pelo Kodo.
            </p>

            <Card className="border-border/50 bg-card/80">
              <TableHeader />

              {kubeUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 text-muted-foreground gap-2">
                  {!(selectedCluster as any)?.config_file ? (
                    <p className="text-sm opacity-50">Nenhum kubeconfig importado para este cluster.</p>
                  ) : (
                    <p className="text-sm opacity-50">Nenhum usuário encontrado no kubeconfig.</p>
                  )}
                </div>
              ) : (
                kubeUsers.map((ku) => {
                  const authMeta = AUTH_TYPE_META[ku.authType];
                  const { icon: AuthIcon } = authMeta;
                  const roleMeta = ROLE_META.admin;
                  const { icon: RoleIcon } = roleMeta;

                  return (
                    <div
                      key={ku.name}
                      className="grid md:grid-cols-[1fr_160px_160px_130px_110px_120px_44px] px-4 py-3 border-b border-border/20 hover:bg-muted/20 transition-colors items-center gap-3 text-sm"
                    >
                      {/* Name */}
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-medium truncate text-sm">{ku.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-border/50 text-muted-foreground">
                              Importado do kubeconfig
                            </Badge>
                            {ku.isCurrentContext && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-sky-500/30 text-sky-400 bg-sky-500/8">
                                contexto ativo
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Role */}
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-6 h-6 rounded flex items-center justify-center", roleMeta.bg)}>
                          <RoleIcon className={cn("w-3 h-3", roleMeta.color)} />
                        </div>
                        <span className="text-xs">Admin do Cluster</span>
                      </div>

                      {/* Auth type */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AuthIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{authMeta.label}</span>
                      </div>

                      {/* Namespace */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {ku.namespace ? (
                          <><Lock className="w-3 h-3 shrink-0" /><span className="truncate">{ku.namespace}</span></>
                        ) : (
                          <><Globe className="w-3 h-3 shrink-0" /><span>Todos</span></>
                        )}
                      </div>

                      {/* Status */}
                      <div>
                        <Badge variant="outline" className="text-[10px] gap-1 border-green-500/30 text-green-400 bg-green-500/8">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Ativo
                        </Badge>
                      </div>

                      {/* Created — not available for built-in users */}
                      <div className="text-xs text-muted-foreground/40 italic">—</div>

                      {/* Actions — no revoke for built-in */}
                      <div className="text-muted-foreground/30 text-xs text-center" title="Usuário gerenciado diretamente no cluster">
                        —
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 2 — Acessos criados pelo Kodo
        ════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Acessos Gerenciados pelo Kodo</h2>
            <Badge variant="outline" className="text-[10px]">
              {grants.length} acesso{grants.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Acessos criados via Kodo com kubeconfig restrito. Podem ser revogados a qualquer momento.
          </p>

          <Card className="border-border/50 bg-card/80">
            <TableHeader />

            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : grants.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                <Users className="w-10 h-10 opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium opacity-50">Nenhum acesso Kodo criado</p>
                  <p className="text-xs opacity-30 mt-1">Clique em "Criar novo acesso" para gerar um kubeconfig restrito</p>
                </div>
              </div>
            ) : (
              grants.map(grant => {
                const roleMeta = ROLE_META[grant.access_role] ?? ROLE_META.viewer;
                const statusMeta = STATUS_META[grant.status] ?? STATUS_META.active;
                const { icon: RoleIcon } = roleMeta;

                return (
                  <div key={grant.id}>
                    <div
                      className="grid md:grid-cols-[1fr_160px_160px_130px_110px_120px_44px] px-4 py-3 border-b border-border/20 hover:bg-muted/20 transition-colors items-center gap-3 text-sm"
                    >
                      {/* Collaborator */}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{grant.grantee_name}</div>
                        {grant.grantee_email && (
                          <div className="text-xs text-muted-foreground truncate">{grant.grantee_email}</div>
                        )}
                        {grant.notes && (
                          <div className="text-[10px] text-muted-foreground/60 truncate italic mt-0.5">{grant.notes}</div>
                        )}
                      </div>

                      {/* Role */}
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-6 h-6 rounded flex items-center justify-center", roleMeta.bg)}>
                          <RoleIcon className={cn("w-3 h-3", roleMeta.color)} />
                        </div>
                        <span className="text-xs">{roleMeta.label}</span>
                      </div>

                      {/* Auth type — always ServiceAccount token for Kodo grants */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <KeyRound className="w-3.5 h-3.5 shrink-0" />
                        <span>ServiceAccount</span>
                      </div>

                      {/* Namespace */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {grant.namespace ? (
                          <><Lock className="w-3 h-3 shrink-0" /><span className="truncate">{grant.namespace}</span></>
                        ) : (
                          <><Globe className="w-3 h-3 shrink-0" /><span>Todos</span></>
                        )}
                      </div>

                      {/* Status */}
                      <div>
                        <Badge variant="outline" className={cn("text-[10px] gap-1", statusMeta.badgeCn)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", statusMeta.dotColor,
                            grant.status === "active" && "animate-pulse"
                          )} />
                          {statusMeta.label}
                        </Badge>
                      </div>

                      {/* Created */}
                      <div className="text-xs text-muted-foreground">{relTime(grant.created_at)}</div>

                      {/* Actions */}
                      <div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {grant.kubeconfig_yaml && (
                              <DropdownMenuItem onClick={() =>
                                setShowKubeconfigId(showKubeconfigId === grant.id ? null : grant.id)
                              }>
                                <Eye className="w-3.5 h-3.5 mr-2" />
                                Ver Kubeconfig
                              </DropdownMenuItem>
                            )}
                            {grant.kubeconfig_yaml && (
                              <DropdownMenuItem onClick={() => handleCopyYaml(grant)}>
                                <Copy className="w-3.5 h-3.5 mr-2" />
                                {copiedId === grant.id ? "Copiado!" : "Copiar YAML"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setAuditGrant(grant)}>
                              <ScrollText className="w-3.5 h-3.5 mr-2" />
                              Ver Auditoria
                            </DropdownMenuItem>
                            {grant.status === "active" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setRevokeTarget(grant)}
                                >
                                  <Ban className="w-3.5 h-3.5 mr-2" />
                                  Revogar Acesso
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Inline kubeconfig preview */}
                    {showKubeconfigId === grant.id && grant.kubeconfig_yaml && (
                      <div className="px-4 pb-3">
                        <pre className="text-[10px] font-mono bg-muted rounded-lg p-3 overflow-x-auto max-h-48 border border-border/50 text-muted-foreground leading-relaxed whitespace-pre">
                          {grant.kubeconfig_yaml}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>

      {/* ── Drawers & Dialogs ── */}
      <CreateAccessDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchGrants}
        namespaces={namespaces}
      />

      <AccessAuditDrawer
        open={!!auditGrant}
        onClose={() => setAuditGrant(null)}
        grant={auditGrant}
      />

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar acesso de {revokeTarget?.grantee_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O kubeconfig gerado ficará inativo imediatamente. O ServiceAccount será removido do cluster.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Revogando...</>
                : "Revogar Acesso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
