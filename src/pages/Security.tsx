import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const mockAudits = [
  {
    id: "1",
    severity: "critical",
    title: "Exposed Kubernetes Dashboard",
    description: "Dashboard is publicly accessible without authentication",
    cluster: "prod-us-east-1",
    status: "open",
  },
  {
    id: "2",
    severity: "high",
    title: "Outdated Container Images",
    description: "12 containers running images with known vulnerabilities",
    cluster: "prod-asia-1",
    status: "open",
  },
  {
    id: "3",
    severity: "medium",
    title: "Missing Network Policies",
    description: "No network policies configured for production namespace",
    cluster: "staging-eu-west-1",
    status: "resolved",
  },
];

const severityColors = {
  low: "bg-success",
  medium: "bg-warning",
  high: "bg-warning",
  critical: "bg-destructive",
};

const severityIcons = {
  low: CheckCircle,
  medium: AlertTriangle,
  high: AlertCircle,
  critical: XCircle,
};

const Security = () => {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Security Audits</h1>
          <p className="text-muted-foreground mt-1">Monitor security issues across all clusters</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-gradient-card border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Critical</p>
                <h3 className="text-3xl font-bold text-destructive">1</h3>
              </div>
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
          </Card>
          <Card className="p-6 bg-gradient-card border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">High</p>
                <h3 className="text-3xl font-bold text-warning">1</h3>
              </div>
              <AlertCircle className="w-8 h-8 text-warning" />
            </div>
          </Card>
          <Card className="p-6 bg-gradient-card border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Medium</p>
                <h3 className="text-3xl font-bold text-warning">1</h3>
              </div>
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
          </Card>
          <Card className="p-6 bg-gradient-card border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Resolved</p>
                <h3 className="text-3xl font-bold text-success">1</h3>
              </div>
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
          </Card>
        </div>

        <Card className="p-6 bg-card border-border">
          <h3 className="text-lg font-semibold text-card-foreground mb-4">Recent Audits</h3>
          <div className="space-y-4">
            {mockAudits.map((audit) => {
              const Icon = severityIcons[audit.severity as keyof typeof severityIcons];
              return (
                <div
                  key={audit.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${severityColors[audit.severity as keyof typeof severityColors]}/10`}>
                    <Icon className={`w-5 h-5 ${severityColors[audit.severity as keyof typeof severityColors].replace('bg-', 'text-')}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-card-foreground">{audit.title}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {audit.severity}
                      </Badge>
                      <Badge
                        variant={audit.status === "resolved" ? "outline" : "secondary"}
                        className="text-xs"
                      >
                        {audit.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{audit.description}</p>
                    <Badge variant="outline" className="text-xs">
                      {audit.cluster}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Security;
