import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Server, Box, CheckCircle, Clock, XCircle } from "lucide-react";
import { AvailabilityData } from "@/hooks/useRiskAnalysis";
import { cn } from "@/lib/utils";

interface AvailabilityWidgetProps {
  availability: AvailabilityData;
}

export const AvailabilityWidget = ({ availability }: AvailabilityWidgetProps) => {
  const getHealthColor = (health: number) => {
    if (health >= 90) return "text-green-500";
    if (health >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (health: number) => {
    if (health >= 90) return "bg-green-500";
    if (health >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="h-5 w-5 text-muted-foreground" />
          Disponibilidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Nodes Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Nodes</span>
            </div>
            <span className={cn("text-lg font-bold", getHealthColor(availability.nodeHealth))}>
              {availability.nodeHealth}%
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", getProgressColor(availability.nodeHealth))}
              style={{ width: `${availability.nodeHealth}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{availability.readyNodes} Ready</span>
            <span>{availability.totalNodes - availability.readyNodes} NotReady</span>
            <span>{availability.totalNodes} Total</span>
          </div>
        </div>

        {/* Pods Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pods</span>
            </div>
            <span className={cn("text-lg font-bold", getHealthColor(availability.podHealth))}>
              {availability.podHealth}%
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", getProgressColor(availability.podHealth))}
              style={{ width: `${availability.podHealth}%` }}
            />
          </div>
        </div>

        {/* Pod Status Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle className="h-4 w-4 text-green-500 mb-1" />
            <span className="text-lg font-bold text-green-500">{availability.runningPods}</span>
            <span className="text-xs text-muted-foreground">Running</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Clock className="h-4 w-4 text-yellow-500 mb-1" />
            <span className="text-lg font-bold text-yellow-500">{availability.pendingPods}</span>
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <XCircle className="h-4 w-4 text-red-500 mb-1" />
            <span className="text-lg font-bold text-red-500">{availability.failedPods}</span>
            <span className="text-xs text-muted-foreground">Failed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
