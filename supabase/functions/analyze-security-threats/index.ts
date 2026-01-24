import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define which threat types are REAL ATTACKS vs CONFIGURATION RISKS
const ATTACK_THREAT_TYPES = [
  'crypto_mining',
  'ddos', 
  'brute_force',
  'shell_injection',
  'data_exfiltration',
  'malware',
  'backdoor',
  'intrusion',
  'ransomware',
  'botnet',
];

const CONFIG_RISK_TYPES = [
  'privilege_escalation',
  'unauthorized_access',
  'port_scan',
  'suspicious_process',
  'misconfiguration',
  'compliance_violation',
];

// Check if a threat type is a real attack
function isRealAttack(threatType: string, source: string, reason: string = ''): boolean {
  // Direct attack types
  if (ATTACK_THREAT_TYPES.includes(threatType)) return true;
  
  // Check source - config issues are NOT attacks
  if (['privileged_container', 'host_network', 'host_pid', 'resource_anomaly'].includes(source)) {
    return false;
  }
  
  // Check reason for attack indicators
  const reasonLower = reason.toLowerCase();
  const attackIndicators = ['attack', 'malware', 'crypto', 'mining', 'xmrig', 'botnet', 'backdoor', 'exfiltration', 'intrusion', 'ddos', 'brute'];
  return attackIndicators.some(indicator => reasonLower.includes(indicator));
}

// Map threat data to severity
function determineSeverity(threatLevel: string, threatType: string): string {
  const severityMap: Record<string, string> = {
    'critical': 'critical',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
  };

  if (['crypto_mining', 'backdoor', 'shell_injection', 'data_exfiltration', 'malware', 'ransomware'].includes(threatType)) {
    return threatLevel === 'medium' ? 'high' : (threatLevel === 'low' ? 'medium' : threatLevel);
  }

  return severityMap[threatLevel] || 'medium';
}

// Get threat type from analysis
function getThreatType(reason: string, source: string): { type: string; isAttack: boolean } {
  const reasonLower = reason.toLowerCase();

  if (reasonLower.includes('crypto') || reasonLower.includes('mining') || reasonLower.includes('xmrig')) {
    return { type: 'crypto_mining', isAttack: true };
  }
  if (reasonLower.includes('ddos') || reasonLower.includes('flood') || reasonLower.includes('attack')) {
    return { type: 'ddos', isAttack: true };
  }
  if (reasonLower.includes('backdoor') || reasonLower.includes('reverse-shell') || reasonLower.includes('c2')) {
    return { type: 'shell_injection', isAttack: true };
  }
  if (reasonLower.includes('exfiltration') || reasonLower.includes('data leak')) {
    return { type: 'data_exfiltration', isAttack: true };
  }
  if (reasonLower.includes('brute') || reasonLower.includes('forbidden') || reasonLower.includes('unauthorized')) {
    return { type: 'brute_force', isAttack: true };
  }
  if (reasonLower.includes('malware') || reasonLower.includes('virus') || reasonLower.includes('trojan')) {
    return { type: 'malware', isAttack: true };
  }
  
  // Configuration risks (NOT attacks)
  if (source === 'privileged_container' || reasonLower.includes('privileged') || reasonLower.includes('privilege')) {
    return { type: 'privilege_escalation', isAttack: false };
  }
  if (source === 'host_network' || reasonLower.includes('host network') || reasonLower.includes('hostnetwork')) {
    return { type: 'unauthorized_access', isAttack: false };
  }
  if (source === 'host_pid' || reasonLower.includes('host pid') || reasonLower.includes('hostpid')) {
    return { type: 'unauthorized_access', isAttack: false };
  }
  if (reasonLower.includes('root')) {
    return { type: 'privilege_escalation', isAttack: false };
  }
  if (reasonLower.includes('port') && reasonLower.includes('exposed')) {
    return { type: 'port_scan', isAttack: false };
  }
  if (source === 'resource_anomaly') {
    return { type: 'suspicious_process', isAttack: false };
  }

  // Default: if from suspicious events or network anomalies with attack-like patterns
  if (source === 'suspicious_event' || source === 'network_anomaly') {
    return { type: 'suspicious_process', isAttack: true };
  }

  return { type: 'misconfiguration', isAttack: false };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !data?.claims?.sub) {
      console.error('Claims error:', claimsError);
      throw new Error('Unauthorized');
    }
    
    const userId = data.claims.sub;

    const { cluster_id, silent = false } = await req.json();

    if (!cluster_id) {
      throw new Error('cluster_id is required');
    }

    console.log(`🔒 Starting ${silent ? 'background ' : ''}security threat analysis for cluster ${cluster_id}`);

    // Get recent security_threats metrics
    const { data: metrics, error: metricsError } = await supabaseClient
      .from('agent_metrics')
      .select('*')
      .eq('cluster_id', cluster_id)
      .eq('metric_type', 'security_threats')
      .gte('collected_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .order('collected_at', { ascending: false })
      .limit(1);

    if (metricsError) {
      console.error('Error fetching security metrics:', metricsError);
      throw new Error('Failed to fetch security metrics');
    }

    if (!metrics || metrics.length === 0) {
      return new Response(
        JSON.stringify({
          threats: [],
          summary: 'Nenhuma metrica de seguranca recente encontrada. Aguarde o agente enviar dados.',
          message: 'No recent security metrics to analyze'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const securityData = metrics[0].metric_data;
    console.log('Security data received:', {
      suspicious_pods: securityData.suspicious_pods?.length || 0,
      privileged_containers: securityData.privileged_containers?.length || 0,
      host_network_pods: securityData.host_network_pods?.length || 0,
      host_pid_pods: securityData.host_pid_pods?.length || 0,
      resource_anomalies: securityData.resource_anomalies?.length || 0,
      suspicious_events: securityData.suspicious_events?.length || 0,
      network_anomalies: securityData.network_anomalies?.length || 0,
    });

    // Collect all potential threats
    const allThreats: any[] = [];

    for (const pod of securityData.suspicious_pods || []) {
      allThreats.push({ source: 'suspicious_pod', ...pod });
    }
    for (const container of securityData.privileged_containers || []) {
      allThreats.push({ source: 'privileged_container', ...container });
    }
    for (const pod of securityData.host_network_pods || []) {
      allThreats.push({ source: 'host_network', ...pod });
    }
    for (const pod of securityData.host_pid_pods || []) {
      allThreats.push({ source: 'host_pid', ...pod });
    }
    for (const anomaly of securityData.resource_anomalies || []) {
      allThreats.push({ source: 'resource_anomaly', ...anomaly });
    }
    for (const anomaly of securityData.network_anomalies || []) {
      allThreats.push({ source: 'network_anomaly', ...anomaly });
    }
    for (const event of securityData.suspicious_events || []) {
      allThreats.push({ source: 'suspicious_event', ...event });
    }

    if (allThreats.length === 0) {
      return new Response(
        JSON.stringify({
          threats: [],
          summary: 'Nenhuma ameaca de seguranca detectada. O cluster esta seguro.',
          ai_analysis: null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('🤖 Starting security threat analysis...');

    const systemPrompt = `Voce e um especialista em seguranca de Kubernetes e deteccao de ameacas.

ANALISE AS AMEACAS DE SEGURANCA ABAIXO E CLASSIFIQUE:

**IMPORTANTE: Diferencie ATAQUES REAIS de RISCOS DE CONFIGURACAO**

**ATAQUES REAIS (is_attack = true):**
- ddos, brute_force, crypto_mining, malware, ransomware, botnet
- shell_injection, backdoor, data_exfiltration
- Processos suspeitos com comandos maliciosos

**RISCOS DE CONFIGURACAO (is_attack = false):**
- privilege_escalation (containers privilegiados)
- unauthorized_access (host network/pid)
- port_scan (portas expostas)
- misconfiguration, compliance_violation

**SEVERIDADE:**
- critical: Ameaca ativa, risco imediato
- high: Ameaca seria, atencao imediata
- medium: Potencial ameaca, investigar
- low: Risco baixo, monitorar

Retorne JSON (sem markdown):
{
  "threats": [
    {
      "threat_type": "tipo da ameaca",
      "severity": "critical|high|medium|low",
      "is_attack": true ou false,
      "title": "Titulo curto em portugues",
      "description": "Descricao detalhada em portugues",
      "container_name": "nome do container",
      "pod_name": "nome do pod",
      "namespace": "namespace",
      "node_name": "nome do node",
      "suspicious_command": "comando suspeito",
      "ai_analysis": {
        "threat_score": 0.0-1.0,
        "confidence": 0.0-1.0,
        "indicators": ["indicador1", "indicador2"],
        "recommendation": "Recomendacao em portugues",
        "mitigation_steps": ["passo1", "passo2"]
      },
      "evidence": {
        "source": "origem",
        "raw_reason": "motivo original"
      }
    }
  ],
  "summary": "Resumo em portugues",
  "overall_risk_level": "critical|high|medium|low",
  "immediate_actions": ["acao1", "acao2"]
}`;

    const geminiMessages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: `Analise estas ameacas de seguranca do Kubernetes:\n\n${JSON.stringify(allThreats.slice(0, 100), null, 2)}` }
    ];

    let aiResult: { content: string; inputTokens: number; outputTokens: number; isFreeTier: boolean; estimatedCost: number } | null = null;
    let usedFallback = false;

    // Try Gemini first
    try {
      aiResult = await callGemini(geminiMessages, userId, "analyze-security-threats");
    } catch (geminiError: any) {
      console.log('Gemini failed:', geminiError.message);
      
      // Try Lovable AI Gateway as fallback
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const lovableResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: geminiMessages.map(m => ({ role: m.role, content: m.content })),
            }),
          });
          
          if (lovableResponse.ok) {
            const lovableData = await lovableResponse.json();
            aiResult = {
              content: lovableData.choices?.[0]?.message?.content || "",
              inputTokens: lovableData.usage?.prompt_tokens || 0,
              outputTokens: lovableData.usage?.completion_tokens || 0,
              isFreeTier: true,
              estimatedCost: 0,
            };
            console.log('🤖 Lovable AI Gateway response received');
          } else {
            console.log('Lovable AI Gateway failed:', lovableResponse.status);
          }
        } catch (lovableError) {
          console.log('Lovable AI Gateway error:', lovableError);
        }
      }
    }

    let analysisResult: any;

    // Parse AI response if available
    if (aiResult && aiResult.content) {
      let aiContent = aiResult.content;
      aiContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      try {
        analysisResult = JSON.parse(aiContent);
        console.log(`🤖 AI analysis parsed (tokens: ${aiResult.inputTokens}/${aiResult.outputTokens})`);
      } catch (e) {
        console.error('Failed to parse AI response:', aiContent);
        analysisResult = null;
      }
    }

    // Use deterministic fallback if AI failed
    if (!analysisResult) {
      usedFallback = true;
      console.log('🔧 Using deterministic analysis (AI unavailable or rate limited)');
      
      const deterministicThreats = allThreats.slice(0, 20).map((threat: any) => {
        const threatInfo = getThreatType(threat.reason || '', threat.source || '');
        const severity = determineSeverity(threat.threat_level || 'medium', threatInfo.type);
        
        return {
          threat_type: threatInfo.type,
          severity,
          is_attack: threatInfo.isAttack,
          title: `${threatInfo.type.replace('_', ' ').toUpperCase()} detectado`,
          description: threat.reason || `Ameaça detectada em ${threat.pod_name || threat.container_name || 'recurso desconhecido'}`,
          container_name: threat.container_name || null,
          pod_name: threat.pod_name || null,
          namespace: threat.namespace || 'default',
          node_name: threat.node_name || null,
          suspicious_command: threat.command || null,
          ai_analysis: {
            threat_score: severity === 'critical' ? 0.95 : severity === 'high' ? 0.75 : severity === 'medium' ? 0.5 : 0.25,
            confidence: 0.7,
            indicators: [threat.source || 'metric-based detection'],
            recommendation: threatInfo.isAttack 
              ? `Investigar e mitigar ${threatInfo.type} imediatamente` 
              : `Revisar configuração de ${threatInfo.type} quando possível`,
            mitigation_steps: threatInfo.isAttack 
              ? ['Isolar recurso suspeito', 'Analisar logs', 'Aplicar políticas de segurança']
              : ['Revisar configuração', 'Aplicar best practices', 'Atualizar políticas de segurança']
          },
          evidence: {
            source: threat.source,
            raw_reason: threat.reason || 'Detectado via métricas'
          }
        };
      });

      analysisResult = {
        threats: deterministicThreats,
        summary: `Análise baseada em métricas: ${deterministicThreats.length} ameaça(s) detectada(s). (Serviço de IA temporariamente indisponível)`,
        overall_risk_level: deterministicThreats.some((t: any) => t.severity === 'critical') ? 'critical' :
                           deterministicThreats.some((t: any) => t.severity === 'high') ? 'high' : 'medium',
        immediate_actions: ['Revisar ameaças detectadas', 'Verificar pods suspeitos', 'Monitorar recursos']
      };
    }

    const threats = analysisResult.threats || [];

    console.log(`🤖 Analysis found ${threats.length} threats${usedFallback ? ' (deterministic fallback)' : ` (tokens: ${aiResult?.inputTokens || 0}/${aiResult?.outputTokens || 0})`}`);

    // Store threats in database
    if (threats.length > 0) {
      // Get existing active threats to avoid duplicates
      const { data: existingThreats } = await supabaseClient
        .from('security_threats')
        .select('pod_name, namespace, threat_type')
        .eq('cluster_id', cluster_id)
        .eq('status', 'active')
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

      const existingThreatKeys = new Set(
        (existingThreats || []).map((t: any) => `${t.pod_name}-${t.namespace}-${t.threat_type}`)
      );

      const newThreats = threats.filter((threat: any) => {
        const key = `${threat.pod_name}-${threat.namespace}-${threat.threat_type}`;
        return !existingThreatKeys.has(key);
      });

      if (newThreats.length > 0) {
        const threatsToInsert = newThreats.map((threat: any) => ({
          cluster_id,
          user_id: userId,
          threat_type: threat.threat_type,
          severity: threat.severity,
          is_attack: threat.is_attack ?? true,
          title: threat.title,
          description: threat.description,
          container_name: threat.container_name,
          pod_name: threat.pod_name,
          namespace: threat.namespace,
          node_name: threat.node_name,
          suspicious_command: threat.suspicious_command,
          ai_analysis: threat.ai_analysis,
          evidence: threat.evidence,
          raw_data: allThreats.find(t =>
            t.pod_name === threat.pod_name &&
            t.namespace === threat.namespace
          ),
        }));

        const { error: insertError } = await supabaseClient
          .from('security_threats')
          .insert(threatsToInsert);

        if (insertError) {
          console.error('Error storing threats:', insertError);
        }

        // Create notifications for critical/high severity threats
        if (!silent) {
          const criticalHighThreats = newThreats.filter((t: any) =>
            t.severity === 'critical' || t.severity === 'high'
          );

          if (criticalHighThreats.length > 0) {
            await supabaseClient
              .from('notifications')
              .insert({
                user_id: userId,
                title: criticalHighThreats.some((t: any) => t.severity === 'critical')
                  ? '🚨 ALERTA CRITICO DE SEGURANCA'
                  : '⚠️ Alerta de Seguranca',
                message: `Detectadas ${criticalHighThreats.length} nova(s) ameaca(s) de alta severidade no cluster.`,
                type: 'error',
                related_entity_type: 'security_threat',
                related_entity_id: cluster_id,
              });
          }
        }

        console.log(`✅ Security analysis complete: ${newThreats.length} NEW threats detected`);
      } else {
        console.log(`✅ Security analysis complete: No new threats (${threats.length} duplicates skipped)`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        threats_found: threats.length,
        threats,
        summary: analysisResult.summary || `Detectadas ${threats.length} ameacas de seguranca`,
        overall_risk_level: analysisResult.overall_risk_level || 'medium',
        immediate_actions: analysisResult.immediate_actions || [],
        ai_usage: aiResult ? {
          input_tokens: aiResult.inputTokens,
          output_tokens: aiResult.outputTokens,
          is_free_tier: aiResult.isFreeTier,
          estimated_cost: aiResult.estimatedCost
        } : {
          input_tokens: 0,
          output_tokens: 0,
          is_free_tier: true,
          estimated_cost: 0,
          fallback_used: true
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in analyze-security-threats:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
