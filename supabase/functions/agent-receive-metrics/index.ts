import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key, x-agent-version',
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

    const keyPrefix = agentKey.substring(0, 12);
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
      } else {
        // Final fallback: try prefix match (for cases where key was redacted but prefix stored)
        console.log(`Plaintext auth failed, trying prefix match`);
        const { data: prefixData, error: prefixError } = await supabaseClient
          .from('agent_api_keys')
          .select('cluster_id, is_active, id')
          .eq('api_key_prefix', keyPrefix + '...')
          .single();

        if (prefixData && !prefixError) {
          console.log(`Auth successful via prefix for cluster: ${prefixData.cluster_id}`);
          apiKeyData = prefixData;
          
          // Update the hash and key for future auth
          await supabaseClient
            .from('agent_api_keys')
            .update({ 
              api_key_hash: providedKeyHash,
              api_key: agentKey // Restore the key
            })
            .eq('id', prefixData.id);
          
          console.log('Restored API key and updated hash');
        }
      }
    }

    if (!apiKeyData || !apiKeyData.is_active) {
      console.error(`Authentication failed: No valid key found. Key prefix: ${keyPrefix}, Hash: ${providedKeyHash.substring(0, 16)}...`);
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { cluster_id } = apiKeyData;

    // Get agent version from header
    const agentVersion = req.headers.get('x-agent-version') || 'unknown';
    console.log(`Agent version: ${agentVersion}`);

    // Update last_seen using the ID (more secure than using the plaintext key)
    await supabaseClient
      .from('agent_api_keys')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', apiKeyData.id);

    // Update cluster with agent version and check for updates
    const { data: latestVersionData } = await supabaseClient
      .from('agent_versions')
      .select('version, release_notes, is_required')
      .eq('is_latest', true)
      .single();

    const compareVersions = (v1: string, v2: string): number => {
      if (!v1 || !v2 || v1 === 'unknown' || v2 === 'unknown') return 0;
      const normalize = (v: string) => v.replace(/^v/, '').split('.').map(Number);
      const [major1, minor1, patch1] = normalize(v1);
      const [major2, minor2, patch2] = normalize(v2);
      if (major1 !== major2) return major1 - major2;
      if (minor1 !== minor2) return minor1 - minor2;
      return patch1 - patch2;
    };

    const updateAvailable = latestVersionData && agentVersion !== 'unknown' &&
      compareVersions(agentVersion, latestVersionData.version) < 0;

    await supabaseClient
      .from('clusters')
      .update({
        agent_version: agentVersion,
        agent_last_seen_at: new Date().toISOString(),
        agent_update_available: updateAvailable || false,
        agent_update_message: updateAvailable ? latestVersionData?.release_notes : null,
      })
      .eq('id', cluster_id);

    // Auto-create self_update command if agent is outdated
    if (updateAvailable && latestVersionData) {
      const { data: clusterData } = await supabaseClient
        .from('clusters')
        .select('user_id')
        .eq('id', cluster_id)
        .single();

      const { data: existingCmd } = await supabaseClient
        .from('agent_commands')
        .select('id')
        .eq('cluster_id', cluster_id)
        .in('command_type', ['self_update', 'agent_update'])
        .in('status', ['pending', 'sent'])
        .maybeSingle();

      if (!existingCmd && clusterData) {
        await supabaseClient.from('agent_commands').insert({
          cluster_id: cluster_id,
          user_id: clusterData.user_id,
          command_type: 'self_update',
          command_params: {
            namespace: 'kodo',
            deployment_name: 'kodo-agent',
            new_image: `ghcr.io/kubenetworks-group/kodo-agent:${latestVersionData.version}`,
            trigger: 'auto_update_on_metrics',
            from_version: agentVersion,
            to_version: latestVersionData.version,
          },
          status: 'pending',
        });
        console.log(`Auto-update command created for cluster ${cluster_id}: ${agentVersion} → ${latestVersionData.version}`);
      }
    }

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
      const isLargeMetricType = ['pod_details', 'events', 'nodes', 'pvcs', 'security_threats', 'security'].includes(metric.type);
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
    if (pvcsMetric && pvcsMetric.data?.pvcs !== undefined) {
      const pvcsData = pvcsMetric.data.pvcs as any[];

      // Get user_id from cluster
      const { data: clusterData } = await supabaseClient
        .from('clusters')
        .select('user_id')
        .eq('id', cluster_id)
        .single();

      if (clusterData) {
        // Insert new PVCs only if there are any
        if (pvcsData.length > 0) {
          // Debug: log used_bytes from agent for each PVC
          for (const pvc of pvcsData) {
            const usedGB = ((pvc.used_bytes || 0) / (1024 ** 3)).toFixed(2);
            const reqGB = ((pvc.requested_bytes || 0) / (1024 ** 3)).toFixed(2);
            console.log(`  PVC ${pvc.namespace}/${pvc.name}: used_bytes=${pvc.used_bytes ?? 'undefined'} (${usedGB}GB), requested=${reqGB}GB, source=${pvc.usage_source ?? 'n/a'}`);
          }

          // Upsert PVCs: update existing rows (preserving used_bytes if agent sends 0 this cycle),
          // insert new ones. onConflict matches the unique index (cluster_id, namespace, name).
          const pvcsToUpsert = pvcsData.map(pvc => ({
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
            .upsert(pvcsToUpsert, {
              onConflict: 'cluster_id,namespace,name',
              ignoreDuplicates: false,
            });

          if (pvcError) {
            console.error('Error upserting PVCs:', pvcError);
          } else {
            // Log with real usage info
            const totalUsed = pvcsData.reduce((sum, p) => sum + (p.used_bytes || 0), 0);
            const totalRequested = pvcsData.reduce((sum, p) => sum + (p.requested_bytes || 0), 0);
            console.log(`✅ Upserted ${pvcsToUpsert.length} PVCs (real usage: ${(totalUsed / (1024**3)).toFixed(2)}GB / ${(totalRequested / (1024**3)).toFixed(2)}GB allocated)`);

            // Insert into pvc_usage_history for historical tracking (AI analysis)
            const historyToInsert = pvcsData.map(pvc => ({
              pvc_name: pvc.name,
              namespace: pvc.namespace,
              cluster_id,
              used_bytes: pvc.used_bytes || 0,
              capacity_bytes: pvc.capacity_bytes || 0,
              requested_bytes: pvc.requested_bytes || 0,
              collected_at: new Date().toISOString(),
            }));

            const { error: historyError } = await supabaseClient
              .from('pvc_usage_history')
              .insert(historyToInsert);

            if (historyError) {
              console.error('Error storing PVC usage history:', historyError);
            } else {
              console.log(`📊 Stored ${historyToInsert.length} PVC usage history records`);
            }

            // Cleanup old history occasionally (1% of requests to avoid overhead)
            if (Math.random() < 0.01) {
              try {
                await supabaseClient.rpc('cleanup_old_pvc_usage_history');
                console.log('🧹 Triggered PVC usage history cleanup');
              } catch (cleanupErr) {
                console.error('Error in PVC history cleanup:', cleanupErr);
              }
            }
          }
          // Remove PVCs that no longer exist in the cluster
          const currentNames = pvcsData.map((p: any) => p.name);
          const currentNamespaces = pvcsData.map((p: any) => p.namespace);
          // Simple approach: delete PVCs for this cluster that aren't in the current list
          if (currentNames.length > 0) {
            const { data: stale } = await supabaseClient
              .from('pvcs')
              .select('id, name, namespace')
              .eq('cluster_id', cluster_id);
            const toDelete = (stale || []).filter(
              (row: any) => !pvcsData.some((p: any) => p.name === row.name && p.namespace === row.namespace)
            );
            if (toDelete.length > 0) {
              await supabaseClient
                .from('pvcs')
                .delete()
                .in('id', toDelete.map((r: any) => r.id));
              console.log(`🗑️ Removed ${toDelete.length} stale PVCs`);
            }
          }
        } else {
          // No PVCs in cluster — clear all
          await supabaseClient.from('pvcs').delete().eq('cluster_id', cluster_id);
          console.log(`✅ Cleared all PVCs for cluster (no PVCs in cluster)`);
        }
      }
    }

    // Process standalone PVs (Released, Available, Failed)
    const standalonePVsMetric = metrics.find(m => m.type === 'standalone_pvs');
    if (standalonePVsMetric && standalonePVsMetric.data?.pvs !== undefined) {
      const pvs = standalonePVsMetric.data.pvs as any[];

      // Get user_id from cluster
      const { data: clusterData } = await supabaseClient
        .from('clusters')
        .select('user_id')
        .eq('id', cluster_id)
        .single();

      if (clusterData) {
        // Always delete old PVs for this cluster (even if new list is empty)
        await supabaseClient
          .from('persistent_volumes')
          .delete()
          .eq('cluster_id', cluster_id);

        // Insert new PVs only if there are any
        if (Array.isArray(pvs) && pvs.length > 0) {
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
        } else {
          console.log(`✅ Cleared all standalone PVs for cluster (no Released/Available/Failed PVs)`);
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

    // Process security threats and create immediate alerts
    const securityThreatsMetric = metrics.find(m => m.type === 'security_threats');
    if (securityThreatsMetric) {
      const threatData = securityThreatsMetric.data as any;
      
      // Get user_id from cluster
      const { data: clusterData } = await supabaseClient
        .from('clusters')
        .select('user_id, name')
        .eq('id', cluster_id)
        .single();

      if (clusterData) {
        const userId = clusterData.user_id;
        const clusterName = clusterData.name;
        
        // Collect all threats
        const allThreats: any[] = [];
        
        // High priority threats
        for (const pod of threatData.privileged_containers || []) {
          allThreats.push({
            ...pod,
            threat_type: 'privilege_escalation',
            severity: 'high',
            title: `Container privilegiado: ${pod.container_name}`,
          });
        }
        for (const pod of threatData.host_network_pods || []) {
          allThreats.push({
            ...pod,
            threat_type: 'unauthorized_access',
            severity: 'high',
            title: `Pod com acesso à rede do host: ${pod.pod_name}`,
          });
        }
        for (const pod of threatData.host_pid_pods || []) {
          allThreats.push({
            ...pod,
            threat_type: 'unauthorized_access',
            severity: 'high',
            title: `Pod com acesso ao PID do host: ${pod.pod_name}`,
          });
        }
        
        // Medium priority threats
        for (const pod of threatData.suspicious_pods || []) {
          allThreats.push({
            ...pod,
            threat_type: 'suspicious_process',
            severity: 'medium',
            title: `Pod suspeito: ${pod.pod_name}`,
          });
        }
        
        // Network anomalies (potential attacks)
        for (const anomaly of threatData.network_anomalies || []) {
          allThreats.push({
            ...anomaly,
            threat_type: anomaly.type || 'ddos',
            severity: anomaly.threat_level || 'high',
            title: anomaly.reason || 'Anomalia de rede detectada',
          });
        }
        
        // Suspicious events
        for (const event of threatData.suspicious_events || []) {
          allThreats.push({
            ...event,
            threat_type: 'brute_force',
            severity: event.threat_level || 'medium',
            title: event.reason || 'Evento suspeito detectado',
          });
        }

        if (allThreats.length > 0) {
          console.log(`🔒 Processing ${allThreats.length} security threats`);
          
          // Get existing active threats to avoid duplicates
          const { data: existingThreats } = await supabaseClient
            .from('security_threats')
            .select('title, namespace, threat_type')
            .eq('cluster_id', cluster_id)
            .eq('status', 'active')
            .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

          const existingKeys = new Set(
            (existingThreats || []).map((t: any) => `${t.title}-${t.namespace}-${t.threat_type}`)
          );

          const newThreats = allThreats.filter((threat: any) => {
            const key = `${threat.title}-${threat.namespace}-${threat.threat_type}`;
            return !existingKeys.has(key);
          });

          if (newThreats.length > 0) {
            // Insert new threats
            const threatsToInsert = newThreats.slice(0, 50).map((threat: any) => ({
              cluster_id,
              user_id: userId,
              threat_type: threat.threat_type,
              severity: threat.severity || 'medium',
              status: 'active',
              title: threat.title,
              description: threat.reason || `Ameaça detectada no namespace ${threat.namespace}`,
              affected_resources: [{
                pod: threat.pod_name,
                container: threat.container_name,
                namespace: threat.namespace,
                node: threat.node_name,
              }],
              raw_data: threat,
              detection_source: 'agent',
            }));

            const { error: insertError } = await supabaseClient
              .from('security_threats')
              .insert(threatsToInsert);

            if (insertError) {
              console.error('Error storing security threats:', insertError);
            } else {
              console.log(`✅ Stored ${threatsToInsert.length} new security threats`);
            }

            // Create notifications for critical/high threats
            const criticalHighThreats = newThreats.filter((t: any) => 
              t.severity === 'critical' || t.severity === 'high'
            );

            if (criticalHighThreats.length > 0) {
              const isCritical = criticalHighThreats.some((t: any) => t.severity === 'critical');
              
              await supabaseClient
                .from('notifications')
                .insert({
                  user_id: userId,
                  title: isCritical 
                    ? '🚨 ALERTA CRÍTICO: Ataque Detectado!'
                    : '⚠️ Ameaça de Segurança Detectada',
                  message: `${criticalHighThreats.length} ameaça(s) de alta severidade detectada(s) no cluster ${clusterName}. Verifique imediatamente!`,
                  type: 'error',
                  related_entity_type: 'security_threat',
                  related_entity_id: cluster_id,
                });

              console.log(`🔔 Created notification for ${criticalHighThreats.length} high-severity threats`);
            }
          } else {
            console.log(`✅ No new threats (${allThreats.length} duplicates skipped)`);
          }
        }
      }
    }

    console.log(`✅ Successfully stored ${metrics.length} metrics`);

    // Auto-capture pre-restart logs for pods with spontaneous crashes
    // Detects pods with restart_count > 0 that haven't been captured yet
    const podDetailsMetric = metrics.find((m: any) => m.type === 'pod_details');
    if (podDetailsMetric) {
      const pods = (podDetailsMetric.data as any)?.pods || [];

      if (pods.length > 0) {
        const { data: clusterOwner } = await supabaseClient
          .from('clusters')
          .select('user_id')
          .eq('id', cluster_id)
          .single();

        if (clusterOwner) {
          // Namespaces excluded from any automated action — must be manual only
          const excludedNamespaces = new Set([
            'kodo', 'kodo-agent',
            'kube-system', 'kube-public', 'kube-node-lease',
          ]);

          for (const pod of pods) {
            if (excludedNamespaces.has(pod.namespace)) continue; // never auto-act on agent or system pods
            const totalRestarts = pod.total_restarts || 0;
            if (totalRestarts === 0) continue;

            // episode_key identifies this specific restart count for this pod
            const episodeKey = `${pod.namespace}/${pod.name}/${totalRestarts}`;

            // Check if this restart episode is already captured
            const { data: existing } = await supabaseClient
              .from('pod_restart_audit')
              .select('id')
              .eq('cluster_id', cluster_id)
              .eq('episode_key', episodeKey)
              .maybeSingle();

            if (existing) continue;

            // Check if a capture command is already pending for this pod+episode
            const { data: pending } = await supabaseClient
              .from('agent_commands')
              .select('id')
              .eq('cluster_id', cluster_id)
              .eq('command_type', 'get_pod_logs')
              .eq('status', 'pending')
              .filter('command_params->pod_name', 'eq', pod.name)
              .filter('command_params->namespace', 'eq', pod.namespace)
              .filter('command_params->trigger', 'eq', 'auto_restart_capture')
              .maybeSingle();

            if (pending) continue;

            // Detect restart cause from container last_state
            let restartReason = 'Unknown';
            let exitCode: number | null = null;
            for (const cs of pod.containers || []) {
              const lastState = cs.last_state || {};
              if (lastState.reason) {
                restartReason = lastState.reason;
                exitCode = lastState.exit_code ?? null;
                if (lastState.exit_code === 137) restartReason = 'OOMKilled';
                break;
              }
            }

            // Create command to fetch previous (crashed) container logs
            const { error: cmdError } = await supabaseClient.from('agent_commands').insert({
              cluster_id,
              user_id: clusterOwner.user_id,
              command_type: 'get_pod_logs',
              command_params: {
                pod_name: pod.name,
                namespace: pod.namespace,
                tail_lines: 200,
                previous: true,
                episode_key: episodeKey,
                restart_reason: restartReason,
                exit_code: exitCode,
                restart_count: totalRestarts,
                user_id: clusterOwner.user_id,
                trigger: 'auto_restart_capture',
              },
              status: 'pending',
            });

            if (!cmdError) {
              console.log(`📋 Auto log-capture queued: ${episodeKey}`);
            }
          }
        }
      }
    }

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