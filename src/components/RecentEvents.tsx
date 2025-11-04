import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

interface Event {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  cluster: string;
  timestamp: string;
}

const mockEvents: Event[] = [
  {
    id: "1",
    type: "success",
    message: "Auto-scaling triggered on production cluster",
    cluster: "prod-us-east-1",
    timestamp: "2 minutes ago",
  },
  {
    id: "2",
    type: "warning",
    message: "High memory usage detected",
    cluster: "staging-eu-west-1",
    timestamp: "15 minutes ago",
  },
  {
    id: "3",
    type: "info",
    message: "Backup completed successfully",
    cluster: "prod-asia-1",
    timestamp: "1 hour ago",
  },
  {
    id: "4",
    type: "error",
    message: "Pod restart loop detected",
    cluster: "dev-us-west-2",
    timestamp: "2 hours ago",
  },
];

const eventIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const eventColors = {
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
};

export const RecentEvents = () => {
  return (
    <Card className="p-6 bg-card border-border">
      <h3 className="text-lg font-semibold text-card-foreground mb-4">Recent Events</h3>
      <div className="space-y-4">
        {mockEvents.map((event) => {
          const Icon = eventIcons[event.type];
          return (
            <div key={event.id} className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0">
              <Icon className={`w-5 h-5 mt-0.5 ${eventColors[event.type]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-card-foreground">{event.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {event.cluster}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
