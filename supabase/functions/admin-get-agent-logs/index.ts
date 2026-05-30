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
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate caller is admin using the same pattern as admin-dashboard-data
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin, error: roleError } = await userClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all users so we can map user_id -> email
    const { data: authUsersResp } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const userMap: Record<string, { email: string; full_name: string | null }> = {};
    for (const u of authUsersResp?.users ?? []) {
      userMap[u.id] = {
        email: u.email ?? '',
        full_name: (u.user_metadata?.full_name as string) ?? null,
      };
    }

    const url = new URL(req.url);
    const clusterId = url.searchParams.get('cluster_id');

    // Only select columns that always exist (not from the migration)
    const clusterSelect = `
      id,
      name,
      provider,
      status,
      agent_version,
      agent_last_seen_at,
      agent_pod_name,
      agent_pod_namespace,
      agent_pod_phase,
      agent_container_restart_count,
      user_id
    `;

    if (!clusterId) {
      // List all clusters with agent pod status
      const { data: clusters, error } = await adminClient
        .from('clusters')
        .select(clusterSelect)
        .order('agent_last_seen_at', { ascending: false, nullsFirst: false });

      if (error) {
        // If new columns don't exist yet, fall back to selecting only base columns
        const { data: clustersFallback, error: err2 } = await adminClient
          .from('clusters')
          .select('id, name, provider, status, agent_version, agent_last_seen_at, user_id')
          .order('agent_last_seen_at', { ascending: false, nullsFirst: false });

        if (err2) throw err2;

        const clustersWithOwner = (clustersFallback ?? []).map((c: any) => ({
          ...c,
          agent_pod_name: null,
          agent_pod_namespace: 'kodo',
          agent_pod_phase: null,
          agent_container_restart_count: 0,
          owner: userMap[c.user_id] ?? { email: 'unknown', full_name: null },
        }));

        return new Response(JSON.stringify({ clusters: clustersWithOwner }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clustersWithOwner = (clusters ?? []).map((c: any) => ({
        ...c,
        owner: userMap[c.user_id] ?? { email: 'unknown', full_name: null },
      }));

      return new Response(JSON.stringify({ clusters: clustersWithOwner }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return logs for a specific cluster
    const { data: clusterInfo, error: clusterErr } = await adminClient
      .from('clusters')
      .select(clusterSelect)
      .eq('id', clusterId)
      .single();

    if (clusterErr) {
      // Fallback without new columns
      const { data: clusterFallback } = await adminClient
        .from('clusters')
        .select('id, name, provider, status, agent_version, agent_last_seen_at, user_id')
        .eq('id', clusterId)
        .single();

      const clusterWithOwner = clusterFallback ? {
        ...clusterFallback,
        agent_pod_name: null,
        agent_pod_namespace: 'kodo',
        agent_pod_phase: null,
        agent_container_restart_count: 0,
        owner: userMap[clusterFallback.user_id] ?? { email: 'unknown', full_name: null },
      } : null;

      return new Response(JSON.stringify({ cluster: clusterWithOwner, logs: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clusterWithOwner = clusterInfo ? {
      ...clusterInfo,
      owner: userMap[clusterInfo.user_id] ?? { email: 'unknown', full_name: null },
    } : null;

    // Try to fetch agent logs (table may not exist yet if migration not applied)
    let logs: unknown[] = [];
    try {
      const { data: logData, error: logsError } = await adminClient
        .from('agent_logs')
        .select('id, pod_name, pod_phase, container_state, container_restart_count, log_lines, collected_at')
        .eq('cluster_id', clusterId)
        .order('collected_at', { ascending: false })
        .limit(20);

      if (!logsError) {
        logs = logData ?? [];
      }
    } catch {
      // agent_logs table doesn't exist yet — return empty
    }

    return new Response(JSON.stringify({ cluster: clusterWithOwner, logs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in admin-get-agent-logs:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
