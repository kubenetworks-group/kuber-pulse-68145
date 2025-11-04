import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";

const data = [
  { month: "Jan", cost: 2400 },
  { month: "Feb", cost: 1398 },
  { month: "Mar", cost: 3800 },
  { month: "Apr", cost: 3908 },
  { month: "May", cost: 4800 },
  { month: "Jun", cost: 3800 },
];

export const CostChart = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">{t('costs.infrastructureCosts')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('costs.monthlyAnalysis')}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-card-foreground">{formatCurrency(3800, { sourceCurrency: 'USD' }).value}</p>
          <p className="text-xs text-success">↓ 12% {t('costs.vsLastMonth')}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
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
          <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
