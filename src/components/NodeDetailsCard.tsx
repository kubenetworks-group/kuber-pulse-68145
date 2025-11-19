import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Server, Cpu, HardDrive, Activity, Layers, Shield, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
      <Card className="overflow-hidden bg-gradient-to-br from-card via-card/50 to-card/30">
        <div className="flex items-center justify-center h-60">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-primary/20"></div>
          </div>
        </div>
      </Card>
    );
  }

  const controlPlaneNodes = nodes.filter(n => n.pool === 'control-plane');
  const workerNodes = nodes.filter(n => n.pool !== 'control-plane');

  const getStatusColor = (status: string) => {
    return status === 'Ready' ? 'text-success' : 'text-destructive';
  };

  const renderNodeCard = (node: NodeInfo) => (
    <div
      key={node.name}
      className="group relative p-5 rounded-xl border border-border/50 bg-gradient-to-br from-card to-card/30 hover:from-card hover:to-card/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 animate-scale-in"
    >
      {/* Status indicator line */}
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${node.status === 'Ready' ? 'bg-gradient-to-r from-success/50 via-success to-success/50' : 'bg-destructive'}`}></div>
      
      {/* Node Header */}
      <div className="flex items-start justify-between mb-4 mt-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${node.status === 'Ready' ? 'bg-success' : 'bg-destructive'} animate-pulse`}></div>
            <span className="font-mono text-sm font-semibold truncate text-foreground/90">
              {node.name}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={node.status === 'Ready' ? 'default' : 'destructive'}
              className="text-xs px-2 py-0.5 font-medium"
            >
              {node.status}
            </Badge>
            <Badge variant="outline" className="text-xs px-2 py-0.5 gap-1">
              <Layers className="w-3 h-3" />
              {node.pool}
            </Badge>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Activity className={`w-5 h-5 ${getStatusColor(node.status)} transition-colors`} />
        </div>
      </div>

      {/* Resources Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-blue-500/5 to-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-500/20">
              <Cpu className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">CPU</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-blue-500">{node.cpu}</span>
            <span className="text-xs text-muted-foreground font-medium">cores</span>
          </div>
        </div>

        <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-purple-500/5 to-purple-500/10 border border-purple-500/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-purple-500/20">
              <HardDrive className="w-4 h-4 text-purple-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">RAM</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-purple-500">{node.memoryGB.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground font-medium">GB</span>
          </div>
        </div>
      </div>

      {/* System Info */}
      {(node.osImage || node.kernelVersion) && (
        <div className="pt-3 border-t border-border/30 space-y-2">
          {node.osImage && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-semibold min-w-[65px]">OS:</span>
              <span className="text-foreground/80 truncate font-mono bg-muted/30 px-2 py-0.5 rounded">{node.osImage}</span>
            </div>
          )}
          {node.kernelVersion && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-semibold min-w-[65px]">Kernel:</span>
              <span className="text-foreground/80 truncate font-mono bg-muted/30 px-2 py-0.5 rounded">{node.kernelVersion}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card via-card to-card/50 border-border/50 shadow-lg">
      {/* Header with animated gradient */}
      <div className="relative p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="relative flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm shadow-lg">
            <Server className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
              Node Infrastructure
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Zap className="w-4 h-4 text-primary" />
                <span className="font-medium">{nodes.length} nodes ativos</span>
              </div>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-xs text-muted-foreground">Real-time metrics</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-muted/50">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg gap-2 transition-all"
            >
              <Layers className="w-4 h-4" />
              <span className="font-semibold">Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="control-plane"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg gap-2 transition-all"
            >
              <Shield className="w-4 h-4" />
              <span className="font-semibold hidden sm:inline">Control Plane</span>
              <span className="font-semibold sm:hidden">Control</span>
            </TabsTrigger>
            <TabsTrigger 
              value="workers"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg gap-2 transition-all"
            >
              <Server className="w-4 h-4" />
              <span className="font-semibold">Workers</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-0 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CPU Card */}
              <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-blue-500/5 via-card to-card/50 p-6 hover:border-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
                <div className="relative space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 shadow-lg">
                        <Cpu className="w-7 h-7 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">CPU Total</p>
                        <div className="flex items-baseline gap-2 mt-1.5">
                          <span className="text-4xl font-bold tabular-nums text-blue-500">{totalCPU}</span>
                          <span className="text-sm text-muted-foreground font-medium">cores</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Utilização Atual</span>
                      <span className="font-bold text-blue-500 tabular-nums text-lg">{cpuUsage.toFixed(1)}%</span>
                    </div>
                    <div className="relative">
                      <Progress 
                        value={cpuUsage} 
                        className="h-3 bg-muted/50" 
                      />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 to-transparent pointer-events-none"></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Memory Card */}
              <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-purple-500/5 via-card to-card/50 p-6 hover:border-purple-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>
                <div className="relative space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 shadow-lg">
                        <HardDrive className="w-7 h-7 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Memória Total</p>
                        <div className="flex items-baseline gap-2 mt-1.5">
                          <span className="text-4xl font-bold tabular-nums text-purple-500">{totalMemory.toFixed(1)}</span>
                          <span className="text-sm text-muted-foreground font-medium">GB</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Utilização Atual</span>
                      <span className="font-bold text-purple-500 tabular-nums text-lg">{memoryUsage.toFixed(1)}%</span>
                    </div>
                    <div className="relative">
                      <Progress 
                        value={memoryUsage} 
                        className="h-3 bg-muted/50" 
                      />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/20 to-transparent pointer-events-none"></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/10">
                <div className="text-3xl font-bold text-primary tabular-nums">{nodes.length}</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Total Nodes</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20 hover:border-success/40 transition-all hover:shadow-lg hover:shadow-success/10">
                <div className="text-3xl font-bold text-success tabular-nums">{nodes.filter(n => n.status === 'Ready').length}</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Ready</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-all hover:shadow-lg hover:shadow-blue-500/10">
                <div className="text-3xl font-bold text-blue-500 tabular-nums">{controlPlaneNodes.length}</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Control Plane</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 hover:border-purple-500/40 transition-all hover:shadow-lg hover:shadow-purple-500/10">
                <div className="text-3xl font-bold text-purple-500 tabular-nums">{workerNodes.length}</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Workers</div>
              </div>
            </div>
          </TabsContent>

          {/* Control Plane Tab */}
          <TabsContent value="control-plane" className="space-y-4 mt-0 animate-fade-in">
            {controlPlaneNodes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="p-6 rounded-2xl bg-muted/30 inline-block mb-4">
                  <Shield className="w-16 h-16 mx-auto opacity-50" />
                </div>
                <p className="text-lg font-medium">Nenhum node control plane encontrado</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <Badge variant="outline" className="gap-2 px-3 py-1.5 text-sm font-semibold">
                    <Shield className="w-4 h-4" />
                    Control Plane
                  </Badge>
                  <span className="text-sm text-muted-foreground font-medium">
                    {controlPlaneNodes.length} node{controlPlaneNodes.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {controlPlaneNodes.map(renderNodeCard)}
                </div>
              </>
            )}
          </TabsContent>

          {/* Workers Tab */}
          <TabsContent value="workers" className="space-y-4 mt-0 animate-fade-in">
            {workerNodes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="p-6 rounded-2xl bg-muted/30 inline-block mb-4">
                  <Server className="w-16 h-16 mx-auto opacity-50" />
                </div>
                <p className="text-lg font-medium">Nenhum worker node encontrado</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <Badge variant="outline" className="gap-2 px-3 py-1.5 text-sm font-semibold">
                    <Server className="w-4 h-4" />
                    Worker Pools
                  </Badge>
                  <span className="text-sm text-muted-foreground font-medium">
                    {workerNodes.length} node{workerNodes.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {workerNodes.map(renderNodeCard)}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};
