import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'Kodo <noreply@kubenetworks.com.br>';
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
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [normalizedEmail],
          subject: 'Seu diagnóstico Kubernetes gratuito — Kodo',
          html: buildWelcomeEmail(company || normalizedEmail),
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error('Resend error:', res.status, body);
        // Não falha o fluxo — lead já foi salvo
      }
    } else {
      console.warn('RESEND_API_KEY não configurado — email não enviado');
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

function buildWelcomeEmail(name: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Diagnóstico Kubernetes gratuito</title>
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
        Recebemos seu pedido de diagnóstico. Nossa equipe vai analisar seu ambiente Kubernetes e enviar um relatório personalizado em até <strong style="color:#0f172a;">24 horas úteis</strong>.
      </p>

      <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:28px;">
        <p style="margin:0 0 14px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">O que você vai receber</p>
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
          <span style="color:#475569;font-size:14px;line-height:1.5;"><strong>Recomendações de healing</strong> — padrões de falha mais comuns no seu tipo de cluster</span>
        </div>
      </div>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="${SITE_URL}/auth?tab=signup"
          style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#0891b2,#4f46e5);color:#fff;font-weight:600;font-size:15px;text-decoration:none;border-radius:12px;letter-spacing:-0.01em;">
          Criar conta gratuita agora
        </a>
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
