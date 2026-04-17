import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SnapshotStatusBadge } from "./SnapshotStatusBadge";
import { CreateSnapshotButton } from "./CreateSnapshotButton";
import { type ClusterSnapshot } from "@/services/snapshotService";
import { Trash2, FileArchive, HardDrive, Calendar, Package } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SnapshotsListProps {
  snapshots: ClusterSnapshot[];
  loading: boolean;
  creating: boolean;
  onCreateSnapshot: (name: string, description?: string) => Promise<void>;
  onDeleteSnapshot: (snapshot: ClusterSnapshot) => Promise<void>;
  onSelectForMigration?: (snapshot: ClusterSnapshot) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SnapshotsList({
  snapshots,
  loading,
  creating,
  onCreateSnapshot,
  onDeleteSnapshot,
  onSelectForMigration,
}: SnapshotsListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="w-5 h-5" />
          Snapshots do Cluster
        </CardTitle>
        <CreateSnapshotButton onConfirm={onCreateSnapshot} loading={creating} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : snapshots.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <FileArchive className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum snapshot criado ainda.</p>
            <p className="text-sm">Crie um snapshot antes de iniciar uma migração.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{snapshot.name}</span>
                    <SnapshotStatusBadge status={snapshot.status} />
                  </div>
                  {snapshot.description && (
                    <p className="text-sm text-muted-foreground truncate">{snapshot.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {snapshot.manifest_count != null && (
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {snapshot.manifest_count} recursos
                      </span>
                    )}
                    {snapshot.namespace_count != null && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {snapshot.namespace_count} namespaces
                      </span>
                    )}
                    {snapshot.storage_size_bytes != null && (
                      <span>{formatBytes(snapshot.storage_size_bytes)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDistanceToNow(new Date(snapshot.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  {snapshot.error_message && (
                    <p className="text-xs text-destructive">{snapshot.error_message}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {snapshot.status === "completed" && onSelectForMigration && (
                    <Button size="sm" variant="outline" onClick={() => onSelectForMigration(snapshot)}>
                      Migrar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteSnapshot(snapshot)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
