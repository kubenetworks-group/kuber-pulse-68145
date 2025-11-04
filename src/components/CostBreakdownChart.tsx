import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";

interface CostBreakdownChartProps {
  data: Array<{
    month: string;
    cost: number;
    savings: number;
    net: number;
  }>;
}

export const CostBreakdownChart = ({ data }: CostBreakdownChartProps) => {
  return (
    <Card className="p-6 bg-card border-border">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-card-foreground">Cost vs. AI Savings</h3>
        <p className="text-sm text-muted-foreground mt-1">Monthly infrastructure costs and AI-driven savings</p>
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
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
            labelStyle={{ color: "hsl(var(--card-foreground))" }}
            formatter={(value: number) => `$${value.toFixed(2)}`}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            iconType="circle"
          />
          <Bar 
            dataKey="cost" 
            fill="hsl(var(--primary))" 
            radius={[8, 8, 0, 0]} 
            name="Infrastructure Cost"
          />
          <Bar 
            dataKey="savings" 
            fill="hsl(var(--success))" 
            radius={[8, 8, 0, 0]} 
            name="AI Savings"
          />
          <Line 
            type="monotone" 
            dataKey="net" 
            stroke="hsl(var(--accent))" 
            strokeWidth={2}
            dot={{ fill: "hsl(var(--accent))", r: 4 }}
            name="Net Cost"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
};
