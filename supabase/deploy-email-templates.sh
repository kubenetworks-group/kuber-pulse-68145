#!/usr/bin/env bash
# deploy-email-templates.sh
# Applies branded Kodo email templates to the Supabase Auth service.
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=<your_token>   # from supabase.com/dashboard/account/tokens
#   ./supabase/deploy-email-templates.sh
#
# Or pass as argument:
#   ./supabase/deploy-email-templates.sh <access_token>

set -euo pipefail

PROJECT_REF="jnkdbmyrfihfwfyvlmsp"
TEMPLATES_DIR="$(dirname "$0")/email-templates"
TOKEN="${SUPABASE_ACCESS_TOKEN:-${1:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "❌  SUPABASE_ACCESS_TOKEN não definido."
  echo "    Obtenha em: https://supabase.com/dashboard/account/tokens"
  echo "    Uso: SUPABASE_ACCESS_TOKEN=seu_token ./supabase/deploy-email-templates.sh"
  exit 1
fi

# Read HTML file and escape for JSON
read_html() {
  python3 -c "
import sys, json
with open(sys.argv[1]) as f:
    print(json.dumps(f.read()))
" "$1"
}

echo "📧  Lendo templates..."

RESET_HTML=$(read_html "$TEMPLATES_DIR/reset-password.html")
CONFIRM_HTML=$(read_html "$TEMPLATES_DIR/confirmation.html")
MAGIC_HTML=$(read_html "$TEMPLATES_DIR/magic-link.html")
INVITE_HTML=$(read_html "$TEMPLATES_DIR/invite.html")
CHANGE_HTML=$(read_html "$TEMPLATES_DIR/email-change.html")

echo "🚀  Aplicando templates no projeto $PROJECT_REF..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"mailer_subjects_recovery\": \"Redefinir sua senha — Kodo\",
    \"mailer_subjects_confirmation\": \"Confirme seu email — Kodo\",
    \"mailer_subjects_magic_link\": \"Seu link de acesso ao Kodo\",
    \"mailer_subjects_invite\": \"Seu convite para o Kodo está pronto 🚀\",
    \"mailer_subjects_email_change\": \"Confirme seu novo email — Kodo\",
    \"mailer_templates_recovery_content\": $RESET_HTML,
    \"mailer_templates_confirmation_content\": $CONFIRM_HTML,
    \"mailer_templates_magic_link_content\": $MAGIC_HTML,
    \"mailer_templates_invite_content\": $INVITE_HTML,
    \"mailer_templates_email_change_content\": $CHANGE_HTML,
    \"smtp_admin_email\": \"noreply@kubenetworks.com.br\",
    \"smtp_sender_name\": \"Kodo by KubeNetworks\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "✅  Templates aplicados com sucesso!"
  echo ""
  echo "Templates configurados:"
  echo "  ✉️  Confirmação de cadastro"
  echo "  🔐  Redefinição de senha"
  echo "  ⚡  Magic link"
  echo "  🎉  Convite de usuário"
  echo "  📧  Troca de email"
else
  echo "❌  Erro ao aplicar templates (HTTP $HTTP_CODE):"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  exit 1
fi
