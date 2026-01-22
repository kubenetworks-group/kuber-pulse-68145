import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";
import { UnstablePod } from "@/hooks/useRiskAnalysis";

interface UnstablePodsWidgetProps {
  pods: UnstablePod[];
}

export const UnstablePodsWidget = ({ pods }: UnstablePodsWidgetProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "CrashLoopBackOff":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      case "Failed":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      case "Pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      case "Error":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      default:
        return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    }
  };

  const getRestartColor = (count: number) => {
    if (count >= 10) return "text-red-500";
    if (count >= 5) return "text-orange-500";
    return "text-yellow-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          Pods Instáveis
          {pods.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {pods.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pods.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-70" />
            <p className="text-sm font-medium text-green-500">Todos os pods estão estáveis</p>
            <p className="text-xs text-muted-foreground mt-1">
              Nenhum pod com problemas de estabilidade
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-3">
              {pods.map((pod, index) => (
                <div
                  key={`${pod.namespace}-${pod.name}-${index}`}
                  className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate max-w-[200px]" title={pod.name}>
                      {pod.name}
                    </span>
                    <Badge variant="outline" className={getStatusColor(pod.status)}>
                      {pod.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{pod.namespace}</span>
                    <div className="flex items-center gap-1">
                      <RefreshCw className={`h-3 w-3 ${getRestartColor(pod.restartCount)}`} />
                      <span className={getRestartColor(pod.restartCount)}>
                        {pod.restartCount} restarts
                      </span>
                    </div>
                  </div>
                  {pod.reason && (
                    <p className="text-xs text-muted-foreground truncate" title={pod.reason}>
                      {pod.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
