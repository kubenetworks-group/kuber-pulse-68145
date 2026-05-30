import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'Kodo by KubeNetworks <noreply@kubenetworks.com.br>';
const SITE_URL = 'https://kodo.kubenetworks.com.br';
const INVITE_REDIRECT = `${SITE_URL}/onboarding`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // verify_jwt=false requires passing the token explicitly to getUser()
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    // Check admin via user_roles table (same logic as has_role RPC)
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    console.log(`Caller ${user.email} is admin: ${!!roleRow}`);
    if (!roleRow) return json({ error: 'Forbidden — admin role required' }, 403);

    const { lead_id, email: emailParam } = await req.json();

    let lead: { email: string; company: string | null } | null = null;

    if (lead_id) {
      const { data } = await admin.from('leads').select('email, company').eq('id', lead_id).single();
      lead = data;
    } else if (emailParam) {
      const normalizedEmail = emailParam.toLowerCase().trim();
      const { data } = await admin.from('leads').select('email, company').eq('email', normalizedEmail).maybeSingle();
      lead = data ?? { email: normalizedEmail, company: null };
    }

    if (!lead?.email) return json({ error: 'Lead not found' }, 404);

    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY not configured' }, 500);

    // Try to generate an invite link (for new users not yet in auth.users).
    // Falls back to magiclink if user already exists, then to the signup URL.
    let actionLink = `${SITE_URL}/auth?tab=signup&redirect=/register`;
    const { data: inviteData, error: inviteError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: lead.email,
      options: { redirectTo: INVITE_REDIRECT },
    });

    if (inviteError) {
      console.warn(`invite link failed (${inviteError.message}), trying magiclink…`);
      const { data: magicData, error: magicError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: lead.email,
        options: { redirectTo: INVITE_REDIRECT },
      });
      if (magicError) {
        console.warn(`magiclink also failed (${magicError.message}), using signup URL`);
      } else {
        actionLink = magicData.properties?.action_link ?? actionLink;
      }
    } else {
      actionLink = inviteData.properties?.action_link ?? actionLink;
    }
    console.log(`Action link for ${lead.email}: ${actionLink.substring(0, 60)}…`);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [lead.email],
        subject: 'Seu convite para o Kodo está pronto 🚀',
        html: buildInviteEmail(lead.company ?? lead.email, actionLink),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Resend error:', res.status, body);
      return json({ error: `Resend error ${res.status}: ${body}` }, 502);
    }

    console.log(`✅ Invite sent to ${lead.email}`);
    return json({ success: true, email: lead.email });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('invite-lead error:', message);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildInviteEmail(name: string, link: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu convite para o Kodo</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#0f172a;">
  <div style="max-width:600px;margin:0 auto;padding:48px 20px;">

    <div style="text-align:center;margin-bottom:40px;">
      <span style="font-size:28px;font-weight:900;letter-spacing:-0.03em;color:#ffffff;">Kodo</span>
      <span style="display:block;font-size:11px;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;color:#475569;margin-top:4px;">by KubeNetworks</span>
    </div>

    <div style="background:linear-gradient(135deg,#0891b2 0%,#4f46e5 100%);border-radius:20px;padding:2px;margin-bottom:24px;">
      <div style="background:#1e293b;border-radius:18px;padding:40px 36px;text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">🎉</div>
        <h1 style="margin:0 0 12px;font-size:26px;font-weight:900;color:#f8fafc;letter-spacing:-0.02em;line-height:1.2;">
          Seu acesso está liberado,<br />${name}!
        </h1>
        <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.65;">
          Clique no botão abaixo para entrar no Kodo — sem precisar criar senha.
        </p>
      </div>
    </div>

    <div style="background:#1e293b;border-radius:16px;padding:36px;margin-bottom:24px;border:1px solid #334155;">
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${link}"
          style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#0891b2,#4f46e5);color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;border-radius:12px;letter-spacing:-0.01em;box-shadow:0 8px 32px rgba(8,145,178,0.35);">
          Acessar o Kodo →
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#475569;text-align:center;line-height:1.7;">
        Este link é válido por <strong style="color:#64748b;">1 hora</strong> e de uso único.<br />
        Se você não solicitou acesso, pode ignorar este email.
      </p>
    </div>

    <div style="background:#1e293b;border-radius:16px;padding:28px 36px;margin-bottom:24px;border:1px solid #334155;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#475569;">O que você vai encontrar</p>
      <div style="display:flex;gap:12px;margin-bottom:14px;">
        <span style="font-size:18px;flex-shrink:0;">🤖</span>
        <div><p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#f1f5f9;">Auto-healing com IA</p><p style="margin:0;font-size:13px;color:#64748b;">Detecta e corrige falhas automaticamente no seu cluster</p></div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:14px;">
        <span style="font-size:18px;flex-shrink:0;">💰</span>
        <div><p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#f1f5f9;">FinOps em tempo real</p><p style="margin:0;font-size:13px;color:#64748b;">Identifica recursos subutilizados e economia mensal</p></div>
      </div>
      <div style="display:flex;gap:12px;">
        <span style="font-size:18px;flex-shrink:0;">🔒</span>
        <div><p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#f1f5f9;">Mapa de segurança</p><p style="margin:0;font-size:13px;color:#64748b;">Audita RBAC, Network Policies e Pod Security Standards</p></div>
      </div>
    </div>

    <div style="text-align:center;padding:0 20px;">
      <p style="color:#334155;font-size:13px;margin:0 0 8px;line-height:1.6;">
        Dúvidas? Fale com a gente em<br />
        <a href="mailto:suporte@kubenetworks.com.br" style="color:#0891b2;text-decoration:none;">suporte@kubenetworks.com.br</a>
      </p>
      <p style="color:#1e293b;font-size:11px;margin:16px 0 0;">
        Kodo · KubeNetworks · São Paulo, SP — Brasil
      </p>
    </div>

  </div>
</body>
</html>`;
}
