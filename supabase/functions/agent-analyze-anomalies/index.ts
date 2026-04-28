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
    'crash_loop': 'pod_crash',
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
    'resource_misconfiguration': 'resource_misconfiguration',
    'incomplete_data': 'monitoring_issue',
    'node_pressure': 'node_issue',
    'node_not_ready': 'node_issue',
    'pvc_pending': 'storage_issue',
    'pvc_lost': 'storage_issue',
    'hpa_issue': 'resource_misconfiguration',
    'network_issue': 'network_issue',
    'dns_issue': 'network_issue',
    'rbac_issue': 'security_issue',
    'quota_exceeded': 'resource_pressure',
    'rollout_stuck': 'pod_crash',
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

    // Get recent metrics (last 15 min) for current state
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get historical pod_details from last 24h to detect historical restarts
    const { data: historicalMetrics } = await supabaseClient
      .from('agent_metrics')
      .select('metric_type, metric_data, collected_at')
      .eq('cluster_id', cluster_id)
      .eq('metric_type', 'pod_details')
      .gte('collected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('collected_at', { ascending: false })
      .limit(10);

    // Get recent auto-heal actions as context (last 6h)
    const { data: recentActions } = await supabaseClient
      .from('auto_heal_actions_log')
      .select('action_type, trigger_reason, action_details, status, created_at')
      .eq('cluster_id', cluster_id)
      .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    // Prepare data for AI analysis
    const getLatestMetric = (type: string) => {
      const filtered = metrics.filter(m => m.metric_type === type);
      return filtered.length > 0 ? filtered[0].metric_data : null;
    };

    const podDetailsRaw = getLatestMetric('pod_details') as any;
    const eventsRaw = getLatestMetric('events') as any;
    const nodesRaw = getLatestMetric('nodes') as any;
    const pvcsRaw = getLatestMetric('pvcs') as any;
    const securityRaw = getLatestMetric('security') as any;
    const previousLogsRaw = getLatestMetric('pod_previous_logs') as any;

    // Filter pods with issues (include pods with any restarts — even if running now)
    const problematicPods = podDetailsRaw?.pods?.filter((pod: any) =>
      pod.restarts > 0 ||
      pod.status !== 'Running' ||
      pod.phase !== 'Running' ||
      pod.ready !== pod.total_containers
    )?.slice(0, 50) || [];

    // All events (warnings + errors) from cluster
    const recentEvents = eventsRaw?.events?.filter((event: any) =>
      event.type === 'Warning' || event.reason?.includes('Error') || event.reason?.includes('Failed')
    )?.slice(0, 100) || [];

    // Build restart trend from 24h historical data
    const buildRestartTrend = (historical: any[]) => {
      if (!historical || historical.length === 0) return [];
      const snapshots = historical.map(h => ({
        collected_at: h.collected_at,
        pods_with_restarts: (h.metric_data?.pods || [])
          .filter((p: any) => p.restarts > 0)
          .map((p: any) => ({ name: p.name, namespace: p.namespace, restarts: p.restarts, status: p.status }))
      }));
      // Find pods that had restarts in historical data but may be ok now
      const historicalPodMap = new Map<string, number>();
      snapshots.forEach(s => {
        s.pods_with_restarts.forEach((p: any) => {
          const key = `${p.namespace}/${p.name}`;
          historicalPodMap.set(key, Math.max(historicalPodMap.get(key) || 0, p.restarts));
        });
      });
      return Array.from(historicalPodMap.entries()).map(([key, maxRestarts]) => ({
        pod: key,
        max_restarts_24h: maxRestarts,
      }));
    };

    const podsWithPreviousLogs = previousLogsRaw?.pods_with_logs || [];

    const metricsSummary = {
      cpu: getLatestMetric('cpu'),
      memory: getLatestMetric('memory'),
      pods_count: getLatestMetric('pods'),
      nodes: nodesRaw,
      pvcs: pvcsRaw,
      security: securityRaw,
      problematic_pods: problematicPods,
      warning_events: recentEvents,
      pods_with_previous_logs: podsWithPreviousLogs,
      recent_actions_taken: recentActions || [],
      historical_restart_trends_24h: buildRestartTrend(historicalMetrics || []),
    };

    console.log('Metrics summary prepared:', {
      cpu: metricsSummary.cpu ? 'present' : 'missing',
      memory: metricsSummary.memory ? 'present' : 'missing',
      nodes: nodesRaw ? 'present' : 'missing',
      pvcs: pvcsRaw ? 'present' : 'missing',
      problematic_pods_count: problematicPods.length,
      warning_events_count: recentEvents.length,
      pods_with_previous_logs: podsWithPreviousLogs.length,
      recent_actions_count: recentActions?.length || 0,
      historical_pods_with_restarts: metricsSummary.historical_restart_trends_24h.length,
    });

    if (!podDetailsRaw) {
      return new Response(
        JSON.stringify({
          anomalies: [{
            severity: 'warning',
            type: 'incomplete_data',
            description: 'Dados de pods não encontrados. Agente pode estar iniciando.',
            recommendation: 'Aguarde o agente enviar as primeiras métricas.',
            ai_analysis: { issue: 'incomplete_metrics' }
          }],
          summary: 'Agente está enviando métricas básicas. Aguardando dados completos.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🤖 Calling Google Gemini for comprehensive cluster analysis...');

    const systemPrompt = `You are a senior Kubernetes SRE AI specialized in deep cluster diagnosis.
Analyze ALL provided data: current state, Kubernetes events, pod logs from crashed containers, historical trends, and recent actions taken.

## YOUR ANALYSIS MUST COVER ALL APPLICABLE CATEGORIES:

### 1. Pod Lifecycle (highest priority if logs available)
- CrashLoopBackOff, OOMKilled (exit code 137), ImagePullBackOff, ErrImagePull
- For pods in pods_with_previous_logs: analyze the ACTUAL log content to determine the exact root cause
- Historical restarts (pods in historical_restart_trends_24h): explain what happened even if they are Running now
- Init container failures, liveness/readiness probe failures
- Pending pods: check events for FailedScheduling reasons

### 2. Node Health
- Node conditions: DiskPressure, MemoryPressure, PIDPressure, NetworkUnavailable
- Node resource saturation (CPU > 85%, memory > 90%)
- Nodes with taints preventing scheduling
- Nodes in NotReady state

### 3. Workload Controllers
- Deployments with unavailableReplicas > 0 (rollout stuck or failing)
- StatefulSets with pods not ready in order
- DaemonSets with pods missing on nodes
- HPAs unable to scale (metrics unavailable, min/max replicas reached, behavior restrictions)

### 4. Storage
- PVCs in Pending or Lost state
- StorageClass provisioner issues
- Pods with FailedMount events
- PVs not bound or in Released state

### 5. Network
- Services with no ready endpoints (all backend pods failing readiness)
- DNS resolution failures (look in events for DNS-related messages)
- Network policy blocking legitimate traffic
- Ingress/Gateway misconfiguration events

### 6. Resource Management
- Namespaces exceeding ResourceQuota (events: "exceeded quota")
- LimitRange violations
- Pods without resource requests/limits running on constrained nodes

### 7. Security & RBAC
- Pods failing with Forbidden events (ServiceAccount missing permissions)
- Missing Secrets causing pod startup failures
- ImagePullSecrets missing for private registries

## RULES:
- If pods_with_previous_logs is provided, you MUST analyze the actual log content and cite specific log lines in logs_excerpt
- If historical_restart_trends_24h shows pods with high restart counts that are now Running, create an anomaly explaining what happened
- If recent_actions_taken shows auto-heal actions, reference them in action_already_taken field
- Only create anomalies for REAL issues — do not invent problems
- **DO NOT create anomalies for pods that terminated with exit code 0 ("Completed")** — this is healthy termination (Jobs, init containers, one-shot tasks). These are NOT crashes.
- DO NOT create anomalies for pods with many restarts if they are currently Running and the restarts occurred long ago (>6h) without recent activity
- All text fields must be in Portuguese (Brazil)
- For EACH anomaly, provide concrete kubectl troubleshooting commands in troubleshooting_steps

Return ONLY valid JSON (no markdown fences):
{
  "anomalies": [
    {
      "type": "pod_crash|oom_killed|crash_loop|image_pull_error|node_pressure|node_not_ready|pvc_pending|pvc_lost|hpa_issue|network_issue|dns_issue|rbac_issue|quota_exceeded|rollout_stuck|probe_failure|mount_failure|scheduling_issue|resource_misconfiguration",
      "severity": "low|medium|high|critical",
      "title": "Título curto em português",
      "description": "O que está acontecendo agora (português, 1-2 frases)",
      "root_cause_analysis": "Por que isso aconteceu — análise detalhada baseada nos logs e eventos (português)",
      "troubleshooting_steps": [
        "1. Verificar status: kubectl describe pod <pod> -n <namespace>",
        "2. Ver logs atuais: kubectl logs <pod> -n <namespace>",
        "3. Passo concreto seguinte"
      ],
      "logs_excerpt": "Trecho de log relevante que levou a este diagnóstico (se logs disponíveis, cite linhas reais)",
      "historical_context": "Se o pod tem histórico de restarts nas últimas 24h, descreva o padrão (ou null)",
      "affected_resources": ["namespace/pod-ou-deployment-name"],
      "event_messages": ["mensagens reais dos eventos k8s"],
      "auto_heal": "restart_pod|delete_pod|scale_up|update_deployment_resources|update_deployment_image|null",
      "auto_heal_params": {
        "pod_name": "nome-do-pod",
        "namespace": "namespace",
        "deployment_name": "nome-do-deployment"
      },
      "action_already_taken": "Descrição do que já foi feito pelo auto-heal (ou null)"
    }
  ],
  "summary": "Resumo geral da saúde do cluster em português",
  "health_score": 85,
  "historical_issues_resolved": "Descrição de problemas que ocorreram e foram resolvidos nas últimas 24h (ou null)"
}

**CRITICAL RULES FOR IMAGE ERRORS:**
- For image_pull_error, ONLY suggest auto_heal="update_deployment_image" if you can extract the EXACT failing image
- NEVER use placeholders - only real Docker image names
- If you CANNOT determine a valid image name, set auto_heal="restart_pod"`;

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
        title: anomaly.title || `${anomaly.type.replace(/_/g, ' ')}: ${anomaly.affected_resources?.[0] || anomaly.affected_pods?.[0] || 'Cluster'}`,
        description: anomaly.description,
        auto_heal_action: anomaly.auto_heal || null,
        ai_analysis: {
          model: 'gemini-2.5-flash',
          root_cause_analysis: anomaly.root_cause_analysis || null,
          troubleshooting_steps: anomaly.troubleshooting_steps || [],
          logs_excerpt: anomaly.logs_excerpt || null,
          historical_context: anomaly.historical_context || null,
          recommendation: anomaly.troubleshooting_steps?.[0] || anomaly.recommendation || anomaly.description,
          action_already_taken: anomaly.action_already_taken || null,
          affected_resources: anomaly.affected_resources || anomaly.affected_pods || [],
          event_messages: anomaly.event_messages || [],
          auto_heal_params: anomaly.auto_heal_params || null,
          health_score: analysisResult.health_score || null,
          confidence: 0.9,
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

      // ── AUTO-EXECUTE fixable actions & flag "needs user action" ──
      // System/infrastructure namespaces — AI will NOT auto-fix these, will flag for user
      const SYSTEM_NAMESPACES = new Set([
        'kube-system', 'kube-public', 'kube-node-lease',
        'calico-system', 'calico-apiserver', 'tigera-operator',
        'cilium', 'cilium-system', 'istio-system', 'istio-operator',
        'linkerd', 'linkerd-viz', 'metallb-system',
        'ingress', 'ingress-nginx', 'ingress-controller',
        'cert-manager', 'monitoring', 'prometheus', 'grafana',
        'flux-system', 'argocd', 'argo', 'velero', 'gatekeeper-system',
        'kyverno', 'local-path-storage', 'lens-metrics',
      ]);

      // Issue types that always require user intervention
      const USER_ACTION_TYPES = new Set([
        'node_pressure', 'node_not_ready', 'pvc_pending', 'pvc_lost',
        'rbac_issue', 'quota_exceeded', 'dns_issue', 'network_issue',
        'hpa_issue',
      ]);

      // Actions the AI can execute automatically
      const AUTO_FIXABLE_ACTIONS = new Set([
        'restart_pod', 'delete_pod', 'scale_up',
        'update_deployment_image', 'update_deployment_resources',
      ]);

      let autoFixedCount = 0;
      let needsUserActionCount = 0;

      for (let i = 0; i < anomalies.length; i++) {
        const anomaly = anomalies[i];
        const incident = insertedIncidents?.[i];
        if (!incident) continue;

        // Determine namespace from affected resources
        const firstResource = anomaly.affected_resources?.[0] || anomaly.affected_pods?.[0] || '';
        const namespace = firstResource.includes('/') ? firstResource.split('/')[0] : 'default';

        const isSystemNamespace = SYSTEM_NAMESPACES.has(namespace);

        // False-positive guard: pods that exited with code 0 (Completed) are healthy terminations
        // Do NOT auto-restart them — they're Jobs, init containers, or successful one-shot pods
        const isHealthyTermination =
          (anomaly.description?.includes('exit code 0') || anomaly.description?.includes('código de saída 0') ||
           anomaly.description?.includes('Completed')) &&
          !anomaly.description?.includes('CrashLoop') &&
          anomaly.type !== 'crash_loop' && anomaly.type !== 'oom_killed';

        const needsUserAction = isSystemNamespace ||
          isHealthyTermination ||
          USER_ACTION_TYPES.has(anomaly.type) ||
          !anomaly.auto_heal ||
          !AUTO_FIXABLE_ACTIONS.has(anomaly.auto_heal);

        if (!needsUserAction && anomaly.auto_heal && anomaly.auto_heal_params) {
          // Auto-execute: create agent command immediately
          const { error: cmdError } = await supabaseClient.from('agent_commands').insert({
            cluster_id,
            user_id: userId,
            command_type: anomaly.auto_heal,
            command_params: {
              ...anomaly.auto_heal_params,
              reason: `ai_auto_fix:${anomaly.type}`,
              triggered_by: 'ai_analysis',
            },
            status: 'pending',
          });

          if (!cmdError) {
            await supabaseClient.from('ai_incidents').update({
              action_taken: true,
              action_result: {
                status: 'command_sent',
                message: `Ação "${anomaly.auto_heal}" enviada automaticamente pela IA`,
                timestamp: new Date().toISOString(),
              },
            }).eq('id', incident.id);
            autoFixedCount++;
            console.log(`✅ Auto-fix command sent for incident ${incident.id}: ${anomaly.auto_heal}`);
          }
        } else if (needsUserAction) {
          // Flag as "needs user action" — update ai_analysis with reason
          const userActionReason = isSystemNamespace
            ? `Namespace do sistema "${namespace}" — o Kodo não modifica automaticamente componentes de infraestrutura`
            : isHealthyTermination
            ? `Container encerrou com código de saída 0 (terminação normal) — nenhuma ação automática necessária`
            : `Este tipo de problema (${anomaly.type}) requer intervenção manual`;

          await supabaseClient.from('ai_incidents').update({
            ai_analysis: {
              ...incident.ai_analysis,
              needs_user_action: true,
              user_action_reason: userActionReason,
            },
          }).eq('id', incident.id);
          needsUserActionCount++;
        }
      }

      console.log(`🤖 Auto-fixed: ${autoFixedCount}, Needs user action: ${needsUserActionCount}`);

      // Create notification (differentiate between auto-fixed and user-action-needed)
      const needsActionIncidents = anomalies.filter((_: any, i: number) => {
        const firstResource = anomalies[i].affected_resources?.[0] || anomalies[i].affected_pods?.[0] || '';
        const ns = firstResource.includes('/') ? firstResource.split('/')[0] : 'default';
        return SYSTEM_NAMESPACES.has(ns) || USER_ACTION_TYPES.has(anomalies[i].type) || !anomalies[i].auto_heal;
      });

      const notifTitle = needsUserActionCount > 0
        ? `⚠️ ${needsUserActionCount} problema(s) requerem sua atenção`
        : `✅ IA resolveu ${autoFixedCount} problema(s) automaticamente`;

      const notifMessage = needsUserActionCount > 0
        ? `${needsUserActionCount} problema(s) detectados precisam de ação manual. ${autoFixedCount > 0 ? `${autoFixedCount} foram corrigidos automaticamente.` : ''}`
        : `A IA detectou e corrigiu ${autoFixedCount} anomalia(s) no cluster automaticamente.`;

      await supabaseClient
        .from('notifications')
        .insert({
          user_id: userId,
          title: notifTitle,
          message: notifMessage,
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
