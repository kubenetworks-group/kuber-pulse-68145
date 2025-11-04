import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";

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

  const pieData = namespaceData.flatMap(ns => [
    { name: `${ns.namespace} (${t('common.healthy')})`, value: ns.healthy, status: 'healthy' },
    { name: `${ns.namespace} (${t('common.warning')})`, value: ns.warning, status: 'warning' },
    { name: `${ns.namespace} (${t('common.critical')})`, value: ns.critical, status: 'critical' },
  ]).filter(item => item.value > 0);

  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{t('dashboard.podHealthByNamespace')}</h3>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          {t('common.loading')}
        </div>
      </Card>
    );
  }

  if (pieData.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{t('dashboard.podHealthByNamespace')}</h3>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          {t('common.noData')}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {t('dashboard.podHealthByNamespace')}
        </h3>
        <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
            outerRadius={90}
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {pieData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]}
                className="hover:opacity-80 transition-opacity cursor-pointer"
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              padding: '8px 12px'
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            iconType="circle"
            wrapperStyle={{
              fontSize: '12px',
              paddingTop: '16px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Stats Summary */}
      <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
        {namespaceData.slice(0, 3).map((ns) => (
          <div key={ns.namespace} className="text-center">
            <div className="text-xs text-muted-foreground mb-1">{ns.namespace}</div>
            <div className="text-sm font-bold text-foreground">{ns.total} pods</div>
          </div>
        ))}
      </div>
    </Card>
  );
};
