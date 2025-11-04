import { DashboardLayout } from "@/components/DashboardLayout";
import { CostChart } from "@/components/CostChart";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";

const Costs = () => {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Cost Analysis</h1>
          <p className="text-muted-foreground mt-1">Monitor and optimize infrastructure spending</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Month</p>
                <h3 className="text-3xl font-bold text-card-foreground">$3,800</h3>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <TrendingDown className="w-4 h-4 text-success" />
              <span className="text-sm text-success font-medium">12% decrease</span>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Last Month</p>
                <h3 className="text-3xl font-bold text-card-foreground">$4,320</h3>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <DollarSign className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-destructive" />
              <span className="text-sm text-destructive font-medium">8% increase</span>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Forecast</p>
                <h3 className="text-3xl font-bold text-card-foreground">$3,650</h3>
              </div>
              <div className="p-3 rounded-lg bg-success/10">
                <DollarSign className="w-6 h-6 text-success" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Based on current usage</p>
          </Card>
        </div>

        <CostChart />

        <Card className="p-6 bg-card border-border mt-6">
          <h3 className="text-lg font-semibold text-card-foreground mb-4">Cost by Cluster</h3>
          <div className="space-y-4">
            {[
              { name: "prod-us-east-1", cost: 1450, percentage: 38 },
              { name: "prod-asia-1", cost: 1200, percentage: 32 },
              { name: "staging-eu-west-1", cost: 850, percentage: 22 },
              { name: "dev-us-west-2", cost: 300, percentage: 8 },
            ].map((cluster) => (
              <div key={cluster.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-card-foreground font-medium">{cluster.name}</span>
                  <span className="text-muted-foreground">${cluster.cost}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${cluster.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Costs;
