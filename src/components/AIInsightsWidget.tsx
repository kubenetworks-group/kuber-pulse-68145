import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

type Incident = {
  id: string;
  severity: string;
  title: string;
  created_at: string;
  action_taken: boolean;
};

interface AIInsightsWidgetProps {
  recentIncidents: Incident[];
}

export const AIInsightsWidget = ({ recentIncidents }: AIInsightsWidgetProps) => {
  const topIncidents = recentIncidents.slice(0, 3);
  const actionsToday = recentIncidents.filter(i => {
    const createdToday = new Date(i.created_at).toDateString() === new Date().toDateString();
    return createdToday && i.action_taken;
  }).length;

  return (
    <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
      {/* Animated background effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:scale-110 transition-transform duration-300">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              AI Insights
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
              {actionsToday} auto-healing actions today
            </p>
          </div>
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
        </div>

        {topIncidents.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-lg bg-gradient-to-br from-success/5 to-success/10 border border-success/20">
            <div className="w-12 h-12 rounded-full bg-success/20 mx-auto mb-3 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-success" />
            </div>
            <p className="text-sm font-medium text-foreground">All systems healthy!</p>
            <p className="text-xs text-muted-foreground mt-1">No incidents detected</p>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {topIncidents.map((incident, index) => (
              <div
                key={incident.id}
                className="p-4 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 hover:bg-card hover:border-border transition-all duration-200 hover:scale-[1.02] cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-3">
                  <Badge
                    variant="outline"
                    className={`
                      ${incident.severity === 'critical' ? 'bg-destructive/20 text-destructive border-destructive/30' : ''}
                      ${incident.severity === 'high' ? 'bg-warning/20 text-warning border-warning/30' : ''}
                      ${incident.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30' : ''}
                      font-semibold
                    `}
                  >
                    {incident.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{incident.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                  {incident.action_taken && (
                    <Badge className="bg-success/20 text-success border-success/30 text-xs font-semibold">
                      ✓ Fixed
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Link to="/ai-monitor">
          <Button variant="outline" className="w-full gap-2 group/btn hover:bg-primary/10 hover:border-primary/50">
            <span>View All Incidents</span>
            <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>
    </Card>
  );
};
