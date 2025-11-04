import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", cost: 2400 },
  { month: "Feb", cost: 1398 },
  { month: "Mar", cost: 3800 },
  { month: "Apr", cost: 3908 },
  { month: "May", cost: 4800 },
  { month: "Jun", cost: 3800 },
];

export const CostChart = () => {
  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Infrastructure Costs</h3>
          <p className="text-sm text-muted-foreground mt-1">Monthly spending analysis</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-card-foreground">$3,800</p>
          <p className="text-xs text-success">↓ 12% vs last month</p>
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
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
            labelStyle={{ color: "hsl(var(--card-foreground))" }}
          />
          <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
