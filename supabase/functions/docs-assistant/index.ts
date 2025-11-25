import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get authorization header to identify user
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    // Get user's last message to search documentation
    const lastUserMessage = messages[messages.length - 1];
    const searchQuery = lastUserMessage?.content || "";

    // Search relevant documentation
    let relevantDocs = "";
    if (userId && searchQuery) {
      const { data: docs, error: docsError } = await supabase
        .from("documentation")
        .select("title, content, category, tags")
        .or(`user_id.eq.${userId},is_public.eq.true`)
        .ilike("content", `%${searchQuery.slice(0, 100)}%`)
        .limit(5);

      if (!docsError && docs && docs.length > 0) {
        relevantDocs = "\n\n**Documentação Relevante:**\n\n" + docs.map(doc => 
          `### ${doc.title} (${doc.category})\n${doc.content}\n---`
        ).join("\n\n");
      }
    }

    const systemPrompt = `Você é um assistente especializado no sistema Kodo - uma plataforma de gerenciamento inteligente de infraestrutura Kubernetes multi-cloud.

**Sobre o Kodo:**
- Plataforma de monitoramento e gerenciamento de clusters Kubernetes
- Suporte para múltiplos provedores: AWS EKS, GCP GKE, Azure AKS, DigitalOcean, on-premise
- Recursos principais: AI Monitor, gestão de custos, análise de storage, auto-healing
- Integração com agentes Kubernetes para coleta de métricas em tempo real
- Interface React com Tailwind CSS e componentes Shadcn UI
- Backend Supabase com edge functions e banco de dados PostgreSQL

**Suas responsabilidades:**
- Responder perguntas sobre funcionalidades do sistema
- Explicar como usar recursos específicos (AI Monitor, Clusters, Costs, Storage, etc)
- Fornecer exemplos de código quando relevante
- Guiar na configuração e troubleshooting
- Sugerir melhores práticas

**Diretrizes:**
- Seja claro, conciso e técnico quando apropriado
- Use exemplos práticos e código quando relevante
- Forneça links para documentação quando disponível
- Mantenha respostas focadas (2-5 parágrafos)
- Use formatação markdown para melhor legibilidade
- Se não souber algo, seja honesto e sugira onde procurar

${relevantDocs}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns instantes." }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos ao workspace." }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao comunicar com o assistente." }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Docs assistant error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
