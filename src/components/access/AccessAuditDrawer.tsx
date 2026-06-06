import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  KeyRound, Download, Ban, Eye, Code2, Settings2,
  List, FileText, Terminal, Pencil, Trash2, Loader2, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessAuditDrawerProps {
  open: boolean;
  onClose: () => void;
  grant: {
    id: string;
    grantee_name: string;
    grantee_email?: string;
    access_role: string;
    namespace?: string | null;
    status: string;
    created_at: string;
  } | null;
}

interface AuditLog {
  id: string;
  event_type: string;
  resource_type?: string;
  resource_name?: string;
  resource_namespace?: string;
  details: Record<string, any>;
  created_at: string;
}

const EVENT_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  grant_created:       { icon: KeyRound,  label: "Acesso criado",       color: "text-green-400"  },
  kubeconfig_downloaded: { icon: Download, label: "Kubeconfig baixado", color: "text-sky-400"    },
  access_revoked:      { icon: Ban,       label: "Acesso revogado",     color: "text-red-400"    },
  access_expired:      { icon: Ban,       label: "Acesso expirado",     color: "text-amber-400"  },
  k8s_get:             { icon: Eye,       label: "k8s: get",            color: "text-muted-foreground" },
  k8s_list:            { icon: List,      label: "k8s: list",           color: "text-muted-foreground" },
  k8s_logs:            { icon: FileText,  label: "k8s: logs",           color: "text-sky-400"    },
  k8s_exec:            { icon: Terminal,  label: "k8s: exec",           color: "text-violet-400" },
  k8s_create:          { icon: Code2,     label: "k8s: create",         color: "text-green-400"  },
  k8s_update:          { icon: Pencil,    label: "k8s: update",         color: "text-amber-400"  },
  k8s_patch:           { icon: Pencil,    label: "k8s: patch",          color: "text-amber-400"  },
  k8s_delete:          { icon: Trash2,    label: "k8s: delete",         color: "text-red-400"    },
};

const ROLE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  viewer:    { icon: Eye,      label: "Somente Leitura", color: "text-sky-400"    },
  developer: { icon: Code2,    label: "Desenvolvedor",   color: "text-violet-400" },
  operator:  { icon: Settings2, label: "Operador",       color: "text-amber-400"  },
};

function relTime(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

export function AccessAuditDrawer({ open, onClose, grant }: AccessAuditDrawerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !grant) return;
    setLoading(true);
    supabase
      .from("cluster_access_audit_logs")
      .select("*")
      .eq("access_grant_id", grant.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLogs((data as AuditLog[]) ?? []);
        setLoading(false);
      });
  }, [open, grant]);

  if (!grant) return null;

  const roleMeta = ROLE_META[grant.access_role] ?? ROLE_META.viewer;
  const { icon: RoleIcon } = roleMeta;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle>Auditoria de Acesso</SheetTitle>
          <SheetDescription>
            Histórico de atividades de <strong>{grant.grantee_name}</strong>
          </SheetDescription>
        </SheetHeader>

        {/* Grant summary */}
        <div className="mb-5 p-3 rounded-lg bg-muted/40 border border-border/50 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="font-medium">{grant.grantee_name}</div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                grant.status === "active"  ? "border-green-500/40 text-green-400 bg-green-500/10" :
                grant.status === "revoked" ? "border-red-500/40 text-red-400 bg-red-500/10" :
                "border-amber-500/40 text-amber-400 bg-amber-500/10"
              )}
            >
              {grant.status === "active" ? "Ativo" : grant.status === "revoked" ? "Revogado" : "Expirado"}
            </Badge>
          </div>
          {grant.grantee_email && (
            <div className="text-muted-foreground text-xs">{grant.grantee_email}</div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RoleIcon className={cn("w-3 h-3", roleMeta.color)} />
            <span>{roleMeta.label}</span>
            <span>·</span>
            <span>{grant.namespace ?? "Todos os namespaces"}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Criado {relTime(grant.created_at)}
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
            <Info className="w-6 h-6 opacity-30" />
            <span className="text-sm opacity-50">Nenhum evento registrado</span>
          </div>
        ) : (
          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border/50" />

            {logs.map((log, idx) => {
              const meta = EVENT_META[log.event_type] ?? {
                icon: Info, label: log.event_type, color: "text-muted-foreground",
              };
              const { icon: EventIcon } = meta;
              return (
                <div key={log.id} className="relative flex gap-3 pb-4">
                  {/* Dot */}
                  <div className={cn(
                    "relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-border bg-background",
                  )}>
                    <EventIcon className={cn("w-3.5 h-3.5", meta.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-xs font-medium", meta.color)}>{meta.label}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{relTime(log.created_at)}</span>
                    </div>
                    {(log.resource_type || log.resource_name) && (
                      <div className="mt-0.5 text-xs text-muted-foreground font-mono truncate">
                        {[log.resource_type, log.resource_name].filter(Boolean).join("/")}
                        {log.resource_namespace && <span className="ml-1 text-sky-400/70">({log.resource_namespace})</span>}
                      </div>
                    )}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-1 text-[10px] text-muted-foreground/60 font-mono truncate">
                        {Object.entries(log.details)
                          .filter(([k]) => !["revoked_by"].includes(k))
                          .slice(0, 3)
                          .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
