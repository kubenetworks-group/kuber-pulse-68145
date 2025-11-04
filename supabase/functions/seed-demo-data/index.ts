import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Delete existing demo data
    await supabaseClient.from('ai_incidents').delete().eq('user_id', user.id);
    await supabaseClient.from('cluster_events').delete().eq('user_id', user.id);
    await supabaseClient.from('security_audits').delete().eq('user_id', user.id);
    await supabaseClient.from('clusters').delete().eq('user_id', user.id);

    // Insert 8 demo clusters
    const clusters = [
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'prod-us-east-1',
        cluster_type: 'kubernetes',
        provider: 'AWS',
        environment: 'production',
        region: 'us-east-1',
        api_endpoint: 'https://api.prod-us-east-1.k8s.aws',
        status: 'healthy',
        nodes: 8,
        pods: 150,
        cpu_usage: 65.2,
        memory_usage: 72.5,
        storage_used_gb: 450.5,
        monthly_cost: 2850.00,
        last_sync: new Date(Date.now() - 5 * 60000).toISOString(),
        created_at: new Date(Date.now() - 30 * 24 * 3600000).toISOString()
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'prod-us-west-2',
        cluster_type: 'kubernetes',
        provider: 'AWS',
        environment: 'production',
        region: 'us-west-2',
        api_endpoint: 'https://api.prod-us-west-2.k8s.aws',
        status: 'warning',
        nodes: 6,
        pods: 98,
        cpu_usage: 87.8,
        memory_usage: 68.3,
        storage_used_gb: 380.2,
        monthly_cost: 2100.00,
        last_sync: new Date(Date.now() - 2 * 60000).toISOString(),
        created_at: new Date(Date.now() - 45 * 24 * 3600000).toISOString()
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'prod-eu-west-1',
        cluster_type: 'kubernetes',
        provider: 'GCP',
        environment: 'production',
        region: 'europe-west1',
        api_endpoint: 'https://api.prod-eu-west-1.gcp',
        status: 'healthy',
        nodes: 5,
        pods: 76,
        cpu_usage: 45.5,
        memory_usage: 58.2,
        storage_used_gb: 320.8,
        monthly_cost: 1950.00,
        last_sync: new Date(Date.now() - 8 * 60000).toISOString(),
        created_at: new Date(Date.now() - 60 * 24 * 3600000).toISOString()
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'prod-asia-1',
        cluster_type: 'kubernetes',
        provider: 'GCP',
        environment: 'production',
        region: 'asia-southeast1',
        api_endpoint: 'https://api.prod-asia-1.gcp',
        status: 'error',
        nodes: 4,
        pods: 45,
        cpu_usage: 62.3,
        memory_usage: 94.7,
        storage_used_gb: 280.5,
        monthly_cost: 1650.00,
        last_sync: new Date(Date.now() - 1 * 60000).toISOString(),
        created_at: new Date(Date.now() - 55 * 24 * 3600000).toISOString()
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'staging-us-1',
        cluster_type: 'kubernetes',
        provider: 'Azure',
        environment: 'staging',
        region: 'eastus',
        api_endpoint: 'https://api.staging-us-1.azure',
        status: 'healthy',
        nodes: 3,
        pods: 32,
        cpu_usage: 38.5,
        memory_usage: 42.8,
        storage_used_gb: 180.3,
        monthly_cost: 850.00,
        last_sync: new Date(Date.now() - 10 * 60000).toISOString(),
        created_at: new Date(Date.now() - 20 * 24 * 3600000).toISOString()
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'staging-eu-1',
        cluster_type: 'kubernetes',
        provider: 'DigitalOcean',
        environment: 'staging',
        region: 'ams3',
        api_endpoint: 'https://api.staging-eu-1.do',
        status: 'warning',
        nodes: 2,
        pods: 28,
        cpu_usage: 42.1,
        memory_usage: 51.5,
        storage_used_gb: 120.5,
        monthly_cost: 450.00,
        last_sync: new Date(Date.now() - 15 * 60000).toISOString(),
        created_at: new Date(Date.now() - 15 * 24 * 3600000).toISOString()
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'dev-us-1',
        cluster_type: 'kubernetes',
        provider: 'Magalu',
        environment: 'development',
        region: 'us-central',
        api_endpoint: 'https://api.dev-us-1.magalu',
        status: 'healthy',
        nodes: 2,
        pods: 12,
        cpu_usage: 25.3,
        memory_usage: 32.8,
        storage_used_gb: 85.2,
        monthly_cost: 280.00,
        last_sync: new Date(Date.now() - 3 * 60000).toISOString(),
        created_at: new Date(Date.now() - 10 * 24 * 3600000).toISOString()
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: 'dev-br-1',
        cluster_type: 'docker',
        provider: 'Magalu',
        environment: 'development',
        region: 'br-south',
        api_endpoint: 'https://api.dev-br-1.magalu',
        status: 'warning',
        nodes: 2,
        pods: 18,
        cpu_usage: 52.8,
        memory_usage: 48.5,
        storage_used_gb: 95.8,
        monthly_cost: 320.00,
        last_sync: new Date(Date.now() - 1 * 60000).toISOString(),
        created_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString()
      }
    ];

    const { error: clustersError } = await supabaseClient
      .from('clusters')
      .insert(clusters);

    if (clustersError) throw clustersError;

    // Insert AI incidents
    const incidents = [
      {
        cluster_id: clusters[3].id,
        user_id: user.id,
        incident_type: 'high_memory',
        severity: 'critical',
        title: 'Critical: Memory usage at 94.7% in prod-asia-1',
        description: 'Cluster prod-asia-1 has reached critical memory levels (94.7%). Multiple pods are at risk of being evicted by the kubelet OOM killer.',
        ai_analysis: {
          root_cause: 'Memory leak detected in nginx-ingress controller pods consuming 12GB+ RAM',
          impact: 'High risk of pod evictions and service disruptions. Response times increased by 340ms.',
          recommendation: 'Restart affected pods immediately and investigate memory leak in ingress controller version',
          confidence: 0.92
        },
        auto_heal_action: 'restart_pod',
        action_taken: true,
        action_result: {
          success: true,
          details: 'Restarted 3 nginx-ingress pods (nginx-ingress-7d8f-1, nginx-ingress-7d8f-2, nginx-ingress-7d8f-3). Memory usage dropped to 68.3%.',
          timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
          execution_time_ms: 2340
        },
        created_at: new Date(Date.now() - 45 * 60000).toISOString(),
        resolved_at: new Date(Date.now() - 40 * 60000).toISOString()
      },
      {
        cluster_id: clusters[1].id,
        user_id: user.id,
        incident_type: 'pod_crash',
        severity: 'critical',
        title: 'Critical: Payment API pods crashing in prod-us-west-2',
        description: 'Payment processing API pods are in CrashLoopBackOff state. 15 restart attempts in last 10 minutes.',
        ai_analysis: {
          root_cause: 'Database connection pool exhausted due to connection leak in payment-service v2.1.4',
          impact: 'Payment processing down, affecting 2,500+ transactions/min. Revenue impact estimated at $8,500/hour.',
          recommendation: 'Rollback to payment-service v2.1.3 immediately and increase connection pool size',
          confidence: 0.88
        },
        auto_heal_action: 'rollback_deployment',
        action_taken: true,
        action_result: {
          success: true,
          details: 'Rolled back payment-service from v2.1.4 to v2.1.3. All 5 pods now healthy. Connection pool increased from 50 to 100.',
          timestamp: new Date(Date.now() - 115 * 60000).toISOString(),
          execution_time_ms: 4200
        },
        created_at: new Date(Date.now() - 120 * 60000).toISOString(),
        resolved_at: new Date(Date.now() - 115 * 60000).toISOString()
      },
      {
        cluster_id: clusters[7].id,
        user_id: user.id,
        incident_type: 'deployment_stuck',
        severity: 'critical',
        title: 'Critical: MongoDB deployment stuck in dev-br-1',
        description: 'MongoDB StatefulSet is stuck with 0/3 replicas ready. PersistentVolumeClaims failing to bind.',
        ai_analysis: {
          root_cause: 'StorageClass not found. PVC requesting storage class \'fast-ssd\' which does not exist in cluster',
          impact: 'All database operations failing. Dev team blocked from testing. 8 developers affected.',
          recommendation: 'Update StatefulSet to use existing storage class \'standard\' or create missing storage class',
          confidence: 0.95
        },
        auto_heal_action: null,
        action_taken: false,
        action_result: null,
        created_at: new Date(Date.now() - 25 * 60000).toISOString(),
        resolved_at: null
      },
      {
        cluster_id: clusters[1].id,
        user_id: user.id,
        incident_type: 'high_cpu',
        severity: 'high',
        title: 'High CPU usage (87.8%) in prod-us-west-2',
        description: 'Sustained high CPU usage detected across all nodes. Average CPU at 87.8% for past 15 minutes.',
        ai_analysis: {
          root_cause: 'Elasticsearch bulk indexing job consuming 6 CPU cores. Job scheduled during peak hours.',
          impact: 'API response times degraded by 230ms. User experience affected for 15k active users.',
          recommendation: 'Scale up cluster by 2 nodes and reschedule bulk indexing to off-peak hours (2-4 AM UTC)',
          confidence: 0.85
        },
        auto_heal_action: 'scale_up',
        action_taken: true,
        action_result: {
          success: true,
          details: 'Scaled deployment from 6 to 8 nodes. CPU usage stabilized at 68.2%. Bulk job rescheduled.',
          timestamp: new Date(Date.now() - 165 * 60000).toISOString(),
          execution_time_ms: 180000
        },
        created_at: new Date(Date.now() - 180 * 60000).toISOString(),
        resolved_at: new Date(Date.now() - 165 * 60000).toISOString()
      },
      {
        cluster_id: clusters[3].id,
        user_id: user.id,
        incident_type: 'disk_full',
        severity: 'high',
        title: 'Disk usage at 88% in prod-asia-1',
        description: 'Persistent volume /data is 88% full. Logs and temporary files consuming excessive space.',
        ai_analysis: {
          root_cause: 'Application logs not being rotated. 45GB of debug logs accumulated over 2 weeks.',
          impact: 'Disk will be full in 4 hours at current rate. Database writes may fail.',
          recommendation: 'Clear old logs, enable log rotation, and increase PV size from 300GB to 500GB',
          confidence: 0.91
        },
        auto_heal_action: 'clear_cache',
        action_taken: true,
        action_result: {
          success: true,
          details: 'Deleted logs older than 7 days (38GB freed). Enabled logrotate with 7-day retention. Disk usage now at 52%.',
          timestamp: new Date(Date.now() - 290 * 60000).toISOString(),
          execution_time_ms: 8500
        },
        created_at: new Date(Date.now() - 300 * 60000).toISOString(),
        resolved_at: new Date(Date.now() - 290 * 60000).toISOString()
      }
    ];

    const { error: incidentsError } = await supabaseClient
      .from('ai_incidents')
      .insert(incidents);

    if (incidentsError) throw incidentsError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Demo data created successfully',
        clusters: clusters.length,
        incidents: incidents.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});