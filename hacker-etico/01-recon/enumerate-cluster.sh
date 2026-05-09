#!/usr/bin/env bash
# =============================================================================
# RECONHECIMENTO E ENUMERAÇÃO DO CLUSTER
# Técnica: MITRE ATT&CK T1613 - Container and Resource Discovery
# =============================================================================

set -euo pipefail

REPORT_DIR="${REPORT_DIR:-/tmp/k8s-pentest-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$REPORT_DIR/recon"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BOLD}[*]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
vuln() { echo -e "${RED}[VULN]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }

echo "============================================================"
echo " K8s Pentest - Fase 1: Reconhecimento e Enumeração"
echo " Data: $(date)"
echo "============================================================"
echo ""

# ------------------------------------------------------------------
# 1. Informações gerais do cluster
# ------------------------------------------------------------------
log "1. Versão e informações do cluster"
kubectl version 2>/dev/null | tee "$REPORT_DIR/recon/cluster-version.txt"

log "2. Nodes do cluster"
kubectl get nodes -o wide 2>/dev/null | tee "$REPORT_DIR/recon/nodes.txt"

log "3. Namespaces existentes"
NAMESPACES=$(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
echo "$NAMESPACES" | tr ' ' '\n' | tee "$REPORT_DIR/recon/namespaces.txt"

# ------------------------------------------------------------------
# 2. Enumeração de workloads
# ------------------------------------------------------------------
log "4. Todos os pods (todos os namespaces)"
kubectl get pods -A -o wide 2>/dev/null | tee "$REPORT_DIR/recon/pods-all.txt"

log "5. Deployments e ReplicaSets"
kubectl get deployments,replicasets,statefulsets,daemonsets -A 2>/dev/null \
  | tee "$REPORT_DIR/recon/workloads.txt"

# ------------------------------------------------------------------
# 3. Serviços e endpoints expostos
# ------------------------------------------------------------------
log "6. Services e endpoints"
kubectl get services -A -o wide 2>/dev/null | tee "$REPORT_DIR/recon/services.txt"
kubectl get endpoints -A 2>/dev/null | tee "$REPORT_DIR/recon/endpoints.txt"

log "7. Ingresses e IngressClasses"
kubectl get ingress -A 2>/dev/null | tee "$REPORT_DIR/recon/ingress.txt" || warn "Nenhum ingress encontrado"

# ------------------------------------------------------------------
# 4. ConfigMaps e Secrets (nomes apenas)
# ------------------------------------------------------------------
log "8. ConfigMaps (nomes)"
kubectl get configmaps -A 2>/dev/null | tee "$REPORT_DIR/recon/configmaps.txt"

log "9. Secrets (nomes e tipos)"
kubectl get secrets -A 2>/dev/null | tee "$REPORT_DIR/recon/secrets-list.txt"

# ------------------------------------------------------------------
# 5. RBAC - Papéis e permissões
# ------------------------------------------------------------------
log "10. ClusterRoles e ClusterRoleBindings"
kubectl get clusterroles,clusterrolebindings -o wide 2>/dev/null \
  | tee "$REPORT_DIR/recon/cluster-rbac.txt"

log "11. ServiceAccounts"
kubectl get serviceaccounts -A 2>/dev/null | tee "$REPORT_DIR/recon/service-accounts.txt"

# ------------------------------------------------------------------
# 6. Verificar API Groups disponíveis (superfície de ataque)
# ------------------------------------------------------------------
log "12. API Groups e recursos disponíveis"
kubectl api-resources --verbs=list --namespaced=false 2>/dev/null \
  | tee "$REPORT_DIR/recon/api-resources.txt"

# ------------------------------------------------------------------
# 7. Verificar permissões da identidade atual
# ------------------------------------------------------------------
log "13. O que EU posso fazer no cluster? (who-can-i)"
{
  echo "=== Permissões do usuário atual ==="
  kubectl auth can-i --list 2>/dev/null
  echo ""
  echo "=== Verificações críticas ==="
  CRITICAL_CHECKS=(
    "get secrets"
    "create pods"
    "exec pods"
    "delete pods"
    "create clusterrolebindings"
    "get clusterroles"
    "impersonate users"
    "escalate clusterroles"
  )
  for check in "${CRITICAL_CHECKS[@]}"; do
    verb=$(echo "$check" | awk '{print $1}')
    resource=$(echo "$check" | awk '{print $2}')
    result=$(kubectl auth can-i "$verb" "$resource" --all-namespaces 2>/dev/null)
    if [[ "$result" == "yes" ]]; then
      vuln "POSSO: $check"
    else
      ok "Não posso: $check"
    fi
  done
} | tee "$REPORT_DIR/recon/my-permissions.txt"

# ------------------------------------------------------------------
# 8. Pods privilegiados e com hostNetwork
# ------------------------------------------------------------------
log "14. Pods com privilégios elevados"
{
  echo "=== Pods com hostNetwork=true ==="
  kubectl get pods -A -o json 2>/dev/null \
    | python3 -c "
import json,sys
data=json.load(sys.stdin)
for item in data['items']:
  spec=item.get('spec',{})
  if spec.get('hostNetwork',False):
    print(f\"  {item['metadata']['namespace']}/{item['metadata']['name']} -> hostNetwork=true\")
" 2>/dev/null || echo "  (erro ao processar)"

  echo ""
  echo "=== Pods com containers privilegiados ==="
  kubectl get pods -A -o json 2>/dev/null \
    | python3 -c "
import json,sys
data=json.load(sys.stdin)
for item in data['items']:
  for c in item.get('spec',{}).get('containers',[]):
    sc = c.get('securityContext',{})
    if sc.get('privileged',False):
      print(f\"  {item['metadata']['namespace']}/{item['metadata']['name']} -> container '{c['name']}' privileged=true\")
" 2>/dev/null || echo "  (erro ao processar)"

  echo ""
  echo "=== Pods rodando como root (runAsUser=0) ==="
  kubectl get pods -A -o json 2>/dev/null \
    | python3 -c "
import json,sys
data=json.load(sys.stdin)
for item in data['items']:
  sc=item.get('spec',{}).get('securityContext',{})
  if sc.get('runAsUser',1)==0:
    print(f\"  {item['metadata']['namespace']}/{item['metadata']['name']} -> runAsUser=0\")
" 2>/dev/null || echo "  (erro ao processar)"
} | tee "$REPORT_DIR/recon/privileged-pods.txt"

# ------------------------------------------------------------------
# 9. PersistentVolumes e StorageClasses
# ------------------------------------------------------------------
log "15. PersistentVolumes e Storage"
kubectl get pv,pvc -A 2>/dev/null | tee "$REPORT_DIR/recon/storage.txt"

# ------------------------------------------------------------------
# 10. Network Policies
# ------------------------------------------------------------------
log "16. Network Policies (ausência = tráfego livre)"
NP_COUNT=$(kubectl get networkpolicies -A 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
if [[ "$NP_COUNT" -eq 0 ]]; then
  vuln "NENHUMA NetworkPolicy encontrada! Todo o tráfego pod-a-pod é permitido."
else
  ok "$NP_COUNT NetworkPolicies encontradas"
  kubectl get networkpolicies -A 2>/dev/null
fi | tee "$REPORT_DIR/recon/network-policies.txt"

# ------------------------------------------------------------------
# 11. Admission Controllers
# ------------------------------------------------------------------
log "17. Verificar Admission Controllers via API"
{
  echo "=== ValidatingWebhookConfigurations ==="
  kubectl get validatingwebhookconfigurations 2>/dev/null || echo "Nenhum encontrado"
  echo ""
  echo "=== MutatingWebhookConfigurations ==="
  kubectl get mutatingwebhookconfigurations 2>/dev/null || echo "Nenhum encontrado"
} | tee "$REPORT_DIR/recon/admission-controllers.txt"

echo ""
echo "============================================================"
echo " Reconhecimento concluído!"
echo " Relatório salvo em: $REPORT_DIR/recon/"
echo "============================================================"
