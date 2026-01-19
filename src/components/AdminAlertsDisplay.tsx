import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Info, 
  Bell, 
  X, 
  ExternalLink,
  Shield,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminAlert {
  id: string;
  cluster_id: string;
  user_id: string;
  title: string;
  message: string;
  alert_type: string;
  action_type: string | null;
  action_params: any;
  dismissed: boolean;
  dismissed_at: string | null;
  expires_at: string | null;
  created_at: string;
  created_by: string;
}

const alertTypeConfig: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; border: string }> = {
  warning: { 
    icon: AlertTriangle, 
    color: 'text-amber-500', 
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/30'
  },
  info: { 
    icon: Info, 
    color: 'text-blue-500', 
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/30'
  },
  critical: { 
    icon: Shield, 
    color: 'text-red-500', 
    bg: 'bg-red-500/5',
    border: 'border-red-500/30'
  },
  update: { 
    icon: RefreshCw, 
    color: 'text-primary', 
    bg: 'bg-primary/5',
    border: 'border-primary/30'
  },
};

export function AdminAlertsDisplay() {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && selectedClusterId) {
      fetchAlerts();
    }
  }, [user, selectedClusterId]);

  // Real-time subscription for new alerts
  useEffect(() => {
    if (!user || !selectedClusterId) return;

    const channel = supabase
      .channel('admin-alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_cluster_alerts',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedClusterId]);

  const fetchAlerts = async () => {
    if (!user || !selectedClusterId) return;

    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('admin_cluster_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('cluster_id', selectedClusterId)
        .eq('dismissed', false)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin alerts:', error);
        return;
      }

      setAlerts(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('admin_cluster_alerts')
        .update({ 
          dismissed: true, 
          dismissed_at: new Date().toISOString() 
        })
        .eq('id', alertId);

      if (error) {
        console.error('Error dismissing alert:', error);
        return;
      }

      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  if (loading || alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-3 duration-500">
      {alerts.map((alert) => {
        const config = alertTypeConfig[alert.alert_type] || alertTypeConfig.info;
        const Icon = config.icon;

        return (
          <Alert 
            key={alert.id} 
            className={cn(
              "relative",
              config.bg,
              config.border
            )}
          >
            <Icon className={cn("h-5 w-5", config.color)} />
            <AlertTitle className={cn("font-semibold flex items-center gap-2", config.color)}>
              <Bell className="w-4 h-4" />
              {alert.title}
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p className="text-muted-foreground">{alert.message}</p>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Enviado {formatDistanceToNow(new Date(alert.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </span>
                
                <div className="flex gap-2">
                  {alert.action_type === 'link' && alert.action_params?.url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => window.open(alert.action_params.url, '_blank')}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {alert.action_params.label || 'Ver mais'}
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => dismissAlert(alert.id)}
                  >
                    <X className="w-3 h-3" />
                    Dispensar
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
