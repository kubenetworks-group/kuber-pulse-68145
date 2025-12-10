import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHLY_CHAT_LIMIT = 50; // Limite mensal de mensagens

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

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }), 
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check monthly usage limit
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("ai_analyses_used, ai_analyses_reset_at, plan")
      .eq("user_id", userId)
      .single();

    if (subError) {
      console.error("Error fetching subscription:", subError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar limite de uso" }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if we need to reset the counter (new month)
    const resetAt = new Date(subscription.ai_analyses_reset_at);
    const now = new Date();
    const shouldReset = now > resetAt;

    let currentUsage = subscription.ai_analyses_used || 0;
    
    if (shouldReset) {
      // Reset counter for new month
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await supabase
        .from("subscriptions")
        .update({ 
          ai_analyses_used: 1, 
          ai_analyses_reset_at: nextReset.toISOString() 
        })
        .eq("user_id", userId);
      currentUsage = 0;
    }

    // Calculate limit based on plan
    let limit = MONTHLY_CHAT_LIMIT;
    if (subscription.plan === "pro") limit = 200;
    if (subscription.plan === "enterprise") limit = 1000;

    if (currentUsage >= limit) {
      return new Response(
        JSON.stringify({ 
          error: "Limite mensal de mensagens atingido",
          usage: currentUsage,
          limit: limit
        }), 
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Increment usage if not reset
    if (!shouldReset) {
      await supabase
        .from("subscriptions")
        .update({ ai_analyses_used: currentUsage + 1 })
        .eq("user_id", userId);
    }

    const systemPrompt = `Você é o assistente oficial do Kodo - uma plataforma de gerenciamento inteligente de infraestrutura Kubernetes multi-cloud.

**REGRA CRÍTICA:** Você APENAS responde perguntas relacionadas a:
- Sistema Kodo e suas funcionalidades
- Kubernetes (K8s) e conceitos relacionados
- Configuração de clusters (EKS, GKE, AKS, etc)
- Kodo Agent e métricas
- AI Monitor, Auto-healing, Costs, Storage
- Comandos kubectl e troubleshooting K8s
- Melhores práticas de infraestrutura cloud

**Se o usuário perguntar sobre qualquer outro assunto que NÃO seja relacionado ao Kodo ou Kubernetes, você DEVE responder:**
"Desculpe, só posso ajudar com questões relacionadas ao sistema Kodo e Kubernetes. Por favor, faça uma pergunta sobre configuração de clusters, monitoramento, ou funcionalidades da plataforma."

**Sobre o Kodo:**
- Plataforma de monitoramento e gerenciamento de clusters Kubernetes
- Suporte para: AWS EKS, GCP GKE, Azure AKS, DigitalOcean, on-premise
- AI Monitor: Análise inteligente de anomalias e auto-healing
- Gestão de Custos: Estimativas e otimização de gastos
- Storage: Monitoramento de PVs e PVCs
- Kodo Agent: Coleta métricas do cluster em tempo real

**Diretrizes:**
- Seja claro, conciso e técnico quando apropriado
- Use exemplos práticos e comandos quando relevante
- Mantenha respostas focadas (2-4 parágrafos)
- Use formatação markdown
- Se não souber algo específico do Kodo, seja honesto`;

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
