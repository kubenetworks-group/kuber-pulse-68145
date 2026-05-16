import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Code2,
  Sparkles,
  Copy,
  Download,
  Check,
  Loader2,
  Terminal,
  Layers,
  Zap,
  Clock,
  ChevronRight,
  Info,
  Server,
  RefreshCw,
  History,
  BookOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NamespaceManager } from "@/components/NamespaceManager";

interface GeneratedResult {
  yaml: string;
  explanation: string;
  components: string[];
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
  created_at: string;
}

const EXAMPLE_PROMPTS = [
  {
    label: "Auto-scaling por CPU",
    prompt:
      "Preciso de um serviço Node.js que escale automaticamente quando a CPU passar de 70%, com mínimo de 2 réplicas em produção e máximo de 10. O container usa porta 3000.",
    icon: Zap,
    color: "text-yellow-400",
  },
  {
    label: "API com Redis",
    prompt:
      "Quero fazer deploy de uma API Python Flask com cache Redis. A API precisa de 512MB de memória, escala horizontal e se comunica com o banco de dados pelo serviço 'postgres-service'.",
    icon: Layers,
    color: "text-blue-400",
  },
  {
    label: "Worker background",
    prompt:
      "Preciso de um worker que processa filas em background, sem porta exposta, com 1 CPU e 1GB de RAM, restart automático em caso de falha, e variáveis de ambiente de uma ConfigMap.",
    icon: Terminal,
    color: "text-green-400",
  },
  {
    label: "Microsserviço com Ingress",
    prompt:
      "Deploy de um microsserviço Go no namespace 'payments', exposto via Ingress no path /api/payments, com TLS, 3 réplicas fixas, e limite de 200m CPU e 256Mi de memória.",
    icon: Server,
    color: "text-purple-400",
  },
];

// YAML syntax highlighting
const renderYamlLine = (line: string, idx: number) => {
  if (line.trim().startsWith("#")) {
    return (
      <div key={idx} className="text-slate-500 italic">
        {line}
      </div>
    );
  }
  if (line.trim() === "---") {
    return (
      <div key={idx} className="text-purple-400 font-bold mt-3">
        {line}
      </div>
    );
  }

  const keyValueMatch = line.match(/^(\s*)([\w.\-/]+)(\s*:\s*)(.*)?$/);
  if (keyValueMatch) {
    const [, indent, key, colon, value = ""] = keyValueMatch;
    let valueEl: React.ReactNode;

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      valueEl = null;
    } else if (trimmedValue.startsWith('"') || trimmedValue.startsWith("'")) {
      valueEl = <span className="text-green-400">{value}</span>;
    } else if (/^\d+(\.\d+)?$/.test(trimmedValue)) {
      valueEl = <span className="text-amber-400">{value}</span>;
    } else if (/^(true|false|null|~)$/i.test(trimmedValue)) {
      valueEl = <span className="text-orange-400">{value}</span>;
    } else if (trimmedValue.startsWith("|") || trimmedValue.startsWith(">")) {
      valueEl = <span className="text-cyan-400">{value}</span>;
    } else {
      valueEl = <span className="text-slate-200">{value}</span>;
    }

    return (
      <div key={idx}>
        <span>{indent}</span>
        <span className="text-blue-300">{key}</span>
        <span className="text-slate-500">{colon}</span>
        {valueEl}
      </div>
    );
  }

  const listItemMatch = line.match(/^(\s*-\s*)(.*)?$/);
  if (listItemMatch) {
    const [, dash, rest = ""] = listItemMatch;
    return (
      <div key={idx}>
        <span className="text-slate-500">{dash}</span>
        <span className="text-slate-200">{rest}</span>
      </div>
    );
  }

  return (
    <div key={idx} className="text-slate-300">
      {line}
    </div>
  );
};

export default function Developer() {
  const { selectedClusterId, clusters } = useCluster();
  const { user } = useAuth();
  const selectedCluster = clusters.find((c) => c.id === selectedClusterId);

  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState("yaml");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load history on mount
  useEffect(() => {
    if (selectedClusterId) {
      fetchHistory();
    }
  }, [selectedClusterId]);

  const fetchHistory = async () => {
    if (!selectedClusterId) return;
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from("generated_yamls")
        .select("id, user_description, generated_yaml, explanation, components, created_at")
        .eq("cluster_id", selectedClusterId)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory((data as HistoryItem[]) || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingHistory(false);
    }
  };

  const generate = async () => {
    if (!description.trim() || !selectedClusterId || !user) return;

    setLoading(true);
    setResult(null);
    setActiveTab("yaml");

    try {
      // 1. Fetch cluster context from Supabase client-side
      const { data: cluster } = await supabase
        .from("clusters")
        .select("name, provider, environment, nodes, pods, cpu_usage, memory_usage")
        .eq("id", selectedClusterId)
        .single();

      const { data: podMetric } = await supabase
        .from("agent_metrics")
        .select("metric_data")
        .eq("cluster_id", selectedClusterId)
        .eq("metric_type", "pod_details")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const pods: any[] = (podMetric?.metric_data as any)?.pods || [];
      const namespaces = [...new Set(pods.map((p: any) => p.namespace))].filter(Boolean);
      const runningWorkloads = pods
        .filter((p: any) => p.status === "Running" && !["kube-system", "kodo"].includes(p.namespace))
        .slice(0, 6)
        .map((p: any) => `${p.namespace}/${p.name}`);

      // 2. Build rich prompt with cluster context
      const clusterCtx = cluster
        ? `Cluster: ${cluster.name} | Provedor: ${cluster.provider || "K8s"} | Ambiente: ${cluster.environment || "production"} | Nodes: ${cluster.nodes || "?"} | CPU: ${cluster.cpu_usage ? Math.round(cluster.cpu_usage) + "%" : "?"} | Memória: ${cluster.memory_usage ? Math.round(cluster.memory_usage) + "%" : "?"}`
        : "Cluster K8s padrão";

      const namespacesCtx = namespaces.length > 0
        ? namespaces.join(", ")
        : "default";

      const workloadsCtx = runningWorkloads.length > 0
        ? runningWorkloads.join(", ")
        : "nenhum workload encontrado";

      const userPrompt = `MODO: GERAÇÃO DE YAML KUBERNETES PRODUCTION-READY

ESTADO ATUAL DO CLUSTER:
${clusterCtx}
Namespaces disponíveis: ${namespacesCtx}
Workloads em execução (exemplos): ${workloadsCtx}

PEDIDO DO DESENVOLVEDOR:
"${description.trim()}"

INSTRUÇÕES:
Gere manifestos Kubernetes completos e prontos para produção baseados no pedido e no contexto do cluster.

Regras obrigatórias:
- resources.requests e resources.limits realistas para o cluster atual
- HPA se mencionar auto-scaling/escalonamento automático
- liveness e readiness probes adequados
- Labels: app, version, environment, managed-by: kodo
- Nunca use "latest" como tag de imagem (use "v1.0.0" como placeholder)
- Múltiplos recursos separados por ---
- Se o pedido for para produção, use minReplicas >= 2

Responda EXATAMENTE neste formato:

YAML_START
[YAML completo aqui]
YAML_END

EXPLANATION_START
[Explicação em português, 3-5 frases: o que foi criado, por que as configurações foram escolhidas, considerações importantes]
EXPLANATION_END

COMPONENTS_START
[lista de tipos de recursos separados por vírgula, ex: Deployment, Service, HPA]
COMPONENTS_END`;

      // 3. Call cluster-assistant via SSE stream
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cluster-assistant`;
      const messages = [{ role: "user", content: userPrompt }];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages }),
      });

      if (!resp.ok) {
        if (resp.status === 429) throw new Error("Rate limit excedido. Tente novamente em instantes.");
        if (resp.status === 402) throw new Error("Créditos de IA insuficientes.");
        throw new Error(`Erro ${resp.status} ao chamar assistente`);
      }

      if (!resp.body) throw new Error("Sem resposta do servidor");

      // 4. Read SSE stream
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const token = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (token) fullContent += token;
          } catch {
            /* ignore parse errors */
          }
        }
      }

      // 5. Parse structured response
      const yamlMatch = fullContent.match(/YAML_START\s*([\s\S]*?)\s*YAML_END/);
      const explanationMatch = fullContent.match(/EXPLANATION_START\s*([\s\S]*?)\s*EXPLANATION_END/);
      const componentsMatch = fullContent.match(/COMPONENTS_START\s*([\s\S]*?)\s*COMPONENTS_END/);

      let generatedYaml = yamlMatch?.[1]?.trim() || "";
      const explanation = explanationMatch?.[1]?.trim() || "";
      const componentsRaw = componentsMatch?.[1]?.trim() || "";
      const components = componentsRaw.split(",").map((c: string) => c.trim()).filter(Boolean);

      // Fallback: extract from markdown code block
      if (!generatedYaml) {
        const codeBlock = fullContent.match(/```(?:yaml|yml)?\s*([\s\S]*?)```/);
        generatedYaml = codeBlock?.[1]?.trim() || fullContent.trim();
      }

      const generatedResult: GeneratedResult = {
        yaml: generatedYaml,
        explanation,
        components,
        cluster_context: {
          name: cluster?.name || "Cluster",
          provider: cluster?.provider || "",
          namespaces,
          node_count: cluster?.nodes || 0,
        },
      };

      setResult(generatedResult);
      toast.success("YAML gerado com sucesso!");

      // 6. Save to history (silently — table may not exist yet)
      try {
        await supabase.from("generated_yamls").insert({
          user_id: user.id,
          cluster_id: selectedClusterId,
          user_description: description.trim(),
          generated_yaml: generatedYaml,
          explanation,
          components,
        });
        fetchHistory();
      } catch {
        /* table not created yet — ignore */
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar YAML");
    } finally {
      setLoading(false);
    }
  };

  const copyYaml = async () => {
    if (!result?.yaml) return;
    await navigator.clipboard.writeText(result.yaml);
    setCopied(true);
    toast.success("YAML copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadYaml = () => {
    if (!result?.yaml) return;
    const blob = new Blob([result.yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = description.trim().slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    a.download = `kodo-${fileName || "manifest"}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setDescription(item.user_description);
    setResult({
      yaml: item.generated_yaml,
      explanation: item.explanation || "",
      components: item.components || [],
    });
    setActiveTab("yaml");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const useExample = (prompt: string) => {
    setDescription(prompt);
    textareaRef.current?.focus();
  };

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
              Descreva o que sua aplicação precisa em português. A IA analisa seu cluster e gera os
              manifestos Kubernetes prontos para produção.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
                        {selectedCluster.provider && (
                          <Badge variant="outline" className="text-[10px]">
                            {selectedCluster.provider}
                          </Badge>
                        )}
                        {selectedCluster.environment && (
                          <Badge variant="outline" className="text-[10px]">
                            {selectedCluster.environment}
                          </Badge>
                        )}
                        {selectedCluster.nodes && (
                          <Badge variant="outline" className="text-[10px]">
                            {selectedCluster.nodes} nodes
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Input */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Descreva sua aplicação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  ref={textareaRef}
                  placeholder="Ex: Preciso de um serviço que escale quando tiver mais de 80% de CPU, com 3 réplicas mínimas em produção e container na porta 8080..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[140px] text-sm resize-none font-mono"
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
                  disabled={!description.trim() || loading || !selectedClusterId}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando YAML...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Gerar YAML com IA
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Ctrl+Enter para gerar
                </p>
              </CardContent>
            </Card>

            {/* Example prompts */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Exemplos rápidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {EXAMPLE_PROMPTS.map((ex) => {
                  const Icon = ex.icon;
                  return (
                    <button
                      key={ex.label}
                      className="w-full text-left p-2.5 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                      onClick={() => useExample(ex.prompt)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${ex.color}`} />
                        <span className="text-xs font-medium">{ex.label}</span>
                        <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 ml-5">
                        {ex.prompt}
                      </p>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={fetchHistory}
                      disabled={loadingHistory}
                    >
                      <RefreshCw className={`h-3 w-3 ${loadingHistory ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="max-h-[280px]">
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
                                  <Badge
                                    key={c}
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 h-4"
                                  >
                                    {c}
                                  </Badge>
                                ))}
                                {item.components.length > 2 && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                    +{item.components.length - 2}
                                  </Badge>
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
                    <Code2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Descreva o que você precisa</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Escreva em português o que sua aplicação precisa. <br />
                      A IA vai analisar o seu cluster e gerar os manifestos ideais.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {["Deployment", "Service", "HPA", "Ingress", "ConfigMap"].map((r) => (
                      <Badge key={r} variant="outline" className="text-xs">
                        {r}
                      </Badge>
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
                      Gerando manifestos otimizados para seu ambiente
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
                    <span className="text-xs text-muted-foreground">Recursos gerados:</span>
                    {result.components.map((c) => (
                      <Badge key={c} className="bg-primary/15 text-primary border-primary/30 text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* YAML + Explanation tabs */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="h-8">
                          <TabsTrigger value="yaml" className="text-xs h-6 px-3">
                            <Terminal className="h-3 w-3 mr-1.5" />
                            YAML
                          </TabsTrigger>
                          <TabsTrigger value="explanation" className="text-xs h-6 px-3">
                            <BookOpen className="h-3 w-3 mr-1.5" />
                            Explicação
                          </TabsTrigger>
                          <TabsTrigger value="apply" className="text-xs h-6 px-3">
                            <Zap className="h-3 w-3 mr-1.5" />
                            Como Aplicar
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          onClick={copyYaml}
                        >
                          {copied ? (
                            <>
                              <Check className="h-3 w-3 text-green-500" />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copiar
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          onClick={downloadYaml}
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      {/* YAML Tab */}
                      <TabsContent value="yaml" className="mt-0">
                        <ScrollArea className="h-[520px] rounded-lg border bg-[#0d1117]">
                          <div className="p-4 text-[12px] font-mono leading-6">
                            {result.yaml
                              ? result.yaml.split("\n").map((line, idx) => renderYamlLine(line, idx))
                              : <span className="text-muted-foreground">YAML não disponível</span>
                            }
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      {/* Explanation Tab */}
                      <TabsContent value="explanation" className="mt-0">
                        <div className="min-h-[200px] space-y-4 p-1">
                          {result.explanation ? (
                            <div className="p-4 bg-blue-950/30 border border-blue-800/30 rounded-lg">
                              <div className="flex items-center gap-2 mb-3">
                                <Info className="h-4 w-4 text-blue-400" />
                                <span className="text-sm font-medium text-blue-300">
                                  Análise da IA
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {result.explanation}
                              </p>
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm italic">
                              Nenhuma explicação disponível.
                            </p>
                          )}

                          {result.cluster_context && (
                            <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                              <p className="text-xs font-medium mb-2 text-muted-foreground">
                                Contexto do cluster utilizado
                              </p>
                              <div className="space-y-1.5 text-xs text-muted-foreground">
                                <div className="flex gap-2">
                                  <span className="font-medium w-24">Cluster:</span>
                                  <span>{result.cluster_context.name}</span>
                                </div>
                                {result.cluster_context.provider && (
                                  <div className="flex gap-2">
                                    <span className="font-medium w-24">Provedor:</span>
                                    <span>{result.cluster_context.provider}</span>
                                  </div>
                                )}
                                {result.cluster_context.node_count && (
                                  <div className="flex gap-2">
                                    <span className="font-medium w-24">Nodes:</span>
                                    <span>{result.cluster_context.node_count}</span>
                                  </div>
                                )}
                                {result.cluster_context.namespaces?.length > 0 && (
                                  <div className="flex gap-2">
                                    <span className="font-medium w-24">Namespaces:</span>
                                    <span>{result.cluster_context.namespaces.join(", ")}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      {/* How to Apply Tab */}
                      <TabsContent value="apply" className="mt-0">
                        <div className="space-y-4 p-1">
                          <div className="p-4 bg-amber-950/20 border border-amber-800/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Info className="h-4 w-4 text-amber-400" />
                              <span className="text-sm font-medium text-amber-300">
                                Revise antes de aplicar
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Verifique o YAML gerado, ajuste imagens de container, variáveis de
                              ambiente e secrets antes de aplicar em produção.
                            </p>
                          </div>

                          <div className="space-y-3">
                            <p className="text-sm font-medium">Passos para aplicar:</p>

                            {[
                              {
                                step: "1",
                                title: "Salve o arquivo",
                                cmd: `# Clique em "Download" ou copie e salve como:\nkodo-manifest.yaml`,
                              },
                              {
                                step: "2",
                                title: "Revise e ajuste",
                                cmd: `# Edite a imagem do container:\n# image: sua-registry/sua-imagem:v1.0.0\n\n# Configure secrets e variáveis de ambiente`,
                              },
                              {
                                step: "3",
                                title: "Aplique no cluster",
                                cmd: `kubectl apply -f kodo-manifest.yaml`,
                              },
                              {
                                step: "4",
                                title: "Acompanhe o rollout",
                                cmd: `kubectl rollout status deployment/<nome-do-deployment>\nkubectl get pods -n <namespace> -w`,
                              },
                            ].map((item) => (
                              <div key={item.step} className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary">
                                  {item.step}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium mb-1">{item.title}</p>
                                  <pre className="text-[11px] font-mono bg-[#0d1117] p-2.5 rounded-lg text-green-400 overflow-x-auto border border-border/30">
                                    {item.cmd}
                                  </pre>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Generate again */}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={generate}
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerar YAML
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Namespace Manager */}
        <div className="border-t border-border/50 pt-6">
          <NamespaceManager />
        </div>
      </div>
    </DashboardLayout>
  );
}
