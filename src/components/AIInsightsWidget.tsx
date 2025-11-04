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
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/20">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">AI Insights</h3>
          <p className="text-sm text-muted-foreground">
            {actionsToday} auto-healing actions executed today
          </p>
        </div>
        <Sparkles className="h-5 w-5 text-primary animate-pulse" />
      </div>

      {topIncidents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">All systems healthy! No incidents detected.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {topIncidents.map((incident) => (
            <div
              key={incident.id}
              className="p-3 rounded-lg bg-background/80 border border-border/50 hover:bg-background transition-colors"
            >
              <div className="flex items-start gap-3">
                <Badge
                  variant="outline"
                  className={
                    incident.severity === 'critical'
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : incident.severity === 'high'
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  }
                >
                  {incident.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{incident.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(incident.created_at).toLocaleString()}
                  </p>
                </div>
                {incident.action_taken && (
                  <Badge variant="outline" className="bg-green-500/20 text-green-400 text-xs">
                    Fixed
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link to="/ai-monitor">
        <Button variant="outline" className="w-full gap-2">
          View All Incidents
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </Card>
  );
};
