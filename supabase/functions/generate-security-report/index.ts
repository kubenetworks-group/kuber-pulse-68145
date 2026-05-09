import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { callGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { cluster_id, since_hours = 24 } = await req.json();
    if (!cluster_id) {
      return new Response(JSON.stringify({ error: 'cluster_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sinceDate = new Date(Date.now() - since_hours * 60 * 60 * 1000).toISOString();

    // Fetch cluster info
    const { data: cluster } = await supabase
      .from('clusters')
      .select('name, environment, agent_version')
      .eq('id', cluster_id)
      .eq('user_id', user.id)
      .single();

    // Fetch security threats
    const { data: threats } = await supabase
      .from('security_threats')
      .select('*')
      .eq('cluster_id', cluster_id)
      .eq('user_id', user.id)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false });

    // Fetch AI commands executed (security fixes)
    const { data: commands } = await supabase
      .from('agent_commands')
      .select('*')
      .eq('cluster_id', cluster_id)
      .eq('user_id', user.id)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false });

    // Fetch auto-heal actions log (security type)
    const { data: healLog } = await supabase
      .from('auto_heal_actions_log')
      .select('*')
      .eq('cluster_id', cluster_id)
      .eq('user_id', user.id)
      .eq('action_type', 'security_fix')
      .gte('started_at', sinceDate)
      .order('started_at', { ascending: false });

    const threatsData = threats || [];
    const commandsData = commands || [];
    const healLogData = healLog || [];

    // Statistics
    const totalThreats    = threatsData.length;
    const criticalThreats = threatsData.filter(t => t.severity === 'critical').length;
    const highThreats     = threatsData.filter(t => t.severity === 'high').length;
    const mitigated       = threatsData.filter(t => t.status === 'mitigated').length;
    const active          = threatsData.filter(t => t.status === 'active').length;
    const realAttacks     = threatsData.filter(t => t.is_attack === true).length;
    const configRisks     = threatsData.filter(t => t.is_attack === false).length;

    // Build threat timeline for AI context
    const threatsSummary = threatsData.slice(0, 30).map(t => ({
      title: t.title,
      type: t.threat_type,
      severity: t.severity,
      status: t.status,
      is_attack: t.is_attack,
      namespace: t.namespace || t.affected_resources?.[0]?.namespace,
      resource: t.affected_resources?.[0]?.name || t.pod_name,
      detected_at: t.created_at,
      mitigated_at: t.remediated_at,
      fix_type: t.remediation_result?.fix_type,
      ai_recommendation: t.ai_analysis?.recommendation,
    }));

    const commandsSummary = commandsData.slice(0, 20).map(c => ({
      type: c.command_type,
      params: c.command_params,
      status: c.status,
      created_at: c.created_at,
      executed_at: c.executed_at,
      result: c.result,
    }));

    // Build AI prompt for comprehensive report
    const prompt = `Você é um especialista em segurança Kubernetes. Gere um relatório técnico completo em português sobre os eventos de segurança do cluster.

## Dados do Cluster
- Nome: ${cluster?.name || 'N/A'}
- Ambiente: ${cluster?.environment || 'N/A'}
- Versão do agente: ${cluster?.agent_version || 'N/A'}
- Período analisado: últimas ${since_hours} horas
- Data/hora: ${new Date().toLocaleString('pt-BR')}

## Estatísticas Gerais
- Total de ameaças detectadas: ${totalThreats}
- Críticas: ${criticalThreats} | Altas: ${highThreats}
- Ataques reais: ${realAttacks} | Riscos de configuração: ${configRisks}
- Atualmente ativas: ${active} | Mitigadas: ${mitigated}
- Comandos de correção enviados pela IA: ${commandsData.length}
- Ações de auto-heal executadas: ${healLogData.length}

## Ameaças Detectadas
${JSON.stringify(threatsSummary, null, 2)}

## Comandos de Correção da IA
${JSON.stringify(commandsSummary, null, 2)}

## Sua tarefa
Gere um relatório estruturado com as seguintes seções em Markdown:

### 1. Sumário Executivo
Resumo em 3-4 parágrafos do que aconteceu, gravidade geral e postura de segurança atual.

### 2. Análise de Ameaças por Categoria
Agrupe e explique cada tipo de ameaça encontrada, com contexto técnico.

### 3. Linha do Tempo dos Eventos
Timeline cronológica dos eventos mais importantes (formato: HH:MM - Evento).

### 4. Ações da IA (O que foi feito)
Para cada correção aplicada pela IA, explique:
- O que foi detectado
- Por que era um risco
- Qual comando foi executado
- O resultado esperado

### 5. Troubleshooting - Diagnóstico Detalhado
Para cada ameaça crítica ou alta ainda ativa, forneça:
- Causa raiz provável
- Como verificar manualmente com kubectl
- Impacto potencial se não resolvido

### 6. Recomendações de Hardening
Lista priorizada de 5-10 ações de hardening específicas para este cluster, com comandos kubectl/yaml quando aplicável.

### 7. Conclusão e Próximos Passos
O que deve ser feito nas próximas 24h, 7 dias e 30 dias.

Use linguagem técnica mas acessível. Seja específico com namespaces, nomes de recursos e comandos reais.`;

    const aiResponse = await callGemini([{ role: 'user', content: prompt }], supabase, user.id);

    // Save report to database
    const reportData = {
      cluster_id,
      user_id: user.id,
      generated_at: new Date().toISOString(),
      since_hours,
      statistics: {
        total_threats: totalThreats,
        critical: criticalThreats,
        high: highThreats,
        mitigated,
        active,
        real_attacks: realAttacks,
        config_risks: configRisks,
        commands_sent: commandsData.length,
        heal_actions: healLogData.length,
      },
      threats_summary: threatsSummary,
      commands_summary: commandsSummary,
      ai_report: aiResponse.content,
      token_usage: {
        input: aiResponse.inputTokens,
        output: aiResponse.outputTokens,
        cost: aiResponse.estimatedCost,
      },
    };

    // Upsert into security_reports table (best-effort)
    try {
      await supabase.from('security_reports').insert(reportData);
    } catch (_) {
      // Table may not exist in all environments — non-fatal
      console.warn('Could not save report to security_reports table');
    }

    return new Response(
      JSON.stringify({
        success: true,
        report: reportData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Generate security report error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
