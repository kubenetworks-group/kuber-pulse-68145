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
            content: `You are a Kubernetes cluster monitoring AI assistant. Analyze metrics and detect anomalies.
Return a JSON object with this exact structure (no markdown code fences):
{
  "anomalies": [
    {
      "type": "high_cpu|high_memory|pod_crash|disk_full|resource_underutilized|scaling_opportunity",
      "severity": "low|medium|high|critical",
      "description": "Brief description in Portuguese",
      "recommendation": "What should be done in Portuguese",
      "auto_heal": "restart_pod|scale_up|scale_down|clear_cache|null"
    }
  ],
  "summary": "Brief summary of cluster health in Portuguese"
}

Detection Guidelines:
- CPU > 80% = high severity (scale_up or optimize)
- CPU < 10% for extended time = resource_underutilized (scale_down opportunity)
- Memory > 85% = high severity (memory leak or need scale)
- Memory < 15% = resource_underutilized (cost optimization)
- Pod crashes > 3 in 15min = critical (restart or fix)
- Disk > 85% = high severity (clear_cache or expand)
- No pods running = critical issue
- All resources healthy but overprovisisoned = low severity optimization

IMPORTANT: 
- Always include a summary even if no anomalies
- Look for both problems AND optimization opportunities
- Be proactive with cost-saving suggestions
- Return valid JSON only (no markdown formatting)`
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
