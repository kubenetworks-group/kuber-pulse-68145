import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  User,
  Lock,
  Database,
  Network,
  FileWarning
} from "lucide-react";
import { cn } from "@/lib/utils";

type ScanResult = {
  id: string;
  category: 'security' | 'compliance' | 'configuration' | 'vulnerability' | 'network';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'passed';
  title: string;
  description: string;
  recommendation: string;
  affected_resources: string[];
  needs_specialist: boolean;
};

interface SecurityScanCardProps {
  result: ScanResult;
}

const categoryIcons = {
  security: Lock,
  compliance: Shield,
  configuration: Database,
  vulnerability: FileWarning,
  network: Network,
};

const severityConfig = {
  critical: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/20",
  },
  high: {
    icon: AlertTriangle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  medium: {
    icon: AlertTriangle,
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
  },
  low: {
    icon: AlertTriangle,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  passed: {
    icon: CheckCircle,
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20",
  },
};

export const SecurityScanCard = ({ result }: SecurityScanCardProps) => {
  const CategoryIcon = categoryIcons[result.category];
  const config = severityConfig[result.severity];
  const SeverityIcon = config.icon;

  return (
    <Card className={cn("border-2 transition-all hover:shadow-lg", config.borderColor)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <CategoryIcon className={cn("h-5 w-5", config.color)} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg">{result.title}</CardTitle>
                <Badge 
                  variant={result.severity === 'passed' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {result.severity.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {result.category}
                </Badge>
              </div>
              <CardDescription className="text-sm">
                {result.description}
              </CardDescription>
            </div>
          </div>
          <SeverityIcon className={cn("h-6 w-6 flex-shrink-0", config.color)} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Affected Resources */}
        {result.affected_resources.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recursos Afetados:</p>
            <div className="flex flex-wrap gap-2">
              {result.affected_resources.map((resource, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {resource}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* AI Recommendation */}
        {result.severity !== 'passed' && (
          <div className={cn("p-4 rounded-lg border", config.bgColor, config.borderColor)}>
            <div className="flex items-start gap-2">
              <Shield className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.color)} />
              <div>
                <p className="text-sm font-medium mb-1">Recomendação da IA:</p>
                <p className="text-sm text-muted-foreground">{result.recommendation}</p>
              </div>
            </div>
          </div>
        )}

        {/* Specialist Alert */}
        {result.needs_specialist && (
          <div className="bg-gradient-to-r from-warning/10 to-destructive/10 border-2 border-warning/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm mb-1 text-warning">
                  ⚠️ Atenção Especializada Necessária
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Este problema requer conhecimento especializado em Kubernetes e DevOps para ser resolvido adequadamente. 
                  A correção inadequada pode causar instabilidade no cluster.
                </p>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-warning hover:bg-warning/10"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Contratar Especialista DevOps
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {result.severity === 'passed' && (
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm font-medium">Tudo certo com esta verificação! ✓</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
