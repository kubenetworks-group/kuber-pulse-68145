import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client with user's token to check permissions
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('User error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin using the has_role function
    const { data: isAdmin, error: roleError } = await userClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response(JSON.stringify({ error: 'Failed to check role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied. Admin role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client to bypass RLS and fetch all data
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all users from auth.users
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers();
    if (authError) {
      console.error('Auth users error:', authError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch subscriptions
    const { data: subscriptions, error: subError } = await adminClient
      .from('subscriptions')
      .select('*');

    if (subError) {
      console.error('Subscriptions error:', subError);
    }

    // Fetch clusters
    const { data: clusters, error: clustersError } = await adminClient
      .from('clusters')
      .select('*');

    if (clustersError) {
      console.error('Clusters error:', clustersError);
    }

    // Fetch AI incidents
    const { data: aiIncidents, error: incidentsError } = await adminClient
      .from('ai_incidents')
      .select('*');

    if (incidentsError) {
      console.error('AI incidents error:', incidentsError);
    }

    // Fetch anomalies
    const { data: anomalies, error: anomaliesError } = await adminClient
      .from('agent_anomalies')
      .select('*');

    if (anomaliesError) {
      console.error('Anomalies error:', anomaliesError);
    }

    // Fetch scan history
    const { data: scanHistory, error: scanError } = await adminClient
      .from('scan_history')
      .select('*');

    if (scanError) {
      console.error('Scan history error:', scanError);
    }

    // Build user list with aggregated data
    const users = authUsers.users.map((authUser) => {
      const subscription = subscriptions?.find((s) => s.user_id === authUser.id);
      const userClusters = clusters?.filter((c) => c.user_id === authUser.id) || [];
      const userIncidents = aiIncidents?.filter((i) => i.user_id === authUser.id) || [];
      const userAnomalies = anomalies?.filter((a) => a.user_id === authUser.id) || [];
      const userScans = scanHistory?.filter((s) => s.user_id === authUser.id) || [];

      return {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || null,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        subscription: subscription ? {
          plan: subscription.plan,
          status: subscription.status,
          trial_ends_at: subscription.trial_ends_at,
          ai_analyses_used: subscription.ai_analyses_used,
        } : null,
        clusters_count: userClusters.length,
        clusters: userClusters.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          provider: c.provider,
        })),
        ai_incidents_count: userIncidents.length,
        anomalies_count: userAnomalies.length,
        scans_count: userScans.length,
      };
    });

    // Calculate totals
    const totals = {
      total_users: authUsers.users.length,
      total_clusters: clusters?.length || 0,
      active_clusters: clusters?.filter((c) => c.status === 'active' || c.status === 'connected').length || 0,
      total_ai_incidents: aiIncidents?.length || 0,
      total_anomalies: anomalies?.length || 0,
      total_scans: scanHistory?.length || 0,
      plans: {
        free: subscriptions?.filter((s) => s.plan === 'free').length || 0,
        pro: subscriptions?.filter((s) => s.plan === 'pro').length || 0,
        enterprise: subscriptions?.filter((s) => s.plan === 'enterprise').length || 0,
      },
      statuses: {
        trialing: subscriptions?.filter((s) => s.status === 'trialing').length || 0,
        active: subscriptions?.filter((s) => s.status === 'active').length || 0,
        canceled: subscriptions?.filter((s) => s.status === 'canceled').length || 0,
      },
    };

    console.log('Admin dashboard data fetched successfully for user:', user.email);

    return new Response(
      JSON.stringify({ users, totals }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
