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
      
      // Don't retry on authentication errors
      if (error instanceof Error && (
        error.message.includes('Invalid OpenAI API key') ||
        error.message.includes('Unauthorized')
      )) {
        throw error;
      }
      
      // If it's the last attempt, throw
      if (attempt === maxRetries - 1) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Helper function to find container name from pod details
function findContainerName(podName: string, podDetails: any[]): string {
  for (const metricData of podDetails) {
    const pods = metricData?.pods || [];
    for (const pod of pods) {
      if (pod.name === podName && pod.containers && pod.containers.length > 0) {
        // Return the first container name (usually the main container)
        return pod.containers[0].name;
      }
    }
  }
  // Fallback: extract deployment name from pod name if not found
  return podName.replace(/-[a-z0-9]{5,10}-[a-z0-9]{5}$/, '');
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

    const { cluster_id } = await req.json();

    if (!cluster_id) {
      throw new Error('cluster_id is required');
    }

    // Check for recent scan in last 3 minutes to avoid rate limiting
    const { data: recentScan } = await supabaseClient
      .from('scan_history')
      .select('*')
      .eq('cluster_id', cluster_id)
      .eq('user_id', user.id)
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

    // Call OpenAI for anomaly detection with retry
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('🤖 Calling OpenAI for anomaly analysis with retry...');

    const aiData = await retryWithBackoff(async () => {
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
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

4. **Resource Usage & Optimization**: 
   - CPU > 80% = scale up needed or increase CPU limits
   - Memory > 85% = OOM risk, increase memory limits
   - OOMKilled in events = memory limit too low, MUST increase
   - CPU throttling in events = CPU limit too low, increase
   - Pod with very high resource limits but low usage = wasting resources, decrease
   - Look for resource-related termination reasons in pod states

**DEPLOYMENT ANALYSIS:**
For each pod with issues:
1. Check events for that specific pod/deployment
2. Extract the root cause from event messages
3. Identify if it's: image problem, resource limit, config error, probe failure, etc.
4. Provide specific fix based on the actual error

**RESOURCE OPTIMIZATION:**
When you detect resource issues, you MUST suggest update_deployment_resources action:
- OOMKilled: increase memory_limit and memory_request
- High memory usage (>85%): increase memory limits
- High CPU usage (>80%): increase cpu limits
- Low resource usage with high limits: decrease to save costs
- Provide specific values based on current usage

Return JSON (no markdown):
{
  "anomalies": [
    {
      "type": "pod_restart|pod_crash|pod_pending|image_pull_error|oom_killed|probe_failure|scheduling_issue|mount_failure|high_cpu|high_memory|resource_limit_too_low|resource_limit_too_high",
      "severity": "low|medium|high|critical",
      "description": "Detailed description in Portuguese with pod name, namespace, and SPECIFIC error from events",
      "recommendation": "Specific action in Portuguese based on the actual error found in events",
      "affected_pods": ["namespace/pod-name"],
      "event_messages": ["actual error messages from Kubernetes events"],
      "auto_heal": "restart_pod|delete_pod|scale_up|scale_down|update_deployment_resources|update_deployment_image|null",
      "auto_heal_params": {
        "pod_name": "pod-name",
        "namespace": "namespace",
        "deployment_name": "deployment-name",
        "container_name": "container-name",
        "cpu_limit": "500m",
        "cpu_request": "250m",
        "memory_limit": "512Mi",
        "memory_request": "256Mi",
        "new_image": "nginx:1.21",
        "old_image": "nginx:1.19",
        "action": "delete"
      }
    }
  ],
  "summary": "Portuguese summary with total issues found and most critical problems"
}

**EXAMPLE:**
If you see event: "Failed to pull image 'apache:2.5': image not found"
→ anomaly type: "image_pull_error"
→ description: "Pod apache-deploy-7 no namespace demo não consegue iniciar porque a imagem 'apache:2.5' não foi encontrada"
→ recommendation: "Verificar se a tag da imagem está correta no deployment"
→ affected_pods: ["demo/apache-deploy-7abc123"]
→ event_messages: ["Failed to pull image 'apache:2.5': image not found"]
→ NOTE: Docker Hub verification will be done automatically after AI analysis

**RESOURCE OPTIMIZATION EXAMPLES:**
1. OOMKilled event: "Container killed due to OOM"
   → type: "oom_killed"
   → auto_heal: "update_deployment_resources"
   → params: increase memory_limit by 50-100% based on current value
   → description: "Pod X foi encerrado por falta de memória (OOMKilled)"
   → recommendation: "Aumentar o limite de memória de 256Mi para 512Mi"

2. High CPU usage: CPU > 80%
   → type: "high_cpu"
   → auto_heal: "update_deployment_resources"
   → params: increase cpu_limit by 50%
   → description: "Pod X usando 90% da CPU, risco de throttling"
   → recommendation: "Aumentar limite de CPU de 500m para 750m"

3. Over-provisioned: Pod using 10% of 2GB memory
   → type: "resource_limit_too_high"
   → auto_heal: "update_deployment_resources"
   → params: decrease memory to 512Mi
   → description: "Pod X alocado com 2Gi mas usando apenas 200Mi, desperdiçando recursos"
   → recommendation: "Reduzir limite de memória para 512Mi para economizar custos"

**MANDATORY:**
- Use events.message field to get exact error
- Match events to pods by involved_object.name
- List EVERY pod with problems
- Include event_messages in anomaly
- For resource issues, calculate optimal values based on current usage
- Always provide deployment_name and container_name for update_deployment_resources
- Extract deployment_name from pod name (e.g., "apache-deploy-7abc123" → "apache-deploy")
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
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 401) {
        throw new Error('Invalid OpenAI API key.');
      }
      if (aiResponse.status === 402 || aiResponse.status === 403) {
        throw new Error('Insufficient OpenAI credits. Please add funds to your account.');
      }
      
      throw new Error(`OpenAI API returned ${aiResponse.status}: ${errorText}`);
    }

    return await aiResponse.json();
  }, 3, 2000); // 3 retries with 2 second initial delay
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

    // Verify Docker images for ImagePullBackOff errors
    for (let i = 0; i < anomalies.length; i++) {
      const anomaly = anomalies[i];
      
      if (anomaly.type === 'image_pull_error' && anomaly.event_messages) {
        // Extract image name from error messages
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
                console.log(`Image ${failedImage} not found. Suggesting: ${suggested_image}`);
                
                // Update anomaly with Docker Hub verification
                anomaly.description = `${anomaly.description}\n\n🐳 Docker Hub: ${message}`;
                anomaly.recommendation = `Atualizar a imagem do deployment de "${failedImage}" para "${suggested_image}" (tag sugerida: ${suggested_tag})`;
                
                // Add auto-heal action to update image
                anomaly.auto_heal = 'update_deployment_image';
                
                // Extract deployment and container info from affected pods
                if (anomaly.affected_pods && anomaly.affected_pods.length > 0) {
                  const fullPodName = anomaly.affected_pods[0].split('/')[1] || anomaly.affected_pods[0];
                  // Extract deployment name from pod name (e.g., "nginx-deploy-abc123" -> "nginx-deploy")
                  const deploymentName = fullPodName.replace(/-[a-z0-9]{5,10}-[a-z0-9]{5}$/, '');
                  const namespace = anomaly.affected_pods[0].split('/')[0] || 'default';
                  
                  // Get real container name from pod details
                  const containerName = findContainerName(fullPodName, metricsSummary.pod_details);
                  
                  anomaly.auto_heal_params = {
                    deployment_name: deploymentName,
                    namespace: namespace,
                    container_name: containerName, // Using real container name from pod details
                    new_image: suggested_image,
                    old_image: failedImage
                  };
                  
                  console.log(`Auto-heal configured for ${deploymentName}/${containerName}: ${failedImage} -> ${suggested_image}`);
                }
              } else if (exists) {
                console.log(`Image ${failedImage} exists on Docker Hub`);
                anomaly.description = `${anomaly.description}\n\n✅ Imagem verificada no Docker Hub e existe.`;
                anomaly.recommendation = `A imagem existe no Docker Hub. Verifique as credenciais do registry ou permissões de rede do cluster.`;
              }
            }
          } catch (verifyError) {
            console.error('Error verifying Docker image:', verifyError);
            // Continue without Docker Hub verification
          }
        }
      }
    }

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
