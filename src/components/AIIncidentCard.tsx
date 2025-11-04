import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Flame, AlertCircle, Info, Bot, CheckCircle, Clock, Play, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Incident = {
  id: string;
  cluster_id: string;
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  ai_analysis: {
    root_cause: string;
    impact: string;
    recommendation: string;
    confidence?: number;
  };
  auto_heal_action: string | null;
  action_taken: boolean;
  action_result: {
    success: boolean;
    details: string;
    timestamp: string;
  } | null;
  created_at: string;
  resolved_at: string | null;
};

interface AIIncidentCardProps {
  incident: Incident;
  clusterName?: string;
  savings?: {
    estimated_savings: number;
    saving_type: string;
    downtime_avoided_minutes: number;
  } | null;
  onExecuteAction?: (incidentId: string) => void;
}

const severityConfig = {
  critical: {
    icon: Flame,
    gradient: "from-red-500/20 to-red-600/20",
    border: "border-red-500/50",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    iconColor: "text-red-500"
  },
  high: {
    icon: AlertTriangle,
    gradient: "from-orange-500/20 to-orange-600/20",
    border: "border-orange-500/50",
    badge: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    iconColor: "text-orange-500"
  },
  medium: {
    icon: AlertCircle,
    gradient: "from-yellow-500/20 to-yellow-600/20",
    border: "border-yellow-500/50",
    badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    iconColor: "text-yellow-500"
  },
  low: {
    icon: Info,
    gradient: "from-blue-500/20 to-blue-600/20",
    border: "border-blue-500/50",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    iconColor: "text-blue-500"
  }
};

const actionTypeLabels: Record<string, string> = {
  restart_pod: "Restart Pod",
  scale_up: "Scale Up",
  scale_down: "Scale Down",
  clear_cache: "Clear Cache",
  rollback_deployment: "Rollback Deployment",
  rotate_certificate: "Rotate Certificate",
  optimize_resources: "Optimize Resources"
};

export const AIIncidentCard = ({ incident, clusterName, savings, onExecuteAction }: AIIncidentCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[incident.severity];
  const Icon = config.icon;
  
  const getStatusInfo = () => {
    if (incident.resolved_at) {
      return { icon: CheckCircle, label: "Resolved", color: "text-green-400" };
    }
    if (incident.action_taken) {
      return { icon: Clock, label: "Action Taken", color: "text-blue-400" };
    }
    return { icon: Clock, label: "Pending", color: "text-yellow-400" };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  return (
    <Card className={cn(
      "overflow-hidden border transition-all hover:shadow-lg",
      config.border,
      "bg-gradient-to-br",
      config.gradient
    )}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className={cn("p-3 rounded-lg bg-background/50", config.iconColor)}>
            <Icon className="h-6 w-6" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" className={config.badge}>
                {incident.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="bg-background/50">
                {incident.incident_type.replace(/_/g, ' ')}
              </Badge>
              {clusterName && (
                <Badge variant="outline" className="bg-background/50">
                  {clusterName}
                </Badge>
              )}
              <div className="flex items-center gap-1 text-sm text-muted-foreground ml-auto">
                <StatusIcon className={cn("h-4 w-4", status.color)} />
                <span>{status.label}</span>
              </div>
            </div>
            
            <h3 className="font-semibold text-lg mb-2">{incident.title}</h3>
            <p className="text-muted-foreground text-sm">{incident.description}</p>
          </div>
        </div>

        {/* AI Analysis - Expandable */}
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full justify-start gap-2 text-sm"
          >
            <Bot className="h-4 w-4" />
            AI Analysis {incident.ai_analysis.confidence && `(${Math.round(incident.ai_analysis.confidence * 100)}% confidence)`}
          </Button>
          
          {expanded && (
            <div className="pl-4 space-y-3 text-sm animate-fade-in border-l-2 border-primary/30">
              <div>
                <span className="font-medium text-primary">Root Cause:</span>
                <p className="text-muted-foreground mt-1">{incident.ai_analysis.root_cause}</p>
              </div>
              <div>
                <span className="font-medium text-orange-400">Impact:</span>
                <p className="text-muted-foreground mt-1">{incident.ai_analysis.impact}</p>
              </div>
              <div>
                <span className="font-medium text-green-400">Recommendation:</span>
                <p className="text-muted-foreground mt-1">{incident.ai_analysis.recommendation}</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Section */}
        {incident.auto_heal_action && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Suggested Action:</span>
                <Badge variant="outline" className="bg-primary/10">
                  {actionTypeLabels[incident.auto_heal_action] || incident.auto_heal_action}
                </Badge>
              </div>
              
              {!incident.action_taken && onExecuteAction && (
                <Button 
                  size="sm" 
                  onClick={() => onExecuteAction(incident.id)}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Execute
                </Button>
              )}
            </div>

            {/* Action Result */}
            {incident.action_result && (
              <div className="mt-3 p-3 rounded-lg bg-background/80 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-medium">Action Completed</span>
                </div>
                <p className="text-sm text-muted-foreground">{incident.action_result.details}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(incident.action_result.timestamp).toLocaleString()}
                </p>
              </div>
            )}

            {/* AI Savings */}
            {savings && incident.resolved_at && (
              <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium text-success">AI Cost Savings</span>
                </div>
                <p className="text-2xl font-bold text-success">
                  ${savings.estimated_savings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {savings.downtime_avoided_minutes > 0 
                    ? `${savings.downtime_avoided_minutes} minutes of downtime avoided`
                    : `Optimized via ${savings.saving_type.replace(/_/g, ' ')}`
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Detected: {new Date(incident.created_at).toLocaleString()}</span>
            {incident.resolved_at && (
              <span>Resolved: {new Date(incident.resolved_at).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
