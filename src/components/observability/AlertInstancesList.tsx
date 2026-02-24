import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, XCircle, Bell, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AlertInstance {
  id: string;
  title: string;
  message: string;
  severity: string;
  source: string;
  metric_value: number | null;
  status: string;
  acknowledged: boolean;
  created_at: string;
  resolved_at: string | null;
}

const severityConfig: Record<string, { icon: React.ElementType; color: string }> = {
  critical: { icon: XCircle, color: "text-red-500 bg-red-500/10" },
  high: { icon: AlertTriangle, color: "text-orange-500 bg-orange-500/10" },
  warning: { icon: Clock, color: "text-yellow-500 bg-yellow-500/10" },
  info: { icon: Bell, color: "text-blue-500 bg-blue-500/10" },
};

export const AlertInstancesList = () => {
  const { selectedClusterId } = useCluster();
  const [alerts, setAlerts] = useState<AlertInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("alert_instances")
      .select("*")
      .eq("cluster_id", selectedClusterId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setAlerts(data);
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, [selectedClusterId]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedClusterId) return;
    const channel = supabase
      .channel("alert-instances-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "alert_instances",
        filter: `cluster_id=eq.${selectedClusterId}`,
      }, (payload) => {
        const newAlert = payload.new as AlertInstance;
        setAlerts(prev => [newAlert, ...prev].slice(0, 50));
        toast.warning(`🔔 ${newAlert.title}`, { description: newAlert.message });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedClusterId]);

  const acknowledge = async (id: string) => {
    await supabase.from("alert_instances").update({ acknowledged: true, acknowledged_at: new Date().toISOString() }).eq("id", id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const resolve = async (id: string) => {
    await supabase.from("alert_instances").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "resolved" } : a));
  };

  const firingAlerts = alerts.filter(a => a.status === "firing");
  const resolvedAlerts = alerts.filter(a => a.status === "resolved");

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Alertas Ativos
            {firingAlerts.length > 0 && (
              <Badge variant="destructive" className="text-xs ml-1">{firingAlerts.length}</Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchAlerts} className="text-xs">
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <CheckCircle className="w-8 h-8 opacity-40 text-green-500" />
            <p>Nenhum alerta ativo</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity] || severityConfig.info;
              const Icon = config.icon;
              return (
                <div key={alert.id} className={`p-3 rounded-lg border transition-colors ${
                  alert.status === "resolved" ? "border-border/30 opacity-60" : "border-border/50 hover:bg-muted/30"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className={`p-1 rounded ${config.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{alert.title}</span>
                          <Badge variant="outline" className="text-[10px]">{alert.source}</Badge>
                          {alert.status === "resolved" && (
                            <Badge className="text-[10px] bg-green-500/10 text-green-500 border-0">Resolvido</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                          {alert.metric_value != null && ` • Valor: ${alert.metric_value}`}
                        </p>
                      </div>
                    </div>
                    {alert.status === "firing" && (
                      <div className="flex gap-1">
                        {!alert.acknowledged && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => acknowledge(alert.id)} title="Reconhecer">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500" onClick={() => resolve(alert.id)} title="Resolver">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
