import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { organization_id, action } = await req.json();

    // Get subscription and plan
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*, organization_id')
      .eq('organization_id', organization_id)
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          reason: 'Subscription not found',
          upgrade_required: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if subscription is active or trialing
    if (!['trialing', 'active'].includes(subscription.status)) {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          reason: 'Subscription expired or inactive',
          upgrade_required: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get plan limits
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('limits')
      .eq('slug', subscription.plan_type === 'trial' ? 'starter' : subscription.plan_type)
      .single();

    const limits = plan?.limits || { clusters: 1 };

    // Get current usage
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('subscription_id', subscription.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Check specific action limits
    if (action === 'connect_cluster') {
      const { count: clusterCount } = await supabase
        .from('clusters')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', subscription.user_id);

      const maxClusters = limits.clusters === -1 ? Infinity : limits.clusters;
      
      if ((clusterCount || 0) >= maxClusters) {
        return new Response(
          JSON.stringify({ 
            allowed: false, 
            reason: `Limite de ${maxClusters} cluster(s) atingido`,
            upgrade_required: true,
            current_plan: subscription.plan_type,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        allowed: true,
        limits,
        usage: usage || {},
        current_plan: subscription.plan_type,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking limits:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
