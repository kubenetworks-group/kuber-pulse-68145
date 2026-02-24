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

    const { webhook_id, alert, test } = await req.json();

    // Fetch webhook config
    const { data: webhook, error: whError } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('id', webhook_id)
      .single();

    if (whError || !webhook) {
      return new Response(JSON.stringify({ error: 'Webhook not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!webhook.enabled && !test) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Webhook disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload: any;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Merge custom headers
    if (webhook.headers && typeof webhook.headers === 'object') {
      headers = { ...headers, ...webhook.headers };
    }

    const severity = alert.severity || 'info';
    const title = alert.title || 'Kodo Alert';
    const message = alert.message || '';
    const source = alert.source || 'kodo';
    const timestamp = new Date().toISOString();

    switch (webhook.webhook_type) {
      case 'slack':
        const slackColor = severity === 'critical' ? '#dc2626' : severity === 'high' ? '#ea580c' : severity === 'warning' ? '#eab308' : '#3b82f6';
        payload = {
          attachments: [{
            color: slackColor,
            title: `🔔 ${title}`,
            text: message,
            fields: [
              { title: 'Severidade', value: severity.toUpperCase(), short: true },
              { title: 'Fonte', value: source, short: true },
            ],
            footer: 'Kodo Alert Manager',
            ts: Math.floor(Date.now() / 1000),
          }],
        };
        break;

      case 'discord':
        const discordColor = severity === 'critical' ? 0xdc2626 : severity === 'high' ? 0xea580c : severity === 'warning' ? 0xeab308 : 0x3b82f6;
        payload = {
          embeds: [{
            title: `🔔 ${title}`,
            description: message,
            color: discordColor,
            fields: [
              { name: 'Severidade', value: severity.toUpperCase(), inline: true },
              { name: 'Fonte', value: source, inline: true },
            ],
            footer: { text: 'Kodo Alert Manager' },
            timestamp,
          }],
        };
        break;

      case 'teams':
        payload = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: severity === 'critical' ? 'dc2626' : 'eab308',
          summary: title,
          sections: [{
            activityTitle: `🔔 ${title}`,
            facts: [
              { name: 'Mensagem', value: message },
              { name: 'Severidade', value: severity.toUpperCase() },
              { name: 'Fonte', value: source },
            ],
          }],
        };
        break;

      case 'pagerduty':
        payload = {
          routing_key: new URL(webhook.url).searchParams.get('routing_key') || '',
          event_action: 'trigger',
          payload: {
            summary: `${title}: ${message}`,
            severity: severity === 'critical' ? 'critical' : severity === 'high' ? 'error' : 'warning',
            source: 'kodo-alert-manager',
            timestamp,
          },
        };
        break;

      default: // generic
        payload = {
          event: 'alert',
          title,
          message,
          severity,
          source,
          timestamp,
          test: !!test,
        };
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await supabase.from('webhook_configs').update({
        last_error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
      }).eq('id', webhook_id);

      return new Response(JSON.stringify({ error: `Webhook returned ${response.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await response.text(); // consume body

    // Update last triggered
    await supabase.from('webhook_configs').update({
      last_triggered_at: timestamp,
      last_error: null,
    }).eq('id', webhook_id);

    console.log(`✅ Webhook sent: ${webhook.name} (${webhook.webhook_type})`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
