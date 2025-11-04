import { DashboardLayout } from "@/components/DashboardLayout";
import { CostBreakdownChart } from "@/components/CostBreakdownChart";
import { AISavingsCard } from "@/components/AISavingsCard";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingDown, TrendingUp, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Costs = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (user) {
      fetchCostData();
    }
  }, [user]);

  const fetchCostData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      // Fetch current month costs
      const { data: currentCosts } = await supabase
        .from('cost_calculations')
        .select('*')
        .gte('calculation_date', startOfMonth)
        .lte('calculation_date', endOfMonth);

      const currentTotal = currentCosts?.reduce((sum, c) => sum + Number(c.total_cost), 0) || 0;
      setCurrentMonthCost(currentTotal);

      // Fetch last month costs
      const { data: lastCosts } = await supabase
        .from('cost_calculations')
        .select('*')
        .gte('calculation_date', startOfLastMonth)
        .lte('calculation_date', endOfLastMonth);

      const lastTotal = lastCosts?.reduce((sum, c) => sum + Number(c.total_cost), 0) || 0;
      setLastMonthCost(lastTotal);

      // Fetch savings this month
      const { data: currentSavings } = await supabase
        .from('ai_cost_savings')
        .select('*')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      const savingsThisMonthTotal = currentSavings?.reduce((sum, s) => sum + Number(s.estimated_savings), 0) || 0;
      setSavingsThisMonth(savingsThisMonthTotal);

      // Fetch total savings
      const { data: allSavings } = await supabase
        .from('ai_cost_savings')
        .select('*');

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
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      const generatedChartData = months.map((month, index) => {
        const baseCost = 3500 + Math.random() * 1000;
        const savings = 200 + Math.random() * 400;
        return {
          month,
          cost: Number(baseCost.toFixed(2)),
          savings: Number(savings.toFixed(2)),
          net: Number((baseCost - savings).toFixed(2))
        };
      });

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
          <div className="text-center py-12">Loading cost data...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Cost Analysis</h1>
          <p className="text-muted-foreground mt-1">Monitor and optimize infrastructure spending</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-gradient-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Month</p>
                <h3 className="text-3xl font-bold text-card-foreground">${currentMonthCost.toFixed(2)}</h3>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {costChange < 0 ? (
                <>
                  <TrendingDown className="w-4 h-4 text-success" />
                  <span className="text-sm text-success font-medium">{Math.abs(costChange).toFixed(1)}% decrease</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive font-medium">{costChange.toFixed(1)}% increase</span>
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

          <Card className="p-6 bg-gradient-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Net Cost</p>
                <h3 className="text-3xl font-bold text-card-foreground">${netCost.toFixed(2)}</h3>
              </div>
              <div className="p-3 rounded-lg bg-accent/10">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">After AI savings</p>
          </Card>

          <Card className="p-6 bg-gradient-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">ROI</p>
                <h3 className="text-3xl font-bold text-success">{roi.toFixed(1)}%</h3>
              </div>
              <div className="p-3 rounded-lg bg-success/10">
                <Sparkles className="w-6 h-6 text-success" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">AI savings impact</p>
          </Card>
        </div>

        <CostBreakdownChart data={chartData} />

        <Card className="p-6 bg-card border-border mt-6">
          <h3 className="text-lg font-semibold text-card-foreground mb-4">Cost by Cluster</h3>
          <div className="space-y-4">
            {clusterCosts.length > 0 ? (
              clusterCosts.map((cluster) => (
                <div key={cluster.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-card-foreground font-medium">{cluster.name}</span>
                    <span className="text-muted-foreground">${cluster.cost.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${cluster.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">No cluster cost data available</p>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Costs;
