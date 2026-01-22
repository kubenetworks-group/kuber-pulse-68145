import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Server, Settings, Globe } from "lucide-react";
import { RiskCategory } from "@/hooks/useRiskAnalysis";
import { cn } from "@/lib/utils";

interface RisksOverviewProps {
  risks: {
    security: RiskCategory;
    availability: RiskCategory;
    configuration: RiskCategory;
    exposure: RiskCategory;
  };
}

export const RisksOverview = ({ risks }: RisksOverviewProps) => {
  const categories = [
    {
      key: "security",
      label: "Segurança",
      description: "Ameaças e vulnerabilidades",
      icon: Shield,
      data: risks.security,
    },
    {
      key: "availability",
      label: "Disponibilidade",
      description: "Pods e nodes saudáveis",
      icon: Server,
      data: risks.availability,
    },
    {
      key: "configuration",
      label: "Configuração",
      description: "Recursos e probes",
      icon: Settings,
      data: risks.configuration,
    },
    {
      key: "exposure",
      label: "Exposição",
      description: "Acessos externos",
      icon: Globe,
      data: risks.exposure,
    },
  ];

  const getLevelColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      case "high":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      default:
        return "bg-green-500/10 text-green-500 border-green-500/30";
    }
  };

  const getProgressColor = (score: number) => {
    if (score >= 75) return "bg-red-500";
    if (score >= 50) return "bg-orange-500";
    if (score >= 25) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "critical":
        return "Crítico";
      case "high":
        return "Alto";
      case "medium":
        return "Médio";
      default:
        return "Baixo";
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {categories.map((category) => {
        const Icon = category.icon;
        return (
          <Card key={category.key} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-2 rounded-lg",
                    getLevelColor(category.data.level)
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm font-medium">
                    {category.label}
                  </CardTitle>
                </div>
                <Badge variant="outline" className={getLevelColor(category.data.level)}>
                  {getLevelLabel(category.data.level)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {category.description}
              </p>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Score de Risco</span>
                  <span className="font-medium">{category.data.score}/100</span>
                </div>
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", getProgressColor(category.data.score))}
                    style={{ width: `${category.data.score}%` }}
                  />
                </div>
              </div>

              {category.data.count > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{category.data.count}</span> itens detectados
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
