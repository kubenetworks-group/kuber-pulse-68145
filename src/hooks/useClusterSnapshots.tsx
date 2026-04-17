import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  createSnapshot,
  deleteSnapshot,
  type ClusterSnapshot,
} from "@/services/snapshotService";

export function useClusterSnapshots(clusterId: string | null) {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<ClusterSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchSnapshots = useCallback(async () => {
    if (!clusterId || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cluster_snapshots")
        .select("*")
        .eq("cluster_id", clusterId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSnapshots((data ?? []) as unknown as ClusterSnapshot[]);
    } catch (err) {
      console.error("Failed to load snapshots:", err);
    } finally {
      setLoading(false);
    }
  }, [clusterId, user]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Realtime subscription
  useEffect(() => {
    if (!clusterId || !user) return;

    const channel = supabase
      .channel(`snapshots:${clusterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cluster_snapshots",
          filter: `cluster_id=eq.${clusterId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSnapshots((prev) => [payload.new as unknown as ClusterSnapshot, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setSnapshots((prev) =>
              prev.map((s) => (s.id === payload.new.id ? (payload.new as unknown as ClusterSnapshot) : s))
            );
          } else if (payload.eventType === "DELETE") {
            setSnapshots((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clusterId, user]);

  const handleCreateSnapshot = useCallback(
    async (name: string, description?: string) => {
      if (!clusterId) return;
      setCreating(true);
      try {
        await createSnapshot(clusterId, name, description);
        toast({
          title: "Snapshot iniciado",
          description: "O agente está coletando os manifests do cluster.",
        });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : (err as { message?: string })?.message ?? JSON.stringify(err);
        toast({
          title: "Erro ao criar snapshot",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setCreating(false);
      }
    },
    [clusterId]
  );

  const handleDeleteSnapshot = useCallback(async (snapshot: ClusterSnapshot) => {
    try {
      await deleteSnapshot(snapshot);
      toast({ title: "Snapshot removido com sucesso" });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? JSON.stringify(err);
      toast({
        title: "Erro ao remover snapshot",
        description: msg,
        variant: "destructive",
      });
    }
  }, []);

  return {
    snapshots,
    loading,
    creating,
    createSnapshot: handleCreateSnapshot,
    deleteSnapshot: handleDeleteSnapshot,
    refetch: fetchSnapshots,
  };
}
