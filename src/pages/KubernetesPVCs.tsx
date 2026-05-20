import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { KubernetesResourceTable, NamespaceBadge } from "@/components/kubernetes/KubernetesResourceTable";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { HardDrive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PVC {
  id: string;
  name: string;
  namespace: string;
  status: string;
  requested_bytes: number;
  used_bytes: number;
  storage_class: string | null;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "Bound";
  return <Badge variant={ok ? "default" : "secondary"} className="text-xs">{status}</Badge>;
}

const columns = [
  { key: "name",            label: "Nome",            render: (p: PVC) => <span className="font-medium">{p.name}</span> },
  { key: "namespace",       label: "Namespace",       render: (p: PVC) => <NamespaceBadge namespace={p.namespace} /> },
  { key: "status",          label: "Status",          render: (p: PVC) => <StatusBadge status={p.status} /> },
  { key: "requested_bytes", label: "Solicitado",      render: (p: PVC) => <span className="font-mono text-sm">{formatBytes(p.requested_bytes)}</span> },
  { key: "used_bytes",      label: "Usado",           render: (p: PVC) => <span className="font-mono text-sm">{formatBytes(p.used_bytes)}</span> },
  { key: "storage_class",   label: "Storage Class",   render: (p: PVC) => <span className="text-sm text-muted-foreground">{p.storage_class ?? "—"}</span> },
];

const KubernetesPVCs = () => {
  const { clusters, selectedClusterId } = useCluster();
  const [pvcs, setPvcs] = useState<PVC[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPVCs = async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    const { data } = await supabase
      .from("pvcs")
      .select("id, name, namespace, status, requested_bytes, used_bytes, storage_class")
      .eq("cluster_id", selectedClusterId);
    setPvcs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPVCs(); }, [selectedClusterId]);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Persistent Volume Claims</h1>
              <p className="text-sm text-muted-foreground">Volumes solicitados pelos workloads</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPVCs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        {clusters.length === 0 ? (
          <ClusterOnboarding />
        ) : (
          <KubernetesResourceTable
            data={pvcs}
            columns={columns}
            loading={loading}
            emptyMessage="Nenhum PVC encontrado"
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default KubernetesPVCs;
