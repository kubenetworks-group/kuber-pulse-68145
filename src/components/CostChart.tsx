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
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t('costs.infrastructureCosts')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{t('costs.monthlyAnalysis')}</p>
        </div>
        <div className="text-right px-4 py-2 rounded-lg bg-gradient-to-br from-success/10 to-success/5">
          <p className="text-2xl font-bold text-foreground">{formatCurrency(3800, { sourceCurrency: 'USD' }).value}</p>
          <p className="text-xs text-success font-semibold flex items-center justify-end gap-1">
            <span>↓ 12%</span>
            <span className="text-muted-foreground">{t('costs.vsLastMonth')}</span>
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
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
