import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
}

export function KubernetesResourceTable<T extends Record<string, any>>({
  data,
  columns,
  loading,
  emptyMessage = "Nenhum recurso encontrado",
}: Props<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            {columns.map((col) => (
              <TableHead key={col.key} className="text-xs font-semibold uppercase tracking-wide">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i} className="hover:bg-muted/20">
              {columns.map((col) => (
                <TableCell key={col.key} className="py-2.5">
                  {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ReadyBadge({ ready, desired }: { ready: number; desired: number }) {
  const ok = ready >= desired && desired > 0;
  return (
    <Badge variant={ok ? "default" : "destructive"} className="font-mono text-xs">
      {ready}/{desired}
    </Badge>
  );
}

export function NamespaceBadge({ namespace }: { namespace: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-xs bg-muted font-mono text-muted-foreground">
      {namespace}
    </span>
  );
}
