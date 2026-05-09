#!/usr/bin/env bash
# =============================================================================
# ATAQUES NA SUPPLY CHAIN - IMAGENS E ARTEFATOS
# Técnicas: MITRE T1195 - Supply Chain Compromise, T1525 - Implant Container Image
# OWASP K8s: K02-Supply Chain Vulnerabilities, K10-Outdated and Vulnerable Components
# =============================================================================

set -euo pipefail

REPORT_DIR="${REPORT_DIR:-/tmp/k8s-pentest-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$REPORT_DIR/supply-chain"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BOLD}[*]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
vuln() { echo -e "${RED}[VULN]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }

echo "============================================================"
echo " K8s Pentest - Fase 7: Supply Chain"
echo " Data: $(date)"
echo "============================================================"
echo ""

# ------------------------------------------------------------------
# 1. Inventário de imagens em uso
# ------------------------------------------------------------------
log "1. Inventário de imagens no cluster"
{
  echo "=== Todas as imagens em uso (pods running) ==="
  kubectl get pods -A -o json 2>/dev/null | python3 -c "
import json, sys
from collections import defaultdict
data = json.load(sys.stdin)
images = defaultdict(set)
for item in data['items']:
  ns = item['metadata']['namespace']
  for c in item.get('spec',{}).get('containers',[]) + item.get('spec',{}).get('initContainers',[]):
    img = c.get('image','')
    if img:
      images[img].add(ns)

print(f'Total de imagens únicas: {len(images)}')
print()
for img, namespaces in sorted(images.items()):
  ns_str = ', '.join(sorted(namespaces))
  # Alertar para imagens sem digest SHA
  if '@sha256:' not in img:
    marker = '  [SEM DIGEST]'
  else:
    marker = ''
  print(f'  {img}{marker}')
  print(f'    namespaces: {ns_str}')
" 2>/dev/null
} | tee "$REPORT_DIR/supply-chain/image-inventory.txt"

# ------------------------------------------------------------------
# 2. Imagens de registries não confiáveis
# ------------------------------------------------------------------
log "2. Imagens de registries públicos/não confiáveis"
{
  TRUSTED_REGISTRIES=(
    "gcr.io"
    "registry.k8s.io"
    "k8s.gcr.io"
    "quay.io/openshift"
    "mcr.microsoft.com"
    "amazonaws.com"
    "azurecr.io"
    "pkg.dev"
  )

  echo "=== Imagens de Docker Hub (docker.io) ou sem registry explícito ==="
  kubectl get pods -A -o json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
dockerhub_images = set()
no_registry = set()
for item in data['items']:
  ns = item['metadata']['namespace']
  for c in item.get('spec',{}).get('containers',[]):
    img = c.get('image','')
    if img:
      if '/' not in img.split(':')[0] or not img.split('/')[0].count('.'):
        no_registry.add(img)  # ex: 'nginx', 'ubuntu'
      elif img.startswith('docker.io/'):
        dockerhub_images.add(img)

if no_registry:
  print('  Imagens sem registry explícito (Docker Hub implícito):')
  for img in sorted(no_registry):
    print(f'    {img}')
if dockerhub_images:
  print('  Imagens Docker Hub explícitas:')
  for img in sorted(dockerhub_images):
    print(f'    {img}')
" 2>/dev/null

  echo ""
  echo "=== Verificar se há ImagePolicyWebhook ativo ==="
  kubectl get validatingwebhookconfigurations 2>/dev/null | grep -i "image\|policy\|admission" || echo "Nenhum image policy webhook encontrado"
} | tee "$REPORT_DIR/supply-chain/untrusted-images.txt"

# ------------------------------------------------------------------
# 3. Scan de vulnerabilidades com Trivy (se disponível)
# ------------------------------------------------------------------
log "3. Scan de vulnerabilidades nas imagens (Trivy)"
{
  if command -v trivy &>/dev/null; then
    ok "Trivy disponível! Escaneando imagens críticas..."

    # Pegar as 5 primeiras imagens únicas do cluster para scan
    IMAGES=$(kubectl get pods -A -o jsonpath='{range .items[*]}{range .spec.containers[*]}{.image}{"\n"}{end}{end}' 2>/dev/null | sort -u | head -5)

    for img in $IMAGES; do
      echo ""
      echo "--- Scanning: $img ---"
      trivy image --severity HIGH,CRITICAL --no-progress "$img" 2>/dev/null | tail -30 || true
    done
  else
    warn "Trivy não instalado. Para instalar: brew install trivy"
    echo ""
    echo "Comando para scan manual:"
    echo "  trivy image --severity HIGH,CRITICAL <imagem>"
    echo ""
    echo "Para escanear todas as imagens do cluster:"
    echo "  kubectl get pods -A -o jsonpath='{range .items[*]}{range .spec.containers[*]}{.image}{\"\n\"}{end}{end}' | sort -u | while read img; do trivy image \"\$img\"; done"
  fi
} | tee "$REPORT_DIR/supply-chain/trivy-scan.txt"

# ------------------------------------------------------------------
# 4. Verificar Helm releases com charts desatualizados
# ------------------------------------------------------------------
log "4. Helm releases no cluster"
{
  if command -v helm &>/dev/null; then
    echo "=== Helm releases (todos os namespaces) ==="
    helm list -A 2>/dev/null

    echo ""
    echo "=== Verificar releases com status diferente de deployed ==="
    helm list -A --all 2>/dev/null | awk 'NR>1 && $8 != "deployed" {print "  ATENCAO:", $0}' || true

    echo ""
    echo "Para verificar charts desatualizados:"
    echo "  helm repo update && helm list -A -o json | jq '.[] | select(.chart) | .name + \": \" + .chart'"
  else
    warn "Helm não instalado"
    echo ""
    echo "Verificando releases via secrets do tipo 'helm.sh/release.v1'..."
    kubectl get secrets -A -o json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
count=0
for s in data['items']:
  if s.get('type','') == 'helm.sh/release.v1':
    ns=s['metadata']['namespace']
    name=s['metadata']['name']
    print(f'  {ns}/{name}')
    count+=1
print(f'Total de releases Helm: {count}')
" 2>/dev/null
  fi
} | tee "$REPORT_DIR/supply-chain/helm-releases.txt"

# ------------------------------------------------------------------
# 5. Verificar se admission webhooks podem ser bypassados
# ------------------------------------------------------------------
log "5. Análise de Admission Webhooks (bypass opportunities)"
{
  echo "=== Namespaces excluídos dos webhooks (webhook bypass) ==="
  kubectl get validatingwebhookconfigurations -o json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
for wh in data.get('items',[]):
  name=wh['metadata']['name']
  for hook in wh.get('webhooks',[]):
    ns_sel = hook.get('namespaceSelector',{})
    match_expr = ns_sel.get('matchExpressions',[])
    match_labels = ns_sel.get('matchLabels',{})

    # Webhooks que excluem kube-system ou tem namespaceSelector vazio
    if not ns_sel:
      print(f'  [{name}] webhook \"{hook[\"name\"]}\" sem namespaceSelector -> aplica a TODOS namespaces')
    for expr in match_expr:
      if expr.get('operator') == 'NotIn':
        print(f'  [{name}] exclui namespaces com label {expr[\"key\"]}={expr.get(\"values\")}')
" 2>/dev/null || echo "Nenhum ValidatingWebhookConfiguration acessível"

  echo ""
  echo "=== Falha aberta (failurePolicy: Ignore) ==="
  kubectl get validatingwebhookconfigurations -o json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
for wh in data.get('items',[]):
  for hook in wh.get('webhooks',[]):
    if hook.get('failurePolicy','Fail') == 'Ignore':
      print(f'  RISCO: webhook \"{hook[\"name\"]}\" tem failurePolicy=Ignore')
      print(f'    (se o webhook falhar/timeout, o request é APROVADO)')
" 2>/dev/null || true
} | tee "$REPORT_DIR/supply-chain/webhook-bypass.txt"

# ------------------------------------------------------------------
# 6. Kubescape - scan de compliance (se disponível)
# ------------------------------------------------------------------
log "6. Kubescape compliance scan"
{
  if command -v kubescape &>/dev/null; then
    ok "Kubescape disponível! Executando scan NSA/MITRE..."
    kubescape scan framework nsa,mitre --format pretty-printer 2>/dev/null | tail -50
  else
    warn "Kubescape não instalado."
    echo "Para instalar: curl -s https://raw.githubusercontent.com/kubescape/kubescape/master/install.sh | /bin/bash"
    echo "Para escanear: kubescape scan framework nsa,mitre"
  fi
} | tee "$REPORT_DIR/supply-chain/kubescape.txt"

echo ""
echo "============================================================"
echo " Análise de Supply Chain concluída!"
echo " Relatório: $REPORT_DIR/supply-chain/"
echo "============================================================"
