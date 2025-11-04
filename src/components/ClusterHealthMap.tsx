import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, Server, Cpu, Database } from "lucide-react";
import { Link } from "react-router-dom";

type Cluster = {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'connecting';
  environment: string;
  provider: string;
  nodes: number;
  pods: number;
  cpu_usage: number;
  memory_usage: number;
};

interface ClusterHealthMapProps {
  clusters: Cluster[];
  loading?: boolean;
}

const statusConfig = {
  healthy: {
    gradient: "from-green-500/20 to-green-600/20",
    border: "border-green-500/50",
    pulse: false,
    icon: "text-green-400"
  },
  warning: {
    gradient: "from-yellow-500/20 to-yellow-600/20",
    border: "border-yellow-500/50",
    pulse: true,
    icon: "text-yellow-400"
  },
  critical: {
    gradient: "from-red-500/20 to-red-600/20",
    border: "border-red-500/50",
    pulse: true,
    icon: "text-red-400"
  },
  connecting: {
    gradient: "from-blue-500/20 to-blue-600/20",
    border: "border-blue-500/50",
    pulse: false,
    icon: "text-blue-400"
  }
};

export const ClusterHealthMap = ({ clusters, loading }: ClusterHealthMapProps) => {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-20 bg-muted rounded" />
          </Card>
        ))}
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No clusters connected</h3>
        <p className="text-muted-foreground">
          Connect your first cluster to start monitoring
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {clusters.map((cluster) => {
        const config = statusConfig[cluster.status];
        return (
          <Link key={cluster.id} to="/clusters">
            <Card
              className={cn(
                "p-4 overflow-hidden border transition-all hover:shadow-lg cursor-pointer",
                "bg-gradient-to-br",
                config.gradient,
                config.border,
                config.pulse && "animate-pulse"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{cluster.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {cluster.provider}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {cluster.environment}
                    </Badge>
                  </div>
                </div>
                <Activity className={cn("h-5 w-5", config.icon)} />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Server className="h-3 w-3" />
                    Nodes
                  </span>
                  <span className="font-medium">{cluster.nodes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    Pods
                  </span>
                  <span className="font-medium">{cluster.pods}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Cpu className="h-3 w-3" />
                    CPU
                  </span>
                  <span className="font-medium">{cluster.cpu_usage.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    Memory
                  </span>
                  <span className="font-medium">{cluster.memory_usage.toFixed(1)}%</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border/50">
                <Badge
                  variant="outline"
                  className={cn("text-xs", config.icon)}
                >
                  {cluster.status.toUpperCase()}
                </Badge>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
};
