import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

// Validation schema
const UpdateCommandSchema = z.object({
  command_id: z.string().uuid(),
  status: z.enum(['sent', 'executing', 'completed', 'failed']),
  result: z.record(z.unknown()).optional().refine(
    (data) => !data || JSON.stringify(data).length < 200000,
    { message: 'Result data too large (max 200KB)' }
  ),
});

// Rate limiting
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const requests = (rateLimiter.get(key) || []).filter(
    timestamp => now - timestamp < windowMs
  );

  if (requests.length >= maxRequests) {
    return false;
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
      console.error('Authentication failed');
      return new Response(JSON.stringify({ error: 'Missing API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash the API key for rate limiting
    const keyHash = await hashApiKey(agentKey);

    // Rate limiting: 10 requests per minute
    if (!checkRateLimit(keyHash, 10, 60000)) {
      console.warn('Rate limit exceeded');
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

    // Hash the provided key for authentication
    const providedKeyHash = await hashApiKey(agentKey);

    // Try hash-based authentication first, then fallback to plaintext
    let apiKeyData;

    // First, try hash-based authentication
    const { data: hashData, error: hashError } = await supabaseClient
      .from('agent_api_keys')
      .select('cluster_id, is_active')
      .eq('api_key_hash', providedKeyHash)
      .single();

    if (hashData && !hashError) {
      apiKeyData = hashData;
    } else {
      // Fallback: try plaintext (for keys created before hash implementation)
      const { data: plainData, error: plainError } = await supabaseClient
        .from('agent_api_keys')
        .select('cluster_id, is_active')
        .eq('api_key', agentKey)
        .single();

      if (plainData && !plainError) {
        apiKeyData = plainData;
      }
    }

    if (!apiKeyData || !apiKeyData.is_active) {
      console.error('Authentication failed');
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = UpdateCommandSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Validation failed');
      return new Response(JSON.stringify({ 
        error: 'Invalid request format',
        details: validationResult.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { command_id, status, result } = validationResult.data;

    // Get current command to check retry settings and command type
    const { data: currentCommand, error: fetchError } = await supabaseClient
      .from('agent_commands')
      .select('retry_count, max_retries, command_type, command_params')
      .eq('id', command_id)
      .eq('cluster_id', apiKeyData.cluster_id)
      .single();

    if (fetchError) {
      console.error('Failed to fetch command:', fetchError);
      return new Response(JSON.stringify({ error: 'Command not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update command status
    const updateData: any = {
      status,
      completed_at: new Date().toISOString(),
    };

    if (result) {
      updateData.result = result;
    }

    // If failed and retries available, schedule retry with exponential backoff
    if (status === 'failed' && currentCommand.retry_count < currentCommand.max_retries) {
      const retryCount = currentCommand.retry_count || 0;
      // Exponential backoff: 2^retryCount minutes (1min, 2min, 4min, 8min)
      const delayMinutes = Math.pow(2, retryCount);
      const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
      updateData.next_retry_at = nextRetryAt.toISOString();
      console.log(`Scheduling retry ${retryCount + 1}/${currentCommand.max_retries} in ${delayMinutes} minutes`);
    }

    const { error: updateError } = await supabaseClient
      .from('agent_commands')
      .update(updateData)
      .eq('id', command_id)
      .eq('cluster_id', apiKeyData.cluster_id);

    if (updateError) {
      console.error('Database error occurred');
      return new Response(JSON.stringify({ error: 'Failed to update command' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Snapshot finalization ──────────────────────────────────────────────────
    // When a collect_cluster_snapshot command completes or fails, update the
    // cluster_snapshots table accordingly (the agent never calls this directly).
    if (currentCommand.command_type === 'collect_cluster_snapshot') {
      const params = currentCommand.command_params as any;
      const snapshotId = params?.snapshot_id || (result as any)?.snapshot_id;

      if (snapshotId) {
        if (status === 'completed' && result) {
          const r = result as any;
          const namespaces: string[] = Array.isArray(r.namespaces) ? r.namespaces : [];
          const storageClasses: string[] = Array.isArray(r.storage_classes) ? r.storage_classes : [];

          const { error: snapErr } = await supabaseClient
            .from('cluster_snapshots')
            .update({
              status: 'completed',
              manifest_count: r.resource_count ?? 0,
              storage_size_bytes: r.size_bytes ?? 0,
              namespace_count: namespaces.length,
              resource_summary: {
                namespaces,
                storageClasses: storageClasses,
                resourceCounts: {},
              },
              completed_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', snapshotId);

          if (snapErr) {
            console.error('Failed to finalize snapshot:', snapErr.message);
          } else {
            console.log(`✅ Snapshot ${snapshotId} finalized: ${r.resource_count} resources`);
          }
        } else if (status === 'failed') {
          const errorMsg = (result as any)?.error || (result as any)?.message || 'Agent failed to collect snapshot';
          await supabaseClient
            .from('cluster_snapshots')
            .update({
              status: 'failed',
              error_message: errorMsg,
              completed_at: new Date().toISOString(),
            })
            .eq('id', snapshotId);
          console.log(`❌ Snapshot ${snapshotId} marked as failed: ${errorMsg}`);
        }
      }
    }

    // Auto-capture: if this was an auto-triggered log fetch for restart analysis,
    // save the logs to pod_restart_audit and invoke AI analysis
    if (status === 'completed' && result) {
      const params = currentCommand.command_params as any;
      if (params?.trigger === 'auto_restart_capture') {
        const logs = (result as any).logs || '';
        const clusterId = apiKeyData.cluster_id;

        // Try to update an existing record (created by auto-heal pre-capture)
        let auditId: string | null = null;
        if (params.episode_key) {
          const { data: existing } = await supabaseClient
            .from('pod_restart_audit')
            .select('id, container_logs')
            .eq('cluster_id', clusterId)
            .eq('episode_key', params.episode_key)
            .maybeSingle();

          if (existing?.id) {
            // Update the existing record with logs (only if we actually have logs)
            if (logs) {
              await supabaseClient
                .from('pod_restart_audit')
                .update({ container_logs: logs, container_logs_tail: 200, command_id })
                .eq('id', existing.id);
            }
            auditId = existing.id;
          }
        }

        // No existing record — create a new one
        if (!auditId) {
          const { data: auditRecord } = await supabaseClient
            .from('pod_restart_audit')
            .upsert({
              cluster_id: clusterId,
              user_id: params.user_id,
              pod_name: params.pod_name,
              namespace: params.namespace,
              restart_reason: params.restart_reason || 'Unknown',
              exit_code: params.exit_code || null,
              restart_count: params.restart_count || 0,
              container_logs: logs || null,
              container_logs_tail: 200,
              episode_key: params.episode_key,
              source: 'auto',
              command_id,
              previous_state: {},
            }, { onConflict: 'cluster_id,episode_key', ignoreDuplicates: true })
            .select('id')
            .maybeSingle();
          auditId = auditRecord?.id ?? null;
        }

        if (auditId) {
          console.log(`📋 Saved restart audit: ${params.episode_key}, invoking AI analysis`);
          supabaseClient.functions.invoke('analyze-restart-cause', {
            body: { audit_id: auditId, cluster_id: clusterId }
          }).catch((err: any) => console.error('Failed to invoke analyze-restart-cause:', err));
        }
      }
    }

    console.log(`Command updated successfully`);

    return new Response(
      JSON.stringify({ success: true }),
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
