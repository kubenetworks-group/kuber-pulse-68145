import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  createMigration,
  applyMigration,
  runMigrationValidation,
  cancelMigration,
  type ClusterMigration,
} from "@/services/migrationAnalysisService";

export function useClusterMigrations() {
  const { user } = useAuth();
  const [migrations, setMigrations] = useState<ClusterMigration[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ step: string; percent: number } | null>(null);

  const fetchMigrations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cluster_migrations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMigrations((data ?? []) as unknown as ClusterMigration[]);
    } catch (err) {
      console.error("Failed to load migrations:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMigrations();
  }, [fetchMigrations]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("cluster_migrations_all")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cluster_migrations",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMigrations((prev) => [payload.new as unknown as ClusterMigration, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setMigrations((prev) =>
              prev.map((m) => (m.id === payload.new.id ? (payload.new as unknown as ClusterMigration) : m))
            );
          } else if (payload.eventType === "DELETE") {
            setMigrations((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleCreateMigration = useCallback(
    async (params: {
      sourceClusterId: string;
      targetClusterId: string;
      snapshotId: string;
      name: string;
      description?: string;
      targetStorageClass?: string;
    }) => {
      setAnalyzing(true);
      setAnalysisProgress({ step: "Iniciando...", percent: 0 });
      try {
        const migration = await createMigration({
          ...params,
          onProgress: (step, percent) => {
            setAnalysisProgress({ step, percent });
          },
        });
        toast({
          title: "Análise concluída!",
          description: `Migração "${migration.name}" pronta — score de compatibilidade: ${migration.compatibility_score}%`,
        });
        return migration;
      } catch (err) {
        toast({
          title: "Erro na análise de migração",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
        throw err;
      } finally {
        setAnalyzing(false);
        setAnalysisProgress(null);
      }
    },
    []
  );

  const handleApplyMigration = useCallback(async (migration: ClusterMigration) => {
    try {
      await applyMigration(migration);
      toast({
        title: "Manifests enviados",
        description: "O agente do cluster destino está aplicando os manifests.",
      });
    } catch (err) {
      toast({
        title: "Erro ao aplicar migração",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }, []);

  const handleValidateMigration = useCallback(async (migration: ClusterMigration, namespaces?: string[]) => {
    try {
      await runMigrationValidation(migration, namespaces);
      toast({
        title: "Validação iniciada",
        description: "O agente está verificando a integridade da migração.",
      });
    } catch (err) {
      toast({
        title: "Erro ao iniciar validação",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }, []);

  const handleCancelMigration = useCallback(async (migration: ClusterMigration) => {
    try {
      await cancelMigration(migration);
      toast({
        title: "Migração encerrada",
        description: `"${migration.name}" foi marcada como falha e os comandos pendentes foram cancelados.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao cancelar migração",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }, []);

  return {
    migrations,
    loading,
    analyzing,
    analysisProgress,
    createMigration: handleCreateMigration,
    applyMigration: handleApplyMigration,
    validateMigration: handleValidateMigration,
    cancelMigration: handleCancelMigration,
    refetch: fetchMigrations,
  };
}
