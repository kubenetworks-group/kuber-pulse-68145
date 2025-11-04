import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Activity, HardDrive, Cpu } from "lucide-react";

interface ClusterCardProps {
  name: string;
  status: "healthy" | "warning" | "critical";
  nodes: number;
  pods: number;
  cpuUsage: number;
  memoryUsage: number;
  environment: string;
}

export const ClusterCard = ({
  name,
  status,
  nodes,
  pods,
  cpuUsage,
  memoryUsage,
  environment,
}: ClusterCardProps) => {
  const statusColors = {
    healthy: "bg-success",
    warning: "bg-warning",
    critical: "bg-destructive",
  };

  return (
    <Card className="p-6 hover:shadow-glow transition-all duration-300 border-border bg-gradient-card shadow-card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Server className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-card-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground">{environment}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <Badge variant="secondary" className="text-xs">
            {status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Nodes</p>
            <p className="text-sm font-semibold text-card-foreground">{nodes}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Pods</p>
            <p className="text-sm font-semibold text-card-foreground">{pods}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">CPU</p>
            <p className="text-sm font-semibold text-card-foreground">{cpuUsage}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Memory</p>
            <p className="text-sm font-semibold text-card-foreground">{memoryUsage}%</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
