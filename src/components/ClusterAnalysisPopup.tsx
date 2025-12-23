import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useClusterAnalysis } from "@/hooks/useClusterAnalysis";
import { useNavigate } from "react-router-dom";
import { 
  Server, 
  Box, 
  HardDrive, 
  Layers, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Settings
} from "lucide-react";

interface ClusterAnalysisPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterId: string | null;
  clusterName: string;
}

export const ClusterAnalysisPopup = ({
  open,
  onOpenChange,
  clusterId,
  clusterName,
}: ClusterAnalysisPopupProps) => {
  const navigate = useNavigate();
  const { analysis, loading, progress } = useClusterAnalysis(clusterId);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!loading && analysis) {
      const timer = setTimeout(() => setShowContent(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [loading, analysis]);

  const handleGoToDashboard = () => {
    onOpenChange(false);
    navigate("/dashboard");
  };

  const handleConfigureAutoHeal = () => {
    onOpenChange(false);
    navigate("/ai-monitor");
  };

  const runningPercentage = analysis?.totalPods 
    ? Math.round((analysis.runningPods / analysis.totalPods) * 100) 
    : 0;

  const storagePercentage = analysis?.totalStorageGb 
    ? Math.round((analysis.usedStorageGb / analysis.totalStorageGb) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            {loading ? "Analisando Cluster..." : `Análise: ${clusterName}`}
          </DialogTitle>
          <DialogDescription>
            {loading 
              ? "Carregando informações do seu cluster..."
              : "Resumo dos recursos detectados no seu cluster"
            }
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              Coletando métricas... {progress}%
            </p>
          </div>
        ) : analysis ? (
          <div className={`space-y-6 transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
            {/* Main metrics cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center border border-border">
                <Server className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold">{analysis.totalNodes}</div>
                <div className="text-xs text-muted-foreground">Nodes</div>
                <div className="text-xs text-primary mt-1">{analysis.totalCpu} vCPUs</div>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 text-center border border-border">
                <Box className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold">{analysis.totalPods}</div>
                <div className="text-xs text-muted-foreground">Pods</div>
                <div className="text-xs text-primary mt-1">{runningPercentage}% Running</div>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 text-center border border-border">
                <HardDrive className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <div className="text-2xl font-bold">{analysis.pvcCount}</div>
                <div className="text-xs text-muted-foreground">PVCs</div>
                <div className="text-xs text-primary mt-1">{analysis.totalStorageGb} GB</div>
              </div>
            </div>

            {/* Nodes breakdown */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Server className="h-4 w-4" />
                Nodes Detectados
              </h4>
              <div className="space-y-2 text-sm">
                {analysis.controlPlaneNodes > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>{analysis.controlPlaneNodes}x Control Plane</span>
                  </div>
                )}
                {analysis.workerNodes > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>{analysis.workerNodes}x Workers ({analysis.totalMemoryGb} GB RAM total)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pods status */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Box className="h-4 w-4" />
                Status dos Pods
              </h4>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{analysis.runningPods} Running</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span>{analysis.pendingPods} Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span>{analysis.failedPods} Failed</span>
                </div>
              </div>
            </div>

            {/* Storage */}
            {analysis.pvcCount > 0 && (
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Storage
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{analysis.usedStorageGb} GB usado</span>
                    <span>{analysis.totalStorageGb} GB total</span>
                  </div>
                  <Progress value={storagePercentage} className="h-2" />
                </div>
              </div>
            )}

            {/* Namespaces */}
            {analysis.namespaces.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Principais Namespaces
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.namespaces.map((ns) => (
                    <span
                      key={ns.name}
                      className="bg-muted px-2 py-1 rounded text-xs"
                    >
                      {ns.name} ({ns.podCount} pods)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleGoToDashboard} className="flex-1">
                <ArrowRight className="h-4 w-4 mr-2" />
                Ver Dashboard
              </Button>
              <Button variant="outline" onClick={handleConfigureAutoHeal} className="flex-1">
                <Settings className="h-4 w-4 mr-2" />
                Configurar Auto-Heal
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p>Nenhuma métrica disponível ainda.</p>
            <p className="text-sm mt-2">As métricas aparecerão quando o agente começar a enviar dados.</p>
            <Button onClick={() => onOpenChange(false)} className="mt-4">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
