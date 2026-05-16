import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
import { type ClusterMigration } from "@/services/migrationAnalysisService";
import { isMigrationStalled } from "@/services/migrationAnalysisService";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Eye,
  Layers,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MigrationsListProps {
  migrations: ClusterMigration[];
  loading: boolean;
  onViewMigration: (migration: ClusterMigration) => void;
  onApply: (migration: ClusterMigration) => void;
  onValidate: (migration: ClusterMigration) => void;
  onCancel: (migration: ClusterMigration) => void;
}

const IN_PROGRESS_STATUSES = new Set(["analyzing", "transforming", "applying", "validating", "pending"]);

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending:      { label: "Aguardando",    icon: <Clock className="w-3 h-3" />,                         variant: "secondary" },
  analyzing:    { label: "Analisando",    icon: <Loader2 className="w-3 h-3 animate-spin" />,          variant: "default" },
  ready:        { label: "Pronto",        icon: <CheckCircle2 className="w-3 h-3" />,                   variant: "outline" },
  transforming: { label: "Transformando", icon: <Loader2 className="w-3 h-3 animate-spin" />,          variant: "default" },
  applying:     { label: "Aplicando",     icon: <Loader2 className="w-3 h-3 animate-spin" />,          variant: "default" },
  validating:   { label: "Validando",     icon: <Loader2 className="w-3 h-3 animate-spin" />,          variant: "default" },
  completed:    { label: "Concluído",     icon: <CheckCircle2 className="w-3 h-3 text-green-500" />,   variant: "outline" },
  failed:       { label: "Falhou",        icon: <XCircle className="w-3 h-3" />,                       variant: "destructive" },
  rolled_back:  { label: "Revertido",     icon: <XCircle className="w-3 h-3" />,                       variant: "destructive" },
};

function scoreColor(score?: number): string {
  if (!score) return "";
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
}

export function MigrationsList({
  migrations,
  loading,
  onViewMigration,
  onApply,
  onValidate,
  onCancel,
}: MigrationsListProps) {
  const [cancelTarget, setCancelTarget] = useState<ClusterMigration | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Histórico de Migrações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : migrations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma migração iniciada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {migrations.map((m) => {
                const cfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.pending;
                const stalled = IN_PROGRESS_STATUSES.has(m.status) && isMigrationStalled(m);
                const cancellable = IN_PROGRESS_STATUSES.has(m.status);

                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-lg border bg-card space-y-3 transition-colors ${stalled ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{m.name}</span>

                          {/* Status badge — show stalled variant if stuck */}
                          {stalled ? (
                            <Badge variant="outline" className="flex items-center gap-1 border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                              <AlertTriangle className="w-3 h-3" />
                              Travado
                            </Badge>
                          ) : (
                            <Badge variant={cfg.variant} className="flex items-center gap-1">
                              {cfg.icon}
                              {cfg.label}
                            </Badge>
                          )}

                          {m.compatibility_score != null && (
                            <span className={`text-sm font-semibold ${scoreColor(m.compatibility_score)}`}>
                              {m.compatibility_score}% compat.
                            </span>
                          )}
                        </div>

                        {m.description && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">{m.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => onViewMigration(m)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {m.status === "ready" && (
                          <Button size="sm" onClick={() => onApply(m)}>
                            <ArrowRight className="w-4 h-4 mr-1" />
                            Aplicar
                          </Button>
                        )}
                        {(m.status === "applying" || m.status === "completed") && (
                          <Button size="sm" variant="outline" onClick={() => onValidate(m)}>
                            Validar
                          </Button>
                        )}
                        {cancellable && (
                          <Button
                            size="sm"
                            variant={stalled ? "destructive" : "outline"}
                            onClick={() => setCancelTarget(m)}
                            className={stalled ? "" : "text-destructive hover:text-destructive border-destructive/30"}
                          >
                            <Ban className="w-3.5 h-3.5 mr-1" />
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Stall warning */}
                    {stalled && (
                      <div className="flex items-start gap-2 rounded-md bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          Esta migração parece travada — sem atualização há mais tempo do esperado.
                          O agente pode estar offline ou com problemas. Cancele para encerrar o processo e tente novamente.
                        </span>
                      </div>
                    )}

                    {/* Progress bar */}
                    {m.progress_percent != null && m.progress_percent > 0 && m.progress_percent < 100 && !stalled && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{m.current_step}</span>
                          <span>{m.progress_percent}%</span>
                        </div>
                        <Progress value={m.progress_percent} className="h-1.5" />
                      </div>
                    )}

                    {/* Error */}
                    {m.error_message && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <XCircle className="w-3 h-3 shrink-0" />
                        {m.error_message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Cancelar migração?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A migração <strong>"{cancelTarget?.name}"</strong> será marcada como falha e todos os
              comandos pendentes no cluster destino serão cancelados.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (cancelTarget) {
                  onCancel(cancelTarget);
                  setCancelTarget(null);
                }
              }}
            >
              Sim, cancelar migração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
