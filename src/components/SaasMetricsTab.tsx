import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, TrendingUp, TrendingDown, Users, DollarSign,
  BarChart2, Target, UserPlus, Zap, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface MrrPoint { month: string; mrr: number }
interface CustomerPoint { month: string; count: number }
interface LeadsByStatus { new: number; contacted: number; demo_scheduled: number; converted: number }
interface PlanDistribution { starter: number; growth: number; enterprise: number }
interface TotalUsage { clusters: number; analyses: number; actions: number }
interface RevenueByPlan { starter: number; growth: number; enterprise: number; free: number }
interface TopAIUser {
  user_id: string; email: string; plan: string;
  requests: number; tokens: number; ai_analyses_used: number; plan_limit: number; usage_pct: number;
}

interface Metrics {
  mrr: number; arr: number;
  mrrGrowth: number; newMrrThisMonth: number; churnedMrrThisMonth: number; avgRevenuePerUser: number;
  revenueByPlan: RevenueByPlan;
  activeSubscriptions: number; trialSubscriptions: number;
  churnedThisMonth: number; churnRate: number; trialToPaidConversion: number;
  totalLeads: number; leadsByStatus: LeadsByStatus; planDistribution: PlanDistribution;
  mrrTrend: MrrPoint[]; newCustomersPerMonth: CustomerPoint[];
  totalUsage: TotalUsage; cancelledTotal: number; activeLeads: number;
  newThisQuarter: number; topAIUsers: TopAIUser[];
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const PLAN_COLORS = ['#0891b2', '#4f46e5', '#a855f7'];
const FUNNEL_COLORS = ['#64748b', '#0891b2', '#4f46e5', '#10b981'];

function KpiCard({
  label, value, sub, icon: Icon, color, badge,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; badge?: React.ReactNode;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">{label}</p>
          <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
        </div>
        <div className="flex items-end gap-2">
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {badge}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function SaasMetricsTab() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.functions.invoke('admin-saas-metrics', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        let detail = error.message ?? 'Erro desconhecido';
        try { const b = await (error as any).context?.json?.(); if (b?.error) detail = b.error; } catch { /* */ }
        toast.error(`Erro ao carregar métricas: ${detail}`);
        setLoading(false);
        return;
      }
      setMetrics(data as Metrics);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;
  if (!metrics) return null;

  const growth = metrics.mrrGrowth ?? 0;
  const GrowthIcon = growth > 0 ? ArrowUpRight : growth < 0 ? ArrowDownRight : Minus;
  const growthColor = growth > 0 ? 'text-emerald-400' : growth < 0 ? 'text-red-400' : 'text-muted-foreground';

  const revByPlan = metrics.revenueByPlan ?? { starter: 0, growth: 0, enterprise: 0, free: 0 };
  const revenueChartData = [
    { name: 'Starter', value: revByPlan.starter },
    { name: 'Growth', value: revByPlan.growth },
    { name: 'Enterprise', value: revByPlan.enterprise },
  ].filter(d => d.value > 0);

  const funnelData = [
    { name: 'Novo', value: metrics.leadsByStatus.new },
    { name: 'Contactado', value: metrics.leadsByStatus.contacted },
    { name: 'Demo', value: metrics.leadsByStatus.demo_scheduled },
    { name: 'Convertido', value: metrics.leadsByStatus.converted },
  ];

  const topAIUsers = metrics.topAIUsers ?? [];

  return (
    <div className="space-y-6">

      {/* ── Saúde Financeira ── */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-medium">Saúde Financeira</p>
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard
            label="Receita Atual (MRR)"
            value={brl(metrics.mrr)}
            sub={`ARR: ${brl(metrics.arr)}`}
            icon={DollarSign}
            color="text-cyan-400"
          />
          <KpiCard
            label="Crescimento MRR"
            value={`${growth > 0 ? '+' : ''}${growth}%`}
            sub="vs mês anterior"
            icon={GrowthIcon}
            color={growthColor}
          />
          <KpiCard
            label="Novo MRR"
            value={brl(metrics.newMrrThisMonth ?? 0)}
            sub="novos clientes este mês"
            icon={TrendingUp}
            color="text-emerald-400"
          />
          <KpiCard
            label="Churn em R$"
            value={brl(metrics.churnedMrrThisMonth ?? 0)}
            sub={`${metrics.churnedThisMonth} cancelamento(s) · ${metrics.churnRate}%`}
            icon={TrendingDown}
            color={(metrics.churnedMrrThisMonth ?? 0) > 0 ? 'text-red-400' : 'text-muted-foreground'}
          />
          <KpiCard
            label="ARPU"
            value={brl(metrics.avgRevenuePerUser ?? 0)}
            sub="por cliente ativo"
            icon={BarChart2}
            color="text-amber-400"
          />
        </div>
      </div>

      {/* ── Pipeline de Clientes ── */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-medium">Pipeline de Clientes</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Leads Ativos"
            value={metrics.activeLeads ?? 0}
            sub={`${metrics.leadsByStatus?.converted ?? 0} convertidos`}
            icon={Target}
            color="text-purple-400"
          />
          <KpiCard
            label="Novos este Trimestre"
            value={metrics.newThisQuarter ?? 0}
            sub={`Total cancelados: ${metrics.cancelledTotal ?? 0}`}
            icon={UserPlus}
            color="text-indigo-400"
          />
          <KpiCard
            label="Conversão Lead→Pago"
            value={`${metrics.trialToPaidConversion}%`}
            sub={`de ${metrics.totalLeads} leads totais`}
            icon={TrendingUp}
            color="text-orange-400"
          />
          <KpiCard
            label="Assinaturas Ativas"
            value={metrics.activeSubscriptions}
            sub={`${metrics.trialSubscriptions} em trial`}
            icon={Users}
            color="text-blue-400"
          />
        </div>
      </div>

      {/* ── Gráficos: MRR trend + Novos clientes ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Tendência de Receita (MRR)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={metrics.mrrTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#475569', fontSize: 12 }}
                  formatter={(value: number) => [brl(value), 'MRR']}
                />
                <Area type="monotone" dataKey="mrr" stroke="#0891b2" fill="url(#mrrGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Novos Clientes por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.newCustomersPerMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#475569', fontSize: 12 }}
                  formatter={(v: number) => [v, 'Novos clientes']}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Novo MRR vs Churn + Receita por Plano ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Novo MRR vs Churn MRR — resumo visual */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Novo MRR vs Churn — este mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {/* Net MRR movement */}
            {(() => {
              const net = (metrics.newMrrThisMonth ?? 0) - (metrics.churnedMrrThisMonth ?? 0);
              const netColor = net >= 0 ? 'text-emerald-400' : 'text-red-400';
              return (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-sm text-muted-foreground">Movimento líquido</span>
                  <span className={`text-lg font-bold ${netColor}`}>
                    {net >= 0 ? '+' : ''}{brl(net)}
                  </span>
                </div>
              );
            })()}
            {/* Bars */}
            <div className="space-y-3">
              {[
                { label: 'Novo MRR', value: metrics.newMrrThisMonth ?? 0, color: 'bg-emerald-500', text: 'text-emerald-400' },
                { label: 'Churn MRR', value: metrics.churnedMrrThisMonth ?? 0, color: 'bg-red-500', text: 'text-red-400' },
              ].map((row) => {
                const max = Math.max(metrics.newMrrThisMonth ?? 0, metrics.churnedMrrThisMonth ?? 0, 1);
                const pct = Math.round((row.value / max) * 100);
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={`font-medium ${row.text}`}>{brl(row.value)}</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${row.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Churn em R$ estimado pelo preço do plano cancelado
            </p>
          </CardContent>
        </Card>

        {/* Receita por plano */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Receita por Plano — este mês</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {revenueChartData.length === 0 ? (
              <p className="text-muted-foreground text-sm py-12">Sem receita registrada este mês</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={revenueChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {revenueChartData.map((_, i) => <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(value: number, name: string) => [brl(value), name]}
                  />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: '#475569', fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Funil de Leads ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Funil de Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={funnelData} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} width={72} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                formatter={(v: number) => [v, 'leads']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {funnelData.map((_, i) => <Cell key={i} fill={FUNNEL_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Top Usuários de IA ── */}
      {topAIUsers.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Top Usuários de IA — este mês
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground font-medium px-5 py-2.5">Cliente</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2.5">Plano</th>
                    <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2.5">Req. mês</th>
                    <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2.5">Tokens</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2.5 w-40">Uso do limite</th>
                  </tr>
                </thead>
                <tbody>
                  {topAIUsers.map((u, i) => (
                    <tr key={u.user_id} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                      <td className="px-5 py-2.5 text-foreground font-mono text-xs truncate max-w-[200px]">{u.email}</td>
                      <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px] capitalize">{u.plan}</Badge></td>
                      <td className="px-4 py-2.5 text-right text-foreground/80">{u.requests}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">{u.tokens.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${u.usage_pct >= 100 ? 'bg-red-500' : u.usage_pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(u.usage_pct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] w-8 text-right ${u.usage_pct >= 100 ? 'text-red-400' : u.usage_pct >= 80 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                            {u.usage_pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
