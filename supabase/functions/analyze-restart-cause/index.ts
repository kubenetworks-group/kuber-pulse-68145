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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { audit_id, cluster_id } = await req.json();

    if (!audit_id) {
      return new Response(JSON.stringify({ error: 'audit_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the audit record
    const { data: audit, error: auditError } = await supabase
      .from('pod_restart_audit')
      .select('*')
      .eq('id', audit_id)
      .single();

    if (auditError || !audit) {
      console.error('Audit record not found:', auditError);
      return new Response(JSON.stringify({ error: 'Audit record not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no logs, mark as unavailable and return
    if (!audit.container_logs) {
      await supabase
        .from('pod_restart_audit')
        .update({ analysis_summary: 'Logs do container não disponíveis para análise.' })
        .eq('id', audit_id);

      return new Response(JSON.stringify({ skipped: true, reason: 'no_logs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user_id for AI usage tracking
    const effectiveClusterId = cluster_id || audit.cluster_id;
    const { data: clusterRow } = await supabase
      .from('clusters')
      .select('user_id')
      .eq('id', effectiveClusterId)
      .single();

    const userId = clusterRow?.user_id || audit.user_id || 'system';

    // Determine crash context
    const exitCode = audit.exit_code;
    const isOOMKilled = exitCode === 137 || audit.restart_reason?.toLowerCase().includes('oom');
    const previousState = audit.previous_state || {};

    const systemPrompt = `Você é um especialista SRE em Kubernetes com ampla experiência em diagnóstico de falhas de containers.
Analise os logs do container e o contexto fornecido para determinar a causa do restart.
Responda em português, de forma concisa (3-5 frases), cobrindo:
1. A causa raiz do restart (OOMKilled, crash da aplicação, erro de configuração, etc.)
2. Evidências específicas encontradas nos logs
3. A ação recomendada para resolver o problema

Responda apenas com o texto da análise, sem JSON, sem markdown, sem listas com bullet points.`;

    const userPrompt = `Pod: ${audit.namespace}/${audit.pod_name}
Container: ${audit.container_name || 'não identificado'}
Número de restarts: ${audit.restart_count}
Motivo do restart: ${audit.restart_reason || 'desconhecido'}
Exit code: ${exitCode !== null ? exitCode : 'não disponível'}
OOMKilled: ${isOOMKilled ? 'sim' : 'não'}
Estado anterior: ${JSON.stringify(previousState)}

Logs do container antes do crash (últimas linhas):
---
${audit.container_logs.substring(0, 8000)}
---`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    console.log(`Analyzing restart cause for audit ${audit_id} (pod: ${audit.namespace}/${audit.pod_name})`);

    const aiResult = await callGemini(messages, userId, 'analyze-restart-cause');
    const summary = aiResult.content.trim();

    await supabase
      .from('pod_restart_audit')
      .update({ analysis_summary: summary })
      .eq('id', audit_id);

    console.log(`✅ Analysis complete for audit ${audit_id}`);

    return new Response(
      JSON.stringify({ success: true, audit_id, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('analyze-restart-cause failed:', err.message);

    // Try to store error in analysis_summary so UI doesn't spin forever
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const { audit_id } = await req.clone().json().catch(() => ({}));
      if (audit_id) {
        await supabase
          .from('pod_restart_audit')
          .update({ analysis_summary: `Análise automática indisponível: ${err.message}` })
          .eq('id', audit_id);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
