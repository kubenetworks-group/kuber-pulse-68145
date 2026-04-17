import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIAnalysisProgress } from "./AIAnalysisProgress";
import { CompatibilityReport } from "./CompatibilityReport";
import { ManifestDiffViewer } from "./ManifestDiffViewer";
import { type ClusterSnapshot } from "@/services/snapshotService";
import { type ClusterMigration } from "@/services/migrationAnalysisService";
import { ArrowRight, ArrowLeft, Wand2 } from "lucide-react";

interface MigrationWizardProps {
  clusters: Array<{ id: string; name: string; provider?: string }>;
  snapshots: ClusterSnapshot[];
  analyzing: boolean;
  analysisProgress: { step: string; percent: number } | null;
  onAnalyze: (params: {
    sourceClusterId: string;
    targetClusterId: string;
    snapshotId: string;
    name: string;
    description?: string;
    targetStorageClass?: string;
  }) => Promise<ClusterMigration>;
  onApply: (migration: ClusterMigration) => Promise<void>;
}

const STORAGE_CLASSES = [
  { value: "standard", label: "standard (genérico)" },
  { value: "gp2", label: "gp2 (AWS EBS)" },
  { value: "gp3", label: "gp3 (AWS EBS v3)" },
  { value: "managed-premium", label: "managed-premium (Azure)" },
  { value: "managed-csi", label: "managed-csi (Azure CSI)" },
  { value: "standard-rwo", label: "standard-rwo (GKE)" },
  { value: "cinder", label: "cinder (OpenStack/Magalu)" },
  { value: "oci-bv", label: "oci-bv (Oracle Cloud)" },
];

type Step = "config" | "analyzing" | "result";

export function MigrationWizard({
  clusters,
  snapshots,
  analyzing,
  analysisProgress,
  onAnalyze,
  onApply,
}: MigrationWizardProps) {
  const [step, setStep] = useState<Step>("config");
  const [sourceClusterId, setSourceClusterId] = useState("");
  const [targetClusterId, setTargetClusterId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetStorageClass, setTargetStorageClass] = useState("standard");
  const [result, setResult] = useState<ClusterMigration | null>(null);

  const completedSnapshots = snapshots.filter(
    (s) => s.status === "completed" && (!sourceClusterId || s.cluster_id === sourceClusterId)
  );

  const canAnalyze = sourceClusterId && targetClusterId && snapshotId && name.trim() && sourceClusterId !== targetClusterId;

  const handleAnalyze = async () => {
    setStep("analyzing");
    try {
      const migration = await onAnalyze({
        sourceClusterId,
        targetClusterId,
        snapshotId,
        name: name.trim(),
        description: description.trim() || undefined,
        targetStorageClass,
      });
      setResult(migration);
      setStep("result");
    } catch {
      setStep("config");
    }
  };

  return (
    <div className="space-y-6">
      {step === "config" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Nova Migração Zero-Downtime
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Source cluster */}
              <div className="space-y-1">
                <Label>Cluster de Origem *</Label>
                <Select value={sourceClusterId} onValueChange={(v) => { setSourceClusterId(v); setSnapshotId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cluster de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {clusters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.provider ? `(${c.provider})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target cluster */}
              <div className="space-y-1">
                <Label>Cluster de Destino *</Label>
                <Select value={targetClusterId} onValueChange={setTargetClusterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cluster de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {clusters
                      .filter((c) => c.id !== sourceClusterId)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.provider ? `(${c.provider})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Snapshot */}
            <div className="space-y-1">
              <Label>Snapshot do Cluster de Origem *</Label>
              <Select value={snapshotId} onValueChange={setSnapshotId} disabled={!sourceClusterId}>
                <SelectTrigger>
                  <SelectValue placeholder={sourceClusterId ? "Selecione um snapshot" : "Selecione o cluster de origem primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {completedSnapshots.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Nenhum snapshot disponível — crie um na aba Snapshots
                    </SelectItem>
                  ) : (
                    completedSnapshots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.manifest_count ?? "?"} recursos)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Target StorageClass */}
            <div className="space-y-1">
              <Label>StorageClass do Cluster Destino *</Label>
              <Select value={targetStorageClass} onValueChange={setTargetStorageClass}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_CLASSES.map((sc) => (
                    <SelectItem key={sc.value} value={sc.value}>
                      {sc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A IA vai converter todas as StorageClasses do cluster de origem para este valor.
              </p>
            </div>

            {/* Name */}
            <div className="space-y-1">
              <Label>Nome da Migração *</Label>
              <Input
                placeholder="Ex: azure-to-magalu-prod"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva o objetivo desta migração..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <Button onClick={handleAnalyze} disabled={!canAnalyze || analyzing} className="w-full">
              <Wand2 className="w-4 h-4 mr-2" />
              Analisar e Preparar Migração
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "analyzing" && analysisProgress && (
        <AIAnalysisProgress step={analysisProgress.step} percent={analysisProgress.percent} />
      )}

      {step === "result" && result && (
        <div className="space-y-4">
          <CompatibilityReport migration={result} />
          <ManifestDiffViewer migration={result} />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setStep("config")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nova análise
            </Button>
            <Button
              onClick={() => onApply(result)}
              disabled={result.status !== "ready"}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Aplicar no Cluster Destino
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
