import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AIIncidentCard } from "@/components/AIIncidentCard";
import { MetricCard } from "@/components/MetricCard";
import { Bot, Activity, CheckCircle, Clock, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Incident = {
  id: string;
  cluster_id: string;
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  ai_analysis: {
    root_cause: string;
    impact: string;
    recommendation: string;
    confidence?: number;
  };
  auto_heal_action: string | null;
  action_taken: boolean;
  action_result: any;
  created_at: string;
  resolved_at: string | null;
};

type Cluster = {
  id: string;
  name: string;
};

export default function AIMonitor() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [savings, setSavings] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (user) {
      fetchData();
      subscribeToIncidents();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch incidents
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('ai_incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (incidentsError) throw incidentsError;
      setIncidents((incidentsData || []) as any);

      // Fetch clusters for names
      const { data: clustersData, error: clustersError } = await supabase
        .from('clusters')
        .select('id, name');

      if (clustersError) throw clustersError;
      setClusters(clustersData || []);

      // Fetch AI savings
      const { data: savingsData, error: savingsError } = await supabase
        .from('ai_cost_savings')
        .select('*');

      if (!savingsError && savingsData) {
        const savingsMap = new Map(savingsData.map(s => [s.incident_id, s]));
        setSavings(savingsMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load AI incidents",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToIncidents = () => {
    const channel = supabase
      .channel('ai-incidents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_incidents'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newIncident = payload.new as Incident;
            setIncidents(prev => [newIncident, ...prev]);
            
            if (newIncident.severity === 'critical') {
              toast({
                title: "🔥 Critical Incident Detected",
                description: newIncident.title,
                variant: "destructive"
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            setIncidents(prev => prev.map(inc => 
              inc.id === payload.new.id ? payload.new as Incident : inc
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleExecuteAction = async (incidentId: string) => {
    toast({
      title: "Executing action...",
      description: "AI is performing the corrective action"
    });
    
    // In a real app, this would call an edge function
    // For now, simulate action execution
    setTimeout(() => {
      toast({
        title: "Action completed",
        description: "The incident has been resolved",
      });
      fetchData();
    }, 2000);
  };

  const filteredIncidents = incidents.filter(incident => {
    if (severityFilter !== "all" && incident.severity !== severityFilter) return false;
    if (statusFilter === "resolved" && !incident.resolved_at) return false;
    if (statusFilter === "pending" && incident.resolved_at) return false;
    return true;
  });

  const totalSavingsAmount = Array.from(savings.values()).reduce((sum, s) => sum + Number(s.estimated_savings), 0);

  const stats = {
    total: incidents.length,
    actionsExecuted: incidents.filter(i => i.action_taken).length,
    resolved: incidents.filter(i => i.resolved_at).length,
    totalSavings: totalSavingsAmount,
    avgResolutionTime: incidents.filter(i => i.resolved_at).length > 0
      ? Math.round(
          incidents
            .filter(i => i.resolved_at)
            .reduce((acc, i) => {
              const created = new Date(i.created_at).getTime();
              const resolved = new Date(i.resolved_at!).getTime();
              return acc + (resolved - created) / 60000; // minutes
            }, 0) / incidents.filter(i => i.resolved_at).length
        )
      : 0
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">AI Monitor</h1>
          <p className="text-muted-foreground">
            AI-powered incident detection and auto-healing system
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            title="Total Incidents"
            value={stats.total.toString()}
            icon={Bot}
          />
          <MetricCard
            title="Total Savings"
            value={`$${stats.totalSavings.toFixed(0)}`}
            subtitle="All time"
            icon={Sparkles}
          />
          <MetricCard
            title="Resolved"
            value={stats.resolved.toString()}
            icon={CheckCircle}
          />
          <MetricCard
            title="Avg Resolution Time"
            value={`${stats.avgResolutionTime}m`}
            icon={Clock}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Incidents List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading incidents...
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No incidents detected</h3>
              <p className="text-muted-foreground">
                AI is monitoring your clusters. Incidents will appear here when detected.
              </p>
            </div>
          ) : (
            filteredIncidents.map(incident => (
              <AIIncidentCard
                key={incident.id}
                incident={incident}
                clusterName={clusters.find(c => c.id === incident.cluster_id)?.name}
                savings={savings.get(incident.id)}
                onExecuteAction={handleExecuteAction}
              />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
