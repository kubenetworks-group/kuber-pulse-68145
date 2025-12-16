import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function for retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof Error && (
        error.message.includes('Unauthorized') ||
        error.message.includes('402') ||
        error.message.includes('429')
      )) {
        throw error;
      }

      if (attempt === maxRetries - 1) {
        break;
      }

      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Map threat data to severity
function determineSeverity(threatLevel: string, threatType: string): string {
  const severityMap: Record<string, string> = {
    'critical': 'critical',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
  };

  // Upgrade severity for certain threat types
  if (['crypto_mining', 'backdoor', 'shell_injection', 'data_exfiltration'].includes(threatType)) {
    return threatLevel === 'medium' ? 'high' : (threatLevel === 'low' ? 'medium' : threatLevel);
  }

  return severityMap[threatLevel] || 'medium';
}

// Get threat type from analysis
function getThreatType(reason: string): string {
  const reasonLower = reason.toLowerCase();

  if (reasonLower.includes('crypto') || reasonLower.includes('mining') || reasonLower.includes('xmrig')) {
    return 'crypto_mining';
  }
  if (reasonLower.includes('privileged') || reasonLower.includes('privilege')) {
    return 'privilege_escalation';
  }
  if (reasonLower.includes('host network') || reasonLower.includes('hostnetwork')) {
    return 'unauthorized_access';
  }
  if (reasonLower.includes('host pid') || reasonLower.includes('hostpid')) {
    return 'unauthorized_access';
  }
  if (reasonLower.includes('backdoor') || reasonLower.includes('reverse-shell')) {
    return 'shell_injection';
  }
  if (reasonLower.includes('root')) {
    return 'privilege_escalation';
  }
  if (reasonLower.includes('port') && reasonLower.includes('exposed')) {
    return 'port_scan';
  }
  if (reasonLower.includes('forbidden') || reasonLower.includes('unauthorized')) {
    return 'brute_force';
  }

  return 'suspicious_process';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

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

    // Process suspicious pods
    for (const pod of securityData.suspicious_pods || []) {
      allThreats.push({
        source: 'suspicious_pod',
        ...pod,
      });
    }

    // Process privileged containers
    for (const container of securityData.privileged_containers || []) {
      allThreats.push({
        source: 'privileged_container',
        ...container,
      });
    }

    // Process host network pods
    for (const pod of securityData.host_network_pods || []) {
      allThreats.push({
        source: 'host_network',
        ...pod,
      });
    }

    // Process host PID pods
    for (const pod of securityData.host_pid_pods || []) {
      allThreats.push({
        source: 'host_pid',
        ...pod,
      });
    }

    // Process resource anomalies
    for (const anomaly of securityData.resource_anomalies || []) {
      allThreats.push({
        source: 'resource_anomaly',
        ...anomaly,
      });
    }

    // Process network anomalies
    for (const anomaly of securityData.network_anomalies || []) {
      allThreats.push({
        source: 'network_anomaly',
        ...anomaly,
      });
    }

    // Process suspicious events
    for (const event of securityData.suspicious_events || []) {
      allThreats.push({
        source: 'suspicious_event',
        ...event,
      });
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

    // Call Lovable AI for threat analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      // If no AI key, still process threats but without AI analysis
      console.warn('LOVABLE_API_KEY not configured, processing threats without AI analysis');

      const threatsToInsert = allThreats.slice(0, 50).map(threat => ({
        cluster_id,
        user_id: user.id,
        threat_type: getThreatType(threat.reason || threat.source),
        severity: determineSeverity(threat.threat_level || 'medium', getThreatType(threat.reason || threat.source)),
        title: `${threat.source.replace(/_/g, ' ').toUpperCase()}: ${threat.pod_name || threat.service_name || threat.object || 'Unknown'}`,
        description: threat.reason || `Ameaca detectada: ${threat.source}`,
        container_name: threat.container_name,
        pod_name: threat.pod_name,
        namespace: threat.namespace,
        node_name: threat.node,
        suspicious_command: null,
        source_ip: null,
        raw_data: threat,
      }));

      const { error: insertError } = await supabaseClient
        .from('security_threats')
        .insert(threatsToInsert);

      if (insertError) {
        console.error('Error storing threats:', insertError);
      }

      return new Response(
        JSON.stringify({
          threats: threatsToInsert,
          summary: `Detectadas ${allThreats.length} ameacas de seguranca no cluster.`,
          ai_analysis: null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('🤖 Calling Lovable AI for security threat analysis...');

    const systemPrompt = `Voce e um especialista em seguranca de Kubernetes e deteccao de ameacas.

ANALISE AS AMEACAS DE SEGURANCA ABAIXO E CLASSIFIQUE:

**TIPOS DE AMEACAS:**
1. **ddos** - Ataque DDoS, muitas conexoes, alto trafego
2. **brute_force** - Tentativas de acesso forcado, eventos de autorizacao falhos
3. **port_scan** - Varredura de portas, portas perigosas expostas
4. **suspicious_process** - Processos suspeitos, imagens maliciosas
5. **crypto_mining** - Mineracao de criptomoedas, uso alto de CPU com pouca memoria
6. **privilege_escalation** - Escalacao de privilegios, containers privilegiados, capabilities perigosas
7. **data_exfiltration** - Exfiltracao de dados, trafego de saida suspeito
8. **shell_injection** - Injecao de shell, reverse shell, backdoor
9. **unauthorized_access** - Acesso nao autorizado, host network, host PID

**SEVERIDADE:**
- critical: Ameaca ativa, risco imediato de comprometimento
- high: Ameaca seria, requer atencao imediata
- medium: Potencial ameaca, deve ser investigada
- low: Risco baixo, mas deve ser monitorado

Retorne JSON (sem markdown):
{
  "threats": [
    {
      "threat_type": "tipo da ameaca",
      "severity": "critical|high|medium|low",
      "title": "Titulo curto em portugues",
      "description": "Descricao detalhada em portugues da ameaca",
      "container_name": "nome do container se aplicavel",
      "pod_name": "nome do pod",
      "namespace": "namespace",
      "node_name": "nome do node",
      "suspicious_command": "comando suspeito se houver",
      "ai_analysis": {
        "threat_score": 0.0-1.0,
        "confidence": 0.0-1.0,
        "indicators": ["indicador1", "indicador2"],
        "recommendation": "Recomendacao em portugues de como mitigar",
        "mitigation_steps": ["passo1", "passo2", "passo3"]
      },
      "evidence": {
        "source": "origem da deteccao",
        "raw_reason": "motivo original"
      }
    }
  ],
  "summary": "Resumo em portugues das ameacas encontradas com contagem por severidade",
  "overall_risk_level": "critical|high|medium|low",
  "immediate_actions": ["acao1", "acao2"]
}`;

    const aiData = await retryWithBackoff(async () => {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analise estas ameacas de seguranca do Kubernetes:\n\n${JSON.stringify(allThreats.slice(0, 100), null, 2)}` }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Lovable AI error:', aiResponse.status, errorText);

        if (aiResponse.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (aiResponse.status === 402) {
          throw new Error('Payment required. Please add funds to your Lovable AI workspace.');
        }

        throw new Error(`Lovable AI returned ${aiResponse.status}: ${errorText}`);
      }

      return await aiResponse.json();
    }, 3, 2000);

    let aiContent = aiData.choices[0]?.message?.content || '{"threats":[]}';

    // Remove markdown code fences if present
    aiContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let analysisResult;
    try {
      analysisResult = JSON.parse(aiContent);
    } catch (e) {
      console.error('Failed to parse AI response:', aiContent);
      analysisResult = { threats: [], summary: 'Erro ao processar analise de IA' };
    }

    const threats = analysisResult.threats || [];

    // Store threats in database (check for duplicates first)
    if (threats.length > 0) {
      // Get existing active threats to avoid duplicates
      const { data: existingThreats } = await supabaseClient
        .from('security_threats')
        .select('pod_name, namespace, threat_type')
        .eq('cluster_id', cluster_id)
        .eq('status', 'active')
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Last 30 minutes

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
          user_id: user.id,
          threat_type: threat.threat_type,
          severity: threat.severity,
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

        // Create critical/high severity notifications only for NEW threats and not in silent mode
        if (!silent) {
          const criticalHighThreats = newThreats.filter((t: any) =>
            t.severity === 'critical' || t.severity === 'high'
          );

          if (criticalHighThreats.length > 0) {
            await supabaseClient
              .from('notifications')
              .insert({
                user_id: user.id,
                title: criticalHighThreats.some((t: any) => t.severity === 'critical')
                  ? '🚨 ALERTA CRITICO DE SEGURANCA'
                  : '⚠️ Alerta de Seguranca',
                message: `Detectadas ${criticalHighThreats.length} nova(s) ameaca(s) de alta severidade no cluster. Verifique imediatamente!`,
                type: 'error',
                related_entity_type: 'security_threat',
                related_entity_id: cluster_id,
              });
          }
        }

        console.log(`✅ Security analysis complete: ${newThreats.length} NEW threats detected (${threats.length - newThreats.length} duplicates skipped)`);
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
