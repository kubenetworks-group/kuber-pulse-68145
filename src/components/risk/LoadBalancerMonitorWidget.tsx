import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Globe, 
  Shield, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TrafficLog {
  id: string;
  source_ip: string;
  request_path: string;
  request_method: string;
  status_code: number;
  user_agent: string;
  is_suspicious: boolean;
  threat_level: string;
  threat_reason: string;
  request_timestamp: string;
}

interface LoadBalancerService {
  id: string;
  service_name: string;
  namespace: string;
  external_ip: string;
  ports: number[];
  total_requests: number;
  suspicious_requests: number;
  last_suspicious_at: string | null;
  has_network_policy: boolean;
  last_seen_at: string;
}

export const LoadBalancerMonitorWidget = () => {
  const { selectedClusterId } = useCluster();
  const [services, setServices] = useState<LoadBalancerService[]>([]);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [trafficLogs, setTrafficLogs] = useState<Record<string, TrafficLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null);

  const fetchServices = async () => {
    if (!selectedClusterId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("loadbalancer_services")
        .select("*")
        .eq("cluster_id", selectedClusterId)
        .order("suspicious_requests", { ascending: false });

      if (!error && data) {
        setServices(data.map(s => ({
          ...s,
          ports: Array.isArray(s.ports) ? (s.ports as number[]) : []
        })));
      }
    } catch (err) {
      console.error("Error fetching LB services:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrafficLogs = async (externalIp: string) => {
    if (!selectedClusterId) return;
    
    setLoadingLogs(externalIp);
    try {
      const { data, error } = await supabase
        .from("loadbalancer_traffic_logs")
        .select("*")
        .eq("cluster_id", selectedClusterId)
        .eq("external_ip", externalIp)
        .order("request_timestamp", { ascending: false })
        .limit(50);

      if (!error && data) {
        setTrafficLogs(prev => ({
          ...prev,
          [externalIp]: data
        }));
      }
    } catch (err) {
      console.error("Error fetching traffic logs:", err);
    } finally {
      setLoadingLogs(null);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [selectedClusterId]);

  const handleToggleExpand = async (serviceId: string, externalIp: string) => {
    if (expandedService === serviceId) {
      setExpandedService(null);
    } else {
      setExpandedService(serviceId);
      if (!trafficLogs[externalIp]) {
        await fetchTrafficLogs(externalIp);
      }
    }
  };

  const getThreatBadge = (level: string) => {
    switch (level) {
      case "critical":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/30">Crítico</Badge>;
      case "high":
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/30">Alto</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Médio</Badge>;
      case "low":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30">Baixo</Badge>;
      default:
        return <Badge variant="outline">Normal</Badge>;
    }
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: "bg-green-500/10 text-green-500",
      POST: "bg-blue-500/10 text-blue-500",
      PUT: "bg-yellow-500/10 text-yellow-500",
      DELETE: "bg-red-500/10 text-red-500",
      PATCH: "bg-purple-500/10 text-purple-500",
    };
    return (
      <Badge className={colors[method] || "bg-muted"} variant="outline">
        {method}
      </Badge>
    );
  };

  const totalSuspicious = services.reduce((acc, s) => acc + s.suspicious_requests, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5 text-muted-foreground" />
            Monitoramento de LoadBalancers
            {totalSuspicious > 0 && (
              <Badge className="bg-red-500/10 text-red-500 border-red-500/30 ml-2">
                <ShieldAlert className="h-3 w-3 mr-1" />
                {totalSuspicious} suspeitos
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchServices} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-70" />
            <p className="text-sm font-medium text-green-500">Nenhum LoadBalancer detectado</p>
            <p className="text-xs text-muted-foreground mt-1">
              O cluster não possui serviços do tipo LoadBalancer expostos
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <Collapsible
                key={service.id}
                open={expandedService === service.id}
                onOpenChange={() => handleToggleExpand(service.id, service.external_ip)}
              >
                <div className="rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          service.suspicious_requests > 0 
                            ? 'bg-red-500/10 text-red-500' 
                            : 'bg-blue-500/10 text-blue-500'
                        }`}>
                          {service.suspicious_requests > 0 ? (
                            <ShieldAlert className="h-4 w-4" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{service.service_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {service.namespace}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {service.external_ip}
                            </code>
                            {service.ports.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                :{service.ports.join(", :")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Activity className="h-3 w-3" />
                            {service.total_requests} requests
                          </div>
                          {service.suspicious_requests > 0 && (
                            <div className="text-red-500 font-medium">
                              {service.suspicious_requests} suspeitos
                            </div>
                          )}
                        </div>
                        {service.has_network_policy ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                            <Shield className="h-3 w-3 mr-1" />
                            Protegido
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Sem Policy
                          </Badge>
                        )}
                        {expandedService === service.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="border-t px-3 py-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Últimas Requisições
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => fetchTrafficLogs(service.external_ip)}
                          disabled={loadingLogs === service.external_ip}
                        >
                          <RefreshCw className={`h-3 w-3 ${loadingLogs === service.external_ip ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                      
                      {loadingLogs === service.external_ip ? (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (trafficLogs[service.external_ip]?.length || 0) === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-xs text-muted-foreground">
                            Nenhum log de tráfego disponível
                          </p>
                        </div>
                      ) : (
                        <ScrollArea className="h-64">
                          <div className="space-y-2">
                            {trafficLogs[service.external_ip]?.map((log) => (
                              <div
                                key={log.id}
                                className={`p-2 rounded-lg border text-xs ${
                                  log.is_suspicious 
                                    ? 'bg-red-500/5 border-red-500/20' 
                                    : 'bg-background'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    {getMethodBadge(log.request_method)}
                                    <code className="font-mono truncate max-w-[200px]">
                                      {log.request_path || "/"}
                                    </code>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {log.is_suspicious && getThreatBadge(log.threat_level)}
                                    <Badge variant="outline" className={
                                      log.status_code >= 500 ? 'text-red-500' :
                                      log.status_code >= 400 ? 'text-yellow-500' :
                                      'text-green-500'
                                    }>
                                      {log.status_code}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <span>IP: {log.source_ip || "N/A"}</span>
                                    {log.user_agent && (
                                      <span className="truncate max-w-[150px]" title={log.user_agent}>
                                        {log.user_agent.substring(0, 30)}...
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(log.request_timestamp), { 
                                      addSuffix: true, 
                                      locale: ptBR 
                                    })}
                                  </div>
                                </div>
                                {log.is_suspicious && log.threat_reason && (
                                  <div className="mt-1 p-1.5 rounded bg-red-500/10 text-red-500">
                                    <div className="flex items-center gap-1">
                                      <ShieldAlert className="h-3 w-3" />
                                      <span className="font-medium">Motivo:</span>
                                    </div>
                                    <span>{log.threat_reason}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
