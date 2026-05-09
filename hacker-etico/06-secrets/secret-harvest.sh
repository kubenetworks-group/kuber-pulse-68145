#!/usr/bin/env bash
# =============================================================================
# EXFILTRAÇÃO DE SECRETS E CREDENCIAIS
# Técnicas: MITRE T1552 - Unsecured Credentials, T1528 - Steal Application Token
# OWASP K8s: K08-Secrets Management Failures
# =============================================================================

set -euo pipefail

REPORT_DIR="${REPORT_DIR:-/tmp/k8s-pentest-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$REPORT_DIR/secrets"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BOLD}[*]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
vuln() { echo -e "${RED}[VULN]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }

echo "============================================================"
echo " K8s Pentest - Fase 6: Secrets e Credenciais"
echo " Data: $(date)"
echo "============================================================"
echo ""

# ------------------------------------------------------------------
# 1. Listar todos os secrets e seus tipos
# ------------------------------------------------------------------
log "1. Inventário de secrets"
{
  echo "=== Secrets por tipo ==="
  kubectl get secrets -A -o json 2>/dev/null | python3 -c "
import json, sys
from collections import defaultdict
data = json.load(sys.stdin)
types = defaultdict(list)
for s in data['items']:
  ns   = s['metadata']['namespace']
  name = s['metadata']['name']
  stype = s.get('type', 'Opaque')
  types[stype].append(f'{ns}/{name}')

for stype, items in sorted(types.items()):
  print(f'  [{stype}] ({len(items)} secrets)')
  for item in items[:10]:  # Limitar para não poluir output
    print(f'    - {item}')
  if len(items) > 10:
    print(f'    ... e mais {len(items)-10}')
" 2>/dev/null
} | tee "$REPORT_DIR/secrets/secrets-inventory.txt"

# ------------------------------------------------------------------
# 2. Extrair dados de secrets acessíveis
# ------------------------------------------------------------------
log "2. Tentando ler conteúdo de secrets"
{
  if kubectl auth can-i get secrets --all-namespaces 2>/dev/null | grep -q "yes"; then
    vuln "POSSO LER TODOS OS SECRETS DO CLUSTER!"
    echo ""

    # Buscar secrets com palavras-chave suspeitas
    SUSPICIOUS_PATTERNS="password|passwd|secret|token|key|credential|api.key|auth|bearer|jwt|private"

    echo "=== Secrets com dados sensíveis (chaves suspeitas) ==="
    kubectl get secrets -A -o json 2>/dev/null | python3 -c "
import json, sys, base64, re

PATTERNS = re.compile(r'password|passwd|secret|token|key|credential|api|auth|bearer|jwt|private', re.I)
data = json.load(sys.stdin)

findings = 0
for s in data['items']:
  ns   = s['metadata']['namespace']
  name = s['metadata']['name']
  stype = s.get('type','')

  # Pular service account tokens padrão (muito barulho)
  if stype == 'kubernetes.io/service-account-token' and 'default' in name:
    continue

  secrets_data = s.get('data', {})
  for key, val_b64 in secrets_data.items():
    if PATTERNS.search(key):
      try:
        decoded = base64.b64decode(val_b64).decode('utf-8', errors='replace')
        # Mascarar metade do valor por segurança no relatório
        masked = decoded[:8] + '...' + decoded[-4:] if len(decoded) > 12 else '***'
        print(f'  {ns}/{name} -> {key}: {masked} (len={len(decoded)})')
        findings += 1
      except:
        pass

print(f'Total de campos suspeitos encontrados: {findings}')
" 2>/dev/null
  else
    ok "Sem permissão para ler secrets diretamente"

    echo "Verificando acesso por namespace..."
    for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
      result=$(kubectl auth can-i get secrets -n "$ns" 2>/dev/null)
      if [[ "$result" == "yes" ]]; then
        warn "POSSO ler secrets no namespace: $ns"
      fi
    done
  fi
} | tee "$REPORT_DIR/secrets/secret-contents.txt"

# ------------------------------------------------------------------
# 3. Secrets em variáveis de ambiente dos pods
# ------------------------------------------------------------------
log "3. Secrets expostos como env vars nos pods"
{
  echo "=== Containers com secretKeyRef em env vars ==="
  kubectl get pods -A -o json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data['items']:
  ns   = item['metadata']['namespace']
  name = item['metadata']['name']
  for c in item.get('spec',{}).get('containers',[]):
    for env in c.get('env', []):
      vf = env.get('valueFrom', {})
      if 'secretKeyRef' in vf:
        ref = vf['secretKeyRef']
        print(f'  {ns}/{name} -> env \"{env[\"name\"]}\" = secret \"{ref[\"name\"]}\"[{ref[\"key\"]}]')
    for ef in c.get('envFrom', []):
      if 'secretRef' in ef:
        print(f'  {ns}/{name} -> envFrom secret \"{ef[\"secretRef\"][\"name\"]}\"')
" 2>/dev/null
} | tee "$REPORT_DIR/secrets/env-secrets.txt"

# ------------------------------------------------------------------
# 4. Credenciais de Docker Registry (imagePullSecrets)
# ------------------------------------------------------------------
log "4. Docker registry credentials (imagePullSecrets)"
{
  echo "=== imagePullSecrets referenciados ==="
  kubectl get pods -A -o json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
seen = set()
for item in data['items']:
  for ips in item.get('spec',{}).get('imagePullSecrets',[]):
    key = (item['metadata']['namespace'], ips.get('name',''))
    if key not in seen:
      seen.add(key)
      print(f'  ns={key[0]} secret={key[1]}')
" 2>/dev/null

  echo ""
  echo "=== Tentando ler secrets do tipo kubernetes.io/dockerconfigjson ==="
  kubectl get secrets -A -o json 2>/dev/null | python3 -c "
import json, sys, base64
data = json.load(sys.stdin)
for s in data['items']:
  if s.get('type') in ['kubernetes.io/dockerconfigjson', 'kubernetes.io/dockercfg']:
    ns   = s['metadata']['namespace']
    name = s['metadata']['name']
    raw  = s.get('data',{}).get('.dockerconfigjson') or s.get('data',{}).get('.dockercfg','')
    if raw:
      try:
        decoded = base64.b64decode(raw).decode()
        cfg = json.loads(decoded)
        auths = cfg.get('auths', cfg)  # dockercfg usa formato diferente
        for registry, creds in auths.items():
          user = creds.get('username','?')
          print(f'  REGISTRY CRED: {ns}/{name} -> {registry} (user: {user})')
      except:
        print(f'  {ns}/{name} -> erro ao decodificar')
" 2>/dev/null
} | tee "$REPORT_DIR/secrets/registry-creds.txt"

# ------------------------------------------------------------------
# 5. TLS certificates expostos
# ------------------------------------------------------------------
log "5. Certificados TLS (secrets tipo kubernetes.io/tls)"
{
  kubectl get secrets -A -o json 2>/dev/null | python3 -c "
import json, sys, base64, subprocess, tempfile, os
data = json.load(sys.stdin)
for s in data['items']:
  if s.get('type') == 'kubernetes.io/tls':
    ns   = s['metadata']['namespace']
    name = s['metadata']['name']
    cert_b64 = s.get('data',{}).get('tls.crt','')
    if cert_b64:
      try:
        cert_pem = base64.b64decode(cert_b64).decode()
        # Escrever em tmp e usar openssl
        with tempfile.NamedTemporaryFile(mode='w', suffix='.crt', delete=False) as f:
          f.write(cert_pem)
          tmp = f.name
        result = subprocess.run(
          ['openssl', 'x509', '-in', tmp, '-noout', '-subject', '-issuer', '-dates'],
          capture_output=True, text=True
        )
        print(f'  [{ns}/{name}]')
        print(result.stdout.strip())
        os.unlink(tmp)
      except:
        print(f'  [{ns}/{name}] -> erro ao processar certificado')
" 2>/dev/null || warn "openssl não disponível ou erro ao processar certs"
} | tee "$REPORT_DIR/secrets/tls-certs.txt"

# ------------------------------------------------------------------
# 6. Secrets em ConfigMaps (má prática comum)
# ------------------------------------------------------------------
log "6. Dados sensíveis em ConfigMaps (antipadrão)"
{
  echo "=== ConfigMaps com dados que parecem credenciais ==="
  kubectl get configmaps -A -o json 2>/dev/null | python3 -c "
import json, sys, re
PATTERNS = re.compile(r'password|passwd|secret|token|api.key|apikey|credential|auth|bearer|private.key', re.I)
data = json.load(sys.stdin)
count = 0
for cm in data['items']:
  ns   = cm['metadata']['namespace']
  name = cm['metadata']['name']
  for key, value in cm.get('data',{}).items():
    if PATTERNS.search(key) or (isinstance(value,str) and PATTERNS.search(value[:100])):
      print(f'  {ns}/{name} -> key \"{key}\" pode conter credencial')
      count += 1
print(f'Total suspeitos: {count}')
" 2>/dev/null
} | tee "$REPORT_DIR/secrets/configmap-secrets.txt"

echo ""
echo "============================================================"
echo " Análise de Secrets concluída!"
echo " Relatório: $REPORT_DIR/secrets/"
echo " IMPORTANTE: Dados sensíveis encontrados devem ser rotacionados!"
echo "============================================================"
