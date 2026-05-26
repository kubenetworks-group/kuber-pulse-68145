import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, Users, DollarSign, BarChart2, Target } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface MrrPoint { month: string; mrr: number }
interface CustomerPoint { month: string; count: number }
interface LeadsByStatus { new: number; contacted: number; demo_scheduled: number; converted: number }
interface PlanDistribution { starter: number; growth: number; enterprise: number }
interface TotalUsage { clusters: number; analyses: number; actions: number }

interface Metrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  churnedThisMonth: number;
  churnRate: number;
  trialToPaidConversion: number;
  totalLeads: number;
  leadsByStatus: LeadsByStatus;
  planDistribution: PlanDistribution;
  mrrTrend: MrrPoint[];
  newCustomersPerMonth: CustomerPoint[];
  totalUsage: TotalUsage;
}

const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const PLAN_COLORS = ['#0891b2', '#4f46e5', '#a855f7'];
const FUNNEL_COLORS = ['#64748b', '#0891b2', '#4f46e5', '#10b981'];

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
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore */ }
        toast.error(`Erro ao carregar métricas: ${detail}`);
        setLoading(false);
        return;
      }

      setMetrics(data as Metrics);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!metrics) return null;

  const kpis = [
    {
      label: 'MRR',
      value: brl(metrics.mrr),
      sub: `ARR: ${brl(metrics.arr)}`,
      icon: DollarSign,
      color: 'text-cyan-400',
    },
    {
      label: 'Assinaturas Ativas',
      value: metrics.activeSubscriptions,
      sub: `${metrics.trialSubscriptions} em trial`,
      icon: Users,
      color: 'text-indigo-400',
    },
    {
      label: 'Churn no Mês',
      value: `${metrics.churnRate}%`,
      sub: `${metrics.churnedThisMonth} cancelamento(s)`,
      icon: metrics.churnRate > 5 ? TrendingDown : TrendingUp,
      color: metrics.churnRate > 5 ? 'text-red-400' : 'text-emerald-400',
    },
    {
      label: 'Conversão Lead→Pago',
      value: `${metrics.trialToPaidConversion}%`,
      sub: `${metrics.totalLeads} leads totais`,
      icon: Target,
      color: 'text-purple-400',
    },
    {
      label: 'Total de Analyses IA',
      value: metrics.totalUsage.analyses.toLocaleString('pt-BR'),
      sub: `${metrics.totalUsage.clusters} clusters · ${metrics.totalUsage.actions} ações`,
      icon: BarChart2,
      color: 'text-amber-400',
    },
  ];

  const planData = [
    { name: 'Starter', value: metrics.planDistribution.starter },
    { name: 'Growth', value: metrics.planDistribution.growth },
    { name: 'Enterprise', value: metrics.planDistribution.enterprise },
  ].filter(d => d.value > 0);

  const funnelData = [
    { name: 'Novo', value: metrics.leadsByStatus.new },
    { name: 'Contactado', value: metrics.leadsByStatus.contacted },
    { name: 'Demo', value: metrics.leadsByStatus.demo_scheduled },
    { name: 'Convertido', value: metrics.leadsByStatus.converted },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{kpi.label}</p>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-200">Tendência de Receita (MRR)</CardTitle>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                  formatter={(value: number) => [brl(value), 'MRR']}
                />
                <Area type="monotone" dataKey="mrr" stroke="#0891b2" fill="url(#mrrGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-200">Novos Clientes por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.newCustomersPerMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                  formatter={(value: number) => [value, 'Novos clientes']}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-200">Funil de Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={72} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                  formatter={(value: number) => [value, 'leads']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {funnelData.map((_, index) => (
                    <Cell key={index} fill={FUNNEL_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-200">Distribuição de Planos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {planData.length === 0 ? (
              <p className="text-slate-500 text-sm py-12">Sem assinaturas ativas</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={planData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {planData.map((_, index) => (
                      <Cell key={index} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(value: number, name: string) => [value, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
