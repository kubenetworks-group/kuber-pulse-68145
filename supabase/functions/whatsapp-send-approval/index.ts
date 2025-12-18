import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      user_id, 
      cluster_id, 
      anomaly_id, 
      action_type, 
      action_params, 
      cluster_name, 
      anomaly_description,
      severity,
      recommendation
    } = await req.json();

    console.log(`Sending WhatsApp approval request for cluster ${cluster_name}`);

    // Get user's WhatsApp phone from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_phone, whatsapp_verified, whatsapp_notifications_enabled')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.whatsapp_phone || !profile.whatsapp_verified) {
      console.error('WhatsApp not configured or verified');
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured or verified for this user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.whatsapp_notifications_enabled) {
      console.log('WhatsApp notifications disabled for user');
      return new Response(
        JSON.stringify({ error: 'WhatsApp notifications disabled', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auto_heal_settings for timeout
    const { data: healSettings } = await supabase
      .from('auto_heal_settings')
      .select('approval_timeout_minutes')
      .eq('cluster_id', cluster_id)
      .single();

    const timeoutMinutes = healSettings?.approval_timeout_minutes || 30;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

    // Create approval record
    const { data: approval, error: approvalError } = await supabase
      .from('whatsapp_approvals')
      .insert({
        user_id,
        cluster_id,
        anomaly_id,
        action_type,
        action_params,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (approvalError) {
      console.error('Failed to create approval record:', approvalError);
      return new Response(
        JSON.stringify({ error: 'Failed to create approval record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove non-digits and ensure it has country code)
    let phoneNumber = profile.whatsapp_phone.replace(/\D/g, '');
    if (!phoneNumber.startsWith('55')) {
      phoneNumber = '55' + phoneNumber;
    }

    // Build WhatsApp message
    const severityEmojiMap: Record<string, string> = {
      low: '🟡',
      medium: '🟠',
      high: '🔴',
      critical: '🚨'
    };
    const severityEmoji = severityEmojiMap[severity as string] || '⚠️';

    const actionTypeLabelMap: Record<string, string> = {
      restart_pod: 'Reiniciar Pod',
      scale_deployment: 'Escalar Deployment',
      update_deployment_resources: 'Atualizar Recursos',
      anomaly_fix: 'Correção de Anomalia'
    };
    const actionTypeLabel = actionTypeLabelMap[action_type as string] || action_type;

    const messageBody = `${severityEmoji} *ALERTA KODO*

Cluster: *${cluster_name}*
Problema: ${anomaly_description}

📊 *Detalhes:*
• Severidade: ${severity?.toUpperCase() || 'MÉDIA'}
• Ação: ${actionTypeLabel}

🤖 *Ação Recomendada:*
${recommendation || 'Executar correção automática'}

⏰ Expira em: ${timeoutMinutes} minutos

Responda:
✅ *SIM* - para aprovar
❌ *NAO* - para rejeitar

ID: ${approval.id.slice(0, 8)}`;

    // Check if WhatsApp API is configured
    if (!whatsappToken || !whatsappPhoneId) {
      console.log('WhatsApp API not configured, simulating message send');
      
      // Update approval with simulated message ID
      await supabase
        .from('whatsapp_approvals')
        .update({ whatsapp_message_id: `simulated_${approval.id}` })
        .eq('id', approval.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          approval_id: approval.id,
          simulated: true,
          message: 'WhatsApp API not configured - approval created for web interface'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send WhatsApp message via Meta API
    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneNumber,
          type: 'text',
          text: {
            preview_url: false,
            body: messageBody
          }
        }),
      }
    );

    const whatsappData = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      console.error('WhatsApp API error:', whatsappData);
      
      // Still keep the approval for web interface
      return new Response(
        JSON.stringify({ 
          success: true, 
          approval_id: approval.id,
          whatsapp_error: whatsappData.error?.message || 'Failed to send WhatsApp message',
          message: 'Approval created - WhatsApp send failed, use web interface'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update approval with message ID
    const messageId = whatsappData.messages?.[0]?.id;
    await supabase
      .from('whatsapp_approvals')
      .update({ whatsapp_message_id: messageId })
      .eq('id', approval.id);

    console.log(`WhatsApp message sent successfully: ${messageId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        approval_id: approval.id,
        message_id: messageId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('WhatsApp send approval error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
