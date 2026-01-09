import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Lovable AI Gateway configuration
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

// Free tier limits
const FREE_TIER_RPD = 500; // Requests per day
const FREE_TIER_WARNING_THRESHOLD = 0.8; // 80% warning

// Pricing (per 1M tokens) - approximate
const INPUT_PRICE = 0.15; // $0.15 per 1M input tokens
const OUTPUT_PRICE = 0.60; // $0.60 per 1M output tokens

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
    model: DEFAULT_MODEL,
    provider: "lovable-ai",
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
    .gte("created_at", today);
  
  const dailyCount = count || 0;
  const shouldWarn = dailyCount >= FREE_TIER_RPD * FREE_TIER_WARNING_THRESHOLD && dailyCount < FREE_TIER_RPD;
  const exceededFreeTier = dailyCount > FREE_TIER_RPD;
  
  // Check if we need to send notifications
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
          message: `Você excedeu o limite gratuito de ${FREE_TIER_RPD} requisições/dia. As próximas requisições serão cobradas (~$0.15-0.60/1M tokens). Custo estimado este mês: $${monthlyCost.toFixed(4)}`
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
    .gte("created_at", today);
  
  const dailyCount = count || 0;
  return { isFreeTier: dailyCount < FREE_TIER_RPD, dailyCount };
}

// Main function to call Lovable AI Gateway (non-streaming)
export async function callGemini(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<GeminiResponse> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY não configurada");
  }
  
  const { isFreeTier } = await checkFreeTierStatus(userId);
  
  console.log(`[AI] Calling Lovable AI Gateway for ${functionName}...`);
  
  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Lovable AI Gateway error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required. Please add funds to your Lovable AI workspace.");
    }
    
    throw new Error(`AI Gateway error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from AI");
  }
  
  const content = data.choices[0].message?.content || "";
  const usage = data.usage || {};
  const inputTokens = usage.prompt_tokens || estimateTokens(messages.map(m => m.content).join(" "));
  const outputTokens = usage.completion_tokens || estimateTokens(content);
  
  // Calculate estimated cost
  const estimatedCost = isFreeTier ? 0 : 
    (inputTokens / 1_000_000) * INPUT_PRICE + 
    (outputTokens / 1_000_000) * OUTPUT_PRICE;
  
  // Log usage and send notifications
  await logUsageAndNotify(userId, functionName, inputTokens, outputTokens, isFreeTier, estimatedCost);
  
  console.log(`[AI] Response received: ${inputTokens} input, ${outputTokens} output tokens`);
  
  return {
    content,
    inputTokens,
    outputTokens,
    isFreeTier,
    estimatedCost
  };
}

// Streaming function for chat assistants
export async function streamGemini(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<ReadableStream> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY não configurada");
  }
  
  const { isFreeTier } = await checkFreeTierStatus(userId);
  
  console.log(`[AI] Calling Lovable AI Gateway (streaming) for ${functionName}...`);
  
  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Lovable AI Gateway streaming error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required. Please add funds to your Lovable AI workspace.");
    }
    
    throw new Error(`AI Gateway error: ${response.status}`);
  }
  
  // Track tokens for logging
  let totalContent = "";
  const inputTokens = estimateTokens(messages.map(m => m.content).join(" "));
  
  // Transform the SSE stream
  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n");
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            continue;
          }
          
          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices?.[0]?.delta?.content || "";
            
            if (content) {
              totalContent += content;
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
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
        (inputTokens / 1_000_000) * INPUT_PRICE + 
        (outputTokens / 1_000_000) * OUTPUT_PRICE;
      
      await logUsageAndNotify(userId, functionName, inputTokens, outputTokens, isFreeTier, estimatedCost);
      
      console.log(`[AI] Stream complete: ${inputTokens} input, ${outputTokens} output tokens`);
      
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
    }
  });
  
  return response.body!.pipeThrough(transformStream);
}

// Fallback function - now just retries with a different model
export async function callWithFallback(
  messages: GeminiMessage[],
  userId: string,
  functionName: string
): Promise<GeminiResponse> {
  try {
    return await callGemini(messages, userId, functionName);
  } catch (error) {
    console.warn("First attempt failed, retrying with fallback model:", error);
    
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw error;
    }
    
    const { isFreeTier } = await checkFreeTierStatus(userId);
    
    // Try with a different model as fallback
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI Gateway fallback failed: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message?.content || "";
    const usage = data.usage || {};
    const inputTokens = usage.prompt_tokens || estimateTokens(messages.map(m => m.content).join(" "));
    const outputTokens = usage.completion_tokens || estimateTokens(content);
    
    const estimatedCost = isFreeTier ? 0 : 
      (inputTokens / 1_000_000) * INPUT_PRICE + 
      (outputTokens / 1_000_000) * OUTPUT_PRICE;
    
    await logUsageAndNotify(userId, functionName, inputTokens, outputTokens, isFreeTier, estimatedCost);
    
    return {
      content,
      inputTokens,
      outputTokens,
      isFreeTier,
      estimatedCost
    };
  }
}
