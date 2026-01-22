import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HeartPulse, CheckCircle, AlertTriangle } from "lucide-react";
import { ProbeIssue } from "@/hooks/useRiskAnalysis";

interface MissingProbesWidgetProps {
  issues: ProbeIssue[];
}

export const MissingProbesWidget = ({ issues }: MissingProbesWidgetProps) => {
  const getProbeLabel = (probe: string) => {
    switch (probe) {
      case "readiness":
        return "Readiness";
      case "liveness":
        return "Liveness";
      case "startup":
        return "Startup";
      default:
        return probe;
    }
  };

  // Group issues by pod
  const groupedIssues = issues.reduce((acc, issue) => {
    const key = `${issue.namespace}/${issue.podName}`;
    if (!acc[key]) {
      acc[key] = {
        podName: issue.podName,
        namespace: issue.namespace,
        containers: [],
      };
    }
    acc[key].containers.push({
      name: issue.containerName,
      missingProbes: issue.missingProbes,
    });
    return acc;
  }, {} as Record<string, { podName: string; namespace: string; containers: { name: string; missingProbes: string[] }[] }>);

  const groupedList = Object.values(groupedIssues);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="h-5 w-5 text-muted-foreground" />
          Probes Ausentes
          {groupedList.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {groupedList.length} pods
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {groupedList.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-70" />
            <p className="text-sm font-medium text-green-500">Probes configuradas</p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos os pods possuem probes de health check
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-3">
              {groupedList.slice(0, 15).map((group, index) => (
                <div
                  key={`${group.namespace}-${group.podName}-${index}`}
                  className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate max-w-[180px]" title={group.podName}>
                      {group.podName}
                    </span>
                    <span className="text-xs text-muted-foreground">{group.namespace}</span>
                  </div>
                  {group.containers.map((container, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">{container.name}:</span>
                      {container.missingProbes.map((probe, j) => (
                        <Badge
                          key={j}
                          variant="outline"
                          className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                        >
                          <AlertTriangle className="h-2 w-2 mr-1" />
                          {getProbeLabel(probe)}
                        </Badge>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              {groupedList.length > 15 && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  e mais {groupedList.length - 15} pods...
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
