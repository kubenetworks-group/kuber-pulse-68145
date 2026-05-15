import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, MemoryStick } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface NamespaceUsage {
  namespace: string;
  cpuPercent: number;
  memoryPercent: number;
  podCount: number;
}

interface ResourceUsageChartsProps {
  namespaceUsage: NamespaceUsage[];
  loading: boolean;
  hasResourceData?: boolean;
}

const getBarColor = (value: number) => {
  if (value >= 90) return "hsl(0, 84%, 60%)";
  if (value >= 70) return "hsl(45, 93%, 47%)";
  return "hsl(142, 76%, 36%)";
};

export const ResourceUsageCharts = ({ namespaceUsage, loading, hasResourceData = true }: ResourceUsageChartsProps) => {
  const cpuLabel = hasResourceData ? "CPU por Namespace" : "Pods por Namespace (sem requests definidos)";
  const memLabel = hasResourceData ? "Memória por Namespace" : "Pods por Namespace (distribuição)";
  const cpuTooltip = hasResourceData ? "CPU (share de requests)" : "Pods (%)";
  const memTooltip = hasResourceData ? "Memória (share de requests)" : "Pods (%)";

  if (loading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="h-64 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* CPU Chart */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-orange-400" />
            {cpuLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {namespaceUsage.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              Sem dados de uso
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={namespaceUsage.slice(0, 8)} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis
                    dataKey="namespace"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value}%`, cpuTooltip]}
                  />
                  <Bar dataKey="cpuPercent" radius={[0, 4, 4, 0]}>
                    {namespaceUsage.slice(0, 8).map((entry, i) => (
                      <Cell key={i} fill={getBarColor(entry.cpuPercent)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memory Chart */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MemoryStick className="w-4 h-4 text-violet-400" />
            {memLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {namespaceUsage.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              Sem dados de uso
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={namespaceUsage.slice(0, 8)} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis
                    dataKey="namespace"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value}%`, memTooltip]}
                  />
                  <Bar dataKey="memoryPercent" radius={[0, 4, 4, 0]}>
                    {namespaceUsage.slice(0, 8).map((entry, i) => (
                      <Cell key={i} fill={getBarColor(entry.memoryPercent)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
