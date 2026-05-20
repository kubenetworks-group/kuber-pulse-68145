import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { KubernetesResourceTable } from "@/components/kubernetes/KubernetesResourceTable";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Disc, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PV {
  id: string;
  name: string;
  status: string;
  capacity_bytes: number;
  storage_class: string | null;
  reclaim_policy: string | null;
  claim_ref_namespace: string | null;
  claim_ref_name: string | null;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(0)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const variant = s === "bound" ? "default" : s === "available" ? "secondary" : "destructive";
  return <Badge variant={variant} className="text-xs">{status}</Badge>;
}

const columns = [
  { key: "name",              label: "Nome",          render: (p: PV) => <span className="font-medium">{p.name}</span> },
  { key: "status",            label: "Status",        render: (p: PV) => <StatusBadge status={p.status} /> },
  { key: "capacity_bytes",    label: "Capacidade",    render: (p: PV) => <span className="font-mono text-sm">{formatBytes(p.capacity_bytes)}</span> },
  { key: "storage_class",     label: "Storage Class", render: (p: PV) => <span className="text-sm text-muted-foreground">{p.storage_class ?? "—"}</span> },
  { key: "reclaim_policy",    label: "Reclaim",       render: (p: PV) => <span className="text-sm">{p.reclaim_policy ?? "—"}</span> },
  { key: "claim_ref_name",    label: "Claim",         render: (p: PV) => (
    p.claim_ref_name
      ? <span className="text-sm font-mono">{p.claim_ref_namespace}/{p.claim_ref_name}</span>
      : <span className="text-muted-foreground text-sm">—</span>
  )},
];

const KubernetesVolumes = () => {
  const { clusters, selectedClusterId } = useCluster();
  const [pvs, setPvs] = useState<PV[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPVs = async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    const { data } = await supabase
      .from("persistent_volumes")
      .select("*")
      .eq("cluster_id", selectedClusterId);
    setPvs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPVs(); }, [selectedClusterId]);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Disc className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Persistent Volumes</h1>
              <p className="text-sm text-muted-foreground">Volumes persistentes do cluster</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPVs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        {clusters.length === 0 ? (
          <ClusterOnboarding />
        ) : (
          <KubernetesResourceTable
            data={pvs}
            columns={columns}
            loading={loading}
            emptyMessage="Nenhum persistent volume encontrado"
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default KubernetesVolumes;
