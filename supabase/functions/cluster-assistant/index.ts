import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { streamGemini } from "../_shared/gemini.ts";

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
    
    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }), 
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }), 
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `Você é um assistente especializado em Kubernetes e configuração de clusters. Seu objetivo é ajudar usuários a configurar seus primeiros clusters Kubernetes no Kodo.

Você tem expertise em:
- AWS EKS, Google GKE, Azure AKS e outros provedores de Kubernetes
- Configuração de kubeconfig e credenciais
- Instalação e configuração do Kodo Agent
- Comandos kubectl e troubleshooting
- Melhores práticas de segurança e networking

Diretrizes:
- Seja claro, conciso e técnico quando necessário
- Forneça comandos específicos quando relevante
- Explique termos técnicos de forma simples
- Pergunte sobre o provedor específico do usuário para dar respostas mais personalizadas
- Sempre sugira verificar logs e status após executar comandos
- Mantenha respostas curtas (2-4 parágrafos) e focadas
- Use formatação markdown para comandos e código

Se o usuário estiver com erro ou dúvida, peça detalhes específicos como:
- Qual provedor está usando (AWS, GCP, Azure, etc)
- Qual passo da configuração está
- Mensagens de erro exatas
- Output de comandos executados`;

    // Convert messages to Gemini format with system prompt
    const geminiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }))
    ];

    try {
      const stream = await streamGemini(geminiMessages, user.id, "cluster-assistant");
      
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } catch (error) {
      console.error("Gemini streaming error:", error);
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes("429") || error.message.includes("rate limit")) {
          return new Response(
            JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns instantes." }), 
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
      
      throw error;
    }
  } catch (error) {
    console.error("Cluster assistant error:", error);
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
