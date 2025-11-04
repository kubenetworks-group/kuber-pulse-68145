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
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Recent Events
        </h3>
        <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
      </div>
      
      <div className="space-y-3">
        {mockEvents.map((event, index) => {
          const Icon = eventIcons[event.type];
          return (
            <div 
              key={event.id} 
              className="group flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-all duration-200 border border-transparent hover:border-border/50"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`p-2 rounded-lg ${
                event.type === 'success' ? 'bg-success/10' :
                event.type === 'warning' ? 'bg-warning/10' :
                event.type === 'error' ? 'bg-destructive/10' :
                'bg-primary/10'
              }`}>
                <Icon className={`w-4 h-4 ${eventColors[event.type]}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight mb-2">
                  {event.message}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-medium">
                    {event.cluster}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                </div>
              </div>
              
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-xs text-primary hover:text-primary/80">View</button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
