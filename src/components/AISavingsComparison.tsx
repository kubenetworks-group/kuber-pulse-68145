import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingDown, Clock, Server, Zap, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { useCurrency } from "@/hooks/useCurrency";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AISaving {
  id: string;
  saving_type: string;
  downtime_avoided_minutes: number;
  cost_per_minute: number;
  estimated_savings: number;
  created_at: string;
  incident: {
    title: string;
    description: string;
    severity: string;
  } | null;
}

export const AISavingsComparison = () => {
  const { user } = useAuth();
  const { selectedClusterId } = useCluster();
  const { formatCurrency } = useCurrency();
  const [savings, setSavings] = useState<AISaving[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    totalSavings: 0,
    totalDowntimeAvoided: 0,
    incidentsResolved: 0,
    withoutAICost: 0,
    withAICost: 0
  });

  useEffect(() => {
    if (user && selectedClusterId) {
      fetchSavingsData();
    }
  }, [user, selectedClusterId]);

  const fetchSavingsData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_cost_savings')
        .select(`
          id,
          saving_type,
          downtime_avoided_minutes,
          cost_per_minute,
          estimated_savings,
          created_at,
          ai_incidents!inner(title, description, severity)
        `)
        .eq('cluster_id', selectedClusterId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching AI savings:', error);
        return;
      }

      const formattedData: AISaving[] = (data || []).map((item: any) => ({
        id: item.id,
        saving_type: item.saving_type,
        downtime_avoided_minutes: item.downtime_avoided_minutes,
        cost_per_minute: item.cost_per_minute,
        estimated_savings: item.estimated_savings,
        created_at: item.created_at,
        incident: item.ai_incidents ? {
          title: item.ai_incidents.title,
          description: item.ai_incidents.description,
          severity: item.ai_incidents.severity
        } : null
      }));

      setSavings(formattedData);

      // Calculate totals
      const totalSavings = formattedData.reduce((sum, s) => sum + s.estimated_savings, 0);
      const totalDowntime = formattedData.reduce((sum, s) => sum + s.downtime_avoided_minutes, 0);
      const avgCostPerMinute = formattedData.length > 0 
        ? formattedData.reduce((sum, s) => sum + s.cost_per_minute, 0) / formattedData.length 
        : 10;
      
      // Without AI: all downtime would have happened = total cost
      const withoutAICost = totalDowntime * avgCostPerMinute;
      // With AI: we pay for AI but avoid most costs (simulated as 10% of potential cost)
      const withAICost = withoutAICost * 0.1;

      setTotals({
        totalSavings,
        totalDowntimeAvoided: totalDowntime,
        incidentsResolved: formattedData.length,
        withoutAICost,
        withAICost
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSavingTypeLabel = (type: string) => {
    switch (type) {
      case 'downtime_prevention': return 'Prevenção de Downtime';
      case 'resource_optimization': return 'Otimização de Recursos';
      case 'scale_optimization': return 'Otimização de Escala';
      case 'auto_heal': return 'Auto-Healing';
      default: return type;
    }
  };

  const getSavingTypeIcon = (type: string) => {
    switch (type) {
      case 'downtime_prevention': return <Clock className="w-4 h-4" />;
      case 'resource_optimization': return <Server className="w-4 h-4" />;
      case 'scale_optimization': return <Zap className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Comparison Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6 bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Sem IA</span>
          </div>
          <p className="text-2xl font-bold text-destructive">
            {formatCurrency(totals.withoutAICost, { sourceCurrency: 'USD' }).value}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.totalDowntimeAvoided} min de downtime estimado
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-success/20">
              <Sparkles className="w-5 h-5 text-success" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Com IA</span>
          </div>
          <p className="text-2xl font-bold text-success">
            {formatCurrency(totals.withAICost, { sourceCurrency: 'USD' }).value}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.incidentsResolved} incidentes resolvidos
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <TrendingDown className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Economia Total</span>
          </div>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(totals.totalSavings, { sourceCurrency: 'USD' }).value}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.withoutAICost > 0 ? Math.round((totals.totalSavings / totals.withoutAICost) * 100) : 0}% de redução
          </p>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-success" />
            Histórico de Economia com IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma economia registrada ainda.</p>
              <p className="text-sm">Os dados aparecerão conforme a IA detectar e resolver incidentes.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incidente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead className="text-right">Downtime Evitado</TableHead>
                    <TableHead className="text-right">Custo/min</TableHead>
                    <TableHead className="text-right">Economia</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savings.map((saving) => (
                    <TableRow key={saving.id}>
                      <TableCell className="max-w-[200px]">
                        <div className="truncate font-medium">
                          {saving.incident?.title || 'Incidente'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSavingTypeIcon(saving.saving_type)}
                          <span className="text-sm">{getSavingTypeLabel(saving.saving_type)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityVariant(saving.incident?.severity || 'low')}>
                          {saving.incident?.severity || 'low'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {saving.downtime_avoided_minutes} min
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(saving.cost_per_minute, { sourceCurrency: 'USD' }).value}
                      </TableCell>
                      <TableCell className="text-right font-mono text-success font-medium">
                        {formatCurrency(saving.estimated_savings, { sourceCurrency: 'USD' }).value}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(saving.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
