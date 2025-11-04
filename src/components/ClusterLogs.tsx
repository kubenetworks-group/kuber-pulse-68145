import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";

interface ClusterLog {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
  details?: any;
}

interface ClusterLogsProps {
  clusterId: string;
}

export const ClusterLogs = ({ clusterId }: ClusterLogsProps) => {
  const [logs, setLogs] = useState<ClusterLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`cluster-logs-${clusterId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cluster_events',
          filter: `cluster_id=eq.${clusterId}`
        },
        (payload) => {
          setLogs((current) => [payload.new as ClusterLog, ...current]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clusterId]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("cluster_events")
      .select("*")
      .eq("cluster_id", clusterId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const getLogIcon = (eventType: string) => {
    switch (eventType) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogBadge = (eventType: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
      error: "destructive",
      success: "default",
      warning: "secondary",
      info: "outline",
    };
    
    return (
      <Badge variant={variants[eventType] || "outline"} className="text-xs">
        {eventType.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connection Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No logs available yet
            </p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="mt-0.5">{getLogIcon(log.event_type)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      {getLogBadge(log.event_type)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{log.message}</p>
                    {log.details && (
                      <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
