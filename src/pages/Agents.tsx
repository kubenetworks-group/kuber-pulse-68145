import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCluster } from "@/contexts/ClusterContext";
import { toast } from "sonner";
import { Terminal, Copy, Trash2, Plus, Download, Activity } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AgentKey {
  id: string;
  name: string;
  api_key_prefix: string; // Only the prefix is stored/displayed, never the full key
  cluster_id: string;
  last_seen: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  clusters: {
    name: string;
  };
}

const Agents = () => {
  const { user } = useAuth();
  const { clusters } = useCluster();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agentKeys, setAgentKeys] = useState<AgentKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

  // Handle cluster_id from URL (coming from Clusters page after creating a cluster)
  useEffect(() => {
    const clusterIdFromUrl = searchParams.get('cluster_id');
    if (clusterIdFromUrl && clusters.length > 0) {
      const clusterExists = clusters.find(c => c.id === clusterIdFromUrl);
      if (clusterExists) {
        setSelectedClusterId(clusterIdFromUrl);
        setDialogOpen(true);
        // Clear the URL param
        setSearchParams({});
      }
    }
  }, [searchParams, clusters, setSearchParams]);

  useEffect(() => {
    if (user) {
      fetchAgentKeys();
    }
  }, [user]);

  const fetchAgentKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_api_keys')
        .select('id, name, cluster_id, api_key_prefix, is_active, last_seen, created_at, updated_at, clusters(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgentKeys(data || []);
    } catch (error) {
      console.error('Error fetching agent keys:', error);
      toast.error('Erro ao carregar API keys');
    } finally {
      setLoading(false);
    }
  };

  const createAgentKey = async () => {
    if (!newAgentName.trim()) {
      toast.error('Digite um nome para o agente');
      return;
    }

    if (!selectedClusterId || selectedClusterId === "") {
      toast.error('Selecione um cluster');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-generate-key', {
        body: {
          cluster_id: selectedClusterId,
          name: newAgentName,
        },
      });

      if (error) throw error;

      toast.success('API key criada com sucesso!');
      setShowApiKey(data.api_key.api_key);
      setDialogOpen(false);
      setNewAgentName("");
      setSelectedClusterId("");
      fetchAgentKeys();
    } catch (error) {
      console.error('Error creating agent key:', error);
      toast.error('Erro ao criar API key');
    } finally {
      setCreating(false);
    }
  };

  const deleteAgentKey = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta API key? O agente parará de funcionar.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agent_api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('API key deletada');
      fetchAgentKeys();
    } catch (error) {
      console.error('Error deleting agent key:', error);
      toast.error('Erro ao deletar API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para área de transferência');
  };

  const downloadDeploymentYaml = (apiKey: string, clusterId: string) => {
    const yaml = `apiVersion: v1
kind: Namespace
metadata:
  name: kuberpulse
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kuberpulse-agent
  namespace: kuberpulse
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kuberpulse-agent
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
  name: kuberpulse-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kuberpulse-agent
subjects:
- kind: ServiceAccount
  name: kuberpulse-agent
  namespace: kuberpulse
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: kuberpulse-config
  namespace: kuberpulse
data:
  API_ENDPOINT: "${import.meta.env.VITE_SUPABASE_URL}/functions/v1"
  COLLECT_INTERVAL: "30"
---
apiVersion: v1
kind: Secret
metadata:
  name: kuberpulse-secret
  namespace: kuberpulse
type: Opaque
stringData:
  API_KEY: "${apiKey}"
  CLUSTER_ID: "${clusterId}"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kuberpulse-agent
  namespace: kuberpulse
  labels:
    app: kuberpulse-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kuberpulse-agent
  template:
    metadata:
      labels:
        app: kuberpulse-agent
    spec:
      serviceAccountName: kuberpulse-agent
      containers:
      - name: agent
        image: kuberpulse/agent:latest
        imagePullPolicy: Always
        envFrom:
        - configMapRef:
            name: kuberpulse-config
        - secretRef:
            name: kuberpulse-secret
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "128Mi"
            cpu: "200m"`;

    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kuberpulse-agent-${clusterId}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('YAML baixado com sucesso');
  };

  const getStatusColor = (lastSeen: string | null, isActive: boolean) => {
    if (!isActive) return 'bg-muted text-muted-foreground';
    if (!lastSeen) return 'bg-warning text-warning-foreground';
    
    const minutesAgo = (new Date().getTime() - new Date(lastSeen).getTime()) / 1000 / 60;
    if (minutesAgo < 2) return 'bg-success text-success-foreground';
    if (minutesAgo < 5) return 'bg-warning text-warning-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  const getStatusText = (lastSeen: string | null, isActive: boolean) => {
    if (!isActive) return 'Inativo';
    if (!lastSeen) return 'Aguardando';
    
    const minutesAgo = Math.floor((new Date().getTime() - new Date(lastSeen).getTime()) / 1000 / 60);
    if (minutesAgo < 1) return 'Online';
    if (minutesAgo < 5) return `${minutesAgo}min atrás`;
    return 'Offline';
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Agentes CloudOps
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Gerencie agentes de monitoramento instalados nos seus clusters
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Nova API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerar Nova API Key</DialogTitle>
                <DialogDescription>
                  Crie uma API key para instalar o agente no seu cluster
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="agent-name">Nome do Agente *</Label>
                  <Input
                    id="agent-name"
                    placeholder="Ex: Production Agent"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cluster">Cluster *</Label>
                  <select
                    id="cluster"
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    value={selectedClusterId}
                    onChange={(e) => setSelectedClusterId(e.target.value)}
                    required
                  >
                    <option value="">Selecione um cluster</option>
                    {clusters.map((cluster) => (
                      <option key={cluster.id} value={cluster.id}>
                        {cluster.name}
                      </option>
                    ))}
                  </select>
                  {clusters.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ⚠️ Você precisa conectar um cluster primeiro
                    </p>
                  )}
                </div>
                <Button 
                  onClick={createAgentKey} 
                  disabled={creating || !newAgentName.trim() || !selectedClusterId}
                  className="w-full"
                >
                  {creating ? 'Gerando...' : 'Gerar API Key'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Show newly created API key */}
        {showApiKey && (
          <Card className="border-success bg-success/5">
            <CardHeader>
              <CardTitle className="text-success">✅ API Key Criada!</CardTitle>
              <CardDescription>
                Copie esta chave agora. Ela não será mostrada novamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 bg-background rounded-lg font-mono text-sm break-all">
                <code className="flex-1">{showApiKey}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(showApiKey)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowApiKey(null)}
              >
                Entendi, fechar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Agent Keys List */}
        {loading ? (
          <div className="text-center py-12">Carregando...</div>
        ) : agentKeys.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Terminal className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum agente configurado</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Crie uma API key e instale o agente no seu cluster para começar a monitorar
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {agentKeys.map((agent) => (
              <Card key={agent.id} className="hover:shadow-md transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle>{agent.name}</CardTitle>
                        <Badge className={getStatusColor(agent.last_seen, agent.is_active)}>
                          <Activity className="w-3 h-3 mr-1" />
                          {getStatusText(agent.last_seen, agent.is_active)}
                        </Badge>
                      </div>
                      <CardDescription>
                        Cluster: {agent.clusters.name}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAgentKey(agent.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">API Key (prefix)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 px-3 py-2 bg-muted rounded text-sm font-mono text-muted-foreground">
                          {agent.api_key_prefix || 'kp_***...'}
                        </code>
                        <span className="text-xs text-muted-foreground italic">
                          Chave mostrada apenas na criação
                        </span>
                      </div>
                    </div>

                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Para baixar o YAML de deploy, crie uma nova API key. A chave só é exibida no momento da criação por segurança.
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Criado em {new Date(agent.created_at).toLocaleDateString('pt-BR')}
                      {agent.last_seen && (
                        <> · Última conexão: {new Date(agent.last_seen).toLocaleString('pt-BR')}</>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Agents;
