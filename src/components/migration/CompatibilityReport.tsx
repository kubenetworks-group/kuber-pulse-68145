import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, XCircle, Info, Wrench } from "lucide-react";
import { type ClusterMigration } from "@/services/migrationAnalysisService";

interface CompatibilityReportProps {
  migration: ClusterMigration;
}

const severityConfig = {
  critical: { icon: <XCircle className="w-4 h-4 text-destructive" />, label: "Crítico", color: "text-destructive" },
  warning: { icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />, label: "Aviso", color: "text-yellow-600" },
  info: { icon: <Info className="w-4 h-4 text-blue-500" />, label: "Info", color: "text-blue-600" },
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
}

export function CompatibilityReport({ migration }: CompatibilityReportProps) {
  const score = migration.compatibility_score ?? 0;
  const aiAnalysis = migration.ai_analysis as Record<string, unknown> | null;
  const rawText = aiAnalysis?.["raw"] as string | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Relatório de Compatibilidade</span>
          <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}%</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Score de compatibilidade</span>
            <span className={`font-semibold ${scoreColor(score)}`}>
              {score >= 80 ? "Alta compatibilidade" : score >= 60 ? "Compatibilidade moderada" : "Atenção necessária"}
            </span>
          </div>
          <Progress value={score} className="h-3" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<XCircle className="w-5 h-5 text-destructive" />}
            value={migration.issues_found ?? 0}
            label="Problemas detectados"
          />
          <StatCard
            icon={<Wrench className="w-5 h-5 text-primary" />}
            value={migration.issues_auto_fixed ?? 0}
            label="Corrigidos pela IA"
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
            value={(migration.issues_found ?? 0) - (migration.issues_auto_fixed ?? 0)}
            label="Requer ação manual"
          />
        </div>

        {/* Transformation log */}
        {Array.isArray(migration.transformation_log) && migration.transformation_log.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Transformações aplicadas</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(migration.transformation_log as Array<Record<string, string>>).map((entry, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/50 text-xs">
                  <Wrench className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{entry.kind}/{entry.resource}</span>
                    {entry.namespace && <span className="text-muted-foreground"> ({entry.namespace})</span>}
                    <p className="text-muted-foreground">{entry.change}</p>
                    <p className="text-muted-foreground italic">{entry.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI analysis text */}
        {rawText && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              Análise da IA
              <Badge variant="secondary" className="text-xs">Gemini</Badge>
            </h4>
            <div className="prose prose-sm max-w-none text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 whitespace-pre-wrap font-mono text-xs max-h-64 overflow-y-auto">
              {rawText}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card text-center gap-1">
      {icon}
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
