import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Code2, Sparkles, Copy, Download, Check, Loader2, Terminal,
  Layers, Zap, Clock, ChevronRight, Info, Server, RefreshCw,
  History, BookOpen, Package, FileCode2, Rocket, CheckCircle2,
  XCircle, AlertCircle, Play,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NamespaceManager } from "@/components/NamespaceManager";

type GenerateMode = "yaml" | "helm" | "dockerfile";

interface GeneratedResult {
  yaml: string;
  explanation: string;
  components: string[];
  generate_type: GenerateMode;
  // Helm extras
  rendered_yaml?: string;
  helm?: {
    chart_yaml: string;
    values_yaml: string;
    templates: Record<string, string>;
    app_name: string;
  };
  // Dockerfile extras
  dockerfile?: string;
  dockerignore?: string;
  tech?: string;
  cluster_context?: {
    name: string;
    provider: string;
    namespaces: string[];
    node_count: number;
  };
}

interface HistoryItem {
  id: string;
  user_description: string;
  generated_yaml: string;
  explanation: string | null;
  components: string[] | null;
  generate_type: string | null;
  created_at: string;
}

type DeployStatus = "idle" | "deploying" | "success" | "failed" | "offline";

const WORKLOAD_TYPES = ["Deployment", "StatefulSet", "DaemonSet", "CronJob", "Job"];

const EXAMPLE_PROMPTS: Record<GenerateMode, { label: string; prompt: string; icon: typeof Zap; color: string }[]> = {
  yaml: [
    { label: "Auto-scaling por CPU", prompt: "Preciso de um serviço Node.js que escale automaticamente quando a CPU passar de 70%, com mínimo de 2 réplicas em produção e máximo de 10. O container usa porta 3000.", icon: Zap, color: "text-yellow-400" },
    { label: "API com Redis", prompt: "Quero fazer deploy de uma API Python Flask com cache Redis. A API precisa de 512MB de memória, escala horizontal e se comunica com o banco de dados pelo serviço 'postgres-service'.", icon: Layers, color: "text-blue-400" },
    { label: "Worker background", prompt: "Preciso de um worker que processa filas em background, sem porta exposta, com 1 CPU e 1GB de RAM, restart automático em caso de falha, e variáveis de ambiente de uma ConfigMap.", icon: Terminal, color: "text-green-400" },
    { label: "Microsserviço com Ingress", prompt: "Deploy de um microsserviço Go no namespace 'payments', exposto via Ingress no path /api/payments, com TLS, 3 réplicas fixas, e limite de 200m CPU e 256Mi de memória.", icon: Server, color: "text-purple-400" },
  ],
  helm: [
    { label: "API REST escalável", prompt: "API REST em Node.js com auto-scaling, variáveis de ambiente configuráveis e expose via Ingress com TLS.", icon: Layers, color: "text-blue-400" },
    { label: "Worker com ConfigMap", prompt: "Worker de processamento de filas em Python com configuração externalizada via ConfigMap e secrets do ambiente.", icon: Terminal, color: "text-green-400" },
    { label: "Banco com PV", prompt: "PostgreSQL com PersistentVolume, backup via CronJob, e sidecar para métricas Prometheus.", icon: Server, color: "text-purple-400" },
    { label: "Microsserviço gRPC", prompt: "Serviço gRPC em Go com health checks, múltiplas réplicas e política de restart agressiva.", icon: Zap, color: "text-yellow-400" },
  ],
  dockerfile: [
    { label: "API Node.js", prompt: "API Node.js 20 com Express, multi-stage build, usuário não-root e health check na rota /health.", icon: Zap, color: "text-yellow-400" },
    { label: "App Python Flask", prompt: "Aplicação Python 3.12 com Flask e dependências em requirements.txt, otimizada para produção com gunicorn.", icon: Terminal, color: "text-green-400" },
    { label: "Serviço Go", prompt: "Serviço Go 1.22 com multi-stage build: compilação no builder e runtime mínimo com scratch ou distroless.", icon: Layers, color: "text-blue-400" },
    { label: "App Java Spring", prompt: "Aplicação Java 21 Spring Boot com Maven, multi-stage build e runtime mínimo com Eclipse Temurin JRE.", icon: Server, color: "text-purple-400" },
  ],
};

// YAML / Dockerfile syntax highlighting
const renderCodeLine = (line: string, idx: number, isDockerfile = false) => {
  if (isDockerfile) {
    const instruction = line.match(/^(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\b/);
    if (instruction) {
      return (
        <div key={idx}>
          <span className="text-purple-400 font-bold">{instruction[1]}</span>
          <span className="text-slate-200">{line.slice(instruction[1].length)}</span>
        </div>
      );
    }
    if (line.trim().startsWith("#")) {
      return <div key={idx} className="text-slate-500 italic">{line}</div>;
    }
    return <div key={idx} className="text-slate-300">{line}</div>;
  }

  if (line.trim().startsWith("#")) return <div key={idx} className="text-slate-500 italic">{line}</div>;
  if (line.trim() === "---") return <div key={idx} className="text-purple-400 font-bold mt-3">{line}</div>;

  const keyValueMatch = line.match(/^(\s*)([\w.\-/{}]+)(\s*:\s*)(.*)?$/);
  if (keyValueMatch) {
    const [, indent, key, colon, value = ""] = keyValueMatch;
    const trimmed = value.trim();
    let valueEl: React.ReactNode;
    if (!trimmed) valueEl = null;
    else if (trimmed.startsWith('"') || trimmed.startsWith("'")) valueEl = <span className="text-green-400">{value}</span>;
    else if (/^\d+(\.\d+)?$/.test(trimmed)) valueEl = <span className="text-amber-400">{value}</span>;
    else if (/^(true|false|null|~)$/i.test(trimmed)) valueEl = <span className="text-orange-400">{value}</span>;
    else if (trimmed.startsWith("|") || trimmed.startsWith(">")) valueEl = <span className="text-cyan-400">{value}</span>;
    else valueEl = <span className="text-slate-200">{value}</span>;
    return (
      <div key={idx}>
        <span>{indent}</span>
        <span className="text-blue-300">{key}</span>
        <span className="text-slate-500">{colon}</span>
        {valueEl}
      </div>
    );
  }
  const listMatch = line.match(/^(\s*-\s*)(.*)?$/);
  if (listMatch) {
    const [, dash, rest = ""] = listMatch;
    return <div key={idx}><span className="text-slate-500">{dash}</span><span className="text-slate-200">{rest}</span></div>;
  }
  return <div key={idx} className="text-slate-300">{line}</div>;
};

export default function Developer() {
  const { selectedClusterId, clusters } = useCluster();
  const { user } = useAuth();
  const selectedCluster = clusters.find((c) => c.id === selectedClusterId);

  // Mode tabs
  const [mode, setMode] = useState<GenerateMode>("yaml");

  // Input state
  const [description, setDescription] = useState("");
  const [appName, setAppName] = useState("");
  const [workloadType, setWorkloadType] = useState("Deployment");

  // Generation state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeOutputTab, setActiveOutputTab] = useState("code");

  // Helm sub-tab (chart / values / templates)
  const [helmTab, setHelmTab] = useState("rendered");

  // Deploy state
  const [deployStatus, setDeployStatus] = useState<DeployStatus>("idle");
  const [deployCommandId, setDeployCommandId] = useState<string | null>(null);
  const deployPollRef = useRef<number | null>(null);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (selectedClusterId) fetchHistory();
  }, [selectedClusterId, mode]);

  // Clear result when switching mode
  useEffect(() => {
    setResult(null);
    setDeployStatus("idle");
    setDeployCommandId(null);
  }, [mode]);

  const fetchHistory = async () => {
    if (!selectedClusterId) return;
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from("generated_yamls")
        .select("id, user_description, generated_yaml, explanation, components, generate_type, created_at")
        .eq("cluster_id", selectedClusterId)
        .eq("generate_type", mode)
        .order("created_at", { ascending: false })
        .limit(8);
      setHistory((data as HistoryItem[]) || []);
    } catch { /* ignore */ } finally {
      setLoadingHistory(false);
    }
  };

  const generate = async () => {
    if (!description.trim() || !selectedClusterId || !user) return;
    if (mode === "helm" && !appName.trim()) {
      toast.error("Informe o nome da aplicação para o Helm chart.");
      return;
    }

    setLoading(true);
    setResult(null);
    setDeployStatus("idle");
    setDeployCommandId(null);
    setActiveOutputTab("code");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

      let endpoint = "";
      let body: Record<string, unknown> = { cluster_id: selectedClusterId, description: description.trim() };

      if (mode === "yaml") {
        endpoint = "generate-k8s-yaml";
        body.generate_type = "yaml";
      } else if (mode === "helm") {
        endpoint = "generate-k8s-yaml";
        body.generate_type = "helm";
        body.app_name = appName.trim();
        body.workload_type = workloadType;
      } else {
        endpoint = "generate-dockerfile";
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) throw new Error("Limite de velocidade da IA atingido. Aguarde 1 minuto.");
        const errData = await resp.json().catch(() => ({}));
        const errMsg = errData.error || `Erro ${resp.status}`;
        if (errMsg.includes("Limite de") && errMsg.includes("análises de IA")) {
          toast.error(errMsg, { action: { label: "Ver planos", onClick: () => window.open("/plans", "_blank") }, duration: 8000 });
          return;
        }
        throw new Error(errMsg);
      }

      const data = await resp.json();

      if (mode === "dockerfile") {
        if (!data.dockerfile) throw new Error("A IA não retornou um Dockerfile válido.");
        setResult({
          yaml: data.dockerfile,
          explanation: data.explanation || "",
          components: data.tech ? [data.tech] : ["Dockerfile"],
          generate_type: "dockerfile",
          dockerfile: data.dockerfile,
          dockerignore: data.dockerignore,
          tech: data.tech,
        });
        toast.success("Dockerfile gerado com sucesso!");
      } else {
        if (!data.yaml) throw new Error("A IA não retornou um YAML válido.");
        setResult({
          yaml: data.yaml,
          explanation: data.explanation || "",
          components: data.components || [],
          generate_type: mode,
          rendered_yaml: data.rendered_yaml,
          helm: data.helm,
          cluster_context: data.cluster_context,
        });
        toast.success(mode === "helm" ? "Helm chart gerado com sucesso!" : "YAML gerado com sucesso!");
      }

      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    const text = result?.yaml || "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    if (!result) return;
    const text = result.yaml;
    const ext = mode === "dockerfile" ? "Dockerfile" : "yaml";
    const fname = description.trim().slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = mode === "dockerfile" ? "Dockerfile" : `kodo-${fname || "manifest"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deployToCluster = async () => {
    if (!result || !selectedClusterId) return;
    const yamlToDeploy = mode === "helm" ? (result.rendered_yaml || result.yaml) : result.yaml;
    if (!yamlToDeploy || mode === "dockerfile") return;

    setDeployStatus("deploying");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada.");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-to-cluster`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            cluster_id: selectedClusterId,
            yaml_content: yamlToDeploy,
            namespace: "default",
          }),
        }
      );

      const data = await resp.json();
      if (!resp.ok) {
        if (data.agent_offline) {
          setDeployStatus("offline");
          toast.error("Agente offline. Aguarde o agente conectar e tente novamente.");
          return;
        }
        throw new Error(data.error || `Erro ${resp.status}`);
      }

      setDeployCommandId(data.command_id);
      toast.success("Deploy enviado! Aguardando execução pelo agente...");
      startDeployPolling(data.command_id);
    } catch (err: any) {
      setDeployStatus("failed");
      toast.error(err.message || "Erro ao fazer deploy");
    }
  };

  const startDeployPolling = (commandId: string) => {
    if (deployPollRef.current) clearInterval(deployPollRef.current);
    let attempts = 0;
    deployPollRef.current = window.setInterval(async () => {
      attempts++;
      if (attempts > 40) { // 2 min timeout
        clearInterval(deployPollRef.current!);
        setDeployStatus("failed");
        toast.error("Timeout aguardando o agente executar o deploy.");
        return;
      }
      try {
        const { data } = await supabase
          .from("agent_commands")
          .select("status, result")
          .eq("id", commandId)
          .single();

        if (data?.status === "completed") {
          clearInterval(deployPollRef.current!);
          setDeployStatus("success");
          const r = data.result as any;
          toast.success(`Deploy concluído! ${r?.applied || 0} recursos aplicados.`);
        } else if (data?.status === "failed") {
          clearInterval(deployPollRef.current!);
          setDeployStatus("failed");
          const r = data.result as any;
          toast.error(`Deploy falhou: ${r?.error || "verifique o log do agente"}`);
        }
      } catch { /* keep polling */ }
    }, 3000);
  };

  const loadFromHistory = (item: HistoryItem) => {
    const gtype = (item.generate_type || "yaml") as GenerateMode;
    setMode(gtype);
    setDescription(item.user_description);
    setResult({
      yaml: item.generated_yaml,
      explanation: item.explanation || "",
      components: item.components || [],
      generate_type: gtype,
      dockerfile: gtype === "dockerfile" ? item.generated_yaml : undefined,
    });
    setActiveOutputTab("code");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isDeployable = result && mode !== "dockerfile";

  const deployableYaml = mode === "helm" ? (result?.rendered_yaml || result?.yaml || "") : (result?.yaml || "");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
            <Code2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Plataforma do Desenvolvedor
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Beta</Badge>
            </h1>
            <p className="text-muted-foreground mt-0.5">
              Descreva sua aplicação em português. A IA gera manifestos Kubernetes, Helm charts ou Dockerfiles prontos para produção.
            </p>
          </div>
        </div>

        {/* Mode selector tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as GenerateMode)}>
          <TabsList className="h-10 gap-1">
            <TabsTrigger value="yaml" className="gap-2 text-sm">
              <Terminal className="h-4 w-4" />
              K8s YAML
            </TabsTrigger>
            <TabsTrigger value="helm" className="gap-2 text-sm">
              <Package className="h-4 w-4" />
              Helm Chart
            </TabsTrigger>
            <TabsTrigger value="dockerfile" className="gap-2 text-sm">
              <FileCode2 className="h-4 w-4" />
              Dockerfile
            </TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4">
            {/* Left Column — Input */}
            <div className="lg:col-span-2 space-y-4">
              {/* Cluster context banner */}
              {selectedCluster && (
                <Card className="border-border/50 bg-card/60">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Server className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{selectedCluster.name}</span>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {selectedCluster.provider && <Badge variant="outline" className="text-[10px]">{selectedCluster.provider}</Badge>}
                          {selectedCluster.environment && <Badge variant="outline" className="text-[10px]">{selectedCluster.environment}</Badge>}
                          {selectedCluster.nodes && <Badge variant="outline" className="text-[10px]">{selectedCluster.nodes} nodes</Badge>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Input card */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {mode === "yaml" && "Descreva sua aplicação"}
                    {mode === "helm" && "Configure o Helm Chart"}
                    {mode === "dockerfile" && "Descreva o container"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Helm-specific fields */}
                  {mode === "helm" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome da aplicação *</Label>
                        <Input
                          placeholder="ex: my-api"
                          value={appName}
                          onChange={(e) => setAppName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                          className="h-8 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo de workload</Label>
                        <Select value={workloadType} onValueChange={setWorkloadType}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WORKLOAD_TYPES.map((wt) => (
                              <SelectItem key={wt} value={wt}>{wt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <Textarea
                    ref={textareaRef}
                    placeholder={
                      mode === "yaml"
                        ? "Ex: Preciso de um serviço que escale quando tiver mais de 80% de CPU, com 3 réplicas mínimas em produção e container na porta 8080..."
                        : mode === "helm"
                        ? "Ex: API REST em Node.js com auto-scaling, expose via Ingress com TLS e variáveis de ambiente configuráveis..."
                        : "Ex: API Node.js 20 com Express, multi-stage build, usuário não-root, health check na rota /health..."
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[120px] text-sm resize-none font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        generate();
                      }
                    }}
                  />
                  <Button
                    className="w-full gap-2"
                    onClick={generate}
                    disabled={!description.trim() || loading || !selectedClusterId || (mode === "helm" && !appName.trim())}
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />
                        {mode === "yaml" && "Gerando YAML..."}
                        {mode === "helm" && "Gerando Helm chart..."}
                        {mode === "dockerfile" && "Gerando Dockerfile..."}
                      </>
                    ) : (
                      <><Sparkles className="h-4 w-4" />
                        {mode === "yaml" && "Gerar YAML com IA"}
                        {mode === "helm" && "Gerar Helm Chart com IA"}
                        {mode === "dockerfile" && "Gerar Dockerfile com IA"}
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">Ctrl+Enter para gerar</p>
                </CardContent>
              </Card>

              {/* Examples */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Exemplos rápidos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {EXAMPLE_PROMPTS[mode].map((ex) => {
                    const Icon = ex.icon;
                    return (
                      <button
                        key={ex.label}
                        className="w-full text-left p-2.5 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                        onClick={() => { setDescription(ex.prompt); textareaRef.current?.focus(); }}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${ex.color}`} />
                          <span className="text-xs font-medium">{ex.label}</span>
                          <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 ml-5">{ex.prompt}</p>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              {/* History */}
              {history.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <History className="h-3.5 w-3.5" />
                        Histórico
                      </CardTitle>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={fetchHistory} disabled={loadingHistory}>
                        <RefreshCw className={`h-3 w-3 ${loadingHistory ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="max-h-[240px]">
                      <div className="space-y-1.5">
                        {history.map((item) => (
                          <button
                            key={item.id}
                            className="w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                            onClick={() => loadFromHistory(item)}
                          >
                            <p className="text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
                              {item.user_description}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                              {item.components && item.components.length > 0 && (
                                <div className="flex gap-1 ml-auto">
                                  {item.components.slice(0, 2).map((c) => (
                                    <Badge key={c} variant="outline" className="text-[9px] px-1 py-0 h-4">{c}</Badge>
                                  ))}
                                  {item.components.length > 2 && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">+{item.components.length - 2}</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column — Output */}
            <div className="lg:col-span-3 space-y-4">
              {!result && !loading && (
                <Card className="border-border/50 border-dashed">
                  <CardContent className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="p-4 rounded-full bg-muted/50">
                      {mode === "dockerfile" ? <FileCode2 className="h-8 w-8 text-muted-foreground" /> : <Code2 className="h-8 w-8 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium">
                        {mode === "yaml" && "Descreva o que você precisa"}
                        {mode === "helm" && "Configure seu Helm chart"}
                        {mode === "dockerfile" && "Descreva seu container"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {mode === "yaml" && "Escreva em português. A IA analisa seu cluster e gera os manifestos ideais."}
                        {mode === "helm" && "Informe o nome da aplicação e o tipo de workload. A IA gera o chart completo."}
                        {mode === "dockerfile" && "Descreva a linguagem e necessidades. A IA gera um Dockerfile otimizado com multi-stage build."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {mode === "yaml" && ["Deployment", "Service", "HPA", "Ingress", "ConfigMap"].map((r) => (
                        <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                      ))}
                      {mode === "helm" && ["Chart.yaml", "values.yaml", "templates/", "NOTES.txt"].map((r) => (
                        <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                      ))}
                      {mode === "dockerfile" && ["Multi-stage", "Non-root", "HEALTHCHECK", ".dockerignore"].map((r) => (
                        <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {loading && (
                <Card className="border-border/50">
                  <CardContent className="py-20 flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      <Code2 className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">A IA está analisando seu cluster...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {mode === "helm" && "Gerando Chart.yaml, values.yaml e templates..."}
                        {mode === "dockerfile" && "Otimizando o Dockerfile para produção..."}
                        {mode === "yaml" && "Gerando manifestos otimizados para seu ambiente..."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {result && !loading && (
                <>
                  {/* Components generated */}
                  {result.components.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {mode === "dockerfile" ? "Tecnologia:" : "Recursos gerados:"}
                      </span>
                      {result.components.map((c) => (
                        <Badge key={c} className="bg-primary/15 text-primary border-primary/30 text-xs">{c}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Output card */}
                  <Card className="border-border/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Tabs value={activeOutputTab} onValueChange={setActiveOutputTab}>
                          <TabsList className="h-8">
                            <TabsTrigger value="code" className="text-xs h-6 px-3">
                              <Terminal className="h-3 w-3 mr-1.5" />
                              {mode === "helm" ? "Chart" : mode === "dockerfile" ? "Dockerfile" : "YAML"}
                            </TabsTrigger>
                            <TabsTrigger value="explanation" className="text-xs h-6 px-3">
                              <BookOpen className="h-3 w-3 mr-1.5" />
                              Explicação
                            </TabsTrigger>
                            {isDeployable && (
                              <TabsTrigger value="deploy" className="text-xs h-6 px-3">
                                <Rocket className="h-3 w-3 mr-1.5" />
                                Deploy
                              </TabsTrigger>
                            )}
                            {mode === "dockerfile" && (
                              <TabsTrigger value="apply" className="text-xs h-6 px-3">
                                <Zap className="h-3 w-3 mr-1.5" />
                                Como Usar
                              </TabsTrigger>
                            )}
                          </TabsList>
                        </Tabs>
                        <div className="flex gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={copyCode}>
                            {copied ? <><Check className="h-3 w-3 text-green-500" />Copiado!</> : <><Copy className="h-3 w-3" />Copiar</>}
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={downloadCode}>
                            <Download className="h-3 w-3" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <Tabs value={activeOutputTab} onValueChange={setActiveOutputTab}>

                        {/* Code tab */}
                        <TabsContent value="code" className="mt-0">
                          {mode === "helm" && result.helm && (
                            <div className="mb-3">
                              <Tabs value={helmTab} onValueChange={setHelmTab}>
                                <TabsList className="h-7 text-xs">
                                  <TabsTrigger value="rendered" className="h-5 text-[11px] px-2">YAML renderizado</TabsTrigger>
                                  <TabsTrigger value="chart" className="h-5 text-[11px] px-2">Chart.yaml</TabsTrigger>
                                  <TabsTrigger value="values" className="h-5 text-[11px] px-2">values.yaml</TabsTrigger>
                                  <TabsTrigger value="templates" className="h-5 text-[11px] px-2">Templates</TabsTrigger>
                                </TabsList>
                              </Tabs>
                            </div>
                          )}

                          <ScrollArea className="h-[480px] rounded-lg border bg-[#0d1117]">
                            <div className="p-4 text-[12px] font-mono leading-6">
                              {(() => {
                                let displayCode = result.yaml;
                                if (mode === "helm" && result.helm) {
                                  if (helmTab === "rendered") displayCode = result.rendered_yaml || result.yaml;
                                  else if (helmTab === "chart") displayCode = result.helm.chart_yaml;
                                  else if (helmTab === "values") displayCode = result.helm.values_yaml;
                                  else if (helmTab === "templates") {
                                    displayCode = Object.entries(result.helm.templates || {})
                                      .map(([fn, content]) => `# templates/${fn}\n${content}`)
                                      .join("\n---\n");
                                  }
                                }
                                return displayCode
                                  ? displayCode.split("\n").map((line, idx) => renderCodeLine(line, idx, mode === "dockerfile"))
                                  : <span className="text-muted-foreground">Conteúdo não disponível</span>;
                              })()}
                            </div>
                          </ScrollArea>

                          {mode === "dockerfile" && result.dockerignore && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1.5">.dockerignore</p>
                              <ScrollArea className="max-h-32 rounded-lg border bg-[#0d1117]">
                                <div className="p-3 text-[11px] font-mono text-slate-400 leading-5">
                                  {result.dockerignore.split("\n").map((line, i) => (
                                    <div key={i}>{line}</div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}
                        </TabsContent>

                        {/* Explanation tab */}
                        <TabsContent value="explanation" className="mt-0">
                          <div className="min-h-[200px] space-y-4 p-1">
                            {result.explanation ? (
                              <div className="p-4 bg-blue-950/30 border border-blue-800/30 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                  <Info className="h-4 w-4 text-blue-400" />
                                  <span className="text-sm font-medium text-blue-300">Análise da IA</span>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{result.explanation}</p>
                              </div>
                            ) : (
                              <p className="text-muted-foreground text-sm italic">Nenhuma explicação disponível.</p>
                            )}

                            {result.cluster_context && (
                              <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                                <p className="text-xs font-medium mb-2 text-muted-foreground">Contexto do cluster utilizado</p>
                                <div className="space-y-1.5 text-xs text-muted-foreground">
                                  <div className="flex gap-2"><span className="font-medium w-24">Cluster:</span><span>{result.cluster_context.name}</span></div>
                                  {result.cluster_context.provider && <div className="flex gap-2"><span className="font-medium w-24">Provedor:</span><span>{result.cluster_context.provider}</span></div>}
                                  {result.cluster_context.node_count && <div className="flex gap-2"><span className="font-medium w-24">Nodes:</span><span>{result.cluster_context.node_count}</span></div>}
                                  {result.cluster_context.namespaces?.length > 0 && <div className="flex gap-2"><span className="font-medium w-24">Namespaces:</span><span>{result.cluster_context.namespaces.join(", ")}</span></div>}
                                </div>
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        {/* Deploy tab */}
                        {isDeployable && (
                          <TabsContent value="deploy" className="mt-0">
                            <div className="space-y-4 p-1">
                              <div className="p-4 bg-amber-950/20 border border-amber-800/30 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertCircle className="h-4 w-4 text-amber-400" />
                                  <span className="text-sm font-medium text-amber-300">Revise antes de fazer deploy</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Verifique o YAML gerado, ajuste imagens de container, variáveis de ambiente e secrets antes de aplicar em produção.
                                  {mode === "helm" && " O YAML renderizado com os valores padrão do values.yaml será aplicado."}
                                </p>
                              </div>

                              {/* Deploy button + status */}
                              <div className="space-y-3">
                                {deployStatus === "idle" && (
                                  <Button
                                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={deployToCluster}
                                    disabled={!selectedClusterId}
                                  >
                                    <Play className="h-4 w-4" />
                                    Deploy no Cluster — {selectedCluster?.name || "selecione um cluster"}
                                  </Button>
                                )}

                                {deployStatus === "deploying" && (
                                  <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                                    <div>
                                      <p className="text-sm font-medium">Enviando para o agente...</p>
                                      <p className="text-xs text-muted-foreground">Aguardando execução no cluster {selectedCluster?.name}</p>
                                    </div>
                                  </div>
                                )}

                                {deployStatus === "success" && (
                                  <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                                    <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-green-300">Deploy concluído com sucesso!</p>
                                      <p className="text-xs text-muted-foreground">Recursos aplicados no cluster {selectedCluster?.name}</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setDeployStatus("idle"); setDeployCommandId(null); }}>
                                      Novo deploy
                                    </Button>
                                  </div>
                                )}

                                {deployStatus === "failed" && (
                                  <div className="flex items-center gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                                    <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-red-300">Deploy falhou</p>
                                      <p className="text-xs text-muted-foreground">Verifique os logs do agente para mais detalhes</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setDeployStatus("idle"); setDeployCommandId(null); }}>
                                      Tentar novamente
                                    </Button>
                                  </div>
                                )}

                                {deployStatus === "offline" && (
                                  <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                                    <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-amber-300">Agente offline</p>
                                      <p className="text-xs text-muted-foreground">O agente não está conectado. Verifique se o kodo-agent está rodando no cluster.</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setDeployStatus("idle"); }}>
                                      Tentar novamente
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Preview of what will be deployed */}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                                  {mode === "helm" ? "YAML renderizado que será aplicado:" : "YAML que será aplicado:"}
                                </p>
                                <ScrollArea className="max-h-52 rounded-lg border bg-[#0d1117]">
                                  <div className="p-3 text-[11px] font-mono text-slate-400 leading-5">
                                    {deployableYaml.split("\n").slice(0, 30).map((line, i) => (
                                      <div key={i}>{line}</div>
                                    ))}
                                    {deployableYaml.split("\n").length > 30 && (
                                      <div className="text-slate-600 mt-1">... ({deployableYaml.split("\n").length - 30} linhas adicionais)</div>
                                    )}
                                  </div>
                                </ScrollArea>
                              </div>
                            </div>
                          </TabsContent>
                        )}

                        {/* Dockerfile How-to tab */}
                        {mode === "dockerfile" && (
                          <TabsContent value="apply" className="mt-0">
                            <div className="space-y-4 p-1">
                              <div className="p-4 bg-blue-950/20 border border-blue-800/30 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <Info className="h-4 w-4 text-blue-400" />
                                  <span className="text-sm font-medium text-blue-300">Como containerizar e fazer push</span>
                                </div>
                              </div>
                              {[
                                { step: "1", title: "Salve o Dockerfile", cmd: `# Clique em "Download" para salvar o Dockerfile\n# Ou copie e salve como "Dockerfile" na raiz do projeto` },
                                { step: "2", title: "Faça o build", cmd: `docker build -t minha-imagem:v1.0.0 .` },
                                { step: "3", title: "Envie para o registry", cmd: `# Docker Hub:\ndocker tag minha-imagem:v1.0.0 seu-usuario/minha-imagem:v1.0.0\ndocker push seu-usuario/minha-imagem:v1.0.0\n\n# GitHub Container Registry:\ndocker tag minha-imagem:v1.0.0 ghcr.io/seu-usuario/minha-imagem:v1.0.0\ndocker push ghcr.io/seu-usuario/minha-imagem:v1.0.0` },
                                { step: "4", title: "Use no YAML K8s", cmd: `# Volte à aba "K8s YAML" e descreva o deploy\n# usando a imagem que acabou de publicar` },
                              ].map((item) => (
                                <div key={item.step} className="flex gap-3">
                                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary">
                                    {item.step}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium mb-1">{item.title}</p>
                                    <pre className="text-[11px] font-mono bg-[#0d1117] p-2.5 rounded-lg text-green-400 overflow-x-auto border border-border/30">{item.cmd}</pre>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TabsContent>
                        )}
                      </Tabs>
                    </CardContent>
                  </Card>

                  {/* Regenerate */}
                  <Button variant="outline" className="w-full gap-2" onClick={generate} disabled={loading}>
                    <RefreshCw className="h-4 w-4" />
                    {mode === "yaml" && "Regenerar YAML"}
                    {mode === "helm" && "Regenerar Helm Chart"}
                    {mode === "dockerfile" && "Regenerar Dockerfile"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Tabs>

        {/* Namespace Manager */}
        <div className="border-t border-border/50 pt-6">
          <NamespaceManager />
        </div>
      </div>
    </DashboardLayout>
  );
}
