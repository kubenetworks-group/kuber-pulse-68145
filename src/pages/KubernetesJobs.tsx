import { DashboardLayout } from "@/components/DashboardLayout";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { KubernetesResourceTable, NamespaceBadge } from "@/components/kubernetes/KubernetesResourceTable";
import { Badge } from "@/components/ui/badge";
import { Briefcase, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobData } from "@/hooks/useObservabilityData";

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const variant = s === "complete" ? "default" : s === "active" ? "secondary" : "destructive";
  return <Badge variant={variant} className="text-xs">{status}</Badge>;
}

const columns = [
  { key: "name",        label: "Nome",        render: (j: JobData) => <span className="font-medium">{j.name}</span> },
  { key: "namespace",   label: "Namespace",   render: (j: JobData) => <NamespaceBadge namespace={j.namespace} /> },
  { key: "status",      label: "Status",      render: (j: JobData) => <StatusBadge status={j.status} /> },
  { key: "completions", label: "Completados", render: (j: JobData) => <span className="font-mono text-sm">{j.completions}</span> },
  { key: "active",      label: "Ativos",      render: (j: JobData) => <span className="font-mono text-sm">{j.active}</span> },
  { key: "failed",      label: "Falhas",      render: (j: JobData) => <span className={`font-mono text-sm ${j.failed > 0 ? "text-destructive" : ""}`}>{j.failed}</span> },
];

const KubernetesJobs = () => {
  const { clusters } = useCluster();
  const { jobs, loading, refetch } = useObservabilityData();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Jobs</h1>
              <p className="text-sm text-muted-foreground">Tarefas de execução única</p>
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
            data={jobs}
            columns={columns}
            loading={loading}
            emptyMessage="Nenhum job encontrado"
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default KubernetesJobs;
