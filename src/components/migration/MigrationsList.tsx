import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { type ClusterMigration } from "@/services/migrationAnalysisService";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Eye,
  Layers,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MigrationsListProps {
  migrations: ClusterMigration[];
  loading: boolean;
  onViewMigration: (migration: ClusterMigration) => void;
  onApply: (migration: ClusterMigration) => void;
  onValidate: (migration: ClusterMigration) => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Aguardando", icon: <Clock className="w-3 h-3" />, variant: "secondary" },
  analyzing: { label: "Analisando", icon: <Loader2 className="w-3 h-3 animate-spin" />, variant: "default" },
  ready: { label: "Pronto", icon: <CheckCircle2 className="w-3 h-3" />, variant: "outline" },
  transforming: { label: "Transformando", icon: <Loader2 className="w-3 h-3 animate-spin" />, variant: "default" },
  applying: { label: "Aplicando", icon: <Loader2 className="w-3 h-3 animate-spin" />, variant: "default" },
  validating: { label: "Validando", icon: <Loader2 className="w-3 h-3 animate-spin" />, variant: "default" },
  completed: { label: "Concluído", icon: <CheckCircle2 className="w-3 h-3 text-green-500" />, variant: "outline" },
  failed: { label: "Falhou", icon: <XCircle className="w-3 h-3" />, variant: "destructive" },
  rolled_back: { label: "Revertido", icon: <XCircle className="w-3 h-3" />, variant: "destructive" },
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
}: MigrationsListProps) {
  return (
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
              return (
                <div key={m.id} className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{m.name}</span>
                        <Badge variant={cfg.variant} className="flex items-center gap-1">
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
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
                      {m.status === "applying" || m.status === "completed" ? (
                        <Button size="sm" variant="outline" onClick={() => onValidate(m)}>
                          Validar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {m.progress_percent != null && m.progress_percent > 0 && m.progress_percent < 100 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{m.current_step}</span>
                        <span>{m.progress_percent}%</span>
                      </div>
                      <Progress value={m.progress_percent} className="h-1.5" />
                    </div>
                  )}
                  {m.error_message && (
                    <p className="text-xs text-destructive">{m.error_message}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
