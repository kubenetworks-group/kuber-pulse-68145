import { DashboardLayout } from "@/components/DashboardLayout";
import { useObservabilityData } from "@/hooks/useObservabilityData";
import { useCluster } from "@/contexts/ClusterContext";
import { ClusterOnboarding } from "@/components/ClusterOnboarding";
import { KubernetesResourceTable, NamespaceBadge } from "@/components/kubernetes/KubernetesResourceTable";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NetworkPolicyData } from "@/hooks/useObservabilityData";

const columns = [
  { key: "name",         label: "Nome",          render: (n: NetworkPolicyData) => <span className="font-medium">{n.name}</span> },
  { key: "namespace",    label: "Namespace",     render: (n: NetworkPolicyData) => <NamespaceBadge namespace={n.namespace} /> },
  { key: "policy_types", label: "Tipos de regra", render: (n: NetworkPolicyData) => (
    <div className="flex gap-1 flex-wrap">
      {n.policy_types.length > 0
        ? n.policy_types.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)
        : <span className="text-muted-foreground text-sm">—</span>}
    </div>
  )},
];

const KubernetesNetworkPolicies = () => {
  const { clusters } = useCluster();
  const { networkPolicies, loading, refetch } = useObservabilityData();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Network Policies</h1>
              <p className="text-sm text-muted-foreground">Regras de rede entre pods e namespaces</p>
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
            data={networkPolicies}
            columns={columns}
            loading={loading}
            emptyMessage="Nenhuma network policy encontrada"
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default KubernetesNetworkPolicies;
