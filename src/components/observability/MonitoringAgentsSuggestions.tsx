import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  ExternalLink,
  BarChart3,
  FileText,
  Search,
  Gauge,
} from "lucide-react";

interface AgentStatus {
  name: string;
  installed: boolean;
  namespace: string | null;
}

interface MonitoringAgentsSuggestionsProps {
  agents: AgentStatus[];
  loading: boolean;
}

const AGENT_INFO: Record<string, {
  icon: React.ReactNode;
  description: string;
  installCommand: string;
  docsUrl: string;
  color: string;
}> = {
  "Prometheus": {
    icon: <Gauge className="w-5 h-5" />,
    description: "Coleta de métricas e alertas. Essencial para monitoramento de CPU, memória, disco e métricas customizadas.",
    installCommand: `helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace`,
    docsUrl: "https://prometheus.io/docs/introduction/overview/",
    color: "text-orange-400",
  },
  "Grafana": {
    icon: <BarChart3 className="w-5 h-5" />,
    description: "Visualização de dashboards e métricas. Já incluído no kube-prometheus-stack.",
    installCommand: `# Já incluído no kube-prometheus-stack
# Acesse via port-forward:
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring`,
    docsUrl: "https://grafana.com/docs/grafana/latest/",
    color: "text-yellow-400",
  },
  "Loki": {
    icon: <FileText className="w-5 h-5" />,
    description: "Agregação de logs. Integra com Grafana para busca e visualização de logs dos containers.",
    installCommand: `helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack -n monitoring --create-namespace --set promtail.enabled=true`,
    docsUrl: "https://grafana.com/docs/loki/latest/",
    color: "text-cyan-400",
  },
  "Elasticsearch": {
    icon: <Search className="w-5 h-5" />,
    description: "Busca e análise de logs em escala. Ideal para ambientes que precisam de busca full-text avançada.",
    installCommand: `helm repo add elastic https://helm.elastic.co
helm install elasticsearch elastic/elasticsearch -n logging --create-namespace
helm install kibana elastic/kibana -n logging`,
    docsUrl: "https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html",
    color: "text-green-400",
  },
  "Jaeger": {
    icon: <BarChart3 className="w-5 h-5" />,
    description: "Distributed tracing para rastreamento de requisições entre microserviços.",
    installCommand: `helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm install jaeger jaegertracing/jaeger -n tracing --create-namespace`,
    docsUrl: "https://www.jaegertracing.io/docs/latest/",
    color: "text-blue-400",
  },
  "metrics-server": {
    icon: <Gauge className="w-5 h-5" />,
    description: "Fornece métricas de recursos para kubectl top e HPA. Necessário para autoscaling.",
    installCommand: `kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml`,
    docsUrl: "https://github.com/kubernetes-sigs/metrics-server",
    color: "text-violet-400",
  },
};

export const MonitoringAgentsSuggestions = ({ agents, loading }: MonitoringAgentsSuggestionsProps) => {
  const installedCount = agents.filter(a => a.installed).length;

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            Agentes de Monitoramento
          </CardTitle>
          <Badge
            variant={installedCount === agents.length ? "default" : "secondary"}
            className="text-xs"
          >
            {installedCount}/{agents.length} instalados
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Ferramentas detectadas e sugestões de instalação para observabilidade completa
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {agents.map((agent) => {
              const info = AGENT_INFO[agent.name];
              if (!info) return null;

              return (
                <div
                  key={agent.name}
                  className={`p-3 rounded-lg border transition-all ${
                    agent.installed
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-border/50 bg-muted/20 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={info.color}>{info.icon}</span>
                      <span className="text-sm font-semibold text-foreground">{agent.name}</span>
                    </div>
                    {agent.installed ? (
                      <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" /> Instalado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Não detectado
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                    {info.description}
                  </p>
                  {agent.installed ? (
                    <div className="text-[10px] text-muted-foreground">
                      Namespace: <span className="font-mono text-foreground">{agent.namespace}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-background/80 rounded-md p-2 border border-border/30">
                        <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
                          {info.installCommand}
                        </pre>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 px-2"
                          onClick={() => copyCommand(info.installCommand)}
                        >
                          Copiar
                        </Button>
                        <a
                          href={info.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary hover:underline flex items-center gap-1"
                        >
                          Docs <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
