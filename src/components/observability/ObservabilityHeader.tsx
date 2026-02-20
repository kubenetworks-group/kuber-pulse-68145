import { Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ObservabilityHeaderProps {
  lastSync: string | null;
  onRefresh: () => void;
  loading: boolean;
}

export const ObservabilityHeader = ({ lastSync, onRefresh, loading }: ObservabilityHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
          <Activity className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Observabilidade</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento em tempo real do cluster
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {lastSync && (
          <Badge variant="outline" className="text-xs">
            Última sync: {new Date(lastSync).toLocaleTimeString('pt-BR')}
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
    </div>
  );
};
