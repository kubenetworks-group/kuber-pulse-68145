import { cn } from "@/lib/utils";

interface RiskScoreCardProps {
  score: number;
}

export const RiskScoreCard = ({ score }: RiskScoreCardProps) => {
  const getScoreColor = () => {
    if (score >= 75) return "text-red-500";
    if (score >= 50) return "text-orange-500";
    if (score >= 25) return "text-yellow-500";
    return "text-green-500";
  };

  const getScoreLabel = () => {
    if (score >= 75) return "Crítico";
    if (score >= 50) return "Alto";
    if (score >= 25) return "Médio";
    return "Baixo";
  };

  const getScoreBg = () => {
    if (score >= 75) return "from-red-500/20 to-red-600/20 border-red-500/30";
    if (score >= 50) return "from-orange-500/20 to-orange-600/20 border-orange-500/30";
    if (score >= 25) return "from-yellow-500/20 to-yellow-600/20 border-yellow-500/30";
    return "from-green-500/20 to-green-600/20 border-green-500/30";
  };

  return (
    <div className={cn(
      "flex items-center gap-4 px-4 py-3 rounded-xl bg-gradient-to-r border",
      getScoreBg()
    )}>
      <div className="text-center">
        <div className={cn("text-3xl font-bold", getScoreColor())}>
          {score}
        </div>
        <div className="text-xs text-muted-foreground">Score de Risco</div>
      </div>
      <div className="h-10 w-px bg-border" />
      <div>
        <div className={cn("text-sm font-medium", getScoreColor())}>
          Risco {getScoreLabel()}
        </div>
        <div className="text-xs text-muted-foreground">
          {score >= 50 ? "Ação recomendada" : "Cluster saudável"}
        </div>
      </div>
    </div>
  );
};
