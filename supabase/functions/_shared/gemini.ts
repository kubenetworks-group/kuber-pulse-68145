import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAndConsumeAICredit } from "./ai-limits.ts";

// Google Gemini API configuration
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-1.5-flash";

// Free tier limits for Gemini
const FREE_TIER_RPD = 1500; // Requests per day (free tier)
const FREE_TIER_WARNING_THRESHOLD = 0.8; // 80% warning

// Pricing (per 1M tokens) - Gemini 2.5 Flash
const GEMINI_INPUT_PRICE = 0.075; // $0.075 per 1M input tokens
const GEMINI_OUTPUT_PRICE = 0.30;  // $0.30 per 1M output tokens

export interface GeminiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GeminiResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  isFreeTier: boolean;
  estimatedCost: number;
}

// Estimate tokens (rough approximation: 1 token ≈ 4 chars)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Convert messages to Gemini format
function convertToGeminiFormat(messages: GeminiMessage[]): { contents: any[]; systemInstruction?: any } {
  const systemMessages = messages.filter(m => m.role === "system");
  const otherMessages = messages.filter(m => m.role !== "system");

  const contents = otherMessages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  const result: { contents: any[]; systemInstruction?: any } = { contents };

  if (systemMessages.length > 0) {
    result.systemInstruction = {
      parts: [{ text: systemMessages.map(m => m.content).join("\n") }]
    };
  }

  return result;
}

// Get Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey);
}

// Check and log AI usage, send notifications if needed
async function logUsageAndNotify(
  userId: string,
  functionName: string,
  inputTokens: number,
  outputTokens: number,
  isFreeTier: boolean,
  estimatedCost: number
): Promise<{ dailyCount: number; shouldWarn: boolean; exceededFreeTier: boolean }> {
  const supabase = getSupabaseAdmin();

  await supabase.from("ai_usage_logs").insert({
    user_id: userId,
    function_name: functionName,
    model: GEMINI_MODEL,
    provider: "google",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    is_free_tier: isFreeTier,
    estimated_cost_usd: estimatedCost
  });

  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from("ai_usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("provider", "google")
    .gte("created_at", today);

  const dailyCount = count || 0;
  const shouldWarn = dailyCount >= FREE_TIER_RPD * FREE_TIER_WARNING_THRESHOLD && dailyCount < FREE_TIER_RPD;
  const exceededFreeTier = dailyCount > FREE_TIER_RPD;

  if (shouldWarn || exceededFreeTier) {
    const notificationType = exceededFreeTier ? "ai_free_tier_exceeded" : "ai_free_tier_warning";
    const { data: existingNotification } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", notificationType)
      .gte("created_at", today)
      .limit(1);

    if (!existingNotification || existingNotification.length === 0) {
      if (exceededFreeTier) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: monthlyUsage } = await supabase
          .from("ai_usage_logs")
          .select("estimated_cost_usd")
          .eq("user_id", userId)
          .eq("is_free_tier", false)
          .gte("created_at", startOfMonth.toISOString());

        const monthlyCost = monthlyUsage?.reduce((sum, log) => sum + (log.estimated_cost_usd || 0), 0) || 0;

        await supabase.from("notifications").insert({
          user_id: userId,
          type: "ai_free_tier_exceeded",
          title: "⚠️ Limite gratuito de IA excedido",
          message: `Você excedeu o limite gratuito de ${FREE_TIER_RPD} requisições/dia. As próximas requisições serão cobradas (~$0.075-0.30/1M tokens). Custo estimado este mês: $${monthlyCost.toFixed(4)}`
        });
      } else if (shouldWarn) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "ai_free_tier_warning",
          title: "🔔 80% do limite gratuito de IA",
          message: `Você usou ${dailyCount}/${FREE_TIER_RPD} requisições gratuitas de IA hoje. Após o limite, haverá cobrança por uso.`
        });
      }
    }
  }

  if (exceededFreeTier) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyUsage } = await supabase
      .from("ai_usage_logs")
      .select("estimated_cost_usd")
      .eq("user_id", userId)
      .eq("is_free_tier", false)
      .gte("created_at", startOfMonth.toISOString());

    const monthlyCost = monthlyUsage?.reduce((sum, log) => sum + (log.estimated_cost_usd || 0), 0) || 0;

    if (monthlyCost > 5) {
      const { data: costAlert } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "ai_high_cost_alert")
        .gte("created_at", startOfMonth.toISOString())
        .limit(1);

      if (!costAlert || costAlert.length === 0) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "ai_high_cost_alert",
          title: "🚨 Alerta de custo de IA",
          message: `ATENÇÃO: Seu uso de IA este mês já gerou ~$${monthlyCost.toFixed(2)} em custos estimados. Considere otimizar o uso.`
        });
      }
    }
  }

  return { dailyCount, shouldWarn, exceededFreeTier };
}

// Check if user is within free tier
async function checkFreeTierStatus(userId: string): Promise<{ isFreeTier: boolean; dailyCount: number }> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split('T')[0];

  const { count } = await supabase
    .from("ai_usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("provider", "google")
    .gte("created_at", today);

  const dailyCount = count || 0;
  return { isFreeTier: dailyCount < FREE_TIER_RPD, dailyCount };
}

// Map Gemini error codes to friendly messages
function geminiErrorMessage(status: number): string {
  if (status === 429) return "Limite de velocidade da IA atingido. Aguarde 1 minuto e tente novamente.";
  if (status === 403) return "Chave da API Gemini inválida ou sem permissão. Verifique a configuração.";
  if (status === 503 || status === 500) return "Serviço de IA temporariamente indisponível. Tente novamente em instantes.";
  return `Erro no serviço de IA (código ${status}). Tente novamente.`;
}

// Main function to call Gemini API (non-streaming)
export async function callGemini(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<GeminiResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada. Adicione a chave nos secrets do Supabase.");
  }

  // Enforce per-plan monthly AI limit
  const limitResult = await checkAndConsumeAICredit(userId);
  if (!limitResult.allowed) {
    const planLabel = limitResult.plan.charAt(0).toUpperCase() + limitResult.plan.slice(1);
    throw new Error(
      `Limite de ${limitResult.limit} análises de IA do plano ${planLabel} atingido este mês. Faça upgrade para continuar.`
    );
  }

  const { isFreeTier } = await checkFreeTierStatus(userId);
  const { contents, systemInstruction } = convertToGeminiFormat(messages);

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  console.log(`[Gemini] Calling ${GEMINI_MODEL} for ${functionName}... (remaining credits: ${limitResult.remaining})`);

  const response = await fetch(
    `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error:", response.status, error);
    throw new Error(geminiErrorMessage(response.status));
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    console.error("No candidates in response:", JSON.stringify(data));
    throw new Error("A IA não retornou resultado. Tente reformular sua solicitação.");
  }

  const content = data.candidates[0].content?.parts?.[0]?.text || "";
  const usageMetadata = data.usageMetadata || {};
  const inputTokens = usageMetadata.promptTokenCount || estimateTokens(messages.map(m => m.content).join(" "));
  const outputTokens = usageMetadata.candidatesTokenCount || estimateTokens(content);

  const estimatedCost = isFreeTier ? 0 :
    (inputTokens / 1_000_000) * GEMINI_INPUT_PRICE +
    (outputTokens / 1_000_000) * GEMINI_OUTPUT_PRICE;

  await logUsageAndNotify(userId, functionName, inputTokens, outputTokens, isFreeTier, estimatedCost);

  console.log(`[Gemini] Response: ${inputTokens} input, ${outputTokens} output tokens, cost: $${estimatedCost.toFixed(6)}`);

  return { content, inputTokens, outputTokens, isFreeTier, estimatedCost };
}

// Streaming function for chat assistants
export async function streamGemini(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<ReadableStream> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada. Adicione a chave nos secrets do Supabase.");
  }

  // Enforce per-plan monthly AI limit
  const limitResult = await checkAndConsumeAICredit(userId);
  if (!limitResult.allowed) {
    const planLabel = limitResult.plan.charAt(0).toUpperCase() + limitResult.plan.slice(1);
    throw new Error(
      `Limite de ${limitResult.limit} análises de IA do plano ${planLabel} atingido este mês. Faça upgrade para continuar.`
    );
  }

  const { isFreeTier } = await checkFreeTierStatus(userId);
  const { contents, systemInstruction } = convertToGeminiFormat(messages);

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  console.log(`[Gemini] Streaming ${GEMINI_MODEL} for ${functionName}... (remaining credits: ${limitResult.remaining})`);

  const response = await fetch(
    `${GEMINI_API_URL}/${GEMINI_MODEL}:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini streaming error:", response.status, error);
    throw new Error(geminiErrorMessage(response.status));
  }

  let totalContent = "";
  const inputTokens = estimateTokens(messages.map(m => m.content).join(" "));

  // Transform the Gemini SSE stream to OpenAI-compatible format
  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            continue;
          }

          try {
            const data = JSON.parse(jsonStr);
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (content) {
              totalContent += content;
              const openAIFormat = {
                choices: [{ delta: { content }, index: 0 }]
              };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
            }
          } catch (_e) {
            // Skip invalid JSON chunks
          }
        }
      }
    },
    async flush(controller) {
      const outputTokens = estimateTokens(totalContent);
      const estimatedCost = isFreeTier ? 0 :
        (inputTokens / 1_000_000) * GEMINI_INPUT_PRICE +
        (outputTokens / 1_000_000) * GEMINI_OUTPUT_PRICE;

      await logUsageAndNotify(userId, functionName, inputTokens, outputTokens, isFreeTier, estimatedCost);

      console.log(`[Gemini] Stream complete: ${inputTokens} input, ${outputTokens} output tokens`);

      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
    }
  });

  return response.body!.pipeThrough(transformStream);
}

// Convenience wrapper — throws if Gemini is unavailable (no silent paid fallback)
export async function callWithFallback(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<GeminiResponse> {
  return callGemini(messages, userId, functionName);
}
