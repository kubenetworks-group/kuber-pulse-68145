import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { callGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HTTP_ATTACK_TYPES = ['shell_injection', 'sql_injection', 'path_traversal', 'brute_force', 'port_scan'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const { cluster_id, threat_id, since_hours = 24 } = await req.json();
    if (!cluster_id) {
      return new Response(JSON.stringify({ error: 'cluster_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sinceDate = new Date(Date.now() - since_hours * 60 * 60 * 1000).toISOString();

    // Fetch cluster info
    const { data: cluster } = await supabase
      .from('clusters')
      .select('name, environment, agent_version, provider')
      .eq('id', cluster_id)
      .eq('user_id', user.id)
      .single();

    if (!cluster) {
      return new Response(JSON.stringify({ error: 'Cluster not found or access denied' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch HTTP attack threats
    let threatQuery = supabase
      .from('security_threats')
      .select('*')
      .eq('cluster_id', cluster_id)
      .eq('user_id', user.id)
      .in('threat_type', HTTP_ATTACK_TYPES)
      .eq('is_attack', true)
      .order('created_at', { ascending: true });

    if (threat_id) {
      threatQuery = threatQuery.eq('id', threat_id);
    } else {
      threatQuery = threatQuery.gte('created_at', sinceDate);
    }

    const { data: threats } = await threatQuery.limit(100);

    // Fetch mitigation commands applied
    const { data: mitigationCmds } = await supabase
      .from('agent_commands')
      .select('id, command_params, status, created_at, completed_at, result')
      .eq('cluster_id', cluster_id)
      .eq('command_type', 'block_attacker_ip')
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: true });

    // Build attack timeline for the report
    const attackTimeline = (threats || []).map((t: any) => ({
      timestamp: t.evidence?.timestamp || t.created_at,
      source_ip: t.source_ip,
      destination_ip: t.destination_ip,
      endpoint: t.evidence?.attack_url,
      decoded_payload: (t.evidence?.decoded_payload || '').slice(0, 200),
      status_code: t.evidence?.status_code,
      type: t.threat_type,
      service: t.evidence?.service_name,
      lb_ip: t.evidence?.lb_ingress,
      etp: t.evidence?.external_traffic_policy,
      pod: t.pod_name,
      namespace: t.namespace,
      mitigated: t.status === 'mitigated',
      internal_source: t.evidence?.internal_source,
      sample_log: (t.evidence?.evidence_logs?.[0] || '').slice(0, 300),
    }));

    const statistics = {
      total_attacks: threats?.length ?? 0,
      unique_ips: [...new Set((threats || []).map((t: any) => t.source_ip).filter(Boolean))].length,
      unique_c2_ips: [...new Set((threats || []).map((t: any) => t.destination_ip).filter(Boolean))].length,
      attack_types: [...new Set((threats || []).map((t: any) => t.threat_type))],
      mitigated: (threats || []).filter((t: any) => t.status === 'mitigated').length,
      active: (threats || []).filter((t: any) => t.status === 'active').length,
      internal_source_count: (threats || []).filter((t: any) => t.evidence?.internal_source).length,
      mitigation_commands: mitigationCmds?.length ?? 0,
      mitigation_success: (mitigationCmds || []).filter((c: any) => c.status === 'completed').length,
    };

    const mitigationSummary = (mitigationCmds || []).map((c: any) => ({
      applied_at: c.created_at,
      completed_at: c.completed_at,
      blocked_ip: c.command_params?.attacker_ip,
      namespace: c.command_params?.namespace,
      etp: c.command_params?.external_traffic_policy,
      status: c.status,
      result_message: (c.result as any)?.message || (c.result as any)?.etp_caveat,
    }));

    // AI report generation via Gemini
    const prompt = `Você é um especialista em segurança Kubernetes. Gere um relatório detalhado de ataque HTTP em português brasileiro.

## Contexto do Cluster
- Nome: ${cluster.name} (${cluster.environment})
- Provider: ${cluster.provider || 'não informado'}
- Data do Relatório: ${new Date().toLocaleString('pt-BR')}
- Período Analisado: últimas ${since_hours} horas

## Estatísticas do Ataque
${JSON.stringify(statistics, null, 2)}

## Linha do Tempo dos Ataques (cronológica)
${JSON.stringify(attackTimeline.slice(0, 30), null, 2)}

## Mitigações Aplicadas pelo Kodo
${JSON.stringify(mitigationSummary, null, 2)}

---

Gere um relatório com EXATAMENTE estas seções (use ## para títulos):

## 1. Sumário Executivo
Parágrafo de 3-4 linhas resumindo o incidente, severidade, impacto potencial e postura atual de segurança. Mencione se houve lateral movement (IP interno atacando).

## 2. Rastreamento do Ataque (Attack Trace)
Trace completo: [IP do Atacante] → [LB IP Externo] → [Service Name] → [Pod] → [Endpoint Vulnerável]
Inclua nota sobre externalTrafficPolicy se for "Cluster" (IP pode ser do nó, não do atacante real).

## 3. Linha do Tempo
Tabela Markdown: | Horário | IP de Origem | Endpoint | Status HTTP | Tipo de Ataque |

## 4. Análise da Carga Maliciosa (Payload Analysis)
Explique cada tipo de ataque detectado. Para Mirai/Mozi: explique o que o botnet tenta fazer (baixar malware ARM, executar no /tmp, propagar). Decodifique payloads URL-encoded e explique cada comando shell.

## 5. Por que o Endpoint era Vulnerável?
Análise técnica: qual endpoint estava exposto, por que retornou HTTP 200, qual a causa raiz da vulnerabilidade (ex: endpoint /shell sem autenticação, variável cmd= sem sanitização).

## 6. Solução Aplicada pelo Kodo
Descreva a NetworkPolicy criada (allow 0.0.0.0/0 except attacker/32), quando foi aplicada, e se foi efetiva. Se ETP=Cluster, explique a limitação e recomende mudar para Local.

## 7. Recomendações Futuras (Priorizadas)
Lista numerada de ações preventivas: WAF, rate limiting no LB, externalTrafficPolicy=Local, validação de input, patch do endpoint vulnerável, segmentação de rede, etc.

## 8. Evidências (Logs de Amostra)
Mostre 2-3 linhas de log representativas e explique o que cada campo significa.

Seja técnico mas claro. Use linguagem direta.`;

    const aiResponse = await callGemini(
      [{ role: 'user', content: prompt }],
      user.id,
      'generate-attack-report'
    );

    const reportData = {
      cluster_id,
      cluster_name: cluster.name,
      user_id: user.id,
      generated_at: new Date().toISOString(),
      since_hours,
      threat_id: threat_id || null,
      statistics,
      attack_timeline: attackTimeline,
      mitigation_summary: mitigationSummary,
      ai_report: aiResponse.content,
      token_usage: {
        input: aiResponse.inputTokens,
        output: aiResponse.outputTokens,
      },
    };

    // Persist to attack_reports table
    await supabase.from('attack_reports').insert({
      cluster_id,
      user_id: user.id,
      threat_id: threat_id || null,
      since_hours,
      statistics,
      attack_timeline: attackTimeline,
      ai_report: aiResponse.content,
      token_usage: reportData.token_usage,
    });

    return new Response(
      JSON.stringify({ success: true, report: reportData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('generate-attack-report error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
