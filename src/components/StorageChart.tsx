import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { HardDrive, AlertTriangle, Package, TrendingUp, Database, FileText, Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const [selectedNamespace, setSelectedNamespace] = useState<string>("all");

  // Get unique namespaces
  const namespaces = useMemo(() => {
    const uniqueNamespaces = [...new Set(pvcs.map(p => p.namespace))].sort();
    return ["all", ...uniqueNamespaces];
  }, [pvcs]);

  // Filter PVCs by namespace
  const filteredPVCs = useMemo(() => {
    if (selectedNamespace === "all") return pvcs;
    return pvcs.filter(p => p.namespace === selectedNamespace);
  }, [pvcs, selectedNamespace]);

  // Count PVCs by status (filtered)
  const totalPVCs = filteredPVCs.length;
  const boundPVCs = filteredPVCs.filter(p => p.status?.toLowerCase() === 'bound');
  const pendingPVCs = filteredPVCs.filter(p => p.status?.toLowerCase() === 'pending');
  const availablePVCs = filteredPVCs.filter(p => p.status?.toLowerCase() === 'available');

  // Check for overprovisioning
  const hasOverprovisioning = allocated > total;

  // Calculate total real usage from filtered PVCs
  const totalPVCUsed = filteredPVCs.reduce((sum, pvc) => sum + (pvc.used_bytes || 0), 0) / (1024 ** 3);
  const totalPVCAllocated = filteredPVCs.reduce((sum, pvc) => sum + (pvc.requested_bytes || 0), 0) / (1024 ** 3);

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

  // Prepare data for individual PVC usage bar chart (top 10 by allocation, filtered)
  const pvcBarData = boundPVCs
    .map(pvc => ({
      name: pvc.name.length > 15 ? pvc.name.substring(0, 15) + '...' : pvc.name,
      fullName: pvc.name,
      namespace: pvc.namespace,
      allocated: parseFloat((pvc.requested_bytes / (1024 ** 3)).toFixed(2)),
      used: parseFloat((pvc.used_bytes / (1024 ** 3)).toFixed(2)),
      usagePercent: pvc.requested_bytes > 0 
        ? Math.round((pvc.used_bytes / pvc.requested_bytes) * 100) 
        : 0
    }))
    .sort((a, b) => b.allocated - a.allocated)
    .slice(0, 10);

  // Generate PDF Report
  const generateReport = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR');
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text("Relatório de PVC Storage", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${date} às ${time}`, 14, 30);
    doc.text(`Namespace: ${selectedNamespace === 'all' ? 'Todos' : selectedNamespace}`, 14, 36);
    
    // Summary
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text("Resumo", 14, 48);
    
    doc.setFontSize(10);
    doc.text(`Total de PVCs: ${filteredPVCs.length}`, 14, 56);
    doc.text(`Alocado Total: ${totalPVCAllocated.toFixed(2)} GB`, 14, 62);
    doc.text(`Uso Real Total: ${totalPVCUsed.toFixed(2)} GB`, 14, 68);
    doc.text(`Desperdício: ${Math.max(0, totalPVCAllocated - totalPVCUsed).toFixed(2)} GB`, 14, 74);
    doc.text(`Eficiência: ${totalPVCAllocated > 0 ? ((totalPVCUsed / totalPVCAllocated) * 100).toFixed(1) : 0}%`, 14, 80);
    
    // Table
    const tableData = filteredPVCs
      .sort((a, b) => b.requested_bytes - a.requested_bytes)
      .map(pvc => {
        const allocatedGB = (pvc.requested_bytes / (1024 ** 3)).toFixed(2);
        const usedGB = (pvc.used_bytes / (1024 ** 3)).toFixed(2);
        const efficiency = pvc.requested_bytes > 0 
          ? ((pvc.used_bytes / pvc.requested_bytes) * 100).toFixed(1) 
          : "0";
        return [
          pvc.name,
          pvc.namespace,
          pvc.status,
          pvc.storage_class || '-',
          `${allocatedGB} GB`,
          `${usedGB} GB`,
          `${efficiency}%`
        ];
      });

    autoTable(doc, {
      startY: 90,
      head: [['Nome', 'Namespace', 'Status', 'Storage Class', 'Alocado', 'Uso Real', 'Eficiência']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 25 },
        2: { cellWidth: 18 },
        3: { cellWidth: 25 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 20 }
      }
    });

    doc.save(`pvc-report-${selectedNamespace === 'all' ? 'all' : selectedNamespace}-${date.replace(/\//g, '-')}.pdf`);
  };

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

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg min-w-[180px]">
          <p className="text-sm font-medium text-foreground truncate">{data.fullName}</p>
          <p className="text-xs text-muted-foreground mb-2">Namespace: {data.namespace}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Allocated:</span>
              <span className="font-medium text-primary">{data.allocated} GB</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Real Usage:</span>
              <span className="font-medium text-success">{data.used} GB</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Efficiency:</span>
              <span className={`font-medium ${data.usagePercent > 80 ? 'text-warning' : data.usagePercent < 20 ? 'text-destructive' : 'text-success'}`}>
                {data.usagePercent}%
              </span>
            </div>
          </div>
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
              {data[index]?.value.toFixed(2)} GB
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Helper to get usage color
  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-destructive';
    if (percent >= 70) return 'text-warning';
    if (percent < 20) return 'text-muted-foreground';
    return 'text-success';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-destructive';
    if (percent >= 70) return 'bg-warning';
    if (percent < 20) return 'bg-muted';
    return 'bg-success';
  };

  return (
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-accent/5 hover:shadow-[var(--shadow-glow)] transition-all duration-500 group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
        <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2 bg-gradient-primary bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-2 duration-500">
          <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-pulse" />
          <span className="hidden sm:inline">{t('dashboard.storageDistribution')}</span>
          <span className="sm:hidden">Storage</span>
        </CardTitle>
        
        {/* Namespace Filter & Report Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Namespace" />
              </SelectTrigger>
              <SelectContent>
                {namespaces.map(ns => (
                  <SelectItem key={ns} value={ns} className="text-xs">
                    {ns === "all" ? "Todos Namespaces" : ns}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateReport}
            className="h-8 text-xs gap-1"
          >
            <FileText className="w-3 h-3" />
            <span className="hidden sm:inline">Relatório PDF</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="space-y-4">
          <div className="text-center animate-in fade-in slide-in-from-top-3 duration-700">
            <p className="text-3xl sm:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent drop-shadow-sm">
              {total.toFixed(0)} GB
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('dashboard.totalStorage')}</p>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 truncate">{t('dashboard.physicalCapacity')}</p>
                <p className="text-xl sm:text-2xl font-bold text-primary">
                  {total.toFixed(1)} <span className="text-xs sm:text-sm">GB</span>
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{t('dashboard.physicalDisk')}</p>
              </div>
              <div className={`p-3 rounded-lg border transition-all duration-300 hover:scale-105 ${
                hasOverprovisioning 
                  ? 'bg-gradient-to-br from-warning/10 to-warning/5 border-warning/30 hover:border-warning/50' 
                  : 'bg-gradient-to-br from-accent/10 to-accent/5 border-border/30 hover:border-border/50'
              }`}>
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 truncate">{t('dashboard.allocatedPVCs')}</p>
                <p className={`text-xl sm:text-2xl font-bold ${hasOverprovisioning ? 'text-warning' : 'text-foreground'}`}>
                  {totalPVCAllocated.toFixed(1)} <span className="text-xs sm:text-sm">GB</span>
                </p>
                {hasOverprovisioning && (
                  <p className="text-[10px] sm:text-xs text-warning mt-1 flex items-center gap-1 truncate">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    <span className="hidden sm:inline">{t('dashboard.overprovisioning')}</span>
                    <span className="sm:hidden">Over</span>
                  </p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20 hover:border-success/40 transition-all duration-300 hover:scale-105">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 truncate">{t('dashboard.actuallyUsed')}</p>
                <p className="text-xl sm:text-2xl font-bold text-success">
                  {totalPVCUsed.toFixed(1)} <span className="text-xs sm:text-sm">GB</span>
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                  {totalPVCAllocated > 0 ? ((totalPVCUsed / totalPVCAllocated) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 border border-border/30 hover:border-border/50 transition-all duration-300 hover:scale-105">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 truncate">Total PVCs</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-pulse flex-shrink-0" />
                  {totalPVCs}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                  {boundPVCs.length} bound · {pendingPVCs.length} pending
                </p>
              </div>
            </div>
          </div>

          {/* PVC Usage Vertical Bar Chart */}
          {boundPVCs.length > 0 && pvcBarData.length > 0 && (
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    PVC Usage {selectedNamespace !== "all" && `(${selectedNamespace})`}
                  </h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-primary/60" />
                    <span className="text-xs text-muted-foreground">Allocated</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-success" />
                    <span className="text-xs text-muted-foreground">Real Usage</span>
                  </div>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pvcBarData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${value}GB`}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="allocated" name="Allocated" fill="hsl(var(--primary))" opacity={0.6} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="used" name="Real Usage" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* PVCs Tabs with Detailed Usage */}
          <div className="pt-4 border-t border-border/50">
            <Tabs defaultValue="bound" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted/50 backdrop-blur-sm gap-1">
                <TabsTrigger value="bound" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-success/20 data-[state=active]:to-success/10">
                  <span className="hidden sm:inline">Bound</span>
                  <span className="sm:hidden">B</span> ({boundPVCs.length})
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-warning/20 data-[state=active]:to-warning/10">
                  <span className="hidden sm:inline">Pending</span>
                  <span className="sm:hidden">P</span> ({pendingPVCs.length})
                </TabsTrigger>
                <TabsTrigger value="available" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-primary/10">
                  <span className="hidden sm:inline">Available</span>
                  <span className="sm:hidden">A</span> ({availablePVCs.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="bound" className="mt-4 space-y-2 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-bottom-3 duration-500">
                {boundPVCs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No bound PVCs</p>
                ) : (
                  boundPVCs.map((pvc, index) => {
                    const allocatedGB = pvc.requested_bytes / (1024 ** 3);
                    const usedGB = pvc.used_bytes / (1024 ** 3);
                    const usagePercent = allocatedGB > 0 ? (usedGB / allocatedGB) * 100 : 0;
                    
                    return (
                      <div 
                        key={pvc.id} 
                        className="p-3 rounded-lg border border-success/20 bg-gradient-to-r from-success/5 to-transparent hover:from-success/10 hover:border-success/30 transition-all duration-300 hover:scale-[1.01] hover:shadow-md"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Database className="w-3 h-3 text-primary flex-shrink-0" />
                              <p className="font-medium text-xs sm:text-sm text-foreground truncate">{pvc.name}</p>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate ml-5">
                              {pvc.namespace} {pvc.storage_class && `· ${pvc.storage_class}`}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <Badge variant="outline" className="border-success/30 text-success text-[10px] sm:text-xs">
                              {allocatedGB.toFixed(2)} GB
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Usage Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] sm:text-xs">
                            <span className="text-muted-foreground">Real Usage</span>
                            <span className={`font-medium ${getUsageColor(usagePercent)}`}>
                              {usedGB.toFixed(2)} GB / {allocatedGB.toFixed(2)} GB ({usagePercent.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
                            <div 
                              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${getProgressColor(usagePercent)}`}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                          {usagePercent < 20 && usedGB > 0 && (
                            <p className="text-[10px] text-warning flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Low usage - consider resizing
                            </p>
                          )}
                          {usagePercent >= 90 && (
                            <p className="text-[10px] text-destructive flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Near capacity - consider expanding
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm text-foreground flex items-center gap-2 truncate">
                            <span className="truncate">{pvc.name}</span>
                            <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0" />
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Namespace: {pvc.namespace}</p>
                          {pvc.storage_class && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Class: {pvc.storage_class}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="border-warning/30 text-warning text-[10px] sm:text-xs flex-shrink-0">
                          {(pvc.requested_bytes / (1024**3)).toFixed(2)} GB
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="available" className="mt-4 space-y-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-bottom-3 duration-500">
                {availablePVCs.length === 0 ? (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-8">No available PVCs</p>
                ) : (
                  availablePVCs.map((pvc, index) => (
                    <div 
                      key={pvc.id} 
                      className="p-3 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10 hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm text-foreground truncate">{pvc.name}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Namespace: {pvc.namespace}</p>
                          {pvc.storage_class && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Class: {pvc.storage_class}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="border-primary/30 text-primary text-[10px] sm:text-xs flex-shrink-0">
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