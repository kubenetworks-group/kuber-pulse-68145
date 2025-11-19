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
    console.log('Starting retry process for failed commands');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find failed commands ready for retry
    const { data: failedCommands, error: fetchError } = await supabaseClient
      .from('agent_commands')
      .select('id, command_type, retry_count, max_retries, cluster_id, user_id')
      .eq('status', 'failed')
      .not('next_retry_at', 'is', null)
      .lte('next_retry_at', new Date().toISOString())
      .lt('retry_count', 3); // Only retry if under max_retries

    if (fetchError) {
      console.error('Error fetching failed commands:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch commands' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!failedCommands || failedCommands.length === 0) {
      console.log('No commands ready for retry');
      return new Response(JSON.stringify({ 
        message: 'No commands to retry',
        retried: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${failedCommands.length} commands ready for retry`);

    // Reset commands to pending for retry
    const retryResults = await Promise.all(
      failedCommands.map(async (cmd) => {
        const newRetryCount = (cmd.retry_count || 0) + 1;
        
        console.log(`Retrying command ${cmd.id} (attempt ${newRetryCount}/${cmd.max_retries})`);

        const { error: updateError } = await supabaseClient
          .from('agent_commands')
          .update({
            status: 'pending',
            retry_count: newRetryCount,
            next_retry_at: null,
            executed_at: null,
            completed_at: null,
            result: null,
          })
          .eq('id', cmd.id);

        if (updateError) {
          console.error(`Failed to reset command ${cmd.id}:`, updateError);
          return { id: cmd.id, success: false, error: updateError.message };
        }

        // Create notification for retry
        await supabaseClient
          .from('notifications')
          .insert({
            user_id: cmd.user_id,
            title: 'Command Retry',
            message: `Retrying ${cmd.command_type} command (attempt ${newRetryCount}/${cmd.max_retries})`,
            type: 'info',
            related_entity_id: cmd.id,
            related_entity_type: 'agent_command',
          });

        return { id: cmd.id, success: true };
      })
    );

    const successCount = retryResults.filter(r => r.success).length;
    const failCount = retryResults.filter(r => !r.success).length;

    console.log(`Retry process completed: ${successCount} succeeded, ${failCount} failed`);

    return new Response(JSON.stringify({
      message: 'Retry process completed',
      retried: successCount,
      failed: failCount,
      results: retryResults,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in retry process:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});