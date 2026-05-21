import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'Kodo <noreply@kubenetworks.com.br>';
const INTERNAL_EMAIL = 'suporte@kubenetworks.com.br';
const SITE_URL = 'https://kodo.kubenetworks.com.br';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const {
      email, company, cluster_size, vertical, ab_variant,
      utm_source, utm_medium, utm_campaign, utm_content,
    } = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const submittedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .upsert(
        {
          email: normalizedEmail,
          company,
          cluster_size,
          vertical,
          ab_variant,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' },
      )
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting lead:', insertError);
      throw insertError;
    }

    if (RESEND_API_KEY) {
      // Email de confirmação para o lead
      const leadRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [normalizedEmail],
          subject: 'Sua demo do Kodo foi solicitada — KubeNetworks',
          html: buildLeadConfirmationEmail(company || normalizedEmail),
        }),
      });

      if (!leadRes.ok) {
        const body = await leadRes.text();
        console.error('Resend lead email error:', leadRes.status, body);
      } else {
        console.log(`✅ Confirmation email sent to ${normalizedEmail}`);
      }

      // Notificação interna para a equipe
      const internalRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [INTERNAL_EMAIL],
          subject: `🚀 Novo lead — ${company || normalizedEmail} (${cluster_size || '?'} nós)`,
          html: buildInternalNotification({
            email: normalizedEmail,
            company,
            cluster_size,
            utm_source,
            utm_medium,
            utm_campaign,
            ab_variant,
            submittedAt,
          }),
        }),
      });

      if (!internalRes.ok) {
        const body = await internalRes.text();
        console.error('Resend internal email error:', internalRes.status, body);
      } else {
        console.log(`✅ Internal notification sent to ${INTERNAL_EMAIL}`);
      }
    } else {
      console.warn('RESEND_API_KEY não configurado — emails não enviados');
    }

    return new Response(
      JSON.stringify({ success: true, id: lead?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('capture-lead error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function buildLeadConfirmationEmail(name: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Demo Kodo solicitada</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:26px;font-weight:900;letter-spacing:-0.02em;color:#0f172a;">Kodo</span>
    </div>

    <div style="background:#fff;border-radius:16px;padding:40px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">
        Olá, ${name}!
      </h1>
      <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
        Recebemos sua solicitação de demo. Nossa equipe vai entrar em contato em até <strong style="color:#0f172a;">24 horas úteis</strong> para agendar uma sessão personalizada para o seu cluster.
      </p>

      <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:28px;">
        <p style="margin:0 0 14px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">O que esperar na demo</p>
        <div style="margin-bottom:12px;display:flex;gap:12px;">
          <span style="color:#10b981;font-size:16px;line-height:1.4;">✓</span>
          <span style="color:#475569;font-size:14px;line-height:1.5;"><strong>Análise de custo</strong> — recursos subutilizados e estimativa de economia mensal</span>
        </div>
        <div style="margin-bottom:12px;display:flex;gap:12px;">
          <span style="color:#10b981;font-size:16px;line-height:1.4;">✓</span>
          <span style="color:#475569;font-size:14px;line-height:1.5;"><strong>Mapa de segurança</strong> — RBAC, Network Policies e Pod Security Standards</span>
        </div>
        <div style="display:flex;gap:12px;">
          <span style="color:#10b981;font-size:16px;line-height:1.4;">✓</span>
          <span style="color:#475569;font-size:14px;line-height:1.5;"><strong>Auto-healing ao vivo</strong> — veja o Kodo corrigir falhas automaticamente no seu cluster</span>
        </div>
      </div>

      <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.6;">
        Dúvidas? Responda esse email ou escreva para<br />
        <a href="mailto:suporte@kubenetworks.com.br" style="color:#0891b2;">suporte@kubenetworks.com.br</a>
      </p>
    </div>

    <div style="margin-top:28px;text-align:center;">
      <p style="color:#cbd5e1;font-size:12px;margin:0;line-height:1.6;">
        Kodo · KubeNetworks · São Paulo, SP — Brasil<br />
        <a href="${SITE_URL}/privacy" style="color:#94a3b8;text-decoration:none;">Política de Privacidade</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

interface InternalNotificationParams {
  email: string;
  company?: string;
  cluster_size?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ab_variant?: string;
  submittedAt: string;
}

function buildInternalNotification(p: InternalNotificationParams): string {
  const row = (label: string, value: string) =>
    value
      ? `<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;white-space:nowrap;border-bottom:1px solid #f1f5f9;">${label}</td><td style="padding:8px 12px;font-size:13px;color:#0f172a;font-weight:500;border-bottom:1px solid #f1f5f9;">${value}</td></tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Novo lead — Kodo</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:24px;font-weight:900;letter-spacing:-0.02em;color:#0f172a;">Kodo</span>
      <span style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-top:4px;">Novo lead recebido</span>
    </div>

    <div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:2px solid #0891b2;background:linear-gradient(135deg,#ecfeff,#eef2ff);">
        <h2 style="margin:0;font-size:18px;font-weight:800;color:#0f172a;">${p.company || p.email}</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;">${p.email}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${row('Empresa', p.company || '—')}
          ${row('Email', p.email)}
          ${row('Cluster size', p.cluster_size ? `${p.cluster_size} nós` : '—')}
          ${row('UTM source', p.utm_source || '—')}
          ${row('UTM medium', p.utm_medium || '—')}
          ${row('UTM campaign', p.utm_campaign || '—')}
          ${row('Variante A/B', p.ab_variant || '—')}
          ${row('Enviado em', p.submittedAt)}
        </tbody>
      </table>

      <div style="padding:16px 24px;">
        <a href="${SITE_URL}/admin" style="display:inline-block;padding:10px 20px;background:linear-gradient(135deg,#0891b2,#4f46e5);color:#fff;font-weight:600;font-size:13px;text-decoration:none;border-radius:8px;">
          Ver leads no painel
        </a>
      </div>
    </div>

  </div>
</body>
</html>`;
}
