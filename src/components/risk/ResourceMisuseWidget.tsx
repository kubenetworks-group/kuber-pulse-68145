import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cpu, CheckCircle } from "lucide-react";
import { ResourceIssue } from "@/hooks/useRiskAnalysis";

interface ResourceMisuseWidgetProps {
  issues: ResourceIssue[];
}

export const ResourceMisuseWidget = ({ issues }: ResourceMisuseWidgetProps) => {
  const getIssueLabel = (issue: string) => {
    switch (issue) {
      case "no_limits":
        return "Sem Limits";
      case "no_requests":
        return "Sem Requests";
      case "high_memory":
        return "Memória Alta";
      case "high_cpu":
        return "CPU Alta";
      default:
        return issue;
    }
  };

  const getIssueColor = (issue: string) => {
    switch (issue) {
      case "no_limits":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      case "no_requests":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "high_memory":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      case "high_cpu":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Group issues by pod
  const groupedIssues = issues.reduce((acc, issue) => {
    const key = `${issue.namespace}/${issue.podName}`;
    if (!acc[key]) {
      acc[key] = {
        podName: issue.podName,
        namespace: issue.namespace,
        issues: [],
      };
    }
    acc[key].issues.push(issue);
    return acc;
  }, {} as Record<string, { podName: string; namespace: string; issues: ResourceIssue[] }>);

  const groupedList = Object.values(groupedIssues);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="h-5 w-5 text-muted-foreground" />
          Uso Incorreto de Recursos
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
            <p className="text-sm font-medium text-green-500">Recursos bem configurados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos os pods possuem requests e limits definidos
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-3">
              {groupedList.slice(0, 20).map((group, index) => (
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
                  <div className="flex flex-wrap gap-1">
                    {group.issues.map((issue, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className={`text-xs ${getIssueColor(issue.issue)}`}
                      >
                        {issue.containerName}: {getIssueLabel(issue.issue)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {groupedList.length > 20 && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  e mais {groupedList.length - 20} pods...
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
