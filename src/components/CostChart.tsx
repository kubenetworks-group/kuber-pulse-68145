import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { ArrowRight } from "lucide-react";

export const CostChart = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedClusterId } = useCluster();
  const [currentMonthCost, setCurrentMonthCost] = useState(0);
  const [savingsThisMonth, setSavingsThisMonth] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (user && selectedClusterId) {
      fetchCostData();
    }
  }, [user, selectedClusterId]);

  const fetchCostData = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // Fetch current month costs for selected cluster
      const { data: currentCosts } = await supabase
        .from('cost_calculations')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .gte('calculation_date', startOfMonth)
        .lte('calculation_date', endOfMonth);

      const currentTotal = currentCosts?.reduce((sum, c) => sum + Number(c.total_cost), 0) || 0;
      setCurrentMonthCost(currentTotal);

      // Fetch savings this month for selected cluster
      const { data: currentSavings } = await supabase
        .from('ai_cost_savings')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      const savingsTotal = currentSavings?.reduce((sum, s) => sum + Number(s.estimated_savings), 0) || 0;
      setSavingsThisMonth(savingsTotal);

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

          const cost = costs?.reduce((sum, c) => sum + Number(c.total_cost), 0) || 0;

          return { month, cost: Number(cost.toFixed(2)) };
        })
      );

      setChartData(generatedChartData);
    } catch (error) {
      console.error('Error fetching cost data:', error);
    }
  };

  const netCost = currentMonthCost - savingsThisMonth;
  const savingsPercentage = currentMonthCost > 0 ? ((savingsThisMonth / currentMonthCost) * 100) : 0;

  return (
    <Card 
      className="p-6 bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/50 transition-all duration-300 cursor-pointer group"
      onClick={() => navigate('/costs')}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-2">
            {t('costs.infrastructureCosts')}
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{t('costs.monthlyAnalysis')}</p>
        </div>
        <div className="text-right">
          <div className="px-4 py-2 rounded-lg bg-gradient-to-br from-card to-card/50 border border-border mb-2">
            <p className="text-xs text-muted-foreground mb-1">{t('costs.providerCost')}</p>
            <p className="text-xl font-bold text-foreground">
              {formatCurrency(currentMonthCost, { sourceCurrency: 'USD' }).value}
            </p>
          </div>
          <div className="px-4 py-2 rounded-lg bg-gradient-to-br from-success/10 to-success/5">
            <p className="text-xs text-muted-foreground mb-1">{t('costs.netCost')}</p>
            <p className="text-xl font-bold text-success">
              {formatCurrency(netCost, { sourceCurrency: 'USD' }).value}
            </p>
            <p className="text-xs text-success font-semibold flex items-center justify-end gap-1 mt-1">
              <span>↓ {savingsPercentage.toFixed(1)}%</span>
              <span className="text-muted-foreground">{t('costs.withAI')}</span>
            </p>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData}>
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis 
            dataKey="month" 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => formatCurrency(value, { sourceCurrency: 'USD', showConversion: false }).value}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            formatter={(value: number) => [formatCurrency(value, { sourceCurrency: 'USD' }).value, 'Cost']}
            cursor={{ fill: 'hsl(var(--primary) / 0.1)' }}
          />
          <Bar 
            dataKey="cost" 
            fill="url(#costGradient)" 
            radius={[8, 8, 0, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
