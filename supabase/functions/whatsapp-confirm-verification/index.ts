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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { code } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Verification code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile with verification code
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_verification_code, whatsapp_verification_expires_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if code matches
    if (profile.whatsapp_verification_code !== code) {
      return new Response(
        JSON.stringify({ error: 'Invalid verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if code is expired
    if (new Date(profile.whatsapp_verification_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Verification code has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as verified and enable notifications
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        whatsapp_verified: true,
        whatsapp_notifications_enabled: true,
        whatsapp_verification_code: null,
        whatsapp_verification_expires_at: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update verification status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify phone number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`WhatsApp verified for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'WhatsApp verificado com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('WhatsApp confirm verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
