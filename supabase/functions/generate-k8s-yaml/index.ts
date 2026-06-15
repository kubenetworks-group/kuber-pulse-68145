import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { callGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { cluster_id, description, generate_type = "yaml", app_name, workload_type = "Deployment" } = await req.json();

    if (!cluster_id || !description) {
      return new Response(JSON.stringify({ error: "cluster_id e description são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch cluster info
    const { data: cluster } = await serviceSupabase
      .from("clusters")
      .select("name, provider, environment, nodes, pods, cpu_usage, memory_usage, status")
      .eq("id", cluster_id)
      .single();

    if (!cluster) {
      return new Response(JSON.stringify({ error: "Cluster não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch latest pod_details metric for namespace context
    const { data: podMetric } = await serviceSupabase
      .from("agent_metrics")
      .select("metric_data, collected_at")
      .eq("cluster_id", cluster_id)
      .eq("metric_type", "pod_details")
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch latest nodes metric for resource context
    const { data: nodesMetric } = await serviceSupabase
      .from("agent_metrics")
      .select("metric_data, collected_at")
      .eq("cluster_id", cluster_id)
      .eq("metric_type", "nodes")
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Extract namespaces and deployment patterns from pod data
    const pods: any[] = (podMetric?.metric_data as any)?.pods || [];
    const namespaces = [...new Set(pods.map((p: any) => p.namespace))].filter(Boolean);

    // Get examples of existing workloads (names + namespaces for pattern matching)
    const existingWorkloads = pods
      .filter((p: any) => p.status === "Running" && !["kube-system", "kodo"].includes(p.namespace))
      .slice(0, 8)
      .map((p: any) => `${p.namespace}/${p.name}`)
      .filter(Boolean);

    // Extract node resource information
    const nodeList: any[] = (nodesMetric?.metric_data as any)?.nodes || [];
    const nodeResourceSummary = nodeList.length > 0
      ? nodeList.map((n: any) => {
          const cpuCores = n.cpu_capacity_cores || n.cpu_cores || "?";
          const memGB = n.memory_capacity_gb || n.memory_gb || "?";
          return `${n.name || "node"}: ${cpuCores} CPU, ${memGB}GB RAM`;
        }).join("; ")
      : `${cluster.nodes || "?"} nodes disponíveis`;

    const clusterContext = `
ESTADO ATUAL DO CLUSTER:
- Nome: ${cluster.name}
- Provedor: ${cluster.provider || "Kubernetes"}
- Ambiente: ${cluster.environment || "production"}
- Total de nodes: ${cluster.nodes || "?"}
- Pods em execução: ${cluster.pods || "?"}
- Uso de CPU: ${cluster.cpu_usage ? Math.round(cluster.cpu_usage) + "%" : "desconhecido"}
- Uso de Memória: ${cluster.memory_usage ? Math.round(cluster.memory_usage) + "%" : "desconhecido"}
- Recursos dos nodes: ${nodeResourceSummary}
- Namespaces existentes: ${namespaces.length > 0 ? namespaces.join(", ") : "default, kube-system"}
- Workloads em execução (exemplos): ${existingWorkloads.length > 0 ? existingWorkloads.join(", ") : "nenhum encontrado"}
`;

    // ── Helm chart mode ──────────────────────────────────────────────────────
    if (generate_type === "helm") {
      const helmName = (app_name || "my-app").toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const systemPromptHelm = `Você é um engenheiro Kubernetes sênior especialista em Helm charts para plataformas internas (IDP).

Sua missão é gerar um Helm chart completo e production-ready para a aplicação descrita, usando as informações do cluster atual.

${clusterContext}

NOME DA APLICAÇÃO: ${helmName}
TIPO DE WORKLOAD: ${workload_type}

REGRAS:
1. Gere um Helm chart completo com Chart.yaml, values.yaml e templates/
2. No values.yaml: imagem, replicas, resources, service, ingress, autoscaling (todos configuráveis)
3. Templates devem usar {{ .Values.* }} para todos os valores configuráveis
4. Inclua labels padrão com {{ include "${helmName}.labels" . }}
5. Para o tipo de workload solicitado (${workload_type}), gere o template correto
6. Também gere um YAML já renderizado (com os valores defaults do values.yaml) para deploy imediato
7. Use as informações do cluster para definir resources realistas

FORMATO DE RESPOSTA OBRIGATÓRIO:
CHART_YAML_START
[conteúdo do Chart.yaml]
CHART_YAML_END
VALUES_YAML_START
[conteúdo do values.yaml]
VALUES_YAML_END
TEMPLATES_START
[todos os templates separados por # --- TEMPLATE: filename.yaml ---, ex: # --- TEMPLATE: deployment.yaml ---]
TEMPLATES_END
RENDERED_YAML_START
[YAML já renderizado com os valores do values.yaml, pronto para kubectl apply]
RENDERED_YAML_END
EXPLANATION_START
[Explicação em português: o que foi criado, como personalizar via values.yaml, e considerações importantes]
EXPLANATION_END
COMPONENTS_START
[lista de recursos gerados, ex: Deployment, Service, HPA, Ingress]
COMPONENTS_END`;

      const userMessageHelm = `Gere um Helm chart para: "${description}"

Nome da aplicação: ${helmName}
Tipo de workload principal: ${workload_type}`;

      const messagesHelm = [
        { role: "system" as const, content: systemPromptHelm },
        { role: "user" as const, content: userMessageHelm },
      ];

      console.log(`Generating Helm chart for cluster ${cluster_id}: "${description.substring(0, 80)}..."`);

      const aiResultHelm = await callGemini(messagesHelm, user.id, "generate-k8s-yaml");
      const contentHelm = aiResultHelm.content;

      const chartYamlMatch = contentHelm.match(/CHART_YAML_START\s*([\s\S]*?)\s*CHART_YAML_END/);
      const valuesYamlMatch = contentHelm.match(/VALUES_YAML_START\s*([\s\S]*?)\s*VALUES_YAML_END/);
      const templatesMatch = contentHelm.match(/TEMPLATES_START\s*([\s\S]*?)\s*TEMPLATES_END/);
      const renderedMatch = contentHelm.match(/RENDERED_YAML_START\s*([\s\S]*?)\s*RENDERED_YAML_END/);
      const explanationHelmMatch = contentHelm.match(/EXPLANATION_START\s*([\s\S]*?)\s*EXPLANATION_END/);
      const componentsHelmMatch = contentHelm.match(/COMPONENTS_START\s*([\s\S]*?)\s*COMPONENTS_END/);

      const chartYaml = chartYamlMatch?.[1]?.trim() || "";
      const valuesYaml = valuesYamlMatch?.[1]?.trim() || "";
      const templatesRaw = templatesMatch?.[1]?.trim() || "";
      const renderedYaml = renderedMatch?.[1]?.trim() || "";
      const explanationHelm = explanationHelmMatch?.[1]?.trim() || "";
      const componentsHelmRaw = componentsHelmMatch?.[1]?.trim() || "";
      const componentsHelm = componentsHelmRaw.split(",").map((c: string) => c.trim()).filter(Boolean);

      // Parse templates into { filename: content } map
      const templates: Record<string, string> = {};
      const templateParts = templatesRaw.split(/# --- TEMPLATE: ([^\s]+) ---/);
      for (let i = 1; i < templateParts.length; i += 2) {
        const filename = templateParts[i]?.trim();
        const templateContent = templateParts[i + 1]?.trim();
        if (filename && templateContent) {
          templates[filename] = templateContent;
        }
      }

      // Display YAML: combine all Helm files with comments for context
      const displayYaml = [
        `# Chart.yaml`,
        chartYaml,
        `\n# values.yaml`,
        valuesYaml,
        ...Object.entries(templates).map(([fn, content]) => `\n# templates/${fn}\n${content}`),
      ].filter(Boolean).join("\n---\n");

      await serviceSupabase.from("generated_yamls").insert({
        user_id: user.id,
        cluster_id,
        user_description: description,
        generated_yaml: displayYaml,
        explanation: explanationHelm,
        components: componentsHelm,
        generate_type: "helm",
        raw_data: {
          chart_yaml: chartYaml,
          values_yaml: valuesYaml,
          templates,
          rendered_yaml: renderedYaml,
          app_name: helmName,
          workload_type,
        },
      });

      console.log(`✅ Helm chart generated: ${componentsHelm.join(", ")}`);

      return new Response(
        JSON.stringify({
          yaml: displayYaml,
          rendered_yaml: renderedYaml,
          explanation: explanationHelm,
          components: componentsHelm,
          helm: { chart_yaml: chartYaml, values_yaml: valuesYaml, templates, app_name: helmName },
          cluster_context: { name: cluster.name, provider: cluster.provider, namespaces, node_count: cluster.nodes },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Standard K8s YAML mode ────────────────────────────────────────────────
    const systemPrompt = `Você é um engenheiro Kubernetes sênior especializado em plataformas de desenvolvimento interno (IDP - Internal Developer Platform).

Sua missão é transformar descrições em linguagem natural de desenvolvedores em manifestos Kubernetes production-ready, respeitando as características e recursos do cluster atual.

${clusterContext}

REGRAS PARA GERAÇÃO DO YAML:
1. Gere manifestos completos e prontos para produção
2. Defina resources.requests e resources.limits realistas para o cluster (baseado no uso atual)
3. Use os namespaces existentes quando fizer sentido, ou sugira um novo namespace quando apropriado
4. Inclua HPA (HorizontalPodAutoscaler) quando escalonamento automático for mencionado
5. Configure liveness e readiness probes adequados ao tipo de workload
6. Adicione labels padrão: app, version, environment, managed-by: kodo
7. Para imagens de container, use tags específicas (nunca "latest" em produção)
8. Separe múltiplos recursos com ---
9. Adicione comentários explicativos inline no YAML para decisões importantes
10. Se deployment for para ambiente de produção, use minReplicas >= 2
11. Configure PodDisruptionBudget se fizer sentido
12. Para serviços HTTP, inclua ingress ou service do tipo apropriado

FORMATO DE RESPOSTA OBRIGATÓRIO:
Responda EXATAMENTE neste formato com os delimitadores:

YAML_START
[coloque aqui o YAML completo e válido]
YAML_END
EXPLANATION_START
[Explicação em português, 3-5 frases, descrevendo: o que foi criado, por que as configurações foram escolhidas baseadas no cluster atual, e qualquer consideração importante]
EXPLANATION_END
COMPONENTS_START
[lista separada por vírgulas dos tipos de recursos criados, ex: Deployment, Service, HPA, ConfigMap]
COMPONENTS_END`;

    const userMessage = `Gere os manifestos Kubernetes para a seguinte necessidade:

"${description}"

Lembre-se de usar as informações do cluster atual (namespaces, recursos disponíveis, provedor) para gerar YAMLs otimizados para esse ambiente específico.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ];

    console.log(`Generating K8s YAML for cluster ${cluster_id}: "${description.substring(0, 80)}..."`);

    const aiResult = await callGemini(messages, user.id, "generate-k8s-yaml");
    const content = aiResult.content;

    // Parse structured response
    const yamlMatch = content.match(/YAML_START\s*([\s\S]*?)\s*YAML_END/);
    const explanationMatch = content.match(/EXPLANATION_START\s*([\s\S]*?)\s*EXPLANATION_END/);
    const componentsMatch = content.match(/COMPONENTS_START\s*([\s\S]*?)\s*COMPONENTS_END/);

    let generatedYaml = yamlMatch?.[1]?.trim() || "";
    const explanation = explanationMatch?.[1]?.trim() || "";
    const componentsRaw = componentsMatch?.[1]?.trim() || "";
    const components = componentsRaw
      .split(",")
      .map((c: string) => c.trim())
      .filter(Boolean);

    // Fallback: if no delimiters found, try to extract YAML from code blocks
    if (!generatedYaml) {
      const codeBlockMatch = content.match(/```(?:yaml|yml)?\s*([\s\S]*?)```/);
      generatedYaml = codeBlockMatch?.[1]?.trim() || content.trim();
    }

    // Save to history
    await serviceSupabase.from("generated_yamls").insert({
      user_id: user.id,
      cluster_id,
      user_description: description,
      generated_yaml: generatedYaml,
      explanation,
      components,
      generate_type: "yaml",
      raw_data: {},
    });

    console.log(`✅ YAML generated: ${components.join(", ") || "unknown components"}`);

    return new Response(
      JSON.stringify({
        yaml: generatedYaml,
        explanation,
        components,
        cluster_context: {
          name: cluster.name,
          provider: cluster.provider,
          namespaces,
          node_count: cluster.nodes,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-k8s-yaml error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno ao gerar YAML" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
