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
    <Card className="hover:shadow-lg transition-all duration-300 border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-primary" />
          {t('dashboard.storageDistribution')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">
              {total.toFixed(0)} GB
            </p>
            <p className="text-sm text-muted-foreground">{t('dashboard.totalStorage')}</p>
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
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.physicalCapacity')}</p>
                <p className="text-lg font-bold text-foreground">
                  {total.toFixed(1)} GB
                </p>
                <p className="text-xs text-muted-foreground">{t('dashboard.physicalDisk')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.allocatedPVCs')}</p>
                <p className={`text-lg font-bold ${hasOverprovisioning ? 'text-warning' : 'text-foreground'}`}>
                  {allocated.toFixed(1)} GB
                </p>
                {hasOverprovisioning && (
                  <p className="text-xs text-warning">⚠️ {t('dashboard.overprovisioning')}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.actuallyUsed')}</p>
                <p className="text-lg font-bold text-foreground">
                  {used.toFixed(1)} GB
                </p>
                <p className="text-xs text-muted-foreground">
                  {total > 0 ? ((used / total) * 100).toFixed(1) : 0}% {t('dashboard.ofPhysical')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total PVCs</p>
                <p className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {totalPVCs}
                </p>
                <p className="text-xs text-muted-foreground">
                  {boundPVCs.length} bound
                </p>
              </div>
            </div>
          </div>

          {/* PVCs Tabs */}
          <div className="pt-4 border-t border-border/50">
            <Tabs defaultValue="bound" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="bound">
                  Bound ({boundPVCs.length})
                </TabsTrigger>
                <TabsTrigger value="available">
                  Available ({availablePVCs.length})
                </TabsTrigger>
                <TabsTrigger value="released">
                  Released ({releasedPVCs.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="bound" className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {boundPVCs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No bound PVCs</p>
                ) : (
                  boundPVCs.map(pvc => (
                    <div key={pvc.id} className="p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">{pvc.name}</p>
                          <p className="text-xs text-muted-foreground">Namespace: {pvc.namespace}</p>
                          {pvc.storage_class && (
                            <p className="text-xs text-muted-foreground">Class: {pvc.storage_class}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">
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
              
              <TabsContent value="available" className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {availablePVCs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No available PVCs</p>
                ) : (
                  availablePVCs.map(pvc => (
                    <div key={pvc.id} className="p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">{pvc.name}</p>
                          <p className="text-xs text-muted-foreground">Namespace: {pvc.namespace}</p>
                          {pvc.storage_class && (
                            <p className="text-xs text-muted-foreground">Class: {pvc.storage_class}</p>
                          )}
                        </div>
                        <Badge variant="outline">
                          {(pvc.requested_bytes / (1024**3)).toFixed(2)} GB
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="released" className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {releasedPVCs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No released PVCs</p>
                ) : (
                  releasedPVCs.map(pvc => (
                    <div key={pvc.id} className="p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">{pvc.name}</p>
                          <p className="text-xs text-muted-foreground">Namespace: {pvc.namespace}</p>
                          {pvc.storage_class && (
                            <p className="text-xs text-muted-foreground">Class: {pvc.storage_class}</p>
                          )}
                        </div>
                        <Badge variant="outline">
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
