import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

type SnapshotStatus = "pending" | "running" | "completed" | "failed";

const CONFIG: Record<SnapshotStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending: { label: "Aguardando", variant: "secondary", icon: <Clock className="w-3 h-3" /> },
  running: { label: "Coletando", variant: "default", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: "Concluído", variant: "outline", icon: <CheckCircle2 className="w-3 h-3 text-green-500" /> },
  failed: { label: "Falhou", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
};

export function SnapshotStatusBadge({ status }: { status: SnapshotStatus }) {
  const { label, variant, icon } = CONFIG[status] ?? CONFIG.pending;
  return (
    <Badge variant={variant} className="flex items-center gap-1 w-fit">
      {icon}
      {label}
    </Badge>
  );
}
