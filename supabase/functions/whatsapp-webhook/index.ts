import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// Verify webhook signature from Meta
async function verifySignature(payload: string, signature: string, appSecret: string): Promise<boolean> {
  if (!signature || !appSecret) return false;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return signature === expectedSignature;
}

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully');
      return new Response(challenge, { status: 200 });
    } else {
      console.error('Webhook verification failed');
      return new Response('Forbidden', { status: 403 });
    }
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const payload = await req.text();
    
    // Verify signature if app secret is configured
    if (appSecret) {
      const signature = req.headers.get('x-hub-signature-256');
      const isValid = await verifySignature(payload, signature || '', appSecret);
      
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401 });
      }
    }
    
    const body = JSON.parse(payload);
    console.log('WhatsApp webhook received:', JSON.stringify(body, null, 2));
    
    // Process incoming messages
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    if (!value?.messages?.[0]) {
      // Not a message event (could be status update)
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
    
    const message = value.messages[0];
    const from = message.from; // Phone number
    const messageText = message.text?.body?.toLowerCase().trim();
    
    console.log(`Received message from ${from}: ${messageText}`);
    
    // Find user by phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, whatsapp_phone')
      .or(`whatsapp_phone.ilike.%${from.slice(-10)}%,whatsapp_phone.ilike.%${from}%`)
      .single();
    
    if (profileError || !profile) {
      console.log('User not found for phone:', from);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
    
    // Check if this is a response to an approval request
    // Look for pending approvals for this user
    const { data: pendingApprovals, error: approvalError } = await supabase
      .from('whatsapp_approvals')
      .select('*')
      .eq('user_id', profile.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    
    if (approvalError || !pendingApprovals?.length) {
      console.log('No pending approvals for user');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
    
    // Determine if user approved or rejected
    const isApproval = messageText?.includes('sim') || 
                       messageText?.includes('yes') || 
                       messageText?.includes('aprovar') ||
                       messageText === '1' ||
                       messageText === 'ok';
    
    const isRejection = messageText?.includes('nao') || 
                        messageText?.includes('não') ||
                        messageText?.includes('no') || 
                        messageText?.includes('rejeitar') ||
                        messageText === '2' ||
                        messageText === 'cancelar';
    
    if (!isApproval && !isRejection) {
      console.log('Message not recognized as approval/rejection');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
    
    // Check if message contains a specific approval ID
    let targetApproval = pendingApprovals[0]; // Default to most recent
    
    // Try to match approval ID from message
    const idMatch = messageText.match(/([a-f0-9]{8})/);
    if (idMatch) {
      const matchedApproval = pendingApprovals.find(a => a.id.startsWith(idMatch[1]));
      if (matchedApproval) {
        targetApproval = matchedApproval;
      }
    }
    
    const newStatus = isApproval ? 'approved' : 'rejected';
    
    // Update approval status
    await supabase
      .from('whatsapp_approvals')
      .update({
        status: newStatus,
        user_response: messageText,
        responded_at: new Date().toISOString(),
      })
      .eq('id', targetApproval.id);
    
    console.log(`Approval ${targetApproval.id} ${newStatus}`);
    
    // If approved, create the agent command
    if (isApproval) {
      const { error: commandError } = await supabase
        .from('agent_commands')
        .insert({
          cluster_id: targetApproval.cluster_id,
          user_id: targetApproval.user_id,
          command_type: targetApproval.action_type,
          command_params: targetApproval.action_params,
          status: 'pending',
        });
      
      if (commandError) {
        console.error('Failed to create command:', commandError);
      } else {
        console.log('Command created for approved action');
        
        // Update approval status to executed
        await supabase
          .from('whatsapp_approvals')
          .update({ status: 'executed' })
          .eq('id', targetApproval.id);
      }
      
      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: targetApproval.user_id,
          title: '✅ Ação Aprovada via WhatsApp',
          message: `A ação de ${targetApproval.action_type} foi aprovada e será executada.`,
          type: 'success',
          related_entity_type: 'cluster',
          related_entity_id: targetApproval.cluster_id,
        });
    } else {
      // Create notification for rejection
      await supabase
        .from('notifications')
        .insert({
          user_id: targetApproval.user_id,
          title: '❌ Ação Rejeitada via WhatsApp',
          message: `A ação de ${targetApproval.action_type} foi rejeitada.`,
          type: 'info',
          related_entity_type: 'cluster',
          related_entity_id: targetApproval.cluster_id,
        });
    }
    
    // Send confirmation message back via WhatsApp
    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    
    if (whatsappToken && whatsappPhoneId) {
      const confirmationMessage = isApproval
        ? `✅ *Ação Aprovada*\n\nA correção será executada em instantes.\n\nID: ${targetApproval.id.slice(0, 8)}`
        : `❌ *Ação Cancelada*\n\nA correção não será executada.\n\nO problema continuará sendo monitorado.\n\nID: ${targetApproval.id.slice(0, 8)}`;
      
      await fetch(
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
            to: from,
            type: 'text',
            text: {
              preview_url: false,
              body: confirmationMessage
            }
          }),
        }
      );
    }
    
    return new Response('OK', { status: 200, headers: corsHeaders });
    
  } catch (error: any) {
    console.error('WhatsApp webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
