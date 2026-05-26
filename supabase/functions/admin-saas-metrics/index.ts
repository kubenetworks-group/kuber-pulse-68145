import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return json({ error: `Forbidden — role is "${profile?.role ?? 'null'}"` }, 403);
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const [
      invoicesThisMonth,
      subscriptionsAll,
      leadsAll,
      usageAll,
      mrrTrend,
      newCustomersPerMonth,
    ] = await Promise.all([
      admin.from('invoices').select('amount_brl').eq('status', 'paid').gte('paid_at', monthStart).lt('paid_at', monthEnd),
      admin.from('subscriptions').select('plan, status, canceled_at'),
      admin.from('leads').select('status'),
      admin.from('usage_tracking').select('clusters_connected, ai_analyses_used, ai_actions_executed'),
      buildMrrTrend(admin),
      buildNewCustomersPerMonth(admin),
    ]);

    const invoices = invoicesThisMonth.data ?? [];
    const subs = subscriptionsAll.data ?? [];
    const leads = leadsAll.data ?? [];
    const usage = usageAll.data ?? [];

    const mrr = invoices.reduce((sum: number, inv: Record<string, number>) => sum + (inv.amount_brl ?? 0), 0);
    const arr = mrr * 12;

    const activeSubscriptions = subs.filter((s: Record<string, string>) => s.status === 'active').length;
    const trialSubscriptions = subs.filter((s: Record<string, string>) => s.status === 'trialing').length;

    const churnedThisMonth = subs.filter((s: Record<string, string>) => {
      if (!s.canceled_at) return false;
      return s.canceled_at >= monthStart && s.canceled_at < monthEnd;
    }).length;
    const churnBase = activeSubscriptions + churnedThisMonth;
    const churnRate = churnBase > 0 ? (churnedThisMonth / churnBase) * 100 : 0;

    const totalLeads = leads.length;
    const leadsByStatus = {
      new: leads.filter((l: Record<string, string>) => l.status === 'new' || !l.status).length,
      contacted: leads.filter((l: Record<string, string>) => l.status === 'contacted').length,
      demo_scheduled: leads.filter((l: Record<string, string>) => l.status === 'demo_scheduled').length,
      converted: leads.filter((l: Record<string, string>) => l.status === 'converted').length,
    };
    const trialToPaidConversion = totalLeads > 0 ? (leadsByStatus.converted / totalLeads) * 100 : 0;

    const planDistribution = {
      starter: subs.filter((s: Record<string, string>) => s.plan === 'starter' && s.status === 'active').length,
      growth: subs.filter((s: Record<string, string>) => s.plan === 'growth' && s.status === 'active').length,
      enterprise: subs.filter((s: Record<string, string>) => s.plan === 'enterprise' && s.status === 'active').length,
    };

    const totalUsage = {
      clusters: usage.reduce((sum: number, u: Record<string, number>) => sum + (u.clusters_connected ?? 0), 0),
      analyses: usage.reduce((sum: number, u: Record<string, number>) => sum + (u.ai_analyses_used ?? 0), 0),
      actions: usage.reduce((sum: number, u: Record<string, number>) => sum + (u.ai_actions_executed ?? 0), 0),
    };

    return json({
      mrr,
      arr,
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
