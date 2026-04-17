import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCompare } from "lucide-react";
import { type ClusterMigration } from "@/services/migrationAnalysisService";

interface ManifestDiffViewerProps {
  migration: ClusterMigration;
}

interface TransformationEntry {
  resource: string;
  kind: string;
  namespace?: string;
  change: string;
  reason: string;
}

export function ManifestDiffViewer({ migration }: ManifestDiffViewerProps) {
  const log = (migration.transformation_log ?? []) as TransformationEntry[];

  if (log.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            Diff de Manifests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma transformação foi necessária. Os manifests são compatíveis com o cluster destino.
          </p>
        </CardContent>
      </Card>
    );
  }

  const byKind = log.reduce<Record<string, TransformationEntry[]>>((acc, entry) => {
    const key = entry.kind;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            Diff de Manifests
          </span>
          <Badge variant="outline">{log.length} alterações</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {Object.entries(byKind).map(([kind, entries]) => (
              <div key={kind}>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                  {kind} ({entries.length})
                </h4>
                <div className="space-y-2">
                  {entries.map((entry, i) => (
                    <div key={i} className="rounded-lg border bg-muted/30 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 border-b text-xs font-mono">
                        <span className="font-medium">{entry.resource}</span>
                        {entry.namespace && (
                          <Badge variant="outline" className="text-xs py-0">
                            {entry.namespace}
                          </Badge>
                        )}
                      </div>
                      <div className="px-3 py-2 space-y-1">
                        <div className="font-mono text-xs">
                          <span className="text-green-600 dark:text-green-400">+ {entry.change}</span>
                        </div>
                        <p className="text-xs text-muted-foreground italic">{entry.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
