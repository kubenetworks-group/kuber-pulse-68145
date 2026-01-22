import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { HardDrive, CheckCircle, AlertTriangle } from "lucide-react";
import { VolumeProblem } from "@/hooks/useRiskAnalysis";
import { cn } from "@/lib/utils";

interface ProblematicVolumesWidgetProps {
  problems: VolumeProblem[];
}

export const ProblematicVolumesWidget = ({ problems }: ProblematicVolumesWidgetProps) => {
  const getIssueLabel = (issue: string) => {
    switch (issue) {
      case "near_full":
        return "Quase Cheio";
      case "pending":
        return "Pendente";
      case "released":
        return "Released";
      case "failed":
        return "Falhou";
      case "orphan":
        return "Órfão";
      default:
        return issue;
    }
  };

  const getIssueColor = (issue: string) => {
    switch (issue) {
      case "near_full":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      case "released":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      case "orphan":
        return "bg-purple-500/10 text-purple-500 border-purple-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 95) return "bg-red-500";
    if (percent >= 85) return "bg-orange-500";
    return "bg-yellow-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
          Volumes Problemáticos
          {problems.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {problems.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {problems.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-70" />
            <p className="text-sm font-medium text-green-500">Volumes saudáveis</p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos os volumes estão funcionando corretamente
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-3">
              {problems.map((problem, index) => (
                <div
                  key={`${problem.name}-${index}`}
                  className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {problem.type.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium truncate max-w-[150px]" title={problem.name}>
                        {problem.name}
                      </span>
                    </div>
                    <Badge variant="outline" className={getIssueColor(problem.issue)}>
                      {getIssueLabel(problem.issue)}
                    </Badge>
                  </div>
                  
                  {problem.namespace && (
                    <span className="text-xs text-muted-foreground">{problem.namespace}</span>
                  )}

                  {problem.issue === "near_full" && problem.usagePercent !== undefined && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Uso</span>
                        <span className={cn(
                          "font-medium",
                          problem.usagePercent >= 95 ? "text-red-500" :
                          problem.usagePercent >= 85 ? "text-orange-500" : "text-yellow-500"
                        )}>
                          {problem.usagePercent}%
                        </span>
                      </div>
                      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", getProgressColor(problem.usagePercent))}
                          style={{ width: `${problem.usagePercent}%` }}
                        />
                      </div>
                    </div>
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
