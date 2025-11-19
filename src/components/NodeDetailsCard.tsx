import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Cpu, HardDrive, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface NodeInfo {
  name: string;
  cpu: number;
  memory: string | number;
  memoryGB: number;
  status: string;
  pool: string;
  osImage?: string;
  kernelVersion?: string;
  containerRuntime?: string;
  labels?: Record<string, string>;
}

interface NodeDetailsCardProps {
  nodes: NodeInfo[];
  totalCPU: number;
  totalMemory: number;
  cpuUsage: number;
  memoryUsage: number;
  loading: boolean;
}

export const NodeDetailsCard = ({
  nodes,
  totalCPU,
  totalMemory,
  cpuUsage,
  memoryUsage,
  loading,
}: NodeDetailsCardProps) => {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  // Group nodes by pool
  const nodesByPool = nodes.reduce((acc, node) => {
    if (!acc[node.pool]) {
      acc[node.pool] = [];
    }
    acc[node.pool].push(node);
    return acc;
  }, {} as Record<string, NodeInfo[]>);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
          <Server className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Detalhes dos Nodes</h3>
          <p className="text-sm text-muted-foreground">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''} ativos
          </p>
        </div>
      </div>

      {/* Cluster Totals */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cpu className="w-4 h-4" />
            <span>CPU Total</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{totalCPU}</span>
              <span className="text-sm text-muted-foreground">cores</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={cpuUsage} className="flex-1 h-2" />
              <span className="text-xs font-medium">{cpuUsage.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HardDrive className="w-4 h-4" />
            <span>Memória Total</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{totalMemory.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">GB</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={memoryUsage} className="flex-1 h-2" />
              <span className="text-xs font-medium">{memoryUsage.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Nodes by Pool */}
      <div className="space-y-6">
        {Object.entries(nodesByPool).map(([pool, poolNodes]) => (
          <div key={pool}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">
                {pool}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {poolNodes.length} node{poolNodes.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {poolNodes.map((node) => (
                <div
                  key={node.name}
                  className="p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {node.name}
                        </span>
                      </div>
                      <Badge
                        variant={node.status === 'Ready' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {node.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Cpu className="w-3 h-3" />
                        <span className="text-xs">CPU</span>
                      </div>
                      <span className="font-semibold">{node.cpu} cores</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <HardDrive className="w-3 h-3" />
                        <span className="text-xs">Memória</span>
                      </div>
                      <span className="font-semibold">{node.memoryGB.toFixed(1)} GB</span>
                    </div>
                  </div>

                  {(node.osImage || node.kernelVersion || node.containerRuntime) && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
                      {node.osImage && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">OS:</span>
                          <span>{node.osImage}</span>
                        </div>
                      )}
                      {node.kernelVersion && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Kernel:</span>
                          <span>{node.kernelVersion}</span>
                        </div>
                      )}
                      {node.containerRuntime && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Runtime:</span>
                          <span>{node.containerRuntime}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
