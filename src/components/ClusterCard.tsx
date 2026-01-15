import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Server, Activity, HardDrive, Cpu, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

interface ClusterCardProps {
  id?: string;
  name: string;
  status: "healthy" | "warning" | "critical" | "connecting" | "error" | "pending_agent";
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
      color: "bg-success", 
      text: "text-success",
      gradient: "from-success/10 to-success/5",
      border: "border-success/30",
      label: "Saudável",
      showSpinner: false
    },
    warning: { 
      color: "bg-warning", 
      text: "text-warning",
      gradient: "from-warning/10 to-warning/5",
      border: "border-warning/30",
      label: "Atenção",
      showSpinner: false
    },
    critical: { 
      color: "bg-destructive", 
      text: "text-destructive",
      gradient: "from-destructive/10 to-destructive/5",
      border: "border-destructive/30",
      label: "Crítico",
      showSpinner: false
    },
    connecting: {
      color: "bg-blue-500",
      text: "text-blue-500",
      gradient: "from-blue-500/10 to-blue-500/5",
      border: "border-blue-500/30",
      label: "Conectando",
      showSpinner: true
    },
    error: {
      color: "bg-destructive",
      text: "text-destructive",
      gradient: "from-destructive/10 to-destructive/5",
      border: "border-destructive/30",
      label: "Erro",
      showSpinner: false
    },
    pending_agent: {
      color: "bg-blue-500",
      text: "text-blue-500",
      gradient: "from-blue-500/10 to-blue-500/5",
      border: "border-blue-500/30",
      label: "Aguardando Agente",
      showSpinner: false
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

  const downloadAgentConfig = () => {
    if (!id) return;
    
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
  resources: ["nodes", "pods", "events", "namespaces"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["delete"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "update"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["nodes", "pods"]
  verbs: ["get", "list"]
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
        image: your-registry/kodo-agent:latest
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
    
    toast.success('Agent config baixado! Aplique com: kubectl apply -f kodo-agent-*.yaml');
  };

  return (
    <Card className={`group relative overflow-hidden p-4 sm:p-6 bg-gradient-to-br from-card to-card/50 ${config.border} hover:border-opacity-60 transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}>
      {/* Animated background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4 sm:mb-6 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 group-hover:scale-110 transition-transform duration-300 shrink-0">
              <Server className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-foreground truncate">{name}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{environment}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-card/80 border border-border/50 shrink-0">
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${config.color} ${config.showSpinner ? '' : 'animate-pulse'}`} />
            <Badge variant="secondary" className="text-[10px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2">
              {config.showSpinner && <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" />}
              <span className="hidden xs:inline">{config.label}</span>
              <span className="xs:hidden">{config.label.split(' ')[0]}</span>
            </Badge>
          </div>
        </div>

        {status === 'pending_agent' && is_local && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">📝 Próximos Passos:</h4>
            <ol className="text-xs space-y-1 list-decimal list-inside text-blue-800 dark:text-blue-200 mb-3">
              <li>Baixe o arquivo de deployment do agente</li>
              <li>Gere uma API Key na página de Agentes</li>
              <li>Edite o arquivo e substitua "GENERATE_YOUR_API_KEY_IN_AGENTS_PAGE" pela sua API Key</li>
              <li>Aplique no seu cluster: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">kubectl apply -f agent.yaml</code></li>
              <li>O agente irá conectar automaticamente</li>
            </ol>
            <Button 
              size="sm" 
              className="w-full"
              onClick={downloadAgentConfig}
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Agent Config
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-lg bg-gradient-to-br from-card to-card/50 border border-border/50 hover:border-primary/30 transition-all group/item">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Nodes</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{nodes}</p>
          </div>
          
          <div className="p-2 sm:p-3 rounded-lg bg-gradient-to-br from-card to-card/50 border border-border/50 hover:border-primary/30 transition-all group/item">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <Server className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Pods</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{pods}</p>
          </div>
          
          <div className="p-2 sm:p-3 rounded-lg bg-gradient-to-br from-card to-card/50 border border-border/50 hover:border-primary/30 transition-all group/item">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <Cpu className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">CPU</p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <p className="text-lg sm:text-2xl font-bold text-foreground shrink-0">{cpuUsage}%</p>
              <div className="flex-1 h-1.5 sm:h-2 bg-border/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${cpuUsage > 80 ? 'bg-destructive' : cpuUsage > 60 ? 'bg-warning' : 'bg-success'} transition-all duration-300`}
                  style={{ width: `${cpuUsage}%` }}
                />
              </div>
            </div>
          </div>
          
          <div className="p-2 sm:p-3 rounded-lg bg-gradient-to-br from-card to-card/50 border border-border/50 hover:border-primary/30 transition-all group/item">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <HardDrive className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Memory</p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <p className="text-lg sm:text-2xl font-bold text-foreground shrink-0">{memoryUsage}%</p>
              <div className="flex-1 h-1.5 sm:h-2 bg-border/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${memoryUsage > 80 ? 'bg-destructive' : memoryUsage > 60 ? 'bg-warning' : 'bg-success'} transition-all duration-300`}
                  style={{ width: `${memoryUsage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
