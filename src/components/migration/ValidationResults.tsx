import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
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

const TYPE_LABELS: Record<string, string> = {
  pod_health: "Saúde dos Pods",
  service_connectivity: "Conectividade de Services",
  pvc_binding: "Binding de PVCs",
  ingress_routing: "Roteamento de Ingress",
  resource_count: "Contagem de Recursos",
  configmap_secret: "ConfigMaps e Secrets",
  custom: "Personalizado",
};

export function ValidationResults({ migration }: ValidationResultsProps) {
  const [validations, setValidations] = useState<ValidationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!migration.id) return;

    supabase
      .from("migration_validations")
      .select("*")
      .eq("migration_id", migration.id)
      .order("created_at")
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

  const passed = validations.filter((v) => v.status === "passed").length;
  const failed = validations.filter((v) => v.status === "failed").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Validações de Integridade
          </span>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {passed} OK
            </Badge>
            {failed > 0 && (
              <Badge variant="destructive">
                <XCircle className="w-3 h-3 mr-1" /> {failed} falhou
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Carregando validações...</p>
        ) : validations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma validação executada ainda. Clique em "Validar Migração" para verificar a integridade.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {validations.map((v) => (
              <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                {v.status === "passed" && <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />}
                {v.status === "failed" && <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                {(v.status === "pending" || v.status === "running") && <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{TYPE_LABELS[v.validation_type] ?? v.validation_type}</span>
                    {v.namespace && <Badge variant="outline" className="text-xs">{v.namespace}</Badge>}
                    {v.resource_name && <span className="text-xs text-muted-foreground font-mono">{v.resource_name}</span>}
                  </div>
                  {v.detail && <p className="text-xs text-muted-foreground mt-0.5">{v.detail}</p>}
                  {v.error_message && <p className="text-xs text-destructive mt-0.5">{v.error_message}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
