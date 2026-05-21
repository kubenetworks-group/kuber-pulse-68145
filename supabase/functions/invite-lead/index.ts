import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'Kodo by KubeNetworks <noreply@kubenetworks.com.br>';
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

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, company } = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Email inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signupUrl = `${SITE_URL}/auth?tab=signup`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email.toLowerCase().trim()],
        subject: 'Seu acesso ao Kodo está liberado! 🎉',
        html: buildInvitationEmail(company || email, signupUrl),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Resend error:', res.status, body);
      return new Response(JSON.stringify({ error: `Resend error: ${res.status}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update the lead record with invited_at timestamp
    await supabase
      .from('leads')
      .update({ updated_at: new Date().toISOString() })
      .eq('email', email.toLowerCase().trim());

    console.log(`✅ Invitation sent to ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('invite-lead error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildInvitationEmail(name: string, signupUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu acesso ao Kodo está liberado</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#0f172a;">

  <div style="max-width:600px;margin:0 auto;padding:48px 20px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:40px;">
      <span style="font-size:28px;font-weight:900;letter-spacing:-0.03em;color:#ffffff;">Kodo</span>
      <span style="display:block;font-size:11px;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;color:#475569;margin-top:4px;">by KubeNetworks</span>
    </div>

    <!-- Hero card -->
    <div style="background:linear-gradient(135deg,#0891b2 0%,#4f46e5 100%);border-radius:20px;padding:2px;margin-bottom:24px;">
      <div style="background:#1e293b;border-radius:18px;padding:40px 36px;text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">🎉</div>
        <h1 style="margin:0 0 12px;font-size:26px;font-weight:900;color:#f8fafc;letter-spacing:-0.02em;line-height:1.2;">
          Seu acesso está liberado,<br />${name}!
        </h1>
        <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.65;">
          A nossa equipe analisou sua solicitação e você já pode criar sua conta no Kodo e conectar seu cluster Kubernetes.
        </p>
      </div>
    </div>

    <!-- Main card -->
    <div style="background:#1e293b;border-radius:16px;padding:36px;margin-bottom:24px;border:1px solid #334155;">

      <p style="margin:0 0 28px;font-size:15px;color:#cbd5e1;line-height:1.65;">
        Em poucos minutos você terá visibilidade total do seu cluster: custos, segurança, pods com falha, e a IA do Kodo trabalhando automaticamente para manter tudo saudável.
      </p>

      <!-- Feature list -->
      <div style="margin-bottom:32px;">
        ${featureRow('🤖', 'Auto-healing com IA', 'Detecta e corrige CrashLoopBackOff, OOMKilled e falhas de probe automaticamente')}
        ${featureRow('💰', 'FinOps em tempo real', 'Identifica recursos subutilizados e estima economia mensal por cluster')}
        ${featureRow('🔒', 'Mapa de segurança', 'Audita RBAC, Network Policies e Pod Security Standards continuamente')}
        ${featureRow('📊', 'Observabilidade unificada', 'Métricas de CPU, memória, pods, nodes e PVCs num único painel')}
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;">
        <a href="${signupUrl}"
          style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#0891b2,#4f46e5);color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;border-radius:12px;letter-spacing:-0.01em;box-shadow:0 8px 32px rgba(8,145,178,0.35);">
          Criar minha conta agora →
        </a>
        <p style="margin:14px 0 0;font-size:12px;color:#475569;">
          Setup em menos de 5 minutos · Sem cartão de crédito
        </p>
      </div>
    </div>

    <!-- Steps card -->
    <div style="background:#1e293b;border-radius:16px;padding:28px 36px;margin-bottom:24px;border:1px solid #334155;">
      <p style="margin:0 0 20px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#475569;">
        Como começar
      </p>
      ${stepRow('1', 'Crie sua conta', 'Clique no botão acima e preencha seu e-mail e senha')}
      ${stepRow('2', 'Instale o agente', 'Um único comando kubectl no seu cluster — leva menos de 1 minuto')}
      ${stepRow('3', 'Veja a mágica', 'O Kodo já começa a monitorar e corrigir falhas automaticamente')}
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:0 20px;">
      <p style="color:#334155;font-size:13px;margin:0 0 8px;line-height:1.6;">
        Dúvidas? Responda esse e-mail ou fale com a gente em<br />
        <a href="mailto:suporte@kubenetworks.com.br" style="color:#0891b2;text-decoration:none;">suporte@kubenetworks.com.br</a>
      </p>
      <p style="color:#1e293b;font-size:11px;margin:16px 0 0;line-height:1.6;">
        Kodo · KubeNetworks · São Paulo, SP — Brasil<br />
        <a href="${SITE_URL}/privacy" style="color:#334155;text-decoration:none;">Política de Privacidade</a>
        &nbsp;·&nbsp;
        <a href="${SITE_URL}/terms" style="color:#334155;text-decoration:none;">Termos de Uso</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function featureRow(icon: string, title: string, desc: string): string {
  return `
    <div style="display:flex;gap:14px;margin-bottom:18px;align-items:flex-start;">
      <div style="flex-shrink:0;width:36px;height:36px;border-radius:10px;background:#0f172a;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:36px;text-align:center;">${icon}</div>
      <div>
        <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#f1f5f9;">${title}</p>
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">${desc}</p>
      </div>
    </div>`;
}

function stepRow(num: string, title: string, desc: string): string {
  return `
    <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start;">
      <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#0891b2,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;text-align:center;line-height:28px;">${num}</div>
      <div>
        <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#f1f5f9;">${title}</p>
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">${desc}</p>
      </div>
    </div>`;
}
