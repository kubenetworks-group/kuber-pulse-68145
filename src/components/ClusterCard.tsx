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
  const statusConfig = {
    healthy: { 
      color: "bg-success", 
      text: "text-success",
      gradient: "from-success/10 to-success/5",
      border: "border-success/30"
    },
    warning: { 
      color: "bg-warning", 
      text: "text-warning",
      gradient: "from-warning/10 to-warning/5",
      border: "border-warning/30"
    },
    critical: { 
      color: "bg-destructive", 
      text: "text-destructive",
      gradient: "from-destructive/10 to-destructive/5",
      border: "border-destructive/30"
    },
  };

  const config = statusConfig[status];

  return (
    <Card className={`group relative overflow-hidden p-6 bg-gradient-to-br from-card to-card/50 ${config.border} hover:border-opacity-60 transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}>
      {/* Animated background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 group-hover:scale-110 transition-transform duration-300">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">{name}</h3>
              <p className="text-sm text-muted-foreground">{environment}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-card/80 border border-border/50">
            <div className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} />
            <Badge variant="secondary" className="text-xs font-semibold">
              {status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-card to-card/50 border border-border/50 hover:border-primary/30 transition-all group/item">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Nodes</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{nodes}</p>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-br from-card to-card/50 border border-border/50 hover:border-primary/30 transition-all group/item">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Pods</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{pods}</p>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-br from-card to-card/50 border border-border/50 hover:border-primary/30 transition-all group/item">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">CPU</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-foreground">{cpuUsage}%</p>
              <div className="flex-1 h-2 bg-border/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${cpuUsage > 80 ? 'bg-destructive' : cpuUsage > 60 ? 'bg-warning' : 'bg-success'} transition-all duration-300`}
                  style={{ width: `${cpuUsage}%` }}
                />
              </div>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-br from-card to-card/50 border border-border/50 hover:border-primary/30 transition-all group/item">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Memory</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-foreground">{memoryUsage}%</p>
              <div className="flex-1 h-2 bg-border/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${memoryUsage > 80 ? 'bg-destructive' : memoryUsage > 60 ? 'bg-warning' : 'bg-success'} transition-all duration-300`}
                  style={{ width: `${memoryUsage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
