import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema
const AutoHealSchema = z.object({
  cluster_id: z.string().uuid(),
  anomaly_id: z.string().uuid().optional(),
  auto_heal_action: z.string().max(100).optional(),
  auto_heal_params: z.record(z.unknown()).optional().refine(
    (data) => !data || JSON.stringify(data).length < 10000,
    { message: 'Auto-heal params too large (max 10KB)' }
  ),
});

serve(async (req) => {
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = AutoHealSchema.safeParse(body);
    
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

    const { cluster_id, anomaly_id, auto_heal_action, auto_heal_params } = validationResult.data;

    console.log('Creating auto-heal command');

    // Create command for agent to execute
    const { data: command, error: commandError } = await supabaseClient
      .from('agent_commands')
      .insert({
        cluster_id,
        user_id: user.id,
        command_type: auto_heal_action || 'auto_heal',
        command_params: auto_heal_params || {},
        status: 'pending',
      })
      .select()
      .single();

    if (commandError) {
      console.error('Database error occurred');
      return new Response(JSON.stringify({ error: 'Failed to create auto-heal command' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Command created successfully');

    // Mark anomaly as auto-heal applied (only if anomaly_id is provided)
    if (anomaly_id) {
      await supabaseClient
        .from('agent_anomalies')
        .update({ auto_heal_applied: true })
        .eq('id', anomaly_id);
    }

    // Create notification
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: user.id,
        title: '🤖 Auto-cura iniciada',
        message: `Ação de auto-cura "${auto_heal_action}" foi enviada para o cluster.`,
        type: 'info',
        related_entity_type: 'cluster',
        related_entity_id: cluster_id,
      });

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
