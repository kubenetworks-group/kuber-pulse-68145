import { DashboardLayout } from "@/components/DashboardLayout";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { KubernetesResourceTable, ReadyBadge, NamespaceBadge } from "@/components/kubernetes/KubernetesResourceTable";
import { Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StatefulSetData } from "@/hooks/useObservabilityData";

const columns = [
  { key: "name",      label: "Nome",       render: (s: StatefulSetData) => <span className="font-medium">{s.name}</span> },
  { key: "namespace", label: "Namespace",  render: (s: StatefulSetData) => <NamespaceBadge namespace={s.namespace} /> },
  { key: "ready",     label: "Pronto",     render: (s: StatefulSetData) => <ReadyBadge ready={s.ready} desired={s.desired} /> },
  { key: "updated",   label: "Atualizado", render: (s: StatefulSetData) => <span className="font-mono text-sm">{s.updated}</span> },
  { key: "available", label: "Disponível", render: (s: StatefulSetData) => <span className="font-mono text-sm">{s.available}</span> },
];

const KubernetesStatefulSets = () => {
  const { clusters } = useCluster();
  const { statefulSets, loading, refetch } = useObservabilityData();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Stateful Sets</h1>
              <p className="text-sm text-muted-foreground">Workloads com estado persistente</p>
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
            data={statefulSets}
            columns={columns}
            loading={loading}
            emptyMessage="Nenhum stateful set encontrado"
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default KubernetesStatefulSets;
