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
      events: metrics.filter(m => m.metric_type === 'events').map(m => m.metric_data),
    };

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

Analyze the provided metrics and detect ALL issues, including:

**CRITICAL CHECKS:**
1. **Pod Restarts**: Any pod with restart_count > 0 indicates crashes
   - 1-3 restarts = medium severity (intermittent issue)
   - 4-10 restarts = high severity (recurring problem)
   - >10 restarts = critical (persistent failure, CrashLoopBackOff)
   
2. **Pod Status**: Check pod phase and container states
   - Phase != "Running" = potential problem
   - Container state "waiting" with reason "CrashLoopBackOff" = critical
   - Container state "waiting" with reason "ImagePullBackOff" = high
   - Container ready = false = needs investigation
   
3. **Pod Conditions**: Analyze pod conditions
   - PodScheduled = False = scheduling issue
   - ContainersReady = False = container failing to start
   - Ready = False = pod not accepting traffic

4. **Resource Usage**: 
   - CPU > 80% = scale up needed
   - Memory > 85% = potential OOM risk
   - Resources consistently low < 10% = scale down opportunity

Return JSON (no markdown):
{
  "anomalies": [
    {
      "type": "pod_restart|pod_crash|pod_not_ready|high_cpu|high_memory|scheduling_issue|image_pull_error|resource_underutilized",
      "severity": "low|medium|high|critical",
      "description": "Detailed description in Portuguese including pod name, namespace, and specific issue",
      "recommendation": "Specific action to resolve in Portuguese",
      "affected_pods": ["pod-name-1", "pod-name-2"],
      "auto_heal": "restart_pod|delete_pod|scale_up|scale_down|null",
      "auto_heal_params": {
        "pod_name": "specific-pod-name",
        "namespace": "namespace",
        "action": "delete"
      }
    }
  ],
  "summary": "Comprehensive cluster health summary in Portuguese"
}

**IMPORTANT:** 
- List EVERY pod with issues (name + namespace + reason)
- For each anomaly with auto_heal != null, provide specific auto_heal_params
- Always include summary even if cluster is healthy
- Be specific about which pods need attention`
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
