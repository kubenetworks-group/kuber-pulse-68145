import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCommit, AlertTriangle, CheckCircle } from "lucide-react";
import { ClusterChange } from "@/hooks/useRiskAnalysis";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClusterChangesWidgetProps {
  changes: ClusterChange[];
}

export const ClusterChangesWidget = ({ changes }: ClusterChangesWidgetProps) => {
  const getReasonIcon = (type: string) => {
    if (type === "Warning") {
      return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
    }
    return <CheckCircle className="h-3 w-3 text-green-500" />;
  };

  const getReasonBadge = (reason: string) => {
    const variants: Record<string, string> = {
      Pulled: "bg-blue-500/10 text-blue-500 border-blue-500/30",
      Started: "bg-green-500/10 text-green-500 border-green-500/30",
      Created: "bg-purple-500/10 text-purple-500 border-purple-500/30",
      Killing: "bg-red-500/10 text-red-500 border-red-500/30",
      Scheduled: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
      ScalingReplicaSet: "bg-orange-500/10 text-orange-500 border-orange-500/30",
      SuccessfulCreate: "bg-green-500/10 text-green-500 border-green-500/30",
      BackOff: "bg-red-500/10 text-red-500 border-red-500/30",
      FailedMount: "bg-red-500/10 text-red-500 border-red-500/30",
    };
    return variants[reason] || "bg-muted text-muted-foreground";
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: ptBR });
    } catch {
      return timestamp;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCommit className="h-5 w-5 text-muted-foreground" />
          Mudanças Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {changes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <GitCommit className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma mudança recente</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {changes.map((change, index) => (
                <div
                  key={change.id || index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-1">
                    {getReasonIcon(change.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={getReasonBadge(change.reason)}
                      >
                        {change.reason}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {change.namespace}
                      </span>
                    </div>
                    <p className="text-sm truncate" title={change.message}>
                      {change.message}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{change.involvedObject}</span>
                      <span>•</span>
                      <span>{formatTime(change.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
