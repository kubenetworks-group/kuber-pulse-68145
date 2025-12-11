import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, AlertTriangle, Download, Sparkles, Clock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface PersistentVolume {
  id: string;
  name: string;
  status: string;
  capacity_bytes: number;
  storage_class: string | null;
  reclaim_policy: string | null;
  claim_ref_namespace: string | null;
  claim_ref_name: string | null;
  created_at?: string;
}

interface CleanupRecommendation {
  pv: PersistentVolume;
  ageInDays: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  potentialSavings: number;
}

interface PVCleanupRecommendationsProps {
  pvs: PersistentVolume[];
  clusterProvider?: string;
}

// Storage pricing per GB/month by provider (USD)
const getStoragePricePerGB = (provider: string): number => {
  const prices: Record<string, number> = {
    'aws': 0.08,           // AWS EBS gp3
    'gcp': 0.04,           // GCP Standard PD
    'azure': 0.038,        // Azure Standard SSD
    'digitalocean': 0.10,  // DigitalOcean Block Storage
    'magalucloud': 0.05,   // MagaluCloud (estimativa em BRL convertido)
    'local': 0.00,         // On-premise (sem custo cloud)
    'other': 0.08,         // Default
  };
  return prices[provider?.toLowerCase()] || prices['other'];
};

export const PVCleanupRecommendations = ({ pvs, clusterProvider = 'other' }: PVCleanupRecommendationsProps) => {
  const { t } = useTranslation();
  const [selectedPVs, setSelectedPVs] = useState<Set<string>>(new Set());

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
  };

  const calculateAge = (createdAt?: string): number => {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const generateRecommendations = (): CleanupRecommendation[] => {
    const releasedPVs = pvs.filter(pv => pv.status?.toLowerCase() === 'released');
    
    return releasedPVs.map(pv => {
      const ageInDays = calculateAge(pv.created_at);
      let priority: 'high' | 'medium' | 'low' = 'low';
      let reason = '';

      if (ageInDays > 90) {
        priority = 'high';
        reason = `Released há ${ageInDays} dias. Muito tempo sem uso - recomendada deleção imediata`;
      } else if (ageInDays > 30) {
        priority = 'medium';
        reason = `Released há ${ageInDays} dias. Considerar deleção se não houver necessidade de recuperação`;
      } else if (ageInDays > 7) {
        priority = 'low';
        reason = `Released há ${ageInDays} dias. Monitorar por mais tempo antes de deletar`;
      } else {
        priority = 'low';
        reason = `Released recentemente (${ageInDays} dias). Aguardar antes de deletar`;
      }

      // Calculate potential savings based on provider
      const gbSize = pv.capacity_bytes / (1024 ** 3);
      const monthlyCostPerGB = getStoragePricePerGB(clusterProvider);
      const potentialSavings = gbSize * monthlyCostPerGB;

      return {
        pv,
        ageInDays,
        priority,
        reason,
        potentialSavings,
      };
    }).sort((a, b) => {
      // Sort by priority first, then by age
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.ageInDays - a.ageInDays;
    });
  };

  const recommendations = generateRecommendations();
  const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;
  const totalWastedStorage = recommendations.reduce((sum, r) => sum + r.pv.capacity_bytes, 0);
  const totalPotentialSavings = recommendations.reduce((sum, r) => sum + r.potentialSavings, 0);
  const selectedSavings = Array.from(selectedPVs)
    .map(id => recommendations.find(r => r.pv.id === id))
    .filter(Boolean)
    .reduce((sum, r) => sum + r!.potentialSavings, 0);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'low':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Alta Prioridade';
      case 'medium':
        return 'Média Prioridade';
      case 'low':
        return 'Baixa Prioridade';
      default:
        return priority;
    }
  };

  const togglePV = (pvId: string) => {
    const newSelected = new Set(selectedPVs);
    if (newSelected.has(pvId)) {
      newSelected.delete(pvId);
    } else {
      newSelected.add(pvId);
    }
    setSelectedPVs(newSelected);
  };

  const selectAllHighPriority = () => {
    const highPriorityIds = recommendations
      .filter(r => r.priority === 'high')
      .map(r => r.pv.id);
    setSelectedPVs(new Set(highPriorityIds));
  };

  const exportDeleteScript = () => {
    const selectedRecommendations = recommendations.filter(r => selectedPVs.has(r.pv.id));
    const script = selectedRecommendations
      .map(r => `kubectl delete pv ${r.pv.name}`)
      .join('\n');
    
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cleanup-pvs.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (recommendations.length === 0) {
    return (
      <Card className="backdrop-blur-xl bg-card/80 border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">Recomendações de Limpeza</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Análise inteligente de PVs para otimização de storage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum PV Released encontrado para limpeza</p>
            <p className="text-xs mt-1">Seu cluster está otimizado!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0 mt-1" />
            <div>
              <CardTitle className="text-base sm:text-lg">Recomendações de Limpeza Inteligente</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Análise baseada em idade e padrões de uso dos PVs Released
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {recommendations.length} recomendações
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High Priority Alert */}
        {highPriorityCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Atenção: {highPriorityCount} PVs com Alta Prioridade</AlertTitle>
            <AlertDescription className="text-xs">
              Estes volumes estão Released há mais de 90 dias e desperdiçam storage.
              Recomenda-se deleção imediata se não houver necessidade de recuperação.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="space-y-1 p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Storage Desperdiçado</p>
            <p className="text-lg sm:text-xl font-bold text-red-500">{formatBytes(totalWastedStorage)}</p>
          </div>
          <div className="space-y-1 p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Economia/Mês</p>
            <p className="text-lg sm:text-xl font-bold text-green-500">${totalPotentialSavings.toFixed(2)}</p>
          </div>
          <div className="space-y-1 p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Alta Prioridade</p>
            <p className="text-lg sm:text-xl font-bold text-red-500">{highPriorityCount}</p>
          </div>
          <div className="space-y-1 p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Selecionados</p>
            <p className="text-lg sm:text-xl font-bold text-primary">{selectedPVs.size}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllHighPriority}
            disabled={highPriorityCount === 0}
            className="text-xs sm:text-sm"
          >
            <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            <span className="hidden sm:inline">Selecionar Alta Prioridade</span>
            <span className="sm:hidden">Alta Prioridade</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportDeleteScript}
            disabled={selectedPVs.size === 0}
            className="text-xs sm:text-sm"
          >
            <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            Exportar Script ({selectedPVs.size})
          </Button>
          {selectedPVs.size > 0 && (
            <div className="sm:ml-auto text-xs sm:text-sm text-muted-foreground flex items-center gap-2 justify-center sm:justify-start">
              <span>Economia:</span>
              <span className="font-bold text-green-500">${selectedSavings.toFixed(2)}/mês</span>
            </div>
          )}
        </div>

        {/* Recommendations Table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 sm:w-12"></TableHead>
                <TableHead className="text-xs sm:text-sm min-w-[120px]">PV</TableHead>
                <TableHead className="text-xs sm:text-sm">Prioridade</TableHead>
                <TableHead className="text-xs sm:text-sm">Idade</TableHead>
                <TableHead className="text-xs sm:text-sm">Tamanho</TableHead>
                <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Economia/Mês</TableHead>
                <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Recomendação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recommendations.map((rec) => (
                <TableRow key={rec.pv.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedPVs.has(rec.pv.id)}
                      onCheckedChange={() => togglePV(rec.pv.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-[10px] sm:text-xs max-w-[120px] sm:max-w-[200px] truncate">
                    {rec.pv.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${getPriorityColor(rec.priority)} text-[10px] sm:text-xs whitespace-nowrap`}>
                      <span className="hidden sm:inline">{getPriorityLabel(rec.priority)}</span>
                      <span className="sm:hidden">{rec.priority.toUpperCase()}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-[10px] sm:text-sm whitespace-nowrap">{rec.ageInDays}d</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-[10px] sm:text-sm">
                    {formatBytes(rec.pv.capacity_bytes)}
                  </TableCell>
                  <TableCell className="text-green-500 font-semibold text-[10px] sm:text-sm hidden sm:table-cell">
                    ${rec.potentialSavings.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-[10px] sm:text-xs text-muted-foreground max-w-[200px] sm:max-w-[300px] truncate hidden lg:table-cell">
                    {rec.reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Warning Footer */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">Aviso Importante</AlertTitle>
          <AlertDescription className="text-xs">
            Antes de deletar PVs, certifique-se de que:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Os dados não são mais necessários para recuperação</li>
              <li>Não há backups dependentes destes volumes</li>
              <li>A política de retenção da sua organização permite a deleção</li>
              <li>Você tem permissões adequadas no cluster</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
