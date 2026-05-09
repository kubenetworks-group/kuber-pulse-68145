#!/usr/bin/env bash
# =============================================================================
# ATAQUES DE REDE - MOVIMENTAÇÃO LATERAL E ESCANEAMENTO
# Técnicas: MITRE T1046 - Network Service Discovery, T1021 - Remote Services
# OWASP K8s: K07-Network Segmentation Failures
# =============================================================================

set -euo pipefail

REPORT_DIR="${REPORT_DIR:-/tmp/k8s-pentest-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$REPORT_DIR/network"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BOLD}[*]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
vuln() { echo -e "${RED}[VULN]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }

echo "============================================================"
echo " K8s Pentest - Fase 3: Ataques de Rede"
echo " Data: $(date)"
echo "============================================================"
echo ""

# ------------------------------------------------------------------
# 1. Mapear rede de pods (CIDRs)
# ------------------------------------------------------------------
log "1. Mapeamento de rede do cluster"
{
  echo "=== CIDRs de Pods e Services ==="
  kubectl get nodes -o json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
for node in data['items']:
  name = node['metadata']['name']
  pod_cidr = node['spec'].get('podCIDR','N/A')
  print(f'  Node: {name} -> podCIDR: {pod_cidr}')
" 2>/dev/null

  echo ""
  echo "=== Service CIDR (via kube-apiserver args) ==="
  kubectl get pod -n kube-system -l component=kube-apiserver -o json 2>/dev/null \
    | python3 -c "
import json,sys
data=json.load(sys.stdin)
for pod in data.get('items',[]):
  for c in pod.get('spec',{}).get('containers',[]):
    for arg in c.get('command',[]):
      if 'service-cluster-ip-range' in arg:
        print(f'  {arg}')
" 2>/dev/null || warn "Não foi possível ler args do kube-apiserver"
} | tee "$REPORT_DIR/network/cluster-network.txt"

# ------------------------------------------------------------------
# 2. Serviços expostos externamente (NodePort / LoadBalancer)
# ------------------------------------------------------------------
log "2. Serviços com exposição externa"
{
  echo "=== NodePort e LoadBalancer ==="
  kubectl get services -A -o json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
for svc in data['items']:
  stype = svc['spec'].get('type','ClusterIP')
  if stype in ['NodePort', 'LoadBalancer', 'ExternalName']:
    ns = svc['metadata']['namespace']
    name = svc['metadata']['name']
    ports = svc['spec'].get('ports',[])
    lb_ip = svc.get('status',{}).get('loadBalancer',{}).get('ingress',[])
    ext_ip = svc['spec'].get('externalIPs',[])
    print(f'  [{stype}] {ns}/{name}')
    for p in ports:
      np = p.get('nodePort','')
      print(f'    port={p.get(\"port\")} targetPort={p.get(\"targetPort\")} nodePort={np}')
    if lb_ip:
      print(f'    LB IPs: {[i.get(\"ip\",i.get(\"hostname\")) for i in lb_ip]}')
    if ext_ip:
      print(f'    External IPs: {ext_ip}')
" 2>/dev/null
} | tee "$REPORT_DIR/network/external-services.txt"

# ------------------------------------------------------------------
# 3. Scan de metadados do nó (IMDS - Instance Metadata Service)
# ------------------------------------------------------------------
log "3. Verificar acesso ao IMDS (cloud metadata) de dentro do cluster"
cat << 'MANIFEST' > /tmp/pentest-net-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: pentest-network
  namespace: default
  labels:
    app: pentest-network
spec:
  hostNetwork: false
  containers:
  - name: scanner
    image: nicolaka/netshoot:latest
    command: ["sleep", "300"]
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: false
  restartPolicy: Never
  automountServiceAccountToken: false
MANIFEST

if kubectl apply -f /tmp/pentest-net-pod.yaml 2>/dev/null; then
  log "Pod de teste de rede criado. Aguardando..."
  kubectl wait --for=condition=Ready pod/pentest-network -n default --timeout=60s 2>/dev/null || true

  if kubectl get pod pentest-network -n default --field-selector=status.phase=Running 2>/dev/null | grep -q Running; then
    echo ""
    echo "=== Testando acesso ao IMDS (AWS/GCP/Azure) de dentro do pod ==="

    # AWS IMDS
    echo "--- AWS IMDS (169.254.169.254) ---"
    kubectl exec pentest-network -n default -- \
      curl -s --connect-timeout 3 http://169.254.169.254/latest/meta-data/ 2>/dev/null \
      && vuln "AWS IMDS ACESSÍVEL sem proteção hop-limit!" \
      || ok "AWS IMDS não acessível do pod"

    # GCP IMDS
    echo "--- GCP IMDS ---"
    kubectl exec pentest-network -n default -- \
      curl -s --connect-timeout 3 -H "Metadata-Flavor: Google" \
      http://metadata.google.internal/computeMetadata/v1/ 2>/dev/null \
      && vuln "GCP IMDS ACESSÍVEL!" \
      || ok "GCP IMDS não acessível"

    # Azure IMDS
    echo "--- Azure IMDS ---"
    kubectl exec pentest-network -n default -- \
      curl -s --connect-timeout 3 -H "Metadata: true" \
      "http://169.254.169.254/metadata/instance?api-version=2021-02-01" 2>/dev/null \
      && vuln "Azure IMDS ACESSÍVEL!" \
      || ok "Azure IMDS não acessível"

    echo ""
    echo "=== DNS interno do cluster ==="
    kubectl exec pentest-network -n default -- \
      nslookup kubernetes.default.svc.cluster.local 2>/dev/null || true

    echo ""
    echo "=== Rotas de rede do pod ==="
    kubectl exec pentest-network -n default -- ip route 2>/dev/null || true

    echo ""
    echo "=== Scan de portas no kube-apiserver ==="
    API_IP=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' \
      | sed 's|https://||' | cut -d: -f1 2>/dev/null)
    if [[ -n "$API_IP" ]]; then
      kubectl exec pentest-network -n default -- \
        nc -zv -w2 "$API_IP" 443 2>&1 || true
      kubectl exec pentest-network -n default -- \
        nc -zv -w2 "$API_IP" 6443 2>&1 || true
    fi
  fi

  log "Removendo pod de teste de rede..."
  kubectl delete pod pentest-network -n default --ignore-not-found=true 2>/dev/null
else
  warn "Não foi possível criar pod de teste de rede"
fi | tee "$REPORT_DIR/network/internal-network-tests.txt"

# ------------------------------------------------------------------
# 4. Verificar DNS wildcard / exfiltração via DNS
# ------------------------------------------------------------------
log "4. Teste de exfiltração via DNS (dentro do cluster seria via pod)"
{
  echo "=== CoreDNS config ==="
  kubectl get configmap coredns -n kube-system -o yaml 2>/dev/null || echo "CoreDNS ConfigMap não acessível"
} | tee "$REPORT_DIR/network/dns-config.txt"

# ------------------------------------------------------------------
# 5. Verificar kube-proxy e iptables rules
# ------------------------------------------------------------------
log "5. kube-proxy e CNI"
{
  echo "=== kube-proxy config ==="
  kubectl get configmap kube-proxy -n kube-system -o yaml 2>/dev/null | head -60 || echo "Não acessível"

  echo ""
  echo "=== CNI plugins instalados ==="
  kubectl get pods -n kube-system -o wide 2>/dev/null | grep -Ei "cilium|calico|flannel|weave|canal|antrea" || echo "CNI não identificado via pods"
} | tee "$REPORT_DIR/network/kube-proxy-cni.txt"

# ------------------------------------------------------------------
# 6. Exposição do Dashboard do Kubernetes
# ------------------------------------------------------------------
log "6. Verificar kubernetes-dashboard exposto"
{
  DASH=$(kubectl get services -A 2>/dev/null | grep -i dashboard || echo "")
  if [[ -n "$DASH" ]]; then
    vuln "Kubernetes Dashboard encontrado:"
    echo "$DASH"
    warn "Verificar se dashboard está exposto sem autenticação!"
  else
    ok "Kubernetes Dashboard não encontrado como service"
  fi
} | tee "$REPORT_DIR/network/dashboard.txt"

echo ""
echo "============================================================"
echo " Análise de Rede concluída!"
echo " Relatório: $REPORT_DIR/network/"
echo "============================================================"
