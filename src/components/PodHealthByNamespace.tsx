import { Card } from "@/components/ui/card";
import { useEffect, useState, useCallback } from "react";
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

// Modern color palette for namespaces
const NAMESPACE_COLORS = [
  "#1e40af", // blue-800
  "#0891b2", // cyan-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
  "#0d9488", // teal-600
  "#65a30d", // lime-600
  "#ea580c", // orange-600
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

const RADIAN = Math.PI / 180;

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
        console.log('No pod_details metrics found');
        setNamespaceData([]);
        setLoading(false);
        return;
      }

      const latestMetric = metrics[0];
      const metricData = latestMetric.metric_data as any;
      const pods = metricData?.pods || [];

      console.log(`Processing ${pods.length} pods from metric_data`);

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

      setNamespaceData(Array.from(namespaceMap.values()));
    } catch (error) {
      console.error('Error fetching pod data:', error);
      setNamespaceData([]);
    } finally {
      setLoading(false);
    }
  };

  // Create pie data grouped by namespace (total pods per namespace)
  const pieData = namespaceData.map((ns, index) => ({
    name: ns.namespace,
    value: ns.total,
    healthy: ns.healthy,
    warning: ns.warning,
    critical: ns.critical,
    color: NAMESPACE_COLORS[index % NAMESPACE_COLORS.length],
  }));

  const totalPods = namespaceData.reduce((sum, ns) => sum + ns.total, 0);

  // Custom label renderer for outside labels with lines
  const renderCustomizedLabel = useCallback(({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
    name,
    value,
  }: any) => {
    const radius = outerRadius * 1.35;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? 'start' : 'end';
    const percentValue = (percent * 100).toFixed(0);
    const color = pieData[index]?.color || NAMESPACE_COLORS[0];

    // Line from pie to label
    const lineOuterRadius = outerRadius * 1.1;
    const lineX = cx + lineOuterRadius * Math.cos(-midAngle * RADIAN);
    const lineY = cy + lineOuterRadius * Math.sin(-midAngle * RADIAN);

    return (
      <g>
        {/* Connection line */}
        <path
          d={`M${lineX},${lineY}L${x > cx ? x - 10 : x + 10},${y}`}
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          opacity={0.6}
        />
        {/* Namespace name */}
        <text
          x={x}
          y={y - 12}
          textAnchor={textAnchor}
          className="fill-foreground text-xs font-semibold"
        >
          {name}
        </text>
        {/* Percentage */}
        <text
          x={x}
          y={y + 4}
          textAnchor={textAnchor}
          style={{ fill: color }}
          className="text-lg font-bold"
        >
          {percentValue}%
        </text>
        {/* Pod count */}
        <text
          x={x}
          y={y + 20}
          textAnchor={textAnchor}
          className="fill-muted-foreground text-[10px]"
        >
          {value} pods
        </text>
      </g>
    );
  }, [pieData]);

  // Label inside the slice
  const renderInnerLabel = useCallback(({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    if (percent < 0.05) return null; // Don't show for very small slices
    
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percentValue = (percent * 100).toFixed(0);

    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white text-sm font-bold drop-shadow-md"
      >
        {percentValue}%
      </text>
    );
  }, []);

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
    
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 4}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          className="drop-shadow-xl"
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 14}
          outerRadius={outerRadius + 18}
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
        <div className="h-[450px] flex items-center justify-center text-muted-foreground">
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
        <div className="h-[450px] flex items-center justify-center">
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

  const healthyPods = namespaceData.reduce((sum, ns) => sum + ns.healthy, 0);
  const warningPods = namespaceData.reduce((sum, ns) => sum + ns.warning, 0);
  const criticalPods = namespaceData.reduce((sum, ns) => sum + ns.critical, 0);

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
        
        {/* Pie Chart with external labels */}
        <div className="relative">
          <ResponsiveContainer width="100%" height={380}>
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                paddingAngle={1}
                label={renderCustomizedLabel}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="cursor-pointer transition-all duration-300"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              {/* Inner percentage labels */}
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={100}
                fill="transparent"
                dataKey="value"
                label={renderInnerLabel}
                labelLine={false}
                isAnimationActive={false}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20 hover:border-success/40 transition-all cursor-pointer group/stat">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-success group-hover/stat:scale-110 transition-transform" />
              <span className="text-xs font-medium text-muted-foreground">{t('common.healthy')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{healthyPods}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalPods > 0 ? ((healthyPods / totalPods) * 100).toFixed(1) : 0}%
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20 hover:border-warning/40 transition-all cursor-pointer group/stat">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-warning group-hover/stat:scale-110 transition-transform" />
              <span className="text-xs font-medium text-muted-foreground">{t('common.warning')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{warningPods}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalPods > 0 ? ((warningPods / totalPods) * 100).toFixed(1) : 0}%
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20 hover:border-destructive/40 transition-all cursor-pointer group/stat">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-destructive group-hover/stat:scale-110 transition-transform" />
              <span className="text-xs font-medium text-muted-foreground">{t('common.critical')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{criticalPods}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalPods > 0 ? ((criticalPods / totalPods) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        {/* Namespace Legend */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="text-xs font-medium text-muted-foreground mb-3">Namespaces</div>
          <div className="flex flex-wrap gap-2">
            {pieData.map((item, index) => (
              <div 
                key={item.name} 
                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(undefined)}
              >
                <div 
                  className="w-3 h-3 rounded-sm" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-medium text-foreground">{item.name}</span>
                <span className="text-xs text-muted-foreground">({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};