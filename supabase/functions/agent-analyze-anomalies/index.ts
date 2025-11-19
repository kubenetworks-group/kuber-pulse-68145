import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { cluster_id } = await req.json();

    if (!cluster_id) {
      throw new Error('cluster_id is required');
    }

    // Get recent metrics for the cluster
    const { data: metrics, error: metricsError } = await supabaseClient
      .from('agent_metrics')
      .select('*')
      .eq('cluster_id', cluster_id)
      .gte('collected_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Last 15 minutes
      .order('collected_at', { ascending: false });

    if (metricsError) {
      console.error('Error fetching metrics:', metricsError);
      throw new Error('Failed to fetch metrics');
    }

    if (!metrics || metrics.length === 0) {
      return new Response(
        JSON.stringify({ 
          anomalies: [], 
          summary: 'Nenhuma métrica recente encontrada. O agente pode não estar enviando dados.',
          message: 'No recent metrics to analyze' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Prepare data for AI analysis
    const metricsSummary = {
      cpu: metrics.filter(m => m.metric_type === 'cpu').map(m => m.metric_data),
      memory: metrics.filter(m => m.metric_type === 'memory').map(m => m.metric_data),
      pods: metrics.filter(m => m.metric_type === 'pods').map(m => m.metric_data),
      pod_details: metrics.filter(m => m.metric_type === 'pod_details').map(m => m.metric_data),
      nodes: metrics.filter(m => m.metric_type === 'nodes').map(m => m.metric_data),
      events: metrics.filter(m => m.metric_type === 'events').map(m => m.metric_data),
    };

    console.log('Metrics summary prepared:', {
      cpu_count: metricsSummary.cpu.length,
      memory_count: metricsSummary.memory.length,
      pods_count: metricsSummary.pods.length,
      pod_details_count: metricsSummary.pod_details.length,
      events_count: metricsSummary.events.length,
    });

    // Check for missing essential metrics
    if (metricsSummary.pod_details.length === 0 || metricsSummary.events.length === 0) {
      const missingMetrics = [];
      if (metricsSummary.pod_details.length === 0) missingMetrics.push('pod_details');
      if (metricsSummary.events.length === 0) missingMetrics.push('events');
      
      console.warn('Missing essential metrics:', missingMetrics);
      
      return new Response(
        JSON.stringify({ 
          anomalies: [{
            severity: 'warning',
            type: 'incomplete_data',
            description: `Dados incompletos do cluster. Métricas ausentes: ${missingMetrics.join(', ')}`,
            recommendation: 'Verifique se o agente está configurado corretamente e tem permissões para coletar todas as métricas.',
            ai_analysis: {
              issue: 'incomplete_metrics',
              missing: missingMetrics
            }
          }],
          summary: `Agente está enviando apenas métricas básicas. Faltam: ${missingMetrics.join(', ')}. Análise completa não disponível.`,
          message: 'Incomplete metrics data' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Call Lovable AI for anomaly detection
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a Kubernetes cluster monitoring AI assistant specialized in deep cluster analysis.

**PRIMARY ANALYSIS PRIORITY: KUBERNETES EVENTS**
Kubernetes events are the MOST CRITICAL source of truth for cluster health. Analyze events FIRST before looking at metrics:

1. **Critical Event Types (Highest Priority):**
   - CrashLoopBackOff: Container repeatedly crashing - CRITICAL ISSUE
   - ImagePullBackOff / ErrImagePull: Cannot pull container image - CRITICAL
   - FailedScheduling: Pod cannot be scheduled to any node - CRITICAL
   - Failed: General pod failure - HIGH PRIORITY
   - Evicted: Pod evicted due to resource pressure - HIGH PRIORITY
   - OOMKilled: Out of memory - HIGH PRIORITY
   
2. **Warning Event Types:**
   - BackOff: Temporary scheduling issues
   - Unhealthy: Health check failures
   - FailedMount: Volume mount issues
   - NetworkNotReady: Network problems

3. **Pod Status Analysis (from pod_details):**
   - Running + RestartCount > 5: Unstable pod
   - Pending > 5 minutes: Scheduling issues
   - Failed / Error: Immediate attention needed
   - CrashLoopBackOff: Critical failure loop
   - "Failed" / "FailedMount" = Volume mount issues
   - "Failed" / "FailedAttachVolume" = Storage problems
   - "Pulled" / "ErrImagePull" / "ImagePullBackOff" = Image not found or auth issues
   - "Unhealthy" = Liveness/Readiness probe failures
   - "FailedCreate" = Deployment/ReplicaSet creation issues
   - "OOMKilled" = Out of memory
   - Look at event.message for specific error details!

2. **Pod Restarts** (cross-reference with events):
   - 1-3 restarts = medium severity
   - 4-10 restarts = high severity
   - >10 restarts = critical
   
3. **Pod Status & States**:
   - Phase "Pending" + events = scheduling/resource issue
   - Phase "Failed" = deployment problem
   - Container state "waiting" = startup issue
   - Container ready = false = app not healthy

4. **Resource Usage**: 
   - CPU > 80% = scale up needed
   - Memory > 85% = OOM risk

**DEPLOYMENT ANALYSIS:**
For each pod with issues:
1. Check events for that specific pod/deployment
2. Extract the root cause from event messages
3. Identify if it's: image problem, resource limit, config error, probe failure, etc.
4. Provide specific fix based on the actual error

Return JSON (no markdown):
{
  "anomalies": [
    {
      "type": "pod_restart|pod_crash|pod_pending|image_pull_error|oom_killed|probe_failure|scheduling_issue|mount_failure|high_cpu|high_memory",
      "severity": "low|medium|high|critical",
      "description": "Detailed description in Portuguese with pod name, namespace, and SPECIFIC error from events",
      "recommendation": "Specific action in Portuguese based on the actual error found in events",
      "affected_pods": ["namespace/pod-name"],
      "event_messages": ["actual error messages from Kubernetes events"],
      "auto_heal": "restart_pod|delete_pod|scale_up|scale_down|null",
      "auto_heal_params": {
        "pod_name": "pod-name",
        "namespace": "namespace",
        "action": "delete"
      }
    }
  ],
  "summary": "Portuguese summary with total issues found and most critical problems"
}

**EXAMPLE:**
If you see event: "Failed to pull image 'apache:2.5': image not found"
→ anomaly type: "image_pull_error"
→ description: "Pod apache-deploy-7 no namespace demo não consegue iniciar porque a imagem 'apache:2.5' não existe"
→ recommendation: "Corrigir a tag da imagem no deployment para uma versão válida como 'apache:2.4' ou 'apache:latest'"

**MANDATORY:**
- Use events.message field to get exact error
- Match events to pods by involved_object.name
- List EVERY pod with problems
- Include event_messages in anomaly
- Be SPECIFIC about what's wrong and how to fix`
          },
          {
            role: 'user',
            content: `Analyze these Kubernetes cluster metrics and detect anomalies:\n\n${JSON.stringify(metricsSummary, null, 2)}`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Insufficient credits. Please add funds to your Lovable AI workspace.');
      }
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('AI analysis failed');
    }

    const aiData = await aiResponse.json();
    let aiContent = aiData.choices[0]?.message?.content || '{"anomalies":[]}';
    
    // Remove markdown code fences if present
    aiContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let analysisResult;
    try {
      analysisResult = JSON.parse(aiContent);
    } catch (e) {
      console.error('Failed to parse AI response:', aiContent);
      analysisResult = { anomalies: [] };
    }

    const anomalies = analysisResult.anomalies || [];

    // Store anomalies in database
    if (anomalies.length > 0) {
      const anomaliesToInsert = anomalies.map((anomaly: any) => ({
        cluster_id,
        user_id: user.id,
        anomaly_type: anomaly.type,
        severity: anomaly.severity,
        description: anomaly.description,
        recommendation: anomaly.recommendation,
        auto_heal_applied: false,
        ai_analysis: {
          model: 'gemini-2.5-flash',
          confidence: 0.85,
          timestamp: new Date().toISOString(),
        },
      }));

      const { error: insertError } = await supabaseClient
        .from('agent_anomalies')
        .insert(anomaliesToInsert);

      if (insertError) {
        console.error('Error storing anomalies:', insertError);
      }

      // Create notification
      await supabaseClient
        .from('notifications')
        .insert({
          user_id: user.id,
          title: `🤖 ${anomalies.length} anomalia(s) detectada(s)`,
          message: `A IA detectou ${anomalies.length} anomalia(s) no cluster. Verifique a aba de Monitoramento de IA.`,
          type: anomalies.some((a: any) => a.severity === 'critical') ? 'error' : 'warning',
          related_entity_type: 'cluster',
          related_entity_id: cluster_id,
        });
    }

    console.log(`Analyzed cluster ${cluster_id} and found ${anomalies.length} anomalies`);

    return new Response(
      JSON.stringify({
        success: true,
        anomalies_found: anomalies.length,
        anomalies,
        summary: analysisResult.summary || 'Análise concluída',
        metrics_analyzed: {
          cpu_samples: metricsSummary.cpu.length,
          memory_samples: metricsSummary.memory.length,
          pod_samples: metricsSummary.pods.length,
          event_samples: metricsSummary.events.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in agent-analyze-anomalies:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
