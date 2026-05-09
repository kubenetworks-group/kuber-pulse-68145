#!/usr/bin/env bash
# =============================================================================
# ATAQUES DE AUTENTICAÇÃO E AUTORIZAÇÃO (RBAC)
# Técnicas: MITRE T1078 - Valid Accounts, T1548 - Privilege Escalation
# OWASP K8s Top 10: K01-Insecure Workload Configs, K02-Supply Chain Risks
# =============================================================================

set -euo pipefail

REPORT_DIR="${REPORT_DIR:-/tmp/k8s-pentest-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$REPORT_DIR/authn-authz"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BOLD}[*]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
vuln() { echo -e "${RED}[VULN]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }

echo "============================================================"
echo " K8s Pentest - Fase 2: Autenticação e Autorização (RBAC)"
echo " Data: $(date)"
echo "============================================================"
echo ""

# ------------------------------------------------------------------
# 1. Buscar ClusterRoles com permissões perigosas
# ------------------------------------------------------------------
log "1. ClusterRoles com wildcards (*)"
{
  echo "=== ClusterRoles com verbo '*' (acesso total) ==="
  kubectl get clusterroles -o json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for role in data['items']:
  name = role['metadata']['name']
  for rule in role.get('rules', []):
    verbs = rule.get('verbs', [])
    resources = rule.get('resources', [])
    if '*' in verbs or '*' in resources:
      print(f'  RISCO ALTO: ClusterRole \"{name}\" -> verbs={verbs} resources={resources}')
" 2>/dev/null
} | tee "$REPORT_DIR/authn-authz/wildcard-roles.txt"

# ------------------------------------------------------------------
# 2. Quem tem acesso a secrets?
# ------------------------------------------------------------------
log "2. Quem pode ler secrets?"
{
  echo "=== Bindings que permitem GET em secrets ==="
  kubectl get clusterrolebindings -o json 2>/dev/null | python3 -c "
import json, sys, subprocess

data = json.load(sys.stdin)
for binding in data['items']:
  role_ref = binding.get('roleRef', {}).get('name', '')
  subjects = binding.get('subjects', [])

  # Checar se o ClusterRole referenciado dá acesso a secrets
  try:
    role_json = subprocess.run(
      ['kubectl', 'get', 'clusterrole', role_ref, '-o', 'json'],
      capture_output=True, text=True
    ).stdout
    role = json.loads(role_json)
    for rule in role.get('rules', []):
      if ('secrets' in rule.get('resources', []) or '*' in rule.get('resources', [])) and \
         any(v in rule.get('verbs', []) for v in ['get', 'list', '*']):
        for s in subjects:
          print(f'  RISCO: {s[\"kind\"]} \"{s.get(\"name\",\"?\")}\" (ns:{s.get(\"namespace\",\"cluster\")}) -> pode LER secrets via role \"{role_ref}\"')
  except:
    pass
" 2>/dev/null || echo "  (requer permissão para listar clusterrolebindings)"
} | tee "$REPORT_DIR/authn-authz/secret-access.txt"

# ------------------------------------------------------------------
# 3. Privilege Escalation via RBAC (bind/escalate)
# ------------------------------------------------------------------
log "3. Quem pode criar/modificar RBAC? (privilege escalation)"
{
  DANGEROUS_RBAC=(
    "create clusterrolebindings"
    "create rolebindings"
    "bind clusterroles"
    "escalate clusterroles"
    "create clusterroles"
    "patch clusterroles"
    "update clusterroles"
    "impersonate users"
    "impersonate serviceaccounts"
  )
  for check in "${DANGEROUS_RBAC[@]}"; do
    verb=$(echo "$check" | awk '{print $1}')
    resource=$(echo "$check" | awk '{print $2}')
    result=$(kubectl auth can-i "$verb" "$resource" --all-namespaces 2>/dev/null)
    if [[ "$result" == "yes" ]]; then
      vuln "POSSO escalar privilégios via: $check"
    fi
  done
} | tee "$REPORT_DIR/authn-authz/privilege-escalation.txt"

# ------------------------------------------------------------------
# 4. ServiceAccounts com tokens montados automaticamente
# ------------------------------------------------------------------
log "4. Pods com automountServiceAccountToken=true (padrão)"
{
  echo "=== Pods sem automountServiceAccountToken=false ==="
  kubectl get pods -A -o json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
count = 0
for item in data['items']:
  spec = item.get('spec', {})
  if spec.get('automountServiceAccountToken', True):  # true é o padrão inseguro
    ns = item['metadata']['namespace']
    name = item['metadata']['name']
    sa = spec.get('serviceAccountName', 'default')
    print(f'  {ns}/{name} (sa: {sa}) -> token montado automaticamente')
    count += 1
print(f'Total: {count} pods com token de SA montado')
" 2>/dev/null
} | tee "$REPORT_DIR/authn-authz/sa-tokens.txt"

# ------------------------------------------------------------------
# 5. Tentar acessar a API do cluster via token de SA interno
# ------------------------------------------------------------------
log "5. Verificar acesso ao API Server via token de SA"
{
  SA_TOKEN_PATH="/var/run/secrets/kubernetes.io/serviceaccount/token"
  if [[ -f "$SA_TOKEN_PATH" ]]; then
    TOKEN=$(cat "$SA_TOKEN_PATH")
    API_SERVER="https://kubernetes.default.svc"
    CA="/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
    echo "Token encontrado! Tentando enumerar via API..."
    curl -s --cacert "$CA" -H "Authorization: Bearer $TOKEN" \
      "$API_SERVER/api/v1/namespaces" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
ns=[i['metadata']['name'] for i in d.get('items',[])]
print('Namespaces acessíveis:', ns)
" 2>/dev/null
  else
    warn "Token de SA não encontrado (não estamos dentro de um pod)"
    echo "Para testar DENTRO de um pod, execute:"
    echo "  kubectl run -it --rm pentest --image=curlimages/curl --restart=Never -- sh"
  fi
} | tee "$REPORT_DIR/authn-authz/sa-api-access.txt"

# ------------------------------------------------------------------
# 6. Anonymous access no API Server
# ------------------------------------------------------------------
log "6. Verificar acesso anônimo ao API Server"
{
  API_ENDPOINT=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null)
  if [[ -n "$API_ENDPOINT" ]]; then
    echo "Testando acesso anônimo em: $API_ENDPOINT"
    HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "$API_ENDPOINT/api/v1/namespaces" 2>/dev/null)
    if [[ "$HTTP_CODE" == "200" ]]; then
      vuln "API Server permite acesso anônimo! (HTTP $HTTP_CODE)"
    elif [[ "$HTTP_CODE" == "403" ]]; then
      warn "Anônimo recebe 403 (RBAC ativo, mas endpoint acessível sem autenticação)"
    else
      ok "Acesso anônimo bloqueado (HTTP $HTTP_CODE)"
    fi

    echo ""
    echo "Testando endpoint /version (sempre público):"
    curl -sk "$API_ENDPOINT/version" 2>/dev/null | python3 -m json.tool 2>/dev/null || true

    echo ""
    echo "Testando /healthz (pode expor infos):"
    curl -sk "$API_ENDPOINT/healthz" 2>/dev/null || true
  fi
} | tee "$REPORT_DIR/authn-authz/anonymous-access.txt"

# ------------------------------------------------------------------
# 7. Namespace default - isolamento de RBAC
# ------------------------------------------------------------------
log "7. Permissões no namespace 'default'"
{
  echo "=== RoleBindings no namespace default ==="
  kubectl get rolebindings -n default -o wide 2>/dev/null

  echo ""
  echo "=== Verificar se 'system:unauthenticated' tem permissões ==="
  kubectl get clusterrolebindings -o json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
for b in data['items']:
  for s in b.get('subjects',[]):
    name = s.get('name','')
    if 'unauthenticated' in name or 'anonymous' in name:
      print(f'  RISCO: binding \"{b[\"metadata\"][\"name\"]}\" inclui \"{name}\"')
" 2>/dev/null
} | tee "$REPORT_DIR/authn-authz/default-ns-rbac.txt"

echo ""
echo "============================================================"
echo " Análise de RBAC concluída!"
echo " Relatório: $REPORT_DIR/authn-authz/"
echo "============================================================"
