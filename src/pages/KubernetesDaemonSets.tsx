import { DashboardLayout } from "@/components/DashboardLayout";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { KubernetesResourceTable, ReadyBadge, NamespaceBadge } from "@/components/kubernetes/KubernetesResourceTable";
import { Server, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DaemonSetData } from "@/hooks/useObservabilityData";

const columns = [
  { key: "name",      label: "Nome",       render: (d: DaemonSetData) => <span className="font-medium">{d.name}</span> },
  { key: "namespace", label: "Namespace",  render: (d: DaemonSetData) => <NamespaceBadge namespace={d.namespace} /> },
  { key: "ready",     label: "Pronto",     render: (d: DaemonSetData) => <ReadyBadge ready={d.ready} desired={d.desired} /> },
  { key: "updated",   label: "Atualizado", render: (d: DaemonSetData) => <span className="font-mono text-sm">{d.updated}</span> },
  { key: "available", label: "Disponível", render: (d: DaemonSetData) => <span className="font-mono text-sm">{d.available}</span> },
];

const KubernetesDaemonSets = () => {
  const { clusters } = useCluster();
  const { daemonSets, loading, refetch } = useObservabilityData();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Daemon Sets</h1>
              <p className="text-sm text-muted-foreground">Agentes rodando em todos os nós</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        {clusters.length === 0 ? (
          <ClusterOnboarding />
        ) : (
          <KubernetesResourceTable
            data={daemonSets}
            columns={columns}
            loading={loading}
            emptyMessage="Nenhum daemon set encontrado"
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default KubernetesDaemonSets;
