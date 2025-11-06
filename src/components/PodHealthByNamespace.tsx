import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";

interface NamespaceHealth {
  namespace: string;
  healthy: number;
  warning: number;
  critical: number;
  total: number;
}

const STATUS_COLORS = {
  healthy: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  critical: "hsl(var(--destructive))",
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
      const { data: pvcs, error } = await supabase
        .from('pvcs')
        .select('*')
        .eq('cluster_id', selectedClusterId);

      if (error) throw error;

      // Group by namespace and calculate health
      const namespaceMap = new Map<string, NamespaceHealth>();
      
      pvcs?.forEach((pvc) => {
        const ns = pvc.namespace || 'default';
        if (!namespaceMap.has(ns)) {
          namespaceMap.set(ns, { namespace: ns, healthy: 0, warning: 0, critical: 0, total: 0 });
        }
        
        const data = namespaceMap.get(ns)!;
        data.total++;
        
        const usagePercent = (pvc.used_bytes / pvc.requested_bytes) * 100;
        if (usagePercent > 85) {
          data.critical++;
        } else if (usagePercent > 70) {
          data.warning++;
        } else {
          data.healthy++;
        }
      });

      setNamespaceData(Array.from(namespaceMap.values()));
    } catch (error) {
      console.error('Error fetching pod data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPods = namespaceData.reduce((sum, ns) => sum + ns.total, 0);
  const healthyPods = namespaceData.reduce((sum, ns) => sum + ns.healthy, 0);
  const warningPods = namespaceData.reduce((sum, ns) => sum + ns.warning, 0);
  const criticalPods = namespaceData.reduce((sum, ns) => sum + ns.critical, 0);

  const pieData = [
    { 
      name: t('common.healthy'),
      value: healthyPods, 
      status: 'healthy',
      percentage: ((healthyPods / totalPods) * 100).toFixed(1)
    },
    { 
      name: t('common.warning'),
      value: warningPods, 
      status: 'warning',
      percentage: ((warningPods / totalPods) * 100).toFixed(1)
    },
    { 
      name: t('common.critical'),
      value: criticalPods, 
      status: 'critical',
      percentage: ((criticalPods / totalPods) * 100).toFixed(1)
    },
  ].filter(item => item.value > 0);

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
    
    return (
      <g>
        <text x={cx} y={cy - 10} textAnchor="middle" className="fill-foreground font-bold text-2xl">
          {value}
        </text>
        <text x={cx} y={cy + 15} textAnchor="middle" className="fill-muted-foreground text-sm">
          {payload.name}
        </text>
        <text x={cx} y={cy + 32} textAnchor="middle" className="fill-muted-foreground text-xs">
          {payload.percentage}% do total
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          className="drop-shadow-lg"
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 12}
          outerRadius={outerRadius + 16}
          fill={fill}
          opacity={0.3}
        />
      </g>
    );
  };

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

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
    <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/50 transition-all duration-300">
      {/* Background effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('dashboard.podHealthByNamespace')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {totalPods} pods em {namespaceData.length} namespaces
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <Activity className="w-5 h-5 text-primary" />
          </div>
        </div>
        
        <div className="relative">
          <ResponsiveContainer width="100%" height={340}>
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={75}
                outerRadius={105}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                paddingAngle={2}
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]}
                    className="cursor-pointer transition-all duration-300"
                    style={{
                      filter: activeIndex === index ? 'brightness(1.2)' : 'brightness(1)',
                    }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center info when not hovering */}
          {activeIndex === undefined && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-4xl font-bold text-foreground">{totalPods}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Pods</div>
            </div>
          )}
        </div>
        
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="p-3 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20 hover:border-success/40 transition-all cursor-pointer group/stat">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-success group-hover/stat:scale-110 transition-transform" />
              <span className="text-xs font-medium text-muted-foreground">{t('common.healthy')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{healthyPods}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {((healthyPods / totalPods) * 100).toFixed(1)}%
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20 hover:border-warning/40 transition-all cursor-pointer group/stat">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-warning group-hover/stat:scale-110 transition-transform" />
              <span className="text-xs font-medium text-muted-foreground">{t('common.warning')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{warningPods}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {((warningPods / totalPods) * 100).toFixed(1)}%
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20 hover:border-destructive/40 transition-all cursor-pointer group/stat">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-destructive group-hover/stat:scale-110 transition-transform" />
              <span className="text-xs font-medium text-muted-foreground">{t('common.critical')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{criticalPods}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {((criticalPods / totalPods) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Namespace List */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="text-xs font-medium text-muted-foreground mb-3">Namespaces</div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {namespaceData.map((ns) => (
              <div key={ns.namespace} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors">
                <span className="text-sm font-medium text-foreground">{ns.namespace}</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {ns.healthy > 0 && <div className="w-2 h-2 rounded-full bg-success" title={`${ns.healthy} healthy`} />}
                    {ns.warning > 0 && <div className="w-2 h-2 rounded-full bg-warning" title={`${ns.warning} warning`} />}
                    {ns.critical > 0 && <div className="w-2 h-2 rounded-full bg-destructive" title={`${ns.critical} critical`} />}
                  </div>
                  <span className="text-xs text-muted-foreground">{ns.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};
