import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Monthly AI analysis limits per plan
export const AI_PLAN_LIMITS: Record<string, number> = {
  free: 10,
  trialing: 20,
  pro: 200,
  enterprise: 1000,
};

export interface AILimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  plan: string;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function checkAndConsumeAICredit(userId: string): Promise<AILimitResult> {
  const db = getSupabaseAdmin();

  const { data: sub, error } = await db
    .from("subscriptions")
    .select("plan, status, ai_analyses_used, ai_analyses_reset_at")
    .eq("user_id", userId)
    .single();

  if (error || !sub) {
    console.warn(`[AI Limits] No subscription for user ${userId}`);
    return { allowed: false, remaining: 0, limit: AI_PLAN_LIMITS.free, plan: "free" };
  }

  // trialing users use the "trialing" limit bucket
  const planKey = sub.status === "trialing" ? "trialing" : (sub.plan ?? "free");
  const limit = AI_PLAN_LIMITS[planKey] ?? AI_PLAN_LIMITS.free;

  // Reset counter if past reset date
  const now = new Date();
  const resetAt = sub.ai_analyses_reset_at ? new Date(sub.ai_analyses_reset_at) : null;
  let used = sub.ai_analyses_used ?? 0;

  if (!resetAt || now > resetAt) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    const { error: resetErr } = await db
      .from("subscriptions")
      .update({ ai_analyses_used: 0, ai_analyses_reset_at: nextReset })
      .eq("user_id", userId);
    if (!resetErr) used = 0;
  }

  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return { allowed: false, remaining: 0, limit, plan: planKey };
  }

  // Consume one credit
  await db
    .from("subscriptions")
    .update({ ai_analyses_used: used + 1 })
    .eq("user_id", userId);

  // Notify when limit is first hit
  if (used + 1 >= limit) {
    await notifyLimitReached(userId, planKey, limit, db);
  }

  return { allowed: true, remaining: remaining - 1, limit, plan: planKey };
}

async function notifyLimitReached(
  userId: string,
  plan: string,
  limit: number,
  db: ReturnType<typeof getSupabaseAdmin>,
) {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: existing } = await db
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "ai_monthly_limit_reached")
    .gte("created_at", monthStart)
    .limit(1);

  if (existing && existing.length > 0) return;

  const label = plan === "trialing" ? "Trial" : plan.charAt(0).toUpperCase() + plan.slice(1);
  await db.from("notifications").insert({
    user_id: userId,
    type: "ai_monthly_limit_reached",
    title: "Limite mensal de IA atingido",
    message: `Você atingiu o limite de ${limit} análises de IA do plano ${label}. Faça upgrade para continuar usando as funcionalidades de IA este mês.`,
  });
}
