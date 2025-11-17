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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { organization_id, user_id } = await req.json();

    console.log('Initializing trial for:', { organization_id, user_id });

    // Check if subscription already exists
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('organization_id', organization_id)
      .single();

    if (existing) {
      console.log('Subscription already exists');
      return new Response(
        JSON.stringify({ success: true, message: 'Subscription already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create trial subscription (30 days)
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id,
        organization_id,
        plan_type: 'trial',
        status: 'trialing',
        trial_start: trialStart.toISOString(),
        trial_end: trialEnd.toISOString(),
        current_period_start: trialStart.toISOString(),
        current_period_end: trialEnd.toISOString(),
      })
      .select()
      .single();

    if (subError) throw subError;

    // Create initial usage tracking record
    const { error: usageError } = await supabase
      .from('usage_tracking')
      .insert({
        subscription_id: subscription.id,
        organization_id,
        period_start: trialStart.toISOString(),
        period_end: trialEnd.toISOString(),
        clusters_connected: 0,
        ai_analyses_used: 0,
        ai_actions_executed: 0,
        storage_analyzed_gb: 0,
        reports_generated: 0,
      });

    if (usageError) throw usageError;

    // Create notification
    await supabase.from('notifications').insert({
      user_id,
      type: 'info',
      title: 'Trial de 30 dias ativado!',
      message: `Seu trial do Kodo começou e expira em ${trialEnd.toLocaleDateString('pt-BR')}. Explore todas as funcionalidades!`,
      related_entity_type: 'subscription',
      related_entity_id: subscription.id,
    });

    console.log('Trial initialized successfully:', subscription.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        subscription,
        trial_end: trialEnd.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error initializing trial:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
