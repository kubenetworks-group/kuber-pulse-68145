import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DeletingCluster {
  id: string;
  name: string;
  notificationId: string;
}

interface ClusterDeletionProgressProps {
  deletingClusters: DeletingCluster[];
}

export const ClusterDeletionProgress = ({ deletingClusters }: ClusterDeletionProgressProps) => {
  const [progress, setProgress] = useState<Record<string, { message: string; startTime: number }>>({});

  useEffect(() => {
    // Initialize progress for new clusters
    deletingClusters.forEach(cluster => {
      if (!progress[cluster.id]) {
        setProgress(prev => ({
          ...prev,
          [cluster.id]: {
            message: "Iniciando exclusão...",
            startTime: Date.now()
          }
        }));
      }
    });

    // Listen for notification updates
    const channel = supabase
      .channel('deletion-messages')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          const notification = payload.new as any;
          const cluster = deletingClusters.find(c => c.notificationId === notification.id);
          
          if (cluster && notification.related_entity_type === 'cluster_deletion') {
            setProgress(prev => ({
              ...prev,
              [cluster.id]: {
                ...prev[cluster.id],
                message: notification.message
              }
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deletingClusters]);

  if (deletingClusters.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      {deletingClusters.map(cluster => {
        const clusterProgress = progress[cluster.id];
        const elapsedSeconds = clusterProgress 
          ? Math.round((Date.now() - clusterProgress.startTime) / 1000)
          : 0;

        return (
          <Card key={cluster.id} className="border-warning/50 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Loader2 className="w-4 h-4 animate-spin text-warning" />
                <Trash2 className="w-4 h-4 text-warning" />
                Excluindo: {cluster.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{clusterProgress?.message || "Processando..."}</span>
                <span>{elapsedSeconds}s</span>
              </div>
              <Progress value={undefined} className="h-2 animate-pulse" />
              <p className="text-xs text-muted-foreground">
                A exclusão está sendo processada em segundo plano. Você pode continuar usando o sistema normalmente.
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
