import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import { Activity, Server } from "lucide-react";

interface NamespaceHealth {
  namespace: string;
  healthy: number;
  warning: number;
  critical: number;
  total: number;
}

// Modern tech color palette
const NAMESPACE_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
];

// Pod status mapping
const POD_STATUS_MAP: Record<string, string> = {
  Running: 'healthy',
  Succeeded: 'healthy',
  Pending: 'warning',
  Unknown: 'warning',
  Failed: 'critical',
  CrashLoopBackOff: 'critical',
  Error: 'critical',
  ImagePullBackOff: 'critical',
  ErrImagePull: 'critical',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
        <p className="font-semibold text-foreground mb-1">{data.name}</p>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            Total: <span className="text-foreground font-medium">{data.value} pods</span>
          </p>
          <p className="text-muted-foreground">
            Participação: <span className="text-foreground font-medium">{data.percentage}%</span>
          </p>
          <div className="flex gap-2 mt-2 pt-2 border-t border-border">
            <span className="text-success text-xs">● {data.healthy} healthy</span>
            {data.warning > 0 && <span className="text-warning text-xs">● {data.warning} warning</span>}
            {data.critical > 0 && <span className="text-destructive text-xs">● {data.critical} critical</span>}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const PodHealthByNamespace = () => {
  const { t } = useTranslation();
  const { selectedClusterId } = useCluster();
  const [namespaceData, setNamespaceData] = useState<NamespaceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (selectedClusterId) {
      fetchPodData();
    }
  }, [selectedClusterId]);

  const fetchPodData = async () => {
    setLoading(true);
    try {
      const { data: metrics, error } = await supabase
        .from('agent_metrics')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .eq('metric_type', 'pod_details')
        .order('collected_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!metrics || metrics.length === 0) {
        setNamespaceData([]);
        setLoading(false);
        return;
      }

      const latestMetric = metrics[0];
      const metricData = latestMetric.metric_data as any;
      const pods = metricData?.pods || [];

      const namespaceMap = new Map<string, NamespaceHealth>();
      
      pods.forEach((pod: any) => {
        const ns = pod.namespace || 'default';
        if (!namespaceMap.has(ns)) {
          namespaceMap.set(ns, { namespace: ns, healthy: 0, warning: 0, critical: 0, total: 0 });
        }
        
        const data = namespaceMap.get(ns)!;
        data.total++;
        
        const status = pod.status || pod.phase || 'Unknown';
        const healthStatus = POD_STATUS_MAP[status] || 'warning';
        
        if (healthStatus === 'critical') {
          data.critical++;
        } else if (healthStatus === 'warning') {
          data.warning++;
        } else {
          data.healthy++;
        }
      });

      // Sort by total pods descending
      const sorted = Array.from(namespaceMap.values()).sort((a, b) => b.total - a.total);
      setNamespaceData(sorted);
    } catch (error) {
      console.error('Error fetching pod data:', error);
      setNamespaceData([]);
    } finally {
      setLoading(false);
    }
  };

  const totalPods = namespaceData.reduce((sum, ns) => sum + ns.total, 0);

  const pieData = namespaceData.map((ns, index) => ({
    name: ns.namespace,
    value: ns.total,
    healthy: ns.healthy,
    warning: ns.warning,
    critical: ns.critical,
    percentage: totalPods > 0 ? ((ns.total / totalPods) * 100).toFixed(0) : '0',
    color: NAMESPACE_COLORS[index % NAMESPACE_COLORS.length],
  }));

  const healthyPods = namespaceData.reduce((sum, ns) => sum + ns.healthy, 0);
  const warningPods = namespaceData.reduce((sum, ns) => sum + ns.warning, 0);
  const criticalPods = namespaceData.reduce((sum, ns) => sum + ns.critical, 0);

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border/50">
        <h3 className="text-lg font-semibold mb-4">{t('dashboard.podHealthByNamespace')}</h3>
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <Activity className="w-8 h-8 animate-pulse text-primary" />
            {t('common.loading')}
          </div>
        </div>
      </Card>
    );
  }

  if (pieData.length === 0) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border/50">
        <h3 className="text-lg font-semibold mb-4">{t('dashboard.podHealthByNamespace')}</h3>
        <div className="h-[400px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-muted/20 mx-auto mb-3 flex items-center justify-center">
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-card via-card to-card/80 border-border/50 hover:border-primary/30 transition-all duration-500">
      {/* Tech background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              {t('dashboard.podHealthByNamespace')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {totalPods} pods • {namespaceData.length} namespaces
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/20">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium text-success">{healthyPods}</span>
            </div>
            {warningPods > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning/10 border border-warning/20">
                <div className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-xs font-medium text-warning">{warningPods}</span>
              </div>
            )}
            {criticalPods > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/10 border border-destructive/20">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-xs font-medium text-destructive">{criticalPods}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Main content: Chart + Legend side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Donut Chart */}
          <div className="relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  fill="#8884d8"
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={1000}
                  paddingAngle={2}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      className="cursor-pointer transition-all duration-300"
                      stroke="hsl(var(--background))"
                      strokeWidth={activeIndex === index ? 3 : 2}
                      style={{
                        filter: activeIndex === index ? 'brightness(1.2) drop-shadow(0 0 8px rgba(0,0,0,0.3))' : 'brightness(1)',
                        transform: activeIndex === index ? 'scale(1.02)' : 'scale(1)',
                        transformOrigin: 'center',
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center stats */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-3xl font-bold text-foreground">{totalPods}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Pods</div>
            </div>
          </div>

          {/* Legend - Right side */}
          <div className="flex flex-col justify-center space-y-2 max-h-[280px] overflow-y-auto pr-2">
            {pieData.map((item, index) => (
              <div 
                key={item.name} 
                className={`
                  flex items-center justify-between p-3 rounded-lg border transition-all duration-300 cursor-pointer
                  ${activeIndex === index 
                    ? 'bg-accent border-primary/50 shadow-md' 
                    : 'bg-accent/30 border-border/50 hover:bg-accent/50 hover:border-border'
                  }
                `}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(undefined)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-4 h-4 rounded-md flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.healthy > 0 && (
                        <span className="text-[10px] text-success">●{item.healthy}</span>
                      )}
                      {item.warning > 0 && (
                        <span className="text-[10px] text-warning">●{item.warning}</span>
                      )}
                      {item.critical > 0 && (
                        <span className="text-[10px] text-destructive">●{item.critical}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-lg font-bold" style={{ color: item.color }}>{item.percentage}%</p>
                  <p className="text-xs text-muted-foreground">{item.value} pods</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stats bar */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-border/50">
          <div className="text-center p-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground font-medium">{t('common.healthy')}</span>
            </div>
            <p className="text-xl font-bold text-success">{healthyPods}</p>
            <p className="text-xs text-muted-foreground">
              {totalPods > 0 ? ((healthyPods / totalPods) * 100).toFixed(1) : 0}%
            </p>
          </div>
          
          <div className="text-center p-2 border-x border-border/50">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-xs text-muted-foreground font-medium">{t('common.warning')}</span>
            </div>
            <p className="text-xl font-bold text-warning">{warningPods}</p>
            <p className="text-xs text-muted-foreground">
              {totalPods > 0 ? ((warningPods / totalPods) * 100).toFixed(1) : 0}%
            </p>
          </div>
          
          <div className="text-center p-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-xs text-muted-foreground font-medium">{t('common.critical')}</span>
            </div>
            <p className="text-xl font-bold text-destructive">{criticalPods}</p>
            <p className="text-xs text-muted-foreground">
              {totalPods > 0 ? ((criticalPods / totalPods) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
