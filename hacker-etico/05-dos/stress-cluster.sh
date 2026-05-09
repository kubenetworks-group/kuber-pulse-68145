#!/usr/bin/env bash
# =============================================================================
# DENIAL OF SERVICE - STRESS TESTING DO CLUSTER
# Técnicas: MITRE T1499 - Endpoint DoS, T1496 - Resource Hijacking
# OWASP K8s: K09-Misconfigured Cluster Components
# =============================================================================
# ATENÇÃO: Esses testes podem impactar a disponibilidade do cluster!
# Execute APENAS em ambiente de teste/desenvolvimento.
# =============================================================================

set -euo pipefail

REPORT_DIR="${REPORT_DIR:-/tmp/k8s-pentest-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$REPORT_DIR/dos"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BOLD}[*]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
vuln() { echo -e "${RED}[VULN]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }

# Confirmação de segurança
echo -e "${RED}============================================================${NC}"
echo -e "${RED} AVISO: Scripts de DoS - Apenas para clusters de TESTE!${NC}"
echo -e "${RED}============================================================${NC}"
echo ""
read -p "Confirme que este é um cluster de teste (digite 'SIM'): " CONFIRM
if [[ "$CONFIRM" != "SIM" ]]; then
  echo "Operação cancelada."
  exit 0
fi

echo ""
echo "============================================================"
echo " K8s Pentest - Fase 5: Stress e DoS Tests"
echo " Data: $(date)"
echo "============================================================"
echo ""

# ------------------------------------------------------------------
# 1. API Server rate limiting / flood de requests
# ------------------------------------------------------------------
log "1. Teste de rate limiting no API Server"
{
  API_ENDPOINT=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null)
  TOKEN=$(kubectl config view --minify --flatten -o jsonpath='{.users[0].user.token}' 2>/dev/null || echo "")

  echo "API Endpoint: $API_ENDPOINT"
  echo "Enviando 200 requisições rápidas ao /api/v1/namespaces..."
  echo ""

  START=$(date +%s%3N)
  SUCCESS=0; RATE_LIMIT=0; ERRORS=0
  for i in $(seq 1 200); do
    HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" \
      ${TOKEN:+-H "Authorization: Bearer $TOKEN"} \
      "$API_ENDPOINT/api/v1/namespaces" 2>/dev/null)
    case "$HTTP_CODE" in
      200) ((SUCCESS++));;
      429) ((RATE_LIMIT++));;
      *)   ((ERRORS++));;
    esac
  done
  END=$(date +%s%3N)
  ELAPSED=$(( (END - START) ))

  echo "Resultados ($ELAPSED ms):"
  echo "  200 OK:        $SUCCESS"
  echo "  429 Rate Limit: $RATE_LIMIT"
  echo "  Outros erros:  $ERRORS"

  if [[ "$RATE_LIMIT" -eq 0 ]]; then
    vuln "API Server NÃO aplicou rate limiting! ($SUCCESS respostas 200 em ${ELAPSED}ms)"
  else
    ok "Rate limiting detectado após $SUCCESS requisições ($RATE_LIMIT bloqueadas)"
  fi
} | tee "$REPORT_DIR/dos/api-flood.txt"

# ------------------------------------------------------------------
# 2. Namespace bomb - criar muitos namespaces
# ------------------------------------------------------------------
log "2. Namespace creation flood (10 namespaces de teste)"
{
  if kubectl auth can-i create namespaces 2>/dev/null | grep -q "yes"; then
    warn "Posso criar namespaces! Criando 10 para teste..."
    for i in $(seq 1 10); do
      kubectl create namespace "pentest-dos-$i" 2>/dev/null && echo "  Criado: pentest-dos-$i" || true
    done

    echo ""
    echo "Namespaces criados:"
    kubectl get namespaces | grep "pentest-dos"

    echo ""
    echo "Limpando namespaces de teste..."
    for i in $(seq 1 10); do
      kubectl delete namespace "pentest-dos-$i" --ignore-not-found=true 2>/dev/null &
    done
    wait
    ok "Namespaces removidos."
  else
    ok "Sem permissão para criar namespaces"
  fi
} | tee "$REPORT_DIR/dos/namespace-flood.txt"

# ------------------------------------------------------------------
# 3. Fork bomb via pod (CPU starvation)
# ------------------------------------------------------------------
log "3. CPU stress via pod (sem limits)"
{
  cat << 'EOF'
Manifesto para stress de CPU (execução manual recomendada):

apiVersion: v1
kind: Pod
metadata:
  name: cpu-stress-test
  namespace: default
spec:
  containers:
  - name: stress
    image: polinux/stress:latest
    command: ["stress"]
    args: ["--cpu", "4", "--timeout", "60s"]
    # SEM resource limits -> pode consumir todo o CPU do nó!
  restartPolicy: Never

Para executar:
  kubectl apply -f <manifesto>
  kubectl top pod cpu-stress-test

Para verificar impacto no nó:
  kubectl top nodes
EOF

  # Verificar se conseguimos criar pods sem limits
  if kubectl auth can-i create pods 2>/dev/null | grep -q "yes"; then
    warn "POSSO criar pods sem resource limits -> risco de CPU starvation nos nós"

    # Verificar se há LimitRange protegendo
    echo ""
    echo "=== LimitRanges por namespace ==="
    for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
      LR=$(kubectl get limitrange -n "$ns" 2>/dev/null | tail -n +2)
      if [[ -z "$LR" ]]; then
        warn "Namespace '$ns' sem LimitRange"
      else
        ok "Namespace '$ns' tem LimitRange"
      fi
    done

    echo ""
    echo "=== ResourceQuotas por namespace ==="
    for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
      RQ=$(kubectl get resourcequota -n "$ns" 2>/dev/null | tail -n +2)
      if [[ -z "$RQ" ]]; then
        warn "Namespace '$ns' sem ResourceQuota"
      else
        ok "Namespace '$ns' tem ResourceQuota"
        kubectl get resourcequota -n "$ns" 2>/dev/null
      fi
    done
  fi
} | tee "$REPORT_DIR/dos/cpu-stress.txt"

# ------------------------------------------------------------------
# 4. etcd stress - criar muitos ConfigMaps/Secrets (storage pressure)
# ------------------------------------------------------------------
log "4. etcd pressure - criação em massa de objetos"
{
  if kubectl auth can-i create configmaps 2>/dev/null | grep -q "yes"; then
    warn "Posso criar ConfigMaps! Criando 20 para testar pressão no etcd..."

    DATA_1KB=$(python3 -c "print('x'*1024)")
    for i in $(seq 1 20); do
      kubectl create configmap "pentest-etcd-$i" \
        --from-literal="data=$DATA_1KB" \
        -n default 2>/dev/null && echo "  Criado configmap pentest-etcd-$i" || true
    done

    echo ""
    echo "Limpando ConfigMaps de teste..."
    for i in $(seq 1 20); do
      kubectl delete configmap "pentest-etcd-$i" -n default --ignore-not-found=true 2>/dev/null &
    done
    wait
    ok "ConfigMaps removidos."
  else
    ok "Sem permissão para criar ConfigMaps"
  fi
} | tee "$REPORT_DIR/dos/etcd-pressure.txt"

# ------------------------------------------------------------------
# 5. Verificar HPA e Cluster Autoscaler (scale abuse)
# ------------------------------------------------------------------
log "5. HPA e Autoscaler - risco de scale abuse"
{
  echo "=== HPAs existentes ==="
  kubectl get hpa -A 2>/dev/null

  echo ""
  echo "=== Cluster Autoscaler ==="
  kubectl get deployments -n kube-system 2>/dev/null | grep -i autoscaler || echo "Autoscaler não encontrado"

  echo ""
  if kubectl auth can-i update horizontalpodautoscalers 2>/dev/null | grep -q "yes"; then
    warn "POSSO modificar HPAs -> possível scale abuse para esgotar recursos do cluster"
  else
    ok "Sem permissão para modificar HPAs"
  fi
} | tee "$REPORT_DIR/dos/autoscaler.txt"

echo ""
echo "============================================================"
echo " Análise de DoS concluída!"
echo " Relatório: $REPORT_DIR/dos/"
echo "============================================================"
