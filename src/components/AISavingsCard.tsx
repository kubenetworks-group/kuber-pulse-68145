import { Card } from "@/components/ui/card";
import { Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AISavingsCardProps {
  totalSavings: number;
  savingsThisMonth: number;
  savingsByType: {
    downtime_prevention: number;
    resource_optimization: number;
    scale_optimization: number;
  };
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export const AISavingsCard = ({ 
  totalSavings, 
  savingsThisMonth, 
  savingsByType,
  trend 
}: AISavingsCardProps) => {
  const totalByType = 
    savingsByType.downtime_prevention + 
    savingsByType.resource_optimization + 
    savingsByType.scale_optimization;

  const getPercentage = (value: number) => 
    totalByType > 0 ? Math.round((value / totalByType) * 100) : 0;

  return (
    <Card className="p-6 bg-gradient-to-br from-success/10 to-success/5 border-success/20">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-success" />
            <Badge variant="outline" className="border-success/30 text-success">
              AI-Powered Savings
            </Badge>
          </div>
          <h3 className="text-3xl font-bold text-success mb-1">
            ${savingsThisMonth.toFixed(2)}
          </h3>
          <p className="text-sm text-muted-foreground">
            This month • Total: ${totalSavings.toFixed(2)}
          </p>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
            trend.isPositive 
              ? 'bg-success/10 text-success' 
              : 'bg-muted text-muted-foreground'
          }`}>
            {trend.isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{trend.value}%</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Downtime Prevention</span>
            <span className="font-medium text-card-foreground">
              ${savingsByType.downtime_prevention.toFixed(0)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div 
              className="bg-success h-1.5 rounded-full transition-all"
              style={{ width: `${getPercentage(savingsByType.downtime_prevention)}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Resource Optimization</span>
            <span className="font-medium text-card-foreground">
              ${savingsByType.resource_optimization.toFixed(0)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div 
              className="bg-success h-1.5 rounded-full transition-all"
              style={{ width: `${getPercentage(savingsByType.resource_optimization)}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Scale Optimization</span>
            <span className="font-medium text-card-foreground">
              ${savingsByType.scale_optimization.toFixed(0)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div 
              className="bg-success h-1.5 rounded-full transition-all"
              style={{ width: `${getPercentage(savingsByType.scale_optimization)}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
