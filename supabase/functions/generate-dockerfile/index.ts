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

    const { cluster_id, description } = await req.json();

    if (!description) {
      return new Response(JSON.stringify({ error: "description é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um engenheiro DevOps especialista em containerização de aplicações para Kubernetes.

Sua missão é gerar Dockerfiles otimizados e prontos para produção a partir de descrições em linguagem natural.

REGRAS:
1. Use imagens base oficiais e versões específicas (nunca "latest" em imagens base)
2. Multi-stage build quando fizer sentido (build + runtime stages separados)
3. Execute como usuário não-root por segurança
4. Limpe caches do package manager na mesma instrução RUN para minimizar layers
5. Use COPY --chown para permissões corretas
6. Defina WORKDIR, EXPOSE, HEALTHCHECK e CMD ou ENTRYPOINT adequados
7. Para Node.js: copie package.json separado antes do código para cache de layers
8. Para Java/Go: multi-stage obrigatório (build → runtime mínimo)
9. Inclua .dockerignore no campo separado
10. Adicione comentários explicativos nas decisões importantes

FORMATO DE RESPOSTA OBRIGATÓRIO:
DOCKERFILE_START
[Dockerfile completo e otimizado]
DOCKERFILE_END
DOCKERIGNORE_START
[conteúdo do .dockerignore]
DOCKERIGNORE_END
EXPLANATION_START
[Explicação em português, 3-5 frases: o que foi criado, decisões de otimização e considerações de segurança]
EXPLANATION_END
TECH_START
[linguagem/runtime detectado, ex: Node.js 20, Python 3.12, Go 1.22, Java 21]
TECH_END`;

    const userMessage = `Gere um Dockerfile otimizado para produção para a seguinte aplicação:

"${description}"

Foque em segurança, tamanho mínimo da imagem e boas práticas de containerização.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ];

    console.log(`Generating Dockerfile: "${description.substring(0, 80)}..."`);

    const aiResult = await callGemini(messages, user.id, "generate-dockerfile");
    const content = aiResult.content;

    const dockerfileMatch = content.match(/DOCKERFILE_START\s*([\s\S]*?)\s*DOCKERFILE_END/);
    const dockerignoreMatch = content.match(/DOCKERIGNORE_START\s*([\s\S]*?)\s*DOCKERIGNORE_END/);
    const explanationMatch = content.match(/EXPLANATION_START\s*([\s\S]*?)\s*EXPLANATION_END/);
    const techMatch = content.match(/TECH_START\s*([\s\S]*?)\s*TECH_END/);

    let dockerfile = dockerfileMatch?.[1]?.trim() || "";
    const dockerignore = dockerignoreMatch?.[1]?.trim() || "";
    const explanation = explanationMatch?.[1]?.trim() || "";
    const tech = techMatch?.[1]?.trim() || "";

    if (!dockerfile) {
      const codeBlockMatch = content.match(/```(?:dockerfile|docker)?\s*([\s\S]*?)```/i);
      dockerfile = codeBlockMatch?.[1]?.trim() || content.trim();
    }

    // Save to generated_yamls table reusing the same structure
    if (cluster_id) {
      await serviceSupabase.from("generated_yamls").insert({
        user_id: user.id,
        cluster_id,
        user_description: description,
        generated_yaml: dockerfile,
        explanation,
        components: tech ? [tech] : ["Dockerfile"],
        generate_type: "dockerfile",
        raw_data: { dockerignore, tech },
      });
    }

    console.log(`✅ Dockerfile generated for: ${tech || "unknown tech"}`);

    return new Response(
      JSON.stringify({ dockerfile, dockerignore, explanation, tech }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-dockerfile error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno ao gerar Dockerfile" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
