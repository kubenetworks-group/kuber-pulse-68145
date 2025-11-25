import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { HardDrive, AlertTriangle, Package } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PVC {
  id: string;
  name: string;
  namespace: string;
  status: string;
  requested_bytes: number;
  used_bytes: number;
  storage_class: string | null;
}

interface StorageChartProps {
  total: number;
  allocated: number;
  used: number;
  available: number;
  pvcs: PVC[];
}

export const StorageChart = ({ total, allocated, used, available, pvcs }: StorageChartProps) => {
  const { t } = useTranslation();

  // Count PVCs by status
  const totalPVCs = pvcs.length;
  const boundPVCs = pvcs.filter(p => p.status?.toLowerCase() === 'bound');
  const pendingPVCs = pvcs.filter(p => p.status?.toLowerCase() === 'pending');
  const availablePVCs = pvcs.filter(p => p.status?.toLowerCase() === 'available');
  const releasedPVCs = pvcs.filter(p => p.status?.toLowerCase() === 'released');

  // Check for overprovisioning
  const hasOverprovisioning = allocated > total;

  // Data for the pie chart showing actual usage vs available
  const data = [
    { 
      name: t('dashboard.storageUsed'), 
      value: parseFloat(used.toFixed(2)),
      color: 'hsl(var(--destructive))'
    },
    { 
      name: t('dashboard.available'), 
      value: parseFloat(available.toFixed(2)),
      color: 'hsl(var(--success))'
    }
  ].filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{payload[0].name}</p>
          <p className="text-lg font-bold text-primary">{payload[0].value.toFixed(2)} GB</p>
          <p className="text-xs text-muted-foreground">
            {((payload[0].value / total) * 100).toFixed(1)}% {t('dashboard.ofTotal')}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-col gap-2 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.value}</span>
            </div>
            <span className="font-medium text-foreground">
              {data[index].value.toFixed(2)} GB
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-accent/5 hover:shadow-[var(--shadow-glow)] transition-all duration-500 group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 bg-gradient-primary bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-2 duration-500">
          <HardDrive className="w-5 h-5 text-primary animate-pulse" />
          {t('dashboard.storageDistribution')}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="space-y-4">
          <div className="text-center animate-in fade-in slide-in-from-top-3 duration-700">
            <p className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent drop-shadow-sm">
              {total.toFixed(0)} GB
            </p>
            <p className="text-sm text-muted-foreground mt-1">{t('dashboard.totalStorage')}</p>
          </div>
          
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} />
            </PieChart>
          </ResponsiveContainer>

          <div className="pt-4 border-t border-border/50">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105">
                <p className="text-xs text-muted-foreground mb-1">{t('dashboard.physicalCapacity')}</p>
                <p className="text-2xl font-bold text-primary">
                  {total.toFixed(1)} <span className="text-sm">GB</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{t('dashboard.physicalDisk')}</p>
              </div>
              <div className={`p-3 rounded-lg border transition-all duration-300 hover:scale-105 ${
                hasOverprovisioning 
                  ? 'bg-gradient-to-br from-warning/10 to-warning/5 border-warning/30 hover:border-warning/50' 
                  : 'bg-gradient-to-br from-accent/10 to-accent/5 border-border/30 hover:border-border/50'
              }`}>
                <p className="text-xs text-muted-foreground mb-1">{t('dashboard.allocatedPVCs')}</p>
                <p className={`text-2xl font-bold ${hasOverprovisioning ? 'text-warning' : 'text-foreground'}`}>
                  {allocated.toFixed(1)} <span className="text-sm">GB</span>
                </p>
                {hasOverprovisioning && (
                  <p className="text-xs text-warning mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t('dashboard.overprovisioning')}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20 hover:border-success/40 transition-all duration-300 hover:scale-105">
                <p className="text-xs text-muted-foreground mb-1">{t('dashboard.actuallyUsed')}</p>
                <p className="text-2xl font-bold text-success">
                  {used.toFixed(1)} <span className="text-sm">GB</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {total > 0 ? ((used / total) * 100).toFixed(1) : 0}% {t('dashboard.ofPhysical')}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 border border-border/30 hover:border-border/50 transition-all duration-300 hover:scale-105">
                <p className="text-xs text-muted-foreground mb-1">Total PVCs</p>
                <p className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary animate-pulse" />
                  {totalPVCs}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {boundPVCs.length} bound · {pendingPVCs.length} pending
                </p>
              </div>
            </div>
          </div>

          {/* PVCs Tabs */}
          <div className="pt-4 border-t border-border/50">
            <Tabs defaultValue="bound" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-muted/50 backdrop-blur-sm">
                <TabsTrigger value="bound" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-success/20 data-[state=active]:to-success/10">
                  Bound ({boundPVCs.length})
                </TabsTrigger>
                <TabsTrigger value="pending" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-warning/20 data-[state=active]:to-warning/10">
                  Pending ({pendingPVCs.length})
                </TabsTrigger>
                <TabsTrigger value="available" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-primary/10">
                  Available ({availablePVCs.length})
                </TabsTrigger>
                <TabsTrigger value="released" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-destructive/20 data-[state=active]:to-destructive/10">
                  Released ({releasedPVCs.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="bound" className="mt-4 space-y-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-bottom-3 duration-500">
                {boundPVCs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No bound PVCs</p>
                ) : (
                  boundPVCs.map((pvc, index) => (
                    <div 
                      key={pvc.id} 
                      className="p-3 rounded-lg border border-success/20 bg-gradient-to-r from-success/5 to-transparent hover:from-success/10 hover:border-success/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">{pvc.name}</p>
                          <p className="text-xs text-muted-foreground">Namespace: {pvc.namespace}</p>
                          {pvc.storage_class && (
                            <p className="text-xs text-muted-foreground">Class: {pvc.storage_class}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1 border-success/30 text-success">
                            {(pvc.requested_bytes / (1024**3)).toFixed(2)} GB
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            Used: {(pvc.used_bytes / (1024**3)).toFixed(2)} GB
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="pending" className="mt-4 space-y-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-bottom-3 duration-500">
                {pendingPVCs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No pending PVCs</p>
                ) : (
                  pendingPVCs.map((pvc, index) => (
                    <div 
                      key={pvc.id} 
                      className="p-3 rounded-lg border border-warning/20 bg-gradient-to-r from-warning/5 to-transparent hover:from-warning/10 hover:border-warning/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-md animate-pulse"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground flex items-center gap-2">
                            {pvc.name}
                            <AlertTriangle className="w-3 h-3 text-warning" />
                          </p>
                          <p className="text-xs text-muted-foreground">Namespace: {pvc.namespace}</p>
                          {pvc.storage_class && (
                            <p className="text-xs text-muted-foreground">Class: {pvc.storage_class}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="border-warning/30 text-warning">
                          {(pvc.requested_bytes / (1024**3)).toFixed(2)} GB
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="available" className="mt-4 space-y-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-bottom-3 duration-500">
                {availablePVCs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No available PVCs</p>
                ) : (
                  availablePVCs.map((pvc, index) => (
                    <div 
                      key={pvc.id} 
                      className="p-3 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10 hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">{pvc.name}</p>
                          <p className="text-xs text-muted-foreground">Namespace: {pvc.namespace}</p>
                          {pvc.storage_class && (
                            <p className="text-xs text-muted-foreground">Class: {pvc.storage_class}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="border-primary/30 text-primary">
                          {(pvc.requested_bytes / (1024**3)).toFixed(2)} GB
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="released" className="mt-4 space-y-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-bottom-3 duration-500">
                {releasedPVCs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No released PVCs</p>
                ) : (
                  releasedPVCs.map((pvc, index) => (
                    <div 
                      key={pvc.id} 
                      className="p-3 rounded-lg border border-destructive/20 bg-gradient-to-r from-destructive/5 to-transparent hover:from-destructive/10 hover:border-destructive/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">{pvc.name}</p>
                          <p className="text-xs text-muted-foreground">Namespace: {pvc.namespace}</p>
                          {pvc.storage_class && (
                            <p className="text-xs text-muted-foreground">Class: {pvc.storage_class}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="border-destructive/30 text-destructive">
                          {(pvc.requested_bytes / (1024**3)).toFixed(2)} GB
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Overprovisioning Alert */}
          {hasOverprovisioning && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('dashboard.overprovisioningDetected')}</AlertTitle>
              <AlertDescription>
                {t('dashboard.overprovisioningWarning', { 
                  allocated: allocated.toFixed(1), 
                  total: total.toFixed(1) 
                })}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
