import { DashboardLayout } from "@/components/DashboardLayout";
import { CostBreakdownChart } from "@/components/CostBreakdownChart";
import { CostTableView } from "@/components/CostTableView";
import { AISavingsCard } from "@/components/AISavingsCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingDown, TrendingUp, Sparkles, BarChart3, Table as TableIcon, Bot } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";
import { useCluster } from "@/contexts/ClusterContext";

const Costs = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const { selectedClusterId } = useCluster();
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

        <Card className="p-6 bg-card border-border shadow-card mt-6 hover:shadow-glow transition-all">
          <h3 className="text-lg font-semibold text-card-foreground mb-4">{t('clusters.monthlyCost')}</h3>
          <div className="space-y-4">
            {clusterCosts.length > 0 ? (
              clusterCosts.map((cluster) => {
                const clusterCostFormatted = formatCurrency(cluster.cost, { sourceCurrency: 'USD' });
                return (
                  <div key={cluster.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-card-foreground font-medium">{cluster.name}</span>
                      <div className="text-right">
                        <span className="text-muted-foreground">{clusterCostFormatted.value}</span>
                        {clusterCostFormatted.converted && clusterCostFormatted.note && (
                          <p className="text-xs text-muted-foreground">* {clusterCostFormatted.note}</p>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${cluster.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-4">{t('clusters.noclusters')}</p>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Costs;
