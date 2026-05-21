import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { callGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Derives the deployment name from a pod name by stripping the two trailing hash segments.
function deploymentNameFromPod(podName: string): string {
  const parts = podName.split('-');
  if (parts.length >= 3) {
    parts.pop(); // pod hash
    parts.pop(); // replicaset hash
  }
  return parts.join('-');
}

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

    const { data: audit, error: auditError } = await supabase
      .from('pod_restart_audit')
      .select('*')
      .eq('id', audit_id)
      .single();

    if (auditError || !audit) {
      return new Response(JSON.stringify({ error: 'Audit record not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const effectiveClusterId = cluster_id || audit.cluster_id;
    const { data: clusterRow } = await supabase
      .from('clusters')
      .select('user_id')
      .eq('id', effectiveClusterId)
      .single();

    const userId = clusterRow?.user_id || audit.user_id || 'system';
    const deploymentName = deploymentNameFromPod(audit.pod_name);

    if (!audit.container_logs) {
      await supabase
        .from('pod_restart_audit')
        .update({
          analysis_summary: 'Logs do container não disponíveis para análise.',
          remediation_status: 'pending_approval',
          remediation_action: 'Reiniciar o pod para obter novos logs e diagnóstico completo.',
          remediation_result: { proposed: true, fix_action: 'delete_pod', fix_description: 'Reiniciar pod (logs indisponíveis)', fix_params: { namespace: audit.namespace, pod_name: audit.pod_name } },
        })
        .eq('id', audit_id);

      return new Response(JSON.stringify({ skipped: true, reason: 'no_logs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const exitCode = audit.exit_code;
    const previousState = audit.previous_state || {};

    const systemPrompt = `Você é um especialista SRE em Kubernetes. Analise os logs do container e o contexto fornecido.

Retorne APENAS um objeto JSON válido (sem markdown, sem blocos de código, sem texto extra) seguindo este esquema exato:

{
  "summary": "Causa do restart em português (2-4 frases): o que falhou, evidências nos logs, e impacto.",
  "root_cause": "identificador curto do problema (ex: readOnlyRootFilesystem, oom_killed, image_pull_error, config_error, probe_failure, missing_env_var, permission_denied, etc.)",
  "fix_available": true,
  "fix_description": "Descrição em português do que será corrigido no deployment",
  "fix_action": "patch_deployment",
  "fix_params": {
    "deployment_name": "${deploymentName}",
    "namespace": "${audit.namespace}",
    "patch": { ... strategic merge patch JSON para corrigir o problema ... }
  }
}

Se não for possível propor um fix via patch Kubernetes, use:
{
  "summary": "...",
  "root_cause": "...",
  "fix_available": false,
  "fix_description": null,
  "fix_action": "none",
  "fix_params": null
}

Padrões comuns de fix:
- readOnlyRootFilesystem (erros mkdir/write em /tmp, /var/cache, /var/run, /var/log): adicionar volumes emptyDir montados nos paths que precisam de escrita
- OOMKilled (exit 137): usar fix_action "update_deployment_resources" com memory_limit aumentado em 50%
- Probe failure (liveness/readiness): ajustar initialDelaySeconds ou thresholds no patch
- Erro de permissão em arquivo de configuração: ajustar securityContext ou montar config via ConfigMap
- Variável de ambiente ausente: adicionar env var no patch do container

Para patches com volumes emptyDir, a estrutura do patch é:
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{"name": "CONTAINER_NAME", "volumeMounts": [{"name": "VOL_NAME", "mountPath": "/caminho"}]}],
        "volumes": [{"name": "VOL_NAME", "emptyDir": {}}]
      }
    }
  }
}

Para update_deployment_resources, fix_params deve ter: deployment_name, namespace, container_name, memory_limit, memory_request, cpu_limit, cpu_request.

Use o nome do container: "${audit.container_name || deploymentName}".`;

    const userPrompt = `Pod: ${audit.namespace}/${audit.pod_name}
Container: ${audit.container_name || 'não identificado'}
Deployment inferido: ${deploymentName}
Número de restarts: ${audit.restart_count}
Motivo do restart: ${audit.restart_reason || 'desconhecido'}
Exit code: ${exitCode !== null ? exitCode : 'não disponível'}
Estado anterior: ${JSON.stringify(previousState)}

Logs do container antes do crash:
---
${audit.container_logs.substring(0, 8000)}
---`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    console.log(`Analyzing restart for audit ${audit_id} (${audit.namespace}/${audit.pod_name})`);

    const aiResult = await callGemini(messages, userId, 'analyze-restart-cause');
    const rawContent = aiResult.content.trim();

    // Parse JSON response — strip markdown code fences if present
    let analysis: any = null;
    try {
      const jsonText = rawContent.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      analysis = JSON.parse(jsonText);
    } catch (_) {
      // Fallback: treat as plain text summary
      analysis = { summary: rawContent, fix_available: false, fix_action: 'none', fix_params: null };
    }

    const summary = analysis.summary || rawContent;
    const fixAvailable = analysis.fix_available === true && analysis.fix_action !== 'none';

    const updatePayload: any = {
      analysis_summary: summary,
      remediation_status: 'pending_approval',
    };

    if (fixAvailable) {
      updatePayload.remediation_action = analysis.fix_description || 'Correção automática proposta pela IA';
      updatePayload.remediation_result = {
        proposed: true,
        root_cause: analysis.root_cause,
        fix_action: analysis.fix_action,
        fix_description: analysis.fix_description,
        fix_params: analysis.fix_params,
      };
    } else {
      // No config fix available — default is pod restart
      updatePayload.remediation_action = 'Reiniciar pod (causa pode ser transiente)';
      updatePayload.remediation_result = {
        proposed: true,
        root_cause: analysis.root_cause,
        fix_action: 'delete_pod',
        fix_description: 'Reiniciar pod para tentar recuperação',
        fix_params: { namespace: audit.namespace, pod_name: audit.pod_name },
      };
    }

    await supabase
      .from('pod_restart_audit')
      .update(updatePayload)
      .eq('id', audit_id);

    console.log(`✅ Analysis complete for ${audit_id}: root_cause=${analysis.root_cause}, fix=${analysis.fix_action}`);

    // Auto-apply the fix for safe, well-understood actions.
    // image changes and unknown actions stay at pending_approval (too risky to auto-apply).
    const autoApplyActions = ['patch_deployment', 'update_deployment_resources', 'restart_pod', 'delete_pod'];
    if (fixAvailable && analysis.fix_params && autoApplyActions.includes(analysis.fix_action)) {
      try {
        await supabase.from('agent_commands').insert({
          cluster_id:    effectiveClusterId,
          user_id:       userId,
          command_type:  analysis.fix_action,
          command_params: analysis.fix_params,
          status:        'pending',
        });

        await supabase
          .from('pod_restart_audit')
          .update({ remediation_status: 'applied', remediation_at: new Date().toISOString() })
          .eq('id', audit_id);

        console.log(`🔧 Auto-applied fix for ${audit_id}: ${analysis.fix_action}`);
      } catch (applyErr: any) {
        console.error(`Failed to auto-apply fix for ${audit_id}:`, applyErr.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, audit_id, root_cause: analysis.root_cause, fix_action: analysis.fix_action }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('analyze-restart-cause failed:', err.message);

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const { audit_id } = await req.clone().json().catch(() => ({}));
      if (audit_id) {
        await supabase
          .from('pod_restart_audit')
          .update({
            analysis_summary: `Análise automática indisponível: ${err.message}`,
            remediation_status: 'pending_approval',
            remediation_action: 'Reiniciar pod (análise falhou)',
            remediation_result: { proposed: true, fix_action: 'delete_pod', fix_description: 'Reiniciar pod', fix_params: null },
          })
          .eq('id', audit_id);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
