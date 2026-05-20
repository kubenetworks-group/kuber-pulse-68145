import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Server, Activity, HardDrive, Cpu, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ClusterCardProps {
  id?: string;
  name: string;
  status: "healthy" | "warning" | "critical" | "connecting" | "error" | "pending_agent" | "disconnected" | "offline";
  nodes: number;
  pods: number;
  cpuUsage: number;
  memoryUsage: number;
  environment: string;
  is_local?: boolean;
  onRefresh?: () => void;
}

export const ClusterCard = ({
  id,
  name,
  status,
  nodes,
  pods,
  cpuUsage,
  memoryUsage,
  environment,
  is_local,
  onRefresh,
}: ClusterCardProps) => {
  const statusConfig = {
    healthy: {
      color: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      gradient: "from-emerald-500/5 to-transparent",
      border: "border-emerald-200 dark:border-emerald-800/50",
      label: "Saudável",
      showSpinner: false,
      dotClass: "animate-pulse"
    },
    warning: {
      color: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      gradient: "from-amber-500/5 to-transparent",
      border: "border-amber-200 dark:border-amber-800/50",
      label: "Atenção",
      showSpinner: false,
      dotClass: "animate-pulse"
    },
    critical: {
      color: "bg-red-500",
      text: "text-red-600 dark:text-red-400",
      gradient: "from-red-500/5 to-transparent",
      border: "border-red-200 dark:border-red-800/50",
      label: "Crítico",
      showSpinner: false,
      dotClass: "animate-pulse"
    },
    connecting: {
      color: "bg-cyan-500",
      text: "text-cyan-600 dark:text-cyan-400",
      gradient: "from-cyan-500/5 to-transparent",
      border: "border-cyan-200 dark:border-cyan-800/50",
      label: "Conectando",
      showSpinner: true,
      dotClass: ""
    },
    error: {
      color: "bg-red-500",
      text: "text-red-600 dark:text-red-400",
      gradient: "from-red-500/5 to-transparent",
      border: "border-red-200 dark:border-red-800/50",
      label: "Erro",
      showSpinner: false,
      dotClass: "animate-pulse"
    },
    pending_agent: {
      color: "bg-orange-500",
      text: "text-orange-600 dark:text-orange-400",
      gradient: "from-orange-500/5 to-transparent",
      border: "border-orange-200 dark:border-orange-800/50",
      label: "Aguardando Agent",
      showSpinner: false,
      dotClass: "animate-pulse"
    },
    disconnected: {
      color: "bg-slate-400",
      text: "text-slate-500 dark:text-slate-400",
      gradient: "from-slate-400/5 to-transparent",
      border: "border-slate-200 dark:border-slate-700/50",
      label: "Desconectado",
      showSpinner: false,
      dotClass: ""
    },
    offline: {
      color: "bg-slate-400",
      text: "text-slate-500 dark:text-slate-400",
      gradient: "from-slate-400/5 to-transparent",
      border: "border-slate-200 dark:border-slate-700/50",
      label: "Offline",
      showSpinner: false,
      dotClass: ""
    }
  };

  const config = statusConfig[status] || statusConfig.healthy;
  
  // Auto-refresh connecting clusters after 5 seconds
  useEffect(() => {
    if (status === 'connecting' && onRefresh) {
      const timer = setTimeout(() => {
        console.log('Auto-refreshing connecting cluster:', id);
        onRefresh();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [status, id, onRefresh]);

  const downloadAgentConfig = async () => {
    if (!id) return;

    const { data: versionData } = await supabase
      .from("agent_versions")
      .select("version")
      .eq("is_latest", true)
      .single();
    const imageTag = `ghcr.io/kubenetworks-group/kodo-agent:${versionData?.version ?? "v0.1.77"}`;

    const agentConfig = `apiVersion: v1
kind: Namespace
metadata:
  name: kodo-agent
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: kodo-agent-config
  namespace: kodo-agent
data:
  CLUSTER_ID: "${id}"
  API_ENDPOINT: "${import.meta.env.VITE_SUPABASE_URL}/functions/v1"
  COLLECT_INTERVAL: "30"
---
apiVersion: v1
kind: Secret
metadata:
  name: kodo-agent-secret
  namespace: kodo-agent
type: Opaque
stringData:
  API_KEY: "GENERATE_YOUR_API_KEY_IN_AGENTS_PAGE"
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kodo-agent
  namespace: kodo-agent
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kodo-agent
rules:
- apiGroups: [""]
  resources: ["nodes", "pods", "events", "namespaces", "services",
              "persistentvolumes", "persistentvolumeclaims",
              "resourcequotas", "serviceaccounts", "configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods/log", "pods/exec"]
  verbs: ["get", "list", "create"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["delete"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]
  verbs: ["get", "list", "watch", "update"]
- apiGroups: ["autoscaling"]
  resources: ["horizontalpodautoscalers"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses", "networkpolicies"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["nodes", "pods"]
  verbs: ["get", "list"]
- apiGroups: ["rbac.authorization.k8s.io"]
  resources: ["clusterroles", "clusterrolebindings", "roles", "rolebindings"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kodo-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kodo-agent
subjects:
- kind: ServiceAccount
  name: kodo-agent
  namespace: kodo-agent
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kodo-agent
  namespace: kodo-agent
  labels:
    app: kodo-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kodo-agent
  template:
    metadata:
      labels:
        app: kodo-agent
    spec:
      serviceAccountName: kodo-agent
      containers:
      - name: agent
        image: ${imageTag}
        imagePullPolicy: Always
        envFrom:
        - configMapRef:
            name: kodo-agent-config
        - secretRef:
            name: kodo-agent-secret
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "128Mi"
            cpu: "200m"
`;
    
    const blob = new Blob([agentConfig], { type: 'text/yaml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kodo-agent-${name.toLowerCase().replace(/\s+/g, '-')}.yaml`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Configuração do agent baixada! Aplique com: kubectl apply -f kodo-agent-*.yaml');
  };

  return (
    <Card className={`group relative overflow-hidden transition-all duration-300 border-2 ${config.border} hover:shadow-xl hover:shadow-slate-900/10 dark:hover:shadow-slate-950/20 hover:-translate-y-0.5`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient}`} />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-base font-bold text-foreground truncate tracking-tight">{name}</h3>
              {is_local && (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60 shrink-0">Local</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{environment}</p>
          </div>

          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border shrink-0 ${
            config.border
          } bg-white/40 dark:bg-black/20 backdrop-blur-sm`}>
            {config.showSpinner ? (
              <RefreshCw className={`w-3 h-3 ${config.text} animate-spin`} />
            ) : (
              <div className={`w-2 h-2 rounded-full ${config.color} ${config.dotClass}`} />
            )}
            <span className={`text-[11px] font-bold uppercase tracking-wide ${config.text}`}>{config.label}</span>
          </div>
        </div>

        {/* Pending agent instructions */}
        {status === 'pending_agent' && is_local && (
          <div className="mb-4 p-3.5 rounded-xl bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/40">
            <h4 className="font-semibold text-sm mb-2 text-orange-900 dark:text-orange-100 flex items-center gap-1.5">
              <span className="text-base">📋</span>
              Configuração Necessária
            </h4>
            <ol className="text-xs space-y-1 list-decimal list-inside text-orange-800 dark:text-orange-200 mb-3">
              <li>Baixe a configuração do agent</li>
              <li>Gere uma Chave de API na página de Agents</li>
              <li>Edite e adicione sua Chave de API ao arquivo</li>
              <li>Aplique: <code className="bg-orange-100 dark:bg-orange-900/40 px-1 rounded text-[10px] font-mono">kubectl apply -f agent.yaml</code></li>
              <li>O agent se conecta automaticamente</li>
            </ol>
            <Button
              size="sm"
              className="w-full h-8 text-xs font-medium"
              onClick={downloadAgentConfig}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Baixar Configuração do Agent
            </Button>
          </div>
        )}

        {/* Nodes + Pods row */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-100/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40">
            <div className="p-1.5 rounded-md bg-slate-200/80 dark:bg-slate-700/60">
              <Activity className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none mb-1">Nós</p>
              <p className="text-xl font-black text-foreground tabular-nums leading-none">{nodes}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-100/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40">
            <div className="p-1.5 rounded-md bg-slate-200/80 dark:bg-slate-700/60">
              <Server className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none mb-1">Pods</p>
              <p className="text-xl font-black text-foreground tabular-nums leading-none">{pods}</p>
            </div>
          </div>
        </div>

        {/* CPU + Memory gauges */}
        <div className="space-y-2.5">
          {/* CPU */}
          {(() => {
            const cpu = Math.min(100, Math.max(0, cpuUsage));
            const cpuColor = cpu > 80 ? 'text-red-500 dark:text-red-400' : cpu > 60 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
            const cpuBar = cpu > 80 ? 'bg-red-500' : cpu > 60 ? 'bg-amber-500' : 'bg-emerald-500';
            const cpuBg = cpu > 80 ? 'bg-red-50 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/40' : cpu > 60 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40';
            return (
              <div className={`p-3 rounded-lg border ${cpuBg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">CPU</span>
                  </div>
                  <span className={`text-lg font-black tabular-nums leading-none ${cpuColor}`}>
                    {cpu.toFixed(1)}<span className="text-sm font-semibold">%</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cpuBar}`}
                    style={{ width: `${cpu}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Memory */}
          {(() => {
            const mem = Math.min(100, Math.max(0, memoryUsage));
            const memColor = mem > 80 ? 'text-red-500 dark:text-red-400' : mem > 60 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
            const memBar = mem > 80 ? 'bg-red-500' : mem > 60 ? 'bg-amber-500' : 'bg-emerald-500';
            const memBg = mem > 80 ? 'bg-red-50 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/40' : mem > 60 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40';
            return (
              <div className={`p-3 rounded-lg border ${memBg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Memória</span>
                  </div>
                  <span className={`text-lg font-black tabular-nums leading-none ${memColor}`}>
                    {mem.toFixed(1)}<span className="text-sm font-semibold">%</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${memBar}`}
                    style={{ width: `${mem}%` }}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </Card>
  );
};
