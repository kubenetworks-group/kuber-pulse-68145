import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";

interface CostBreakdownChartProps {
  data: Array<{
    month: string;
    cost: number;
    savings: number;
    net: number;
  }>;
}

export const CostBreakdownChart = ({ data }: CostBreakdownChartProps) => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();

  return (
    <Card className="p-6 bg-card border-border shadow-card hover:shadow-glow transition-all">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-card-foreground">{t('costs.costVsSavings')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('costs.monthlyCostsAndSavings')}</p>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="month" 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => formatCurrency(value, { sourceCurrency: 'USD', showConversion: false }).value}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
            labelStyle={{ color: "hsl(var(--card-foreground))" }}
            formatter={(value: number) => formatCurrency(value, { sourceCurrency: 'USD' }).value}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            iconType="circle"
          />
          <Bar 
            dataKey="cost" 
            fill="hsl(var(--primary))" 
            radius={[8, 8, 0, 0]} 
            name={t('costs.infrastructureCost')}
          />
          <Bar 
            dataKey="savings" 
            fill="hsl(var(--success))" 
            radius={[8, 8, 0, 0]} 
            name={t('costs.aiSavings')}
          />
          <Line 
            type="monotone" 
            dataKey="net" 
            stroke="hsl(var(--accent))" 
            strokeWidth={2}
            dot={{ fill: "hsl(var(--accent))", r: 4 }}
            name={t('costs.netCost')}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
};
