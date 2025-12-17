import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

// Rate limiting map (in-memory)
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const requests = (rateLimiter.get(key) || []).filter(
    timestamp => now - timestamp < windowMs
  );
  
  if (requests.length >= maxRequests) {
    return false; // Rate limited
  }
  
  requests.push(now);
  rateLimiter.set(key, requests);
  return true;
}

// Hash function using Web Crypto API
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const agentKey = req.headers.get('x-agent-key');
    
    if (!agentKey) {
      console.error('Authentication failed: Missing API key');
      return new Response(JSON.stringify({ error: 'Missing API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyPrefix = agentKey.substring(0, 15);
    console.log(`Auth attempt with key prefix: ${keyPrefix}...`);

    // Rate limiting: 10 requests per minute (using key prefix for rate limit)
    if (!checkRateLimit(keyPrefix, 10, 60000)) {
      console.warn('Rate limit exceeded for key:', keyPrefix);
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Window': '60s',
        },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Hash the provided key
    const providedKeyHash = await hashApiKey(agentKey);
    console.log(`Generated hash: ${providedKeyHash.substring(0, 16)}...`);

    // Try to validate using hash first, fallback to plaintext for backward compatibility
    let apiKeyData;
    
    // First, try hash-based authentication
    const { data: hashData, error: hashError } = await supabaseClient
      .from('agent_api_keys')
      .select('cluster_id, is_active, id')
      .eq('api_key_hash', providedKeyHash)
      .single();
    
    if (hashData && !hashError) {
      console.log(`Auth successful via hash for cluster: ${hashData.cluster_id}`);
      apiKeyData = hashData;
    } else {
      console.log(`Hash auth failed, trying plaintext fallback. Error: ${hashError?.message}`);
      
      // Fallback: try plaintext (for keys created before hash implementation)
      const { data: plainData, error: plainError } = await supabaseClient
        .from('agent_api_keys')
        .select('cluster_id, is_active, id, api_key')
        .eq('api_key', agentKey)
        .single();
      
      if (plainData && !plainError) {
        console.log(`Auth successful via plaintext for cluster: ${plainData.cluster_id}`);
        apiKeyData = plainData;
        
        // Migrate this key to use hash
        await supabaseClient
          .from('agent_api_keys')
          .update({
            api_key_hash: providedKeyHash,
            api_key_prefix: agentKey.substring(0, 12) + '...',
          })
          .eq('id', plainData.id);
        
        console.log('Migrated API key to hash-based authentication');
      }
    }

    if (!apiKeyData || !apiKeyData.is_active) {
      console.error('Authentication failed');
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { cluster_id } = apiKeyData;

    // Update last_seen using the ID (more secure than using the plaintext key)
    await supabaseClient
      .from('agent_api_keys')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', apiKeyData.id);

    // Parse and validate request body
    const body = await req.json();
    
    if (!body.metrics || !Array.isArray(body.metrics)) {
      console.error('Invalid payload structure - metrics array missing');
      return new Response(JSON.stringify({ 
        error: 'Invalid metrics format',
        details: 'metrics array is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Received ${body.metrics.length} metrics from agent`);

    // Validate each metric individually
    const validMetrics: any[] = [];
    const invalidMetrics: any[] = [];

    for (const metric of body.metrics) {
      const metricSize = JSON.stringify(metric.data || {}).length;
      console.log(`Validating metric type '${metric.type}' (size: ${metricSize} bytes)`);

      // Type-specific validation
      const isLargeMetricType = ['pod_details', 'events', 'nodes', 'pvcs'].includes(metric.type);
      const maxSize = isLargeMetricType ? 500000 : 10000; // 500KB for large types, 10KB for basic
      
      if (metricSize > maxSize) {
        console.error(`❌ Metric '${metric.type}' rejected - size ${metricSize} bytes exceeds limit ${maxSize} bytes`);
        invalidMetrics.push({
          type: metric.type,
          reason: `Size ${metricSize} bytes exceeds limit ${maxSize} bytes`,
          size: metricSize
        });
        continue;
      }

      // Validate basic structure
      if (!metric.type || typeof metric.type !== 'string') {
        console.error(`❌ Metric rejected - invalid type field`);
        invalidMetrics.push({
          type: metric.type || 'unknown',
          reason: 'Invalid or missing type field'
        });
        continue;
      }

      if (!metric.data || typeof metric.data !== 'object') {
        console.error(`❌ Metric '${metric.type}' rejected - invalid data field`);
        invalidMetrics.push({
          type: metric.type,
          reason: 'Invalid or missing data field'
        });
        continue;
      }

      // Metric is valid
      console.log(`✅ Metric '${metric.type}' accepted (${metricSize} bytes)`);
      validMetrics.push({
        type: metric.type,
        data: metric.data,
        collected_at: metric.collected_at || new Date().toISOString()
      });
    }

    if (validMetrics.length === 0) {
      console.error('All metrics failed validation');
      return new Response(JSON.stringify({ 
        error: 'All metrics failed validation',
        invalid_metrics: invalidMetrics
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ ${validMetrics.length} metrics valid, ❌ ${invalidMetrics.length} metrics invalid`);
    if (invalidMetrics.length > 0) {
      console.warn('Invalid metrics:', JSON.stringify(invalidMetrics));
    }

    const metrics = validMetrics;

    // Insert metrics into database
    const metricsToInsert = metrics.map(metric => ({
      cluster_id,
      metric_type: metric.type,
      metric_data: metric.data,
      collected_at: metric.collected_at || new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseClient
      .from('agent_metrics')
      .insert(metricsToInsert);

    if (insertError) {
      console.error('Database error occurred');
      return new Response(JSON.stringify({ error: 'Failed to store metrics' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update cluster stats based on metrics
    const cpuMetric = metrics.find(m => m.type === 'cpu');
    const memoryMetric = metrics.find(m => m.type === 'memory');
    const podsMetric = metrics.find(m => m.type === 'pods');
    
    if (cpuMetric || memoryMetric || podsMetric) {
      const updateData: any = {
        last_sync: new Date().toISOString()
      };
      
      const cpuData = cpuMetric?.data as any;
      const memoryData = memoryMetric?.data as any;
      const podsData = podsMetric?.data as any;
      
      if (cpuData?.usage_percent) updateData.cpu_usage = cpuData.usage_percent;
      if (memoryData?.usage_percent) updateData.memory_usage = memoryData.usage_percent;
      if (podsData?.running) updateData.pods = podsData.running;
      
      // Update nodes count
      const nodesMetric = metrics.find(m => m.type === 'nodes');
      if (nodesMetric) {
        const nodesData = nodesMetric.data as any;
        if (nodesData?.count !== undefined) {
          updateData.nodes = nodesData.count;
        }
      }
      
      await supabaseClient
        .from('clusters')
        .update(updateData)
        .eq('id', cluster_id);
    }

    // Process PVCs
    const pvcsMetric = metrics.find(m => m.type === 'pvcs');
    if (pvcsMetric && pvcsMetric.data?.pvcs) {
      const pvcsData = pvcsMetric.data.pvcs as any[];
      
      // Get user_id from cluster
      const { data: clusterData } = await supabaseClient
        .from('clusters')
        .select('user_id')
        .eq('id', cluster_id)
        .single();
      
      if (clusterData && pvcsData.length > 0) {
        // Delete old PVCs for this cluster
        await supabaseClient
          .from('pvcs')
          .delete()
          .eq('cluster_id', cluster_id);
        
        // Insert new PVCs
        const pvcsToInsert = pvcsData.map(pvc => ({
          cluster_id,
          user_id: clusterData.user_id,
          name: pvc.name,
          namespace: pvc.namespace,
          storage_class: pvc.storage_class || null,
          status: pvc.status,
          requested_bytes: pvc.requested_bytes || 0,
          used_bytes: pvc.used_bytes || 0,
          last_sync: new Date().toISOString(),
        }));
        
        const { error: pvcError } = await supabaseClient
          .from('pvcs')
          .insert(pvcsToInsert);
        
        if (pvcError) {
          console.error('Error storing PVCs:', pvcError);
        } else {
          console.log(`✅ Stored ${pvcsToInsert.length} PVCs`);
        }
      }
    }

    // Process standalone PVs (Released, Available, Failed)
    const standalonePVsMetric = metrics.find(m => m.type === 'standalone_pvs');
    if (standalonePVsMetric) {
      const pvs = (standalonePVsMetric.data as any)?.pvs;
      
      if (Array.isArray(pvs) && pvs.length > 0) {
        // Get user_id from cluster
        const { data: clusterData } = await supabaseClient
          .from('clusters')
          .select('user_id')
          .eq('id', cluster_id)
          .single();
        
        if (clusterData) {
          // Delete old PVs for this cluster
          await supabaseClient
            .from('persistent_volumes')
            .delete()
            .eq('cluster_id', cluster_id);
          
          // Insert new PVs
          const pvsToInsert = pvs.map(pv => ({
            cluster_id,
            user_id: clusterData.user_id,
            name: pv.name,
            status: pv.status,
            capacity_bytes: pv.capacity_bytes || 0,
            storage_class: pv.storage_class || null,
            reclaim_policy: pv.reclaim_policy || null,
            access_modes: pv.access_modes || [],
            volume_mode: pv.volume_mode || null,
            claim_ref_namespace: pv.claim_ref_namespace || null,
            claim_ref_name: pv.claim_ref_name || null,
            last_sync: new Date().toISOString(),
          }));
          
          const { error: pvError } = await supabaseClient
            .from('persistent_volumes')
            .insert(pvsToInsert);
          
          if (pvError) {
            console.error('Error storing standalone PVs:', pvError);
          } else {
            console.log(`✅ Stored ${pvsToInsert.length} standalone PVs (Released/Available/Failed)`);
          }
        }
      }
    }

    // Process storage metrics (from PVs - will be replaced by node_storage)
    const storageMetric = metrics.find(m => m.type === 'storage');
    if (storageMetric) {
      const storageData = storageMetric.data as any;
      
      if (storageData?.total_bytes !== undefined) {
        const totalGB = storageData.total_bytes / (1024 ** 3);
        const allocatableGB = (storageData.allocatable_bytes || 0) / (1024 ** 3);
        const availableGB = allocatableGB;
        
        // Only update if node_storage is not available (fallback)
        const nodeStorageMetric = metrics.find(m => m.type === 'node_storage');
        if (!nodeStorageMetric) {
          await supabaseClient
            .from('clusters')
            .update({
              storage_total_gb: totalGB,
              storage_available_gb: availableGB,
            })
            .eq('id', cluster_id);
          
          console.log(`✅ Updated cluster storage (from PVs): ${totalGB.toFixed(2)}GB total`);
        }
      }
    }

    // Process node storage (physical disk from nodes) - PRIORITY
    const nodeStorageMetric = metrics.find(m => m.type === 'node_storage');
    if (nodeStorageMetric) {
      const nodeStorageData = nodeStorageMetric.data as any;

      if (nodeStorageData?.total_physical_bytes !== undefined) {
        const physicalStorageGB = nodeStorageData.total_physical_bytes / (1024 ** 3);
        const usedStorageGB = (nodeStorageData.used_physical_bytes || 0) / (1024 ** 3);
        const availableStorageGB = (nodeStorageData.available_physical_bytes || 0) / (1024 ** 3);

        await supabaseClient
          .from('clusters')
          .update({
            storage_total_gb: physicalStorageGB,
            storage_used_gb: usedStorageGB,
            storage_available_gb: availableStorageGB,
          })
          .eq('id', cluster_id);

        console.log(`✅ Updated physical storage: total=${physicalStorageGB.toFixed(2)}GB, used=${usedStorageGB.toFixed(2)}GB, available=${availableStorageGB.toFixed(2)}GB`);
      }
    }

    console.log(`✅ Successfully stored ${metrics.length} metrics`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        accepted: metrics.length,
        rejected: invalidMetrics.length,
        accepted_types: metrics.map((m: any) => m.type),
        rejected_metrics: invalidMetrics.length > 0 ? invalidMetrics : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Request processing failed');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});