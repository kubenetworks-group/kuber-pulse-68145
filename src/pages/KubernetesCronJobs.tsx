import { DashboardLayout } from "@/components/DashboardLayout";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { KubernetesResourceTable, NamespaceBadge } from "@/components/kubernetes/KubernetesResourceTable";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CronJobData } from "@/hooks/useObservabilityData";

const columns = [
  { key: "name",          label: "Nome",           render: (c: CronJobData) => <span className="font-medium">{c.name}</span> },
  { key: "namespace",     label: "Namespace",      render: (c: CronJobData) => <NamespaceBadge namespace={c.namespace} /> },
  { key: "schedule",      label: "Agendamento",    render: (c: CronJobData) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.schedule}</code> },
  { key: "suspend",       label: "Status",         render: (c: CronJobData) => <Badge variant={c.suspend ? "secondary" : "default"} className="text-xs">{c.suspend ? "Suspenso" : "Ativo"}</Badge> },
  { key: "active",        label: "Em execução",    render: (c: CronJobData) => <span className="font-mono text-sm">{c.active}</span> },
  { key: "last_schedule", label: "Última execução", render: (c: CronJobData) => <span className="text-sm text-muted-foreground">{c.last_schedule ?? "—"}</span> },
];

const KubernetesCronJobs = () => {
  const { clusters } = useCluster();
  const { cronJobs, loading, refetch } = useObservabilityData();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Cron Jobs</h1>
              <p className="text-sm text-muted-foreground">Tarefas agendadas recorrentes</p>
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
            data={cronJobs}
            columns={columns}
            loading={loading}
            emptyMessage="Nenhum cron job encontrado"
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default KubernetesCronJobs;
