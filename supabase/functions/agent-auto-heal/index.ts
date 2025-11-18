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
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
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

    const { cluster_id, anomaly_id, auto_heal_action, auto_heal_params } = await req.json();

    if (!cluster_id || !anomaly_id) {
      throw new Error('cluster_id and anomaly_id are required');
    }

    console.log('Creating auto-heal command:', { cluster_id, auto_heal_action, auto_heal_params });

    // Create command for agent to execute
    const { data: command, error: commandError } = await supabaseClient
      .from('agent_commands')
      .insert({
        cluster_id,
        user_id: user.id,
        command_type: auto_heal_action,
        command_params: auto_heal_params,
        status: 'pending',
      })
      .select()
      .single();

    if (commandError) {
      console.error('Error creating command:', commandError);
      throw new Error('Failed to create auto-heal command');
    }

    console.log('Command created:', command);

    // Mark anomaly as auto-heal applied
    const { error: anomalyError } = await supabaseClient
      .from('agent_anomalies')
      .update({ auto_heal_applied: true })
      .eq('id', anomaly_id);

    if (anomalyError) {
      console.error('Error updating anomaly:', anomalyError);
    }

    // Create notification
    const { error: notifError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: user.id,
        title: '🤖 Auto-cura iniciada',
        message: `Ação de auto-cura "${auto_heal_action}" foi enviada para o cluster.`,
        type: 'info',
        related_entity_type: 'cluster',
        related_entity_id: cluster_id,
      });

    if (notifError) {
      console.error('Error creating notification:', notifError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        command_id: command.id,
        message: 'Auto-heal command sent to agent',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in agent-auto-heal:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
