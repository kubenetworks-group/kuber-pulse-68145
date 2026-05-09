import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cpu, CheckCircle, MemoryStick } from "lucide-react";
import { ResourceIssue } from "@/hooks/useRiskAnalysis";

interface ResourceMisuseWidgetProps {
  issues: ResourceIssue[];
}

const formatCPU = (milli?: number) => {
  if (milli == null) return null;
  return milli >= 1000 ? `${(milli / 1000).toFixed(1)}` : `${milli}m`;
};

const formatMemory = (bytes?: number) => {
  if (bytes == null) return null;
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)}Gi`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)}Mi`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}Ki`;
  return `${bytes}B`;
};

const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

export const ResourceMisuseWidget = ({ issues }: ResourceMisuseWidgetProps) => {
  const getIssueLabel = (issue: string) => {
    switch (issue) {
      case "no_limits":   return "Sem Limits";
      case "no_requests": return "Sem Requests";
      case "high_memory": return "Memória Alta";
      case "high_cpu":    return "CPU Alta";
      default:            return issue;
    }
  };

  const getIssueColor = (issue: string) => {
    switch (issue) {
      case "no_limits":   return "bg-red-500/10 text-red-500 border-red-500/30";
      case "no_requests": return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "high_memory": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      case "high_cpu":    return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      default:            return "bg-muted text-muted-foreground";
    }
  };

  // Group issues by pod — collect per-pod resource info from any issue entry
  const groupedIssues = issues.reduce((acc, issue) => {
    const key = `${issue.namespace}/${issue.podName}`;
    if (!acc[key]) {
      acc[key] = {
        podName: issue.podName,
        namespace: issue.namespace,
        issues: [] as ResourceIssue[],
        cpuLimitMilli: issue.cpuLimitMilli,
        cpuRequestMilli: issue.cpuRequestMilli,
        memoryLimitBytes: issue.memoryLimitBytes,
        memoryRequestBytes: issue.memoryRequestBytes,
      };
    }
    acc[key].issues.push(issue);
    // Keep the first non-undefined values
    if (acc[key].cpuLimitMilli == null) acc[key].cpuLimitMilli = issue.cpuLimitMilli;
    if (acc[key].cpuRequestMilli == null) acc[key].cpuRequestMilli = issue.cpuRequestMilli;
    if (acc[key].memoryLimitBytes == null) acc[key].memoryLimitBytes = issue.memoryLimitBytes;
    if (acc[key].memoryRequestBytes == null) acc[key].memoryRequestBytes = issue.memoryRequestBytes;
    return acc;
  }, {} as Record<string, {
    podName: string;
    namespace: string;
    issues: ResourceIssue[];
    cpuLimitMilli?: number;
    cpuRequestMilli?: number;
    memoryLimitBytes?: number;
    memoryRequestBytes?: number;
  }>);

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
              {groupedList.slice(0, 20).map((group, index) => {
                const cpuLimit = formatCPU(group.cpuLimitMilli);
                const cpuReq = formatCPU(group.cpuRequestMilli);
                const memLimit = formatMemory(group.memoryLimitBytes);
                const memReq = formatMemory(group.memoryRequestBytes);
                const showCPUBar = group.cpuRequestMilli != null && group.cpuLimitMilli != null && group.cpuLimitMilli > 0;
                const showMemBar = group.memoryRequestBytes != null && group.memoryLimitBytes != null && group.memoryLimitBytes > 0;

                return (
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

                    {/* Resource meters */}
                    {(cpuLimit || cpuReq || memLimit || memReq) && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {(cpuLimit || cpuReq) && (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Cpu className="h-3 w-3" />
                              <span>CPU</span>
                              <span className="ml-auto font-mono text-foreground">
                                {cpuReq ?? "—"} / {cpuLimit ?? "—"}
                              </span>
                            </div>
                            {showCPUBar && (
                              <MiniBar
                                value={group.cpuRequestMilli!}
                                max={group.cpuLimitMilli!}
                                color="bg-blue-500"
                              />
                            )}
                          </div>
                        )}
                        {(memLimit || memReq) && (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MemoryStick className="h-3 w-3" />
                              <span>Mem</span>
                              <span className="ml-auto font-mono text-foreground">
                                {memReq ?? "—"} / {memLimit ?? "—"}
                              </span>
                            </div>
                            {showMemBar && (
                              <MiniBar
                                value={group.memoryRequestBytes!}
                                max={group.memoryLimitBytes!}
                                color="bg-purple-500"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}

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
                );
              })}
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
