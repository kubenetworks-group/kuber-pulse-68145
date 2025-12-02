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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting trial expiration check...');

    // Find all trialing subscriptions that have expired
    const { data: expiredTrials, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'trialing')
      .lt('trial_ends_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired trials:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredTrials?.length || 0} expired trials`);

    // Update each to readonly status
    if (expiredTrials && expiredTrials.length > 0) {
      const expiredIds = expiredTrials.map(s => s.id);
      
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'readonly',
          updated_at: new Date().toISOString()
        })
        .in('id', expiredIds);

      if (updateError) {
        console.error('Error updating expired trials:', updateError);
        throw updateError;
      }

      // Create notifications for users
      const notifications = expiredTrials.map(s => ({
        user_id: s.user_id,
        title: 'Período de teste expirado',
        message: 'Seu período de teste de 30 dias expirou. Escolha um plano para continuar usando todos os recursos.',
        type: 'warning',
      }));

      await supabase.from('notifications').insert(notifications);

      console.log(`Updated ${expiredIds.length} subscriptions to readonly`);
    }

    // Reset monthly AI usage counters
    const now = new Date();
    const { data: resetSubscriptions, error: resetFetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .lt('ai_analyses_reset_at', now.toISOString());

    if (!resetFetchError && resetSubscriptions && resetSubscriptions.length > 0) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      const { error: resetError } = await supabase
        .from('subscriptions')
        .update({ 
          ai_analyses_used: 0,
          ai_analyses_reset_at: nextMonth.toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', resetSubscriptions.map(s => s.id));

      if (resetError) {
        console.error('Error resetting AI usage:', resetError);
      } else {
        console.log(`Reset AI usage for ${resetSubscriptions.length} subscriptions`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        expired_trials_updated: expiredTrials?.length || 0,
        ai_usage_reset: resetSubscriptions?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in check-trial-expiration:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
