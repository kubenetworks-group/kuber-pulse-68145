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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claims } = await supabaseUser.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const { lead_id, email: emailOverride } = await req.json();

    let lead: { email: string; company: string | null } | null = null;
    if (lead_id) {
      const { data } = await admin
        .from('leads')
        .select('email, company')
        .eq('id', lead_id)
        .single();
      lead = data;
    } else if (emailOverride) {
      const { data } = await admin
        .from('leads')
        .select('email, company')
        .eq('email', emailOverride.toLowerCase().trim())
        .maybeSingle();
      lead = data ?? { email: emailOverride.toLowerCase().trim(), company: null };
    }

    if (!lead?.email) return json({ error: 'Lead not found' }, 404);

    // Generate magic link for signup
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: lead.email,
      options: { redirectTo: `${SITE_URL}/welcome` },
    });

    if (linkError) {
      console.error('generateLink error:', linkError);
      return json({ error: linkError.message }, 500);
    }

    const actionLink = linkData.properties?.action_link ?? `${SITE_URL}/auth?tab=signup`;

    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY not configured' }, 500);
    }

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
      return json({ error: 'Email send failed', detail: body }, 502);
    }

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
<head><meta charset="UTF-8" /><title>Convite Kodo</title></head>
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
        Seu acesso ao Kodo está liberado. Clique no botão abaixo para entrar — sem precisar criar senha.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${link}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#0891b2,#4f46e5);color:#fff;font-weight:600;font-size:15px;text-decoration:none;border-radius:10px;">
          Acessar o Kodo
        </a>
      </div>
      <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
        Este link expira em 1 hora. Se você não solicitou, ignore este email.
      </p>
    </div>
  </div>
</body>
</html>`;
}
