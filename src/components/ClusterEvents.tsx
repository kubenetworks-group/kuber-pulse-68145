import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KubernetesEvent {
  name: string;
  namespace: string;
  type: string;
  reason: string;
  message: string;
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
  involvedObject?: {
    kind: string;
    name: string;
  };
}

export const ClusterEvents = () => {
  const { t } = useTranslation();
  const { selectedClusterId } = useCluster();
  const [events, setEvents] = useState<KubernetesEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedClusterId) {
      fetchEvents();
    }
  }, [selectedClusterId]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data: metrics, error } = await supabase
        .from('agent_metrics')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .eq('metric_type', 'events')
        .order('collected_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!metrics || metrics.length === 0) {
        console.log('No events metrics found');
        setEvents([]);
        setLoading(false);
        return;
      }

      const latestMetric = metrics[0];
      const metricData = latestMetric.metric_data as any;
      const eventsData = metricData?.events || [];
      
      // Filter only Warning and Error events, sort by last timestamp
      const importantEvents = eventsData
        .filter((e: KubernetesEvent) => e.type === 'Warning' || e.type === 'Error')
        .sort((a: KubernetesEvent, b: KubernetesEvent) => 
          new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
        )
        .slice(0, 20); // Show only last 20 events

      setEvents(importantEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'Warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'Error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEventBadgeVariant = (type: string) => {
    switch (type) {
      case 'Warning':
        return 'outline' as const;
      case 'Error':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return t('common.justNow');
    if (diffMins < 60) return `${diffMins}m ${t('common.ago')}`;
    if (diffHours < 24) return `${diffHours}h ${t('common.ago')}`;
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">{t('dashboard.clusterEvents')}</h3>
        <div className="h-96 flex items-center justify-center">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">{t('dashboard.clusterEvents')}</h3>
        <div className="h-96 flex items-center justify-center">
          <p className="text-muted-foreground">{t('dashboard.noEvents')}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">{t('dashboard.clusterEvents')}</h3>
      <ScrollArea className="h-96">
        <div className="space-y-3">
          {events.map((event, index) => (
            <div 
              key={`${event.namespace}-${event.name}-${index}`}
              className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getEventBadgeVariant(event.type)}>
                        {event.reason}
                      </Badge>
                      {event.involvedObject && (
                        <span className="text-sm text-muted-foreground">
                          {event.involvedObject.kind}: {event.involvedObject.name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(event.lastTimestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{event.message}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Namespace: {event.namespace}</span>
                    {event.count > 1 && (
                      <span>Count: {event.count}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
