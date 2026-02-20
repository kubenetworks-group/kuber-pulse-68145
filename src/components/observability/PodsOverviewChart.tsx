import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Box, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface PodData {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  cpu: string;
  memory: string;
  node: string;
}

interface PodsOverviewChartProps {
  pods: PodData[];
  loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Running: "hsl(142, 76%, 36%)",
  Pending: "hsl(45, 93%, 47%)",
  Failed: "hsl(0, 84%, 60%)",
  Succeeded: "hsl(217, 91%, 60%)",
  Unknown: "hsl(0, 0%, 45%)",
  CrashLoopBackOff: "hsl(0, 84%, 40%)",
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "Running": return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
    case "Pending": return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
    case "Failed":
    case "CrashLoopBackOff": return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    default: return <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

export const PodsOverviewChart = ({ pods, loading }: PodsOverviewChartProps) => {
  const statusCounts = pods.reduce((acc, pod) => {
    acc[pod.status] = (acc[pod.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name] || STATUS_COLORS.Unknown,
  }));

  const totalPods = pods.length;
  const runningPods = statusCounts["Running"] || 0;
  const healthPercentage = totalPods > 0 ? Math.round((runningPods / totalPods) * 100) : 0;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Box className="w-4 h-4 text-blue-400" />
            Pods
          </CardTitle>
          <Badge
            variant={healthPercentage >= 90 ? "default" : healthPercentage >= 70 ? "secondary" : "destructive"}
            className="text-xs"
          >
            {healthPercentage}% saudáveis
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : pods.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Nenhum pod encontrado
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {pods.slice(0, 15).map((pod, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <StatusIcon status={pod.status} />
                    <span className="truncate font-mono text-foreground">{pod.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      {pod.namespace}
                    </Badge>
                    {pod.restarts > 0 && (
                      <span className="text-orange-400 text-[10px]">
                        {pod.restarts}x
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {pods.length > 15 && (
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  +{pods.length - 15} pods
                </p>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          <span>Total: {totalPods} pods</span>
          <span>Running: {runningPods}</span>
          <span>Restarts: {pods.reduce((a, p) => a + p.restarts, 0)}</span>
        </div>
      </CardContent>
    </Card>
  );
};
