import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Loader2 } from "lucide-react";

interface AIAnalysisProgressProps {
  step: string;
  percent: number;
}

export function AIAnalysisProgress({ step, percent }: AIAnalysisProgressProps) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-6 pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Analisando com IA...</span>
              <span className="text-sm text-muted-foreground">{percent}%</span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
        </div>
        <p className="text-sm text-muted-foreground pl-12">{step}</p>
      </CardContent>
    </Card>
  );
}
