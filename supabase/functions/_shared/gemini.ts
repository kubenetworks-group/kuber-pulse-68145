import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Google Gemini API configuration
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-2.0-flash";

// Lovable AI Gateway configuration
const LOVABLE_AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_AI_MODEL = "google/gemini-2.5-flash"; // Fast and efficient

// Free tier limits for Gemini
const FREE_TIER_RPD = 1500; // Requests per day (free tier)
const FREE_TIER_RPM = 15; // Requests per minute
const FREE_TIER_WARNING_THRESHOLD = 0.8; // 80% warning

// Pricing (per 1M tokens) - Gemini 1.5 Flash
const GEMINI_INPUT_PRICE = 0.075; // $0.075 per 1M input tokens
const GEMINI_OUTPUT_PRICE = 0.30; // $0.30 per 1M output tokens

interface GeminiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface GeminiResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  isFreeTier: boolean;
  estimatedCost: number;
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (response: GeminiResponse) => void;
  onError: (error: Error) => void;
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

// Convert messages to OpenAI format for Lovable AI Gateway
function convertToOpenAIFormat(messages: GeminiMessage[]): { role: string; content: string }[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

// Call Lovable AI Gateway (no API key required)
async function callLovableAI(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<GeminiResponse> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  
  if (!lovableApiKey) {
    throw new Error("LOVABLE_API_KEY não configurada para fallback");
  }
  
  console.log(`[Lovable AI] Calling ${LOVABLE_AI_MODEL} for ${functionName} (fallback)...`);
  
  const response = await fetch(LOVABLE_AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${lovableApiKey}`
    },
    body: JSON.stringify({
      model: LOVABLE_AI_MODEL,
      messages: convertToOpenAIFormat(messages),
      max_tokens: 4096,
      temperature: 0.7
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error("Lovable AI error:", response.status, error);
    throw new Error(`Lovable AI error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const inputTokens = data.usage?.prompt_tokens || estimateTokens(messages.map(m => m.content).join(" "));
  const outputTokens = data.usage?.completion_tokens || estimateTokens(content);
  
  // Log usage (Lovable AI is free for Lovable projects)
  const supabase = getSupabaseAdmin();
  await supabase.from("ai_usage_logs").insert({
    user_id: userId,
    function_name: functionName,
    model: LOVABLE_AI_MODEL,
    provider: "lovable",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    is_free_tier: true,
    estimated_cost_usd: 0
  });
  
  console.log(`[Lovable AI] Response: ${inputTokens} input, ${outputTokens} output tokens (free)`);
  
  return {
    content,
    inputTokens,
    outputTokens,
    isFreeTier: true,
    estimatedCost: 0
  };
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
  
  // Log the usage
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
  
  // Get daily request count
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
  
  // Check if we need to send notifications
  if (shouldWarn || exceededFreeTier) {
    // Check if we already sent this type of notification today
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
        // Get monthly cost
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
  
  // Check monthly cost alert ($5 threshold)
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

// Main function to call Gemini API (non-streaming) with Lovable AI fallback
export async function callGemini(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<GeminiResponse> {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  
  // If no Gemini API key, go straight to Lovable AI
  if (!apiKey) {
    console.log("[Gemini] No API key, using Lovable AI Gateway...");
    return callLovableAI(messages, userId, functionName);
  }
  
  const { isFreeTier } = await checkFreeTierStatus(userId);
  const { contents, systemInstruction } = convertToGeminiFormat(messages);
  
  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    }
  };
  
  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }
  
  console.log(`[Gemini] Calling ${GEMINI_MODEL} for ${functionName}...`);
  
  try {
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
      
      // For rate limit errors (429), fall back to Lovable AI immediately
      if (response.status === 429) {
        console.log("[Gemini] Rate limited (429), falling back to Lovable AI...");
        return callLovableAI(messages, userId, functionName);
      }
      
      // For server errors, also try Lovable AI fallback
      if (response.status === 503 || response.status === 500) {
        console.log(`[Gemini] Server error (${response.status}), falling back to Lovable AI...`);
        return callLovableAI(messages, userId, functionName);
      }
      
      if (response.status === 403) {
        console.log("[Gemini] Access denied (403), falling back to Lovable AI...");
        return callLovableAI(messages, userId, functionName);
      }
      
      // For other errors, try to parse and throw
      try {
        const errorData = JSON.parse(error);
        const errorMessage = errorData.error?.message || error;
        throw new Error(`Erro na API de IA: ${errorMessage}`);
      } catch (parseError) {
        throw new Error(`Erro na API de IA (código ${response.status})`);
      }
    }
    
    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      console.error("No candidates in response:", JSON.stringify(data));
      // Try Lovable AI fallback
      console.log("[Gemini] No candidates, falling back to Lovable AI...");
      return callLovableAI(messages, userId, functionName);
    }
    
    const content = data.candidates[0].content?.parts?.[0]?.text || "";
    const usageMetadata = data.usageMetadata || {};
    const inputTokens = usageMetadata.promptTokenCount || estimateTokens(messages.map(m => m.content).join(" "));
    const outputTokens = usageMetadata.candidatesTokenCount || estimateTokens(content);
    
    // Calculate estimated cost (only if not in free tier)
    const estimatedCost = isFreeTier ? 0 : 
      (inputTokens / 1_000_000) * GEMINI_INPUT_PRICE + 
      (outputTokens / 1_000_000) * GEMINI_OUTPUT_PRICE;
    
    // Log usage and send notifications
    await logUsageAndNotify(userId, functionName, inputTokens, outputTokens, isFreeTier, estimatedCost);
    
    console.log(`[Gemini] Response: ${inputTokens} input, ${outputTokens} output tokens, cost: $${estimatedCost.toFixed(6)}`);
    
    return {
      content,
      inputTokens,
      outputTokens,
      isFreeTier,
      estimatedCost
    };
  } catch (error) {
    // Any unexpected error: try Lovable AI fallback
    console.warn("[Gemini] Unexpected error, falling back to Lovable AI:", error);
    return callLovableAI(messages, userId, functionName);
  }
}

// Streaming function for chat assistants with Lovable AI fallback
export async function streamGemini(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<ReadableStream> {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  
  // If no Gemini API key, use Lovable AI streaming
  if (!apiKey) {
    console.log("[Gemini] No API key, using Lovable AI Gateway streaming...");
    return streamLovableAI(messages, userId, functionName);
  }
  
  const { isFreeTier } = await checkFreeTierStatus(userId);
  const { contents, systemInstruction } = convertToGeminiFormat(messages);
  
  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    }
  };
  
  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }
  
  console.log(`[Gemini] Streaming ${GEMINI_MODEL} for ${functionName}...`);
  
  try {
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
      
      // For rate limit or server errors, fall back to Lovable AI
      if (response.status === 429 || response.status === 503 || response.status === 500 || response.status === 403) {
        console.log(`[Gemini] Error ${response.status}, falling back to Lovable AI streaming...`);
        return streamLovableAI(messages, userId, functionName);
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    // Track tokens for logging
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
                // Convert to OpenAI-compatible format
                const openAIFormat = {
                  choices: [{
                    delta: { content },
                    index: 0
                  }]
                };
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      },
      async flush(controller) {
        // Log usage at the end of streaming
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
  } catch (error) {
    console.warn("[Gemini] Streaming error, falling back to Lovable AI:", error);
    return streamLovableAI(messages, userId, functionName);
  }
}

// Stream using Lovable AI Gateway
async function streamLovableAI(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<ReadableStream> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  
  if (!lovableApiKey) {
    throw new Error("LOVABLE_API_KEY não configurada para fallback de streaming");
  }
  
  console.log(`[Lovable AI] Streaming ${LOVABLE_AI_MODEL} for ${functionName}...`);
  
  const response = await fetch(LOVABLE_AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${lovableApiKey}`
    },
    body: JSON.stringify({
      model: LOVABLE_AI_MODEL,
      messages: convertToOpenAIFormat(messages),
      max_tokens: 4096,
      temperature: 0.7,
      stream: true
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error("Lovable AI streaming error:", response.status, error);
    throw new Error(`Lovable AI streaming error: ${response.status}`);
  }
  
  // Track tokens for logging
  let totalContent = "";
  const inputTokens = estimateTokens(messages.map(m => m.content).join(" "));
  
  // Transform stream for logging
  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      
      // Extract content from SSE data for token counting
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr !== "[DONE]") {
            try {
              const data = JSON.parse(jsonStr);
              const content = data.choices?.[0]?.delta?.content || "";
              if (content) totalContent += content;
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
      
      // Pass through unchanged (already in OpenAI format)
      controller.enqueue(chunk);
    },
    async flush(controller) {
      // Log usage at the end of streaming
      const outputTokens = estimateTokens(totalContent);
      
      const supabase = getSupabaseAdmin();
      await supabase.from("ai_usage_logs").insert({
        user_id: userId,
        function_name: functionName,
        model: LOVABLE_AI_MODEL,
        provider: "lovable",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        is_free_tier: true,
        estimated_cost_usd: 0
      });
      
      console.log(`[Lovable AI] Stream complete: ${inputTokens} input, ${outputTokens} output tokens (free)`);
    }
  });
  
  return response.body!.pipeThrough(transformStream);
}

// Fallback to OpenAI if Gemini fails
export async function callWithFallback(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<GeminiResponse> {
  try {
    return await callGemini(messages, userId, functionName);
  } catch (error) {
    console.warn("Gemini failed, trying OpenAI fallback:", error);
    
    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIKey) {
      throw error; // Re-throw original error if no fallback available
    }
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: 4096
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI fallback failed: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    const inputTokens = data.usage?.prompt_tokens || estimateTokens(messages.map(m => m.content).join(" "));
    const outputTokens = data.usage?.completion_tokens || estimateTokens(content);
    
    // Log as OpenAI usage (always paid)
    const supabase = getSupabaseAdmin();
    const estimatedCost = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;
    
    await supabase.from("ai_usage_logs").insert({
      user_id: userId,
      function_name: functionName,
      model: "gpt-4o-mini",
      provider: "openai",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      is_free_tier: false,
      estimated_cost_usd: estimatedCost
    });
    
    return {
      content,
      inputTokens,
      outputTokens,
      isFreeTier: false,
      estimatedCost
    };
  }
}
