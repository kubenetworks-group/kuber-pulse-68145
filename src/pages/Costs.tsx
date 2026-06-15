import { DashboardLayout } from "@/components/DashboardLayout";
import { CostBreakdownChart } from "@/components/CostBreakdownChart";
import { CostTableView } from "@/components/CostTableView";
import { AISavingsCard } from "@/components/AISavingsCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingDown, TrendingUp, Sparkles, BarChart3, Table as TableIcon, Bot, Package, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";
import { useCluster } from "@/contexts/ClusterContext";
import { useKubecostData } from "@/hooks/useKubecostData";

const Costs = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const { selectedClusterId } = useCluster();
  const kubecost = useKubecostData(selectedClusterId);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [currentMonthCost, setCurrentMonthCost] = useState(0);
  const [lastMonthCost, setLastMonthCost] = useState(0);
  const [savingsThisMonth, setSavingsThisMonth] = useState(0);
  const [totalSavings, setTotalSavings] = useState(0);
  const [savingsByType, setSavingsByType] = useState({
    downtime_prevention: 0,
    resource_optimization: 0,
    scale_optimization: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [clusterCosts, setClusterCosts] = useState<any[]>([]);
  const [aiSavingsDetails, setAiSavingsDetails] = useState<any[]>([]);

  useEffect(() => {
    if (user && selectedClusterId) {
      fetchCostData();
      fetchAISavingsDetails();
    }
  }, [user, selectedClusterId]);

  const fetchAISavingsDetails = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch AI savings for the current month and selected cluster
      const { data: savingsData, error: savingsError } = await supabase
        .from('ai_cost_savings')
        .select('*, ai_incidents!inner(title, description, created_at)')
        .eq('cluster_id', selectedClusterId)
        .gte('created_at', startOfMonth)
        .order('created_at', { ascending: false });

      if (savingsError) {
        console.error('Error fetching AI savings:', savingsError);
        return;
      }

      // Transform the data
      const transformedSavings = savingsData?.map(saving => ({
        id: saving.id,
        type: saving.saving_type,
        title: saving.ai_incidents?.title || 'Ação da IA',
        description: saving.ai_incidents?.description || 'Economia gerada pela IA',
        savings: Number(saving.estimated_savings),
        incidents: 1,
        date: saving.created_at,
      })) || [];

      setAiSavingsDetails(transformedSavings);
    } catch (error) {
      console.error('Error fetching AI savings details:', error);
    }
  };

  const fetchCostData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      // Fetch current month costs for selected cluster
      const { data: currentCosts } = await supabase
        .from('cost_calculations')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .gte('calculation_date', startOfMonth)
        .lte('calculation_date', endOfMonth);

      const currentTotal = currentCosts?.reduce((sum, c) => sum + Number(c.total_cost), 0) || 0;
      setCurrentMonthCost(currentTotal);

      // Fetch last month costs for selected cluster
      const { data: lastCosts } = await supabase
        .from('cost_calculations')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .gte('calculation_date', startOfLastMonth)
        .lte('calculation_date', endOfLastMonth);

      const lastTotal = lastCosts?.reduce((sum, c) => sum + Number(c.total_cost), 0) || 0;
      setLastMonthCost(lastTotal);

      // Fetch savings this month for selected cluster
      const { data: currentSavings } = await supabase
        .from('ai_cost_savings')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      const savingsThisMonthTotal = currentSavings?.reduce((sum, s) => sum + Number(s.estimated_savings), 0) || 0;
      setSavingsThisMonth(savingsThisMonthTotal);

      // Fetch total savings for selected cluster
      const { data: allSavings } = await supabase
        .from('ai_cost_savings')
        .select('*')
        .eq('cluster_id', selectedClusterId);

      const totalSavingsAmount = allSavings?.reduce((sum, s) => sum + Number(s.estimated_savings), 0) || 0;
      setTotalSavings(totalSavingsAmount);

      // Calculate savings by type
      const byType = {
        downtime_prevention: 0,
        resource_optimization: 0,
        scale_optimization: 0
      };

      currentSavings?.forEach(s => {
        if (s.saving_type in byType) {
          byType[s.saving_type as keyof typeof byType] += Number(s.estimated_savings);
        }
      });

      setSavingsByType(byType);

      // Generate chart data (last 6 months)
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          startDate: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
          endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString()
        });
      }

      const generatedChartData = await Promise.all(
        months.map(async ({ month, startDate, endDate }) => {
          const { data: costs } = await supabase
            .from('cost_calculations')
            .select('total_cost')
            .eq('cluster_id', selectedClusterId)
            .gte('calculation_date', startDate)
            .lte('calculation_date', endDate);

          const { data: savings } = await supabase
            .from('ai_cost_savings')
            .select('estimated_savings')
            .eq('cluster_id', selectedClusterId)
            .gte('created_at', startDate)
            .lte('created_at', endDate);

          const cost = costs?.reduce((sum, c) => sum + Number(c.total_cost), 0) || 0;
          const saving = savings?.reduce((sum, s) => sum + Number(s.estimated_savings), 0) || 0;

          return {
            month,
            cost: Number(cost.toFixed(2)),
            savings: Number(saving.toFixed(2)),
            net: Number((cost - saving).toFixed(2))
          };
        })
      );

      setChartData(generatedChartData);

      // Fetch cluster costs
      const { data: clusters } = await supabase
        .from('clusters')
        .select('id, name, monthly_cost');

      const clusterCostsData = clusters?.map(c => ({
        name: c.name,
        cost: Number(c.monthly_cost || 0),
        percentage: currentTotal > 0 ? Math.round((Number(c.monthly_cost || 0) / currentTotal) * 100) : 0
      })) || [];

      setClusterCosts(clusterCostsData);

    } catch (error) {
      console.error('Error fetching cost data:', error);
    } finally {
      setLoading(false);
    }
  };

  const netCost = currentMonthCost - savingsThisMonth;
  const costChange = lastMonthCost > 0 ? ((currentMonthCost - lastMonthCost) / lastMonthCost) * 100 : 0;
  const roi = currentMonthCost > 0 ? (savingsThisMonth / currentMonthCost) * 100 : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-center py-12">{t('common.loading')}</div>
        </div>
      </DashboardLayout>
    );
  }

  const currentMonthFormatted = formatCurrency(currentMonthCost, { sourceCurrency: 'USD' });
  const savingsFormatted = formatCurrency(savingsThisMonth, { sourceCurrency: 'USD' });
  const netCostFormatted = formatCurrency(netCost, { sourceCurrency: 'USD' });

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {t('costs.title')}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t('costs.monthlyAnalysis')}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant={viewMode === 'chart' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('chart')}
              className="gap-2 flex-1 sm:flex-initial"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('costs.chartView')}</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="gap-2 flex-1 sm:flex-initial"
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('costs.tableView')}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="p-6 bg-gradient-card border-border shadow-card hover:shadow-glow transition-all">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('costs.thisMonth')}</p>
                <h3 className="text-3xl font-bold text-card-foreground">{currentMonthFormatted.value}</h3>
                {currentMonthFormatted.converted && currentMonthFormatted.note && (
                  <p className="text-xs text-muted-foreground mt-1">* {currentMonthFormatted.note}</p>
                )}
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {costChange < 0 ? (
                <>
                  <TrendingDown className="w-4 h-4 text-success" />
                  <span className="text-sm text-success font-medium">{Math.abs(costChange).toFixed(1)}% {t('costs.vsLastMonth')}</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive font-medium">{costChange.toFixed(1)}% {t('costs.vsLastMonth')}</span>
                </>
              )}
            </div>
          </Card>

          <AISavingsCard
            totalSavings={totalSavings}
            savingsThisMonth={savingsThisMonth}
            savingsByType={savingsByType}
            trend={{ value: 15, isPositive: true }}
          />

          <Card className="p-6 bg-gradient-card border-border shadow-card hover:shadow-glow transition-all">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('costs.netCost')}</p>
                <h3 className="text-3xl font-bold text-card-foreground">{netCostFormatted.value}</h3>
                {netCostFormatted.converted && netCostFormatted.note && (
                  <p className="text-xs text-muted-foreground mt-1">* {netCostFormatted.note}</p>
                )}
              </div>
              <div className="p-3 rounded-xl bg-accent/10">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{t('costs.aiPoweredSavings')}</p>
          </Card>
        </div>

        {viewMode === 'chart' ? (
          <CostBreakdownChart data={chartData} />
        ) : (
          <CostTableView data={chartData} />
        )}

        {/* AI Savings Details */}
        <Card className="p-6 bg-gradient-card border-border shadow-card mt-6 hover:shadow-glow transition-all">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-gradient-success">
              <Sparkles className="w-5 h-5 text-success-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">{t('costs.aiSavingsDetails')}</h3>
              <p className="text-sm text-muted-foreground">Ações automáticas da IA que geraram economia</p>
            </div>
          </div>

          <div className="space-y-4">
            {aiSavingsDetails.map((saving) => {
              const savingFormatted = formatCurrency(saving.savings, { sourceCurrency: 'USD' });
              const typeColors = {
                downtime_prevention: 'bg-destructive/10 text-destructive border-destructive/20',
                resource_optimization: 'bg-primary/10 text-primary border-primary/20',
                scale_optimization: 'bg-accent/10 text-accent border-accent/20',
                storage_optimization: 'bg-warning/10 text-warning border-warning/20',
              };

              return (
                <div
                  key={saving.id}
                  className="p-4 rounded-lg border bg-gradient-to-r from-background to-muted/20 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${typeColors[saving.type as keyof typeof typeColors]}`}>
                          {saving.type.replace('_', ' ').toUpperCase()}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(saving.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <h4 className="font-semibold text-card-foreground mb-1">{saving.title}</h4>
                      <p className="text-sm text-muted-foreground">{saving.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-success">{savingFormatted.value}</div>
                      {savingFormatted.converted && savingFormatted.note && (
                        <p className="text-xs text-muted-foreground">* {savingFormatted.note}</p>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {saving.incidents} {saving.incidents === 1 ? 'incidente' : 'incidentes'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingDown className="w-3 h-3" />
                    <span>Economia gerada automaticamente pela IA</span>
                  </div>
                </div>
              );
            })}
          </div>

          {aiSavingsDetails.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma economia registrada ainda</p>
              <p className="text-xs mt-1">A IA começará a gerar economias automaticamente</p>
            </div>
          )}
        </Card>

        {/* ── KubeCost FinOps Section ── */}
        <div className="mt-6">
          {/* Status banner */}
          {!kubecost.loading && !kubecost.installed && (
            <Card className="p-4 flex items-center justify-between gap-4 border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">KubeCost não instalado</p>
                  <p className="text-xs text-muted-foreground">Instale o KubeCost para ver alocação de custo real por namespace, deployment e pod.</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                onClick={async () => {
                  if (!selectedClusterId || !user) return;
                  await supabase.from("agent_commands").insert({
                    cluster_id: selectedClusterId,
                    user_id: user.id,
                    command_type: "deploy_kubecost",
                    command_params: {},
                    status: "pending",
                  });
                }}
              >
                <Zap className="w-3.5 h-3.5 mr-1" />
                Instalar KubeCost
              </Button>
            </Card>
          )}

          {kubecost.installed && (
            <>
              {/* Connected banner */}
              <div className="flex items-center gap-2 mb-4 text-sm text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">KubeCost conectado</span>
                <span className="text-muted-foreground">— dados de custo real por workload</span>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Custo Total Hoje</p>
                  <p className="text-2xl font-bold font-mono">{formatCurrency(kubecost.summary.total_cost)}</p>
                  <p className="text-xs text-muted-foreground mt-1">≈ {formatCurrency(kubecost.summary.total_cost * 30)}/mês</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Custo Idle (Desperdício)</p>
                  <p className="text-2xl font-bold font-mono text-amber-500">{formatCurrency(kubecost.summary.idle_cost)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kubecost.summary.total_cost > 0
                      ? `${Math.round((kubecost.summary.idle_cost / kubecost.summary.total_cost) * 100)}% do total`
                      : "—"}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Eficiência Geral</p>
                  <p className={`text-2xl font-bold font-mono ${
                    (kubecost.summary.efficiency ?? 0) >= 70 ? "text-emerald-500"
                    : (kubecost.summary.efficiency ?? 0) >= 40 ? "text-amber-500"
                    : "text-destructive"
                  }`}>
                    {kubecost.summary.efficiency !== null ? `${kubecost.summary.efficiency}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">utilização real vs. alocado</p>
                </Card>
              </div>

              {/* Namespace breakdown table */}
              {kubecost.byNamespace.length > 0 && (
                <Card className="p-4 mb-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Custo por Namespace (hoje)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 pr-4">Namespace</th>
                          <th className="text-right py-2 px-2">CPU</th>
                          <th className="text-right py-2 px-2">Memória</th>
                          <th className="text-right py-2 px-2">Storage</th>
                          <th className="text-right py-2 px-2">Rede</th>
                          <th className="text-right py-2 px-2">Total</th>
                          <th className="text-right py-2 pl-2">Eficiência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kubecost.byNamespace.slice(0, 15).map(ns => (
                          <tr key={ns.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 pr-4 font-mono">{ns.resource_name}</td>
                            <td className="text-right py-2 px-2 text-muted-foreground">{formatCurrency(ns.cpu_cost)}</td>
                            <td className="text-right py-2 px-2 text-muted-foreground">{formatCurrency(ns.memory_cost)}</td>
                            <td className="text-right py-2 px-2 text-muted-foreground">{formatCurrency(ns.pv_cost)}</td>
                            <td className="text-right py-2 px-2 text-muted-foreground">{formatCurrency(ns.network_cost)}</td>
                            <td className="text-right py-2 px-2 font-medium">{formatCurrency(ns.total_cost)}</td>
                            <td className="text-right py-2 pl-2">
                              {ns.efficiency !== null ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.min(ns.efficiency, 100)}%`,
                                        background: ns.efficiency >= 70 ? "#00E5A0" : ns.efficiency >= 40 ? "#F5C518" : "#FF2D2D",
                                      }}
                                    />
                                  </div>
                                  <span className={
                                    ns.efficiency >= 70 ? "text-emerald-500" : ns.efficiency >= 40 ? "text-amber-500" : "text-destructive"
                                  }>{ns.efficiency}%</span>
                                </div>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Top 5 wasteful workloads */}
              {kubecost.byDeployment.filter(d => (d.efficiency ?? 100) < 40 && d.total_cost > 0.01).length > 0 && (
                <Card className="p-4 border-amber-500/30 bg-amber-500/5">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    Top Workloads com Baixa Eficiência (&lt;40%)
                  </h3>
                  <div className="flex flex-col gap-2">
                    {kubecost.byDeployment
                      .filter(d => (d.efficiency ?? 100) < 40 && d.total_cost > 0.01)
                      .slice(0, 5)
                      .map(d => (
                        <div key={d.id} className="flex items-center justify-between gap-4 p-2.5 rounded-lg bg-background border border-border/50">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-medium">{d.resource_name}</span>
                            <span className="text-[10px] text-muted-foreground">{d.namespace}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-destructive font-medium">{d.efficiency ?? "?"}% eficiência</span>
                            <span className="font-mono">{formatCurrency(d.total_cost)}/dia</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Costs;
