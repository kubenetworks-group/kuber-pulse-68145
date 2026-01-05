import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to find container name from pod details
function findContainerName(podName: string, podDetails: any[]): string {
  for (const metricData of podDetails) {
    const pods = metricData?.pods || [];
    for (const pod of pods) {
      if (pod.name === podName && pod.containers && pod.containers.length > 0) {
        return pod.containers[0].name;
      }
    }
  }
  return podName.replace(/-[a-z0-9]{5,10}-[a-z0-9]{5}$/, '');
}

// Map anomaly type to incident type
function mapAnomalyTypeToIncidentType(anomalyType: string): string {
  const typeMap: Record<string, string> = {
    'pod_restart': 'pod_restart',
    'pod_crash': 'pod_crash',
    'pod_pending': 'scheduling_issue',
    'image_pull_error': 'image_pull_error',
    'oom_killed': 'oom_killed',
    'probe_failure': 'health_check_failure',
    'scheduling_issue': 'scheduling_issue',
    'mount_failure': 'storage_issue',
    'high_cpu': 'resource_pressure',
    'high_memory': 'resource_pressure',
    'resource_limit_too_low': 'resource_misconfiguration',
    'resource_limit_too_high': 'resource_misconfiguration',
    'incomplete_data': 'monitoring_issue',
  };
  return typeMap[anomalyType] || 'other';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json();
    const { cluster_id, user_id: bodyUserId } = body;

    if (!cluster_id) {
      throw new Error('cluster_id is required');
    }

    let supabaseClient;
    let userId: string;

    // Check if this is a service role call (from cron jobs)
    const isServiceRoleCall = authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'never-match');
    
    if (isServiceRoleCall && bodyUserId) {
      console.log('🔧 Service role call detected, using provided user_id');
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      userId = bodyUserId;
    } else if (authHeader) {
      supabaseClient = createClient(
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
      userId = user.id;
    } else {
      throw new Error('Missing authorization');
    }

    console.log(`📊 Analyzing cluster ${cluster_id} for user ${userId}`);

    // Check for recent scan in last 3 minutes to avoid rate limiting
    const { data: recentScan } = await supabaseClient
      .from('scan_history')
      .select('*')
      .eq('cluster_id', cluster_id)
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 3 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentScan) {
      console.log('Using cached scan from', recentScan.created_at);
      return new Response(
        JSON.stringify({
          anomalies: recentScan.anomalies_data || [],
          summary: recentScan.summary || 'Análise em cache (últimos 3 minutos)',
          cached: true,
          cached_at: recentScan.created_at
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get recent metrics for the cluster
    const { data: metrics, error: metricsError } = await supabaseClient
      .from('agent_metrics')
      .select('*')
      .eq('cluster_id', cluster_id)
      .gte('collected_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
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
    const getLatestMetric = (type: string) => {
      const filtered = metrics.filter(m => m.metric_type === type);
      return filtered.length > 0 ? filtered[0].metric_data : null;
    };

    const podDetailsRaw = getLatestMetric('pod_details') as any;
    const eventsRaw = getLatestMetric('events') as any;

    // Filter pods with issues
    const problematicPods = podDetailsRaw?.pods?.filter((pod: any) => 
      pod.restarts > 0 || 
      pod.status !== 'Running' || 
      pod.phase !== 'Running' ||
      pod.ready !== pod.total_containers
    )?.slice(0, 50) || [];

    // Filter events - only Warning/Error types from last 30 minutes
    const recentEvents = eventsRaw?.events?.filter((event: any) =>
      event.type === 'Warning' || event.reason?.includes('Error') || event.reason?.includes('Failed')
    )?.slice(0, 100) || [];

    const metricsSummary = {
      cpu: getLatestMetric('cpu'),
      memory: getLatestMetric('memory'),
      pods_count: getLatestMetric('pods'),
      nodes: getLatestMetric('nodes'),
      problematic_pods: problematicPods,
      warning_events: recentEvents,
    };

    console.log('Metrics summary prepared:', {
      cpu: metricsSummary.cpu ? 'present' : 'missing',
      memory: metricsSummary.memory ? 'present' : 'missing',
      problematic_pods_count: problematicPods.length,
      warning_events_count: recentEvents.length,
    });

    // Check for missing essential metrics
    if (!podDetailsRaw || !eventsRaw) {
      const missingMetrics = [];
      if (!podDetailsRaw) missingMetrics.push('pod_details');
      if (!eventsRaw) missingMetrics.push('events');
      
      return new Response(
        JSON.stringify({ 
          anomalies: [{
            severity: 'warning',
            type: 'incomplete_data',
            description: `Dados incompletos do cluster. Métricas ausentes: ${missingMetrics.join(', ')}`,
            recommendation: 'Verifique se o agente está configurado corretamente.',
            ai_analysis: { issue: 'incomplete_metrics', missing: missingMetrics }
          }],
          summary: `Agente está enviando apenas métricas básicas. Faltam: ${missingMetrics.join(', ')}.`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('🤖 Calling Google Gemini for anomaly analysis...');

    const systemPrompt = `You are a Kubernetes cluster monitoring AI assistant specialized in deep cluster analysis.

**PRIMARY ANALYSIS PRIORITY: KUBERNETES EVENTS**
Analyze events FIRST before looking at metrics:

1. **Critical Event Types (Highest Priority):**
   - CrashLoopBackOff: Container repeatedly crashing - CRITICAL ISSUE
   - ImagePullBackOff / ErrImagePull: Cannot pull container image - CRITICAL
   - FailedScheduling: Pod cannot be scheduled - CRITICAL
   - Failed: General pod failure - HIGH PRIORITY
   - OOMKilled: Out of memory - HIGH PRIORITY
   
2. **Warning Event Types:**
   - BackOff: Temporary scheduling issues
   - Unhealthy: Health check failures
   - FailedMount: Volume mount issues

3. **Pod Status Analysis:**
   - Running + RestartCount > 5: Unstable pod
   - Pending > 5 minutes: Scheduling issues
   - Failed / Error: Immediate attention needed

**CRITICAL RULES FOR IMAGE ERRORS:**
- For image_pull_error, ONLY suggest auto_heal="update_deployment_image" if you can extract the EXACT failing image
- NEVER use placeholders - only real Docker image names
- If you CANNOT determine a valid image name, set auto_heal="restart_pod"

Return JSON (no markdown):
{
  "anomalies": [
    {
      "type": "pod_restart|pod_crash|pod_pending|image_pull_error|oom_killed|probe_failure|scheduling_issue|mount_failure|high_cpu|high_memory|resource_limit_too_low|resource_limit_too_high",
      "severity": "low|medium|high|critical",
      "description": "Detailed description in Portuguese",
      "recommendation": "Specific action in Portuguese",
      "affected_pods": ["namespace/pod-name"],
      "event_messages": ["actual error messages"],
      "auto_heal": "restart_pod|delete_pod|scale_up|scale_down|update_deployment_resources|update_deployment_image",
      "auto_heal_params": {
        "pod_name": "pod-name",
        "namespace": "namespace",
        "deployment_name": "deployment-name",
        "container_name": "container-name"
      }
    }
  ],
  "summary": "Portuguese summary with total issues found"
}`;

    const geminiMessages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: `Analyze these Kubernetes cluster metrics and detect anomalies:\n\n${JSON.stringify(metricsSummary, null, 2)}` }
    ];

    const aiResult = await callGemini(geminiMessages, userId, "agent-analyze-anomalies");

    let aiContent = aiResult.content;
    
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

    console.log(`🤖 AI found ${anomalies.length} anomalies (tokens: ${aiResult.inputTokens}/${aiResult.outputTokens}, free tier: ${aiResult.isFreeTier})`);

    // Verify Docker images for ImagePullBackOff errors
    for (let i = 0; i < anomalies.length; i++) {
      const anomaly = anomalies[i];
      
      if (anomaly.type === 'image_pull_error' && anomaly.event_messages) {
        const imageMatch = anomaly.event_messages
          .join(' ')
          .match(/image[:\s]+"?([a-zA-Z0-9\-_\.\/]+:[a-zA-Z0-9\-_\.]+)"?/i);
        
        if (imageMatch && imageMatch[1]) {
          const failedImage = imageMatch[1];
          console.log(`Verifying Docker image: ${failedImage}`);
          
          try {
            const verifyResponse = await supabaseClient.functions.invoke('verify-docker-image', {
              body: { image: failedImage }
            });

            if (verifyResponse.data) {
              const { exists, suggested_image, suggested_tag, message } = verifyResponse.data;
              
              if (!exists && suggested_image) {
                anomaly.description = `${anomaly.description}\n\n🐳 Docker Hub: ${message}`;
                anomaly.recommendation = `Atualizar a imagem do deployment de "${failedImage}" para "${suggested_image}"`;
                anomaly.auto_heal = 'update_deployment_image';
                
                if (anomaly.affected_pods && anomaly.affected_pods.length > 0) {
                  const fullPodName = anomaly.affected_pods[0].split('/')[1] || anomaly.affected_pods[0];
                  const deploymentName = fullPodName.replace(/-[a-z0-9]{5,10}-[a-z0-9]{5}$/, '');
                  const namespace = anomaly.affected_pods[0].split('/')[0] || 'default';
                  const containerName = findContainerName(fullPodName, podDetailsRaw ? [podDetailsRaw] : []);
                  
                  anomaly.auto_heal_params = {
                    deployment_name: deploymentName,
                    namespace: namespace,
                    container_name: containerName,
                    new_image: suggested_image,
                    old_image: failedImage
                  };
                }
              } else if (exists) {
                anomaly.description = `${anomaly.description}\n\n✅ Imagem verificada no Docker Hub.`;
                anomaly.recommendation = `A imagem existe. Verifique credenciais do registry ou rede.`;
              }
            }
          } catch (verifyError) {
            console.error('Error verifying Docker image:', verifyError);
          }
        }
      }
    }

    // Store anomalies in agent_anomalies table
    if (anomalies.length > 0) {
      const anomaliesToInsert = anomalies.map((anomaly: any) => ({
        cluster_id,
        user_id: userId,
        anomaly_type: anomaly.type,
        severity: anomaly.severity,
        description: anomaly.description,
        recommendation: anomaly.recommendation,
        auto_heal_applied: false,
        ai_analysis: {
          model: 'gemini-2.5-flash',
          confidence: 0.85,
          timestamp: new Date().toISOString(),
          affected_pods: anomaly.affected_pods || [],
          event_messages: anomaly.event_messages || [],
          auto_heal: anomaly.auto_heal || null,
          auto_heal_params: anomaly.auto_heal_params || null,
        },
      }));

      const { error: insertError } = await supabaseClient
        .from('agent_anomalies')
        .insert(anomaliesToInsert);

      if (insertError) {
        console.error('Error storing anomalies:', insertError);
      }

      // Create ai_incidents
      const incidentsToInsert = anomalies.map((anomaly: any) => ({
        cluster_id,
        user_id: userId,
        incident_type: mapAnomalyTypeToIncidentType(anomaly.type),
        severity: anomaly.severity,
        title: `${anomaly.type.replace(/_/g, ' ').toUpperCase()}: ${anomaly.affected_pods?.[0] || 'Cluster'}`,
        description: anomaly.description,
        auto_heal_action: anomaly.auto_heal || null,
        ai_analysis: {
          model: 'gemini-2.5-flash',
          recommendation: anomaly.recommendation,
          affected_pods: anomaly.affected_pods || [],
          event_messages: anomaly.event_messages || [],
          auto_heal_params: anomaly.auto_heal_params || null,
          confidence: 0.85,
          analyzed_at: new Date().toISOString(),
        },
        action_taken: false,
        action_result: null,
      }));

      const { data: insertedIncidents, error: incidentsError } = await supabaseClient
        .from('ai_incidents')
        .insert(incidentsToInsert)
        .select();

      if (incidentsError) {
        console.error('Error creating ai_incidents:', incidentsError);
      } else {
        console.log(`✅ Created ${insertedIncidents?.length || 0} ai_incidents`);
      }

      // Create notification
      await supabaseClient
        .from('notifications')
        .insert({
          user_id: userId,
          title: `🤖 ${anomalies.length} anomalia(s) detectada(s)`,
          message: `A IA detectou ${anomalies.length} anomalia(s) no cluster. Verifique a aba de Monitoramento de IA.`,
          type: anomalies.some((a: any) => a.severity === 'critical') ? 'error' : 'warning',
          related_entity_type: 'cluster',
          related_entity_id: cluster_id,
        });
    }

    // Save scan history
    await supabaseClient
      .from('scan_history')
      .insert({
        cluster_id,
        user_id: userId,
        anomalies_found: anomalies.length,
        anomalies_data: anomalies,
        summary: analysisResult.summary || 'Análise concluída',
      });

    console.log(`✅ Analyzed cluster ${cluster_id} and found ${anomalies.length} anomalies`);

    return new Response(
      JSON.stringify({
        success: true,
        anomalies_found: anomalies.length,
        anomalies,
        summary: analysisResult.summary || 'Análise concluída',
        ai_usage: {
          input_tokens: aiResult.inputTokens,
          output_tokens: aiResult.outputTokens,
          is_free_tier: aiResult.isFreeTier,
          estimated_cost: aiResult.estimatedCost
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
