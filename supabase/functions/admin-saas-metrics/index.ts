import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Approximate plan prices in BRL (used to estimate churned MRR)
const PLAN_PRICES_BRL: Record<string, number> = {
  starter: 497, growth: 997, enterprise: 2997, free: 0, trialing: 0, pro: 497,
};

const AI_PLAN_LIMITS: Record<string, number> = { free: 10, trialing: 20, pro: 200, enterprise: 1000 };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Correct admin check: user_roles table via has_role RPC
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return json({ error: 'Forbidden — você não tem permissão de admin' }, 403);
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();

    const [
      invoicesThisMonth,
      invoicesWithSubs,
      subscriptionsAll,
      leadsAll,
      usageAll,
      mrrTrend,
      newCustomersPerMonth,
      aiLogsThisMonth,
      newThisQuarterResult,
      newSubsThisMonth,
    ] = await Promise.all([
      admin.from('invoices').select('amount_brl').eq('status', 'paid').gte('paid_at', monthStart).lt('paid_at', monthEnd),
      admin.from('invoices').select('amount_brl, subscription_id').eq('status', 'paid').gte('paid_at', monthStart).lt('paid_at', monthEnd),
      admin.from('subscriptions').select('id, plan, status, canceled_at, user_id, ai_analyses_used, created_at'),
      admin.from('leads').select('status'),
      admin.from('usage_tracking').select('clusters_connected, ai_analyses_used, ai_actions_executed'),
      buildMrrTrend(admin),
      buildNewCustomersPerMonth(admin),
      admin.from('ai_usage_logs').select('user_id, input_tokens, output_tokens').gte('created_at', monthStart),
      admin.from('subscriptions').select('id', { count: 'exact', head: true }).gte('created_at', quarterStart),
      admin.from('subscriptions').select('id').gte('created_at', monthStart).lt('created_at', monthEnd),
    ]);

    const invoices = invoicesThisMonth.data ?? [];
    const invoicesDetail = invoicesWithSubs.data ?? [];
    const subs = subscriptionsAll.data ?? [];
    const leads = leadsAll.data ?? [];
    const usage = usageAll.data ?? [];
    const aiLogs = aiLogsThisMonth.data ?? [];
    const newThisQuarter = newThisQuarterResult.count ?? 0;

    // --- Revenue ---
    const mrr = invoices.reduce((sum: number, inv: any) => sum + (inv.amount_brl ?? 0), 0);
    const arr = mrr * 12;

    // MRR growth vs previous month
    const prevMrr = mrrTrend.length >= 2 ? mrrTrend[mrrTrend.length - 2].mrr : 0;
    const mrrGrowth = prevMrr > 0 ? Math.round(((mrr - prevMrr) / prevMrr) * 1000) / 10 : 0;

    // Revenue by plan (join invoices with subscriptions)
    const subIdSet = new Set((newSubsThisMonth.data ?? []).map((s: any) => s.id));
    const allSubIds = [...new Set(invoicesDetail.map((i: any) => i.subscription_id).filter(Boolean))];
    let subPlanMap = new Map<string, string>();
    if (allSubIds.length > 0) {
      const { data: subDetails } = await admin.from('subscriptions').select('id, plan').in('id', allSubIds);
      subPlanMap = new Map((subDetails ?? []).map((s: any) => [s.id, s.plan]));
    }
    const revenueByPlan: Record<string, number> = { starter: 0, growth: 0, enterprise: 0, free: 0 };
    for (const inv of invoicesDetail) {
      const plan = subPlanMap.get(inv.subscription_id) || 'free';
      revenueByPlan[plan] = (revenueByPlan[plan] || 0) + (inv.amount_brl || 0);
    }

    // New MRR: invoices from subscriptions created this month
    let newMrrThisMonth = 0;
    if (subIdSet.size > 0) {
      const newIds = [...subIdSet];
      const { data: newInvoices } = await admin
        .from('invoices').select('amount_brl').eq('status', 'paid')
        .in('subscription_id', newIds).gte('paid_at', monthStart).lt('paid_at', monthEnd);
      newMrrThisMonth = (newInvoices ?? []).reduce((sum: number, i: any) => sum + (i.amount_brl || 0), 0);
    }

    // --- Subscriptions ---
    const activeSubscriptions = subs.filter((s: any) => s.status === 'active').length;
    const trialSubscriptions = subs.filter((s: any) => s.status === 'trialing').length;
    const avgRevenuePerUser = activeSubscriptions > 0 ? Math.round(mrr / activeSubscriptions) : 0;

    const churnedThisMonth = subs.filter((s: any) => {
      if (!s.canceled_at) return false;
      return s.canceled_at >= monthStart && s.canceled_at < monthEnd;
    }).length;
    const churnBase = activeSubscriptions + churnedThisMonth;
    const churnRate = churnBase > 0 ? (churnedThisMonth / churnBase) * 100 : 0;

    // Estimated churned MRR
    const churnedMrrThisMonth = subs
      .filter((s: any) => s.canceled_at && s.canceled_at >= monthStart && s.canceled_at < monthEnd)
      .reduce((sum: number, s: any) => sum + (PLAN_PRICES_BRL[s.plan ?? 'free'] ?? 0), 0);

    // --- Leads ---
    const totalLeads = leads.length;
    const leadsByStatus = {
      new: leads.filter((l: any) => l.status === 'new' || !l.status).length,
      contacted: leads.filter((l: any) => l.status === 'contacted').length,
      demo_scheduled: leads.filter((l: any) => l.status === 'demo_scheduled').length,
      converted: leads.filter((l: any) => l.status === 'converted').length,
    };
    const trialToPaidConversion = totalLeads > 0 ? (leadsByStatus.converted / totalLeads) * 100 : 0;
    const activeLeads = leads.filter((l: any) => l.status !== 'converted').length;

    // --- Plan distribution ---
    const planDistribution = {
      starter: subs.filter((s: any) => s.plan === 'starter' && s.status === 'active').length,
      growth: subs.filter((s: any) => s.plan === 'growth' && s.status === 'active').length,
      enterprise: subs.filter((s: any) => s.plan === 'enterprise' && s.status === 'active').length,
    };

    // --- Usage ---
    const totalUsage = {
      clusters: usage.reduce((sum: number, u: any) => sum + (u.clusters_connected ?? 0), 0),
      analyses: usage.reduce((sum: number, u: any) => sum + (u.ai_analyses_used ?? 0), 0),
      actions: usage.reduce((sum: number, u: any) => sum + (u.ai_actions_executed ?? 0), 0),
    };

    const cancelledTotal = subs.filter((s: any) => s.status === 'expired' || s.canceled_at != null).length;

    // --- Top AI Users ---
    const topAIUsers = await buildTopAIUsers(admin, aiLogs, subs);

    return json({
      mrr,
      arr,
      mrrGrowth,
      newMrrThisMonth,
      churnedMrrThisMonth,
      avgRevenuePerUser,
      revenueByPlan,
      activeSubscriptions,
      trialSubscriptions,
      churnedThisMonth,
      churnRate: Math.round(churnRate * 10) / 10,
      trialToPaidConversion: Math.round(trialToPaidConversion * 10) / 10,
      totalLeads,
      leadsByStatus,
      planDistribution,
      mrrTrend,
      newCustomersPerMonth,
      totalUsage,
      cancelledTotal,
      activeLeads,
      newThisQuarter,
      topAIUsers,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('admin-saas-metrics error:', message);
    return json({ error: message }, 500);
  }
});

async function buildMrrTrend(admin: SupabaseClient) {
  const now = new Date();
  const queries = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .replace('.', '').replace(/^\w/, (c) => c.toUpperCase());
    return admin.from('invoices')
      .select('amount_brl')
      .eq('status', 'paid')
      .gte('paid_at', start)
      .lt('paid_at', end)
      .then(({ data }: { data: Array<{ amount_brl: number }> | null }) => ({
        month: label,
        mrr: (data ?? []).reduce((sum, inv) => sum + (inv.amount_brl ?? 0), 0),
      }));
  });
  return Promise.all(queries);
}

async function buildNewCustomersPerMonth(admin: SupabaseClient) {
  const now = new Date();
  const queries = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .replace('.', '').replace(/^\w/, (c) => c.toUpperCase());
    return admin.from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start)
      .lt('created_at', end)
      .then(({ count }: { count: number | null }) => ({
        month: label,
        count: count ?? 0,
      }));
  });
  return Promise.all(queries);
}

async function buildTopAIUsers(
  admin: SupabaseClient,
  aiLogs: Array<{ user_id: string; input_tokens: number; output_tokens: number }>,
  subs: Array<{ user_id: string; plan: string; status: string; ai_analyses_used: number }>,
) {
  if (aiLogs.length === 0) return [];

  const map = new Map<string, { requests: number; tokens: number }>();
  for (const log of aiLogs) {
    const cur = map.get(log.user_id) ?? { requests: 0, tokens: 0 };
    map.set(log.user_id, {
      requests: cur.requests + 1,
      tokens: cur.tokens + (log.input_tokens ?? 0) + (log.output_tokens ?? 0),
    });
  }

  const topIds = [...map.entries()]
    .sort((a, b) => b[1].requests - a[1].requests)
    .slice(0, 10)
    .map(([id]) => id);

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(users.map((u: any) => [u.id, u.email ?? u.id]));
  const subMap = new Map(subs.map((s) => [s.user_id, s]));

  return topIds.map((uid) => {
    const sub = subMap.get(uid);
    const planKey = sub?.status === 'trialing' ? 'trialing' : (sub?.plan ?? 'free');
    const limit = AI_PLAN_LIMITS[planKey] ?? AI_PLAN_LIMITS.free;
    const used = sub?.ai_analyses_used ?? 0;
    const stats = map.get(uid)!;
    return {
      user_id: uid,
      email: emailMap.get(uid) ?? uid,
      plan: planKey,
      requests: stats.requests,
      tokens: stats.tokens,
      ai_analyses_used: used,
      plan_limit: limit,
      usage_pct: Math.round((used / limit) * 100),
    };
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
