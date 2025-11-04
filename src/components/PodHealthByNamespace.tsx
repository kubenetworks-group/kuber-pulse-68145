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
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{t('dashboard.podHealthByNamespace')}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
};
