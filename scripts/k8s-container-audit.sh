#!/bin/bash

#############################################################################
# Kubernetes Container Security Audit Script
#
# Este script realiza uma auditoria detalhada de segurança em containers
# rodando no cluster Kubernetes, incluindo análise de imagens, configurações
# e compliance com benchmarks de segurança (CIS).
#############################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

NAMESPACE="${1:-}"
OUTPUT_DIR="./container-audit-$(date +%Y%m%d-%H%M%S)"

print_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║        Kubernetes Container Security Audit v1.0                    ║"
    echo "║        Análise detalhada de segurança de containers                ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
log_section() {
    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
}

setup() {
    mkdir -p "$OUTPUT_DIR"

    if [ -z "$NAMESPACE" ]; then
        NAMESPACES=$(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}')
    else
        NAMESPACES="$NAMESPACE"
    fi
}

#############################################################################
# CIS Benchmark Checks
#############################################################################
cis_benchmark_checks() {
    log_section "CIS Kubernetes Benchmark Checks"

    local report="$OUTPUT_DIR/cis-benchmark.txt"
    echo "CIS Kubernetes Benchmark Audit Report" > "$report"
    echo "Generated: $(date)" >> "$report"
    echo "" >> "$report"

    # 5.1.1 - Ensure that the cluster-admin role is only used where required
    log_info "CIS 5.1.1: Checking cluster-admin usage..."
    ADMIN_BINDINGS=$(kubectl get clusterrolebindings -o json | \
        jq -r '.items[] | select(.roleRef.name=="cluster-admin") | .metadata.name')

    echo "=== CIS 5.1.1: cluster-admin bindings ===" >> "$report"
    echo "$ADMIN_BINDINGS" >> "$report"
    echo "" >> "$report"

    if [ $(echo "$ADMIN_BINDINGS" | wc -w) -gt 3 ]; then
        log_warn "CIS 5.1.1: Múltiplos bindings cluster-admin encontrados"
    else
        log_pass "CIS 5.1.1: Uso de cluster-admin parece adequado"
    fi

    # 5.1.3 - Minimize wildcard use in Roles and ClusterRoles
    log_info "CIS 5.1.3: Checking wildcard permissions..."
    WILDCARD_ROLES=$(kubectl get clusterroles -o json | \
        jq -r '.items[] | select(.rules[]? | .verbs[]? == "*" or .resources[]? == "*") | .metadata.name' | sort -u)

    echo "=== CIS 5.1.3: Roles with wildcard permissions ===" >> "$report"
    echo "$WILDCARD_ROLES" >> "$report"
    echo "" >> "$report"

    # 5.2.2 - Minimize the admission of privileged containers
    log_info "CIS 5.2.2: Checking privileged containers..."

    for ns in $NAMESPACES; do
        PRIV_PODS=$(kubectl get pods -n "$ns" -o json 2>/dev/null | \
            jq -r '.items[] | select(.spec.containers[]?.securityContext?.privileged == true) | .metadata.name' 2>/dev/null || echo "")
        if [ -n "$PRIV_PODS" ]; then
            log_fail "CIS 5.2.2: Pods privilegiados em $ns: $PRIV_PODS"
            echo "Namespace $ns - Privileged pods: $PRIV_PODS" >> "$report"
        fi
    done

    # 5.2.3 - Minimize the admission of containers wishing to share the host process ID namespace
    log_info "CIS 5.2.3: Checking hostPID usage..."

    for ns in $NAMESPACES; do
        HOSTPID_PODS=$(kubectl get pods -n "$ns" -o json 2>/dev/null | \
            jq -r '.items[] | select(.spec.hostPID == true) | .metadata.name' 2>/dev/null || echo "")
        if [ -n "$HOSTPID_PODS" ]; then
            log_fail "CIS 5.2.3: Pods com hostPID em $ns: $HOSTPID_PODS"
        fi
    done

    # 5.2.4 - Minimize the admission of containers wishing to share the host IPC namespace
    log_info "CIS 5.2.4: Checking hostIPC usage..."

    # 5.2.5 - Minimize the admission of containers wishing to share the host network namespace
    log_info "CIS 5.2.5: Checking hostNetwork usage..."

    # 5.2.6 - Minimize the admission of containers with allowPrivilegeEscalation
    log_info "CIS 5.2.6: Checking allowPrivilegeEscalation..."

    for ns in $NAMESPACES; do
        PRIV_ESC=$(kubectl get pods -n "$ns" -o json 2>/dev/null | \
            jq -r '.items[] | select(.spec.containers[]?.securityContext?.allowPrivilegeEscalation != false) | .metadata.name' 2>/dev/null | sort -u || echo "")
        if [ -n "$PRIV_ESC" ]; then
            log_warn "CIS 5.2.6: Pods sem allowPrivilegeEscalation=false em $ns"
        fi
    done

    # 5.2.7 - Minimize the admission of root containers
    log_info "CIS 5.2.7: Checking root containers..."

    for ns in $NAMESPACES; do
        ROOT_PODS=$(kubectl get pods -n "$ns" -o json 2>/dev/null | \
            jq -r '.items[] | select(.spec.containers[]?.securityContext?.runAsNonRoot != true and .spec.securityContext?.runAsNonRoot != true) | .metadata.name' 2>/dev/null | sort -u || echo "")
        if [ -n "$ROOT_PODS" ]; then
            log_warn "CIS 5.2.7: Pods que podem rodar como root em $ns"
        fi
    done

    # 5.2.8 - Minimize the admission of containers with the NET_RAW capability
    log_info "CIS 5.2.8: Checking NET_RAW capability..."

    # 5.2.9 - Minimize the admission of containers with added capabilities
    log_info "CIS 5.2.9: Checking added capabilities..."

    # 5.4.1 - Prefer using secrets as files over secrets as environment variables
    log_info "CIS 5.4.1: Checking secrets in env vars..."

    for ns in $NAMESPACES; do
        SECRET_ENV=$(kubectl get pods -n "$ns" -o json 2>/dev/null | \
            jq -r '.items[] | select(.spec.containers[]?.env[]?.valueFrom?.secretKeyRef != null) | .metadata.name' 2>/dev/null | sort -u || echo "")
        if [ -n "$SECRET_ENV" ]; then
            log_warn "CIS 5.4.1: Pods com secrets em env vars em $ns"
        fi
    done

    # 5.7.1 - Create administrative boundaries between resources using namespaces
    log_info "CIS 5.7.1: Checking namespace usage..."
    NS_COUNT=$(kubectl get namespaces --no-headers | wc -l)
    if [ "$NS_COUNT" -lt 4 ]; then
        log_warn "CIS 5.7.1: Poucas namespaces ($NS_COUNT) - considere segmentar recursos"
    else
        log_pass "CIS 5.7.1: Uso adequado de namespaces ($NS_COUNT)"
    fi

    # 5.7.2 - Ensure that the seccomp profile is set to docker/default in your pod definitions
    log_info "CIS 5.7.2: Checking seccomp profiles..."

    echo ""
    log_info "Relatório CIS salvo em: $report"
}

#############################################################################
# Container Image Analysis
#############################################################################
analyze_images() {
    log_section "Análise de Imagens de Container"

    local report="$OUTPUT_DIR/image-analysis.txt"
    echo "Container Image Analysis Report" > "$report"
    echo "Generated: $(date)" >> "$report"
    echo "" >> "$report"

    # Coletar todas as imagens únicas
    log_info "Coletando imagens em uso no cluster..."

    ALL_IMAGES=$(kubectl get pods --all-namespaces -o json | \
        jq -r '.items[].spec.containers[].image' | sort -u)

    INIT_IMAGES=$(kubectl get pods --all-namespaces -o json | \
        jq -r '.items[].spec.initContainers[]?.image // empty' | sort -u)

    UNIQUE_IMAGES=$(echo -e "$ALL_IMAGES\n$INIT_IMAGES" | sort -u | grep -v "^$")
    IMAGE_COUNT=$(echo "$UNIQUE_IMAGES" | wc -l | tr -d ' ')

    echo "Total de imagens únicas: $IMAGE_COUNT" >> "$report"
    echo "" >> "$report"
    log_info "Total de imagens únicas: $IMAGE_COUNT"

    # Verificar tags
    echo "=== Análise de Tags ===" >> "$report"

    LATEST_COUNT=0
    NO_TAG_COUNT=0
    SHA_COUNT=0
    VERSIONED_COUNT=0

    while IFS= read -r image; do
        if echo "$image" | grep -q "@sha256:"; then
            ((SHA_COUNT++))
        elif echo "$image" | grep -qE ":latest$"; then
            ((LATEST_COUNT++))
            log_fail "Tag 'latest': $image"
            echo "LATEST: $image" >> "$report"
        elif ! echo "$image" | grep -q ":"; then
            ((NO_TAG_COUNT++))
            log_fail "Sem tag (implicitamente latest): $image"
            echo "NO_TAG: $image" >> "$report"
        else
            ((VERSIONED_COUNT++))
        fi
    done <<< "$UNIQUE_IMAGES"

    echo "" >> "$report"
    echo "Resumo de Tags:" >> "$report"
    echo "  - Com versão específica: $VERSIONED_COUNT" >> "$report"
    echo "  - Com SHA256 digest: $SHA_COUNT" >> "$report"
    echo "  - Com tag 'latest': $LATEST_COUNT" >> "$report"
    echo "  - Sem tag: $NO_TAG_COUNT" >> "$report"

    # Verificar registros
    echo "" >> "$report"
    echo "=== Análise de Registros ===" >> "$report"

    PUBLIC_REGISTRIES=("docker.io" "index.docker.io" "quay.io" "gcr.io" "ghcr.io" "registry.k8s.io")
    PRIVATE_COUNT=0
    PUBLIC_COUNT=0

    while IFS= read -r image; do
        IS_PUBLIC=false
        for reg in "${PUBLIC_REGISTRIES[@]}"; do
            if echo "$image" | grep -q "$reg"; then
                IS_PUBLIC=true
                ((PUBLIC_COUNT++))
                break
            fi
        done
        if [ "$IS_PUBLIC" = false ] && ! echo "$image" | grep -q "/"; then
            # Imagens sem / são do Docker Hub
            ((PUBLIC_COUNT++))
        elif [ "$IS_PUBLIC" = false ]; then
            ((PRIVATE_COUNT++))
        fi
    done <<< "$UNIQUE_IMAGES"

    echo "  - Registros públicos: $PUBLIC_COUNT" >> "$report"
    echo "  - Registros privados: $PRIVATE_COUNT" >> "$report"

    # Verificar imagens base comuns com vulnerabilidades conhecidas
    echo "" >> "$report"
    echo "=== Verificação de Imagens Base ===" >> "$report"

    RISKY_BASES=("alpine:3.1" "alpine:3.2" "alpine:3.3" "ubuntu:14.04" "debian:jessie" "debian:wheezy" "centos:6" "centos:7")

    for base in "${RISKY_BASES[@]}"; do
        if echo "$UNIQUE_IMAGES" | grep -q "$base"; then
            log_fail "Imagem base potencialmente vulnerável: $base"
            echo "VULNERABLE_BASE: $base" >> "$report"
        fi
    done

    echo ""
    log_info "Relatório de imagens salvo em: $report"
}

#############################################################################
# Security Context Analysis
#############################################################################
analyze_security_context() {
    log_section "Análise de Security Context"

    local report="$OUTPUT_DIR/security-context.txt"
    echo "Security Context Analysis Report" > "$report"
    echo "Generated: $(date)" >> "$report"
    echo "" >> "$report"

    for ns in $NAMESPACES; do
        echo "" >> "$report"
        echo "=== Namespace: $ns ===" >> "$report"

        PODS=$(kubectl get pods -n "$ns" -o json 2>/dev/null)

        if [ -z "$PODS" ] || [ "$PODS" = "null" ]; then
            continue
        fi

        # Analisar cada pod
        echo "$PODS" | jq -r '.items[] | .metadata.name' 2>/dev/null | while read -r pod; do
            echo "" >> "$report"
            echo "Pod: $pod" >> "$report"

            POD_JSON=$(echo "$PODS" | jq ".items[] | select(.metadata.name==\"$pod\")")

            # Pod-level security context
            POD_SC=$(echo "$POD_JSON" | jq '.spec.securityContext // {}')
            echo "  Pod SecurityContext:" >> "$report"
            echo "    runAsNonRoot: $(echo "$POD_SC" | jq -r '.runAsNonRoot // "not set"')" >> "$report"
            echo "    runAsUser: $(echo "$POD_SC" | jq -r '.runAsUser // "not set"')" >> "$report"
            echo "    fsGroup: $(echo "$POD_SC" | jq -r '.fsGroup // "not set"')" >> "$report"

            # Host namespaces
            HOST_PID=$(echo "$POD_JSON" | jq -r '.spec.hostPID // false')
            HOST_NET=$(echo "$POD_JSON" | jq -r '.spec.hostNetwork // false')
            HOST_IPC=$(echo "$POD_JSON" | jq -r '.spec.hostIPC // false')

            if [ "$HOST_PID" = "true" ] || [ "$HOST_NET" = "true" ] || [ "$HOST_IPC" = "true" ]; then
                echo "  Host Namespaces (RISK!):" >> "$report"
                echo "    hostPID: $HOST_PID" >> "$report"
                echo "    hostNetwork: $HOST_NET" >> "$report"
                echo "    hostIPC: $HOST_IPC" >> "$report"
            fi

            # Container-level security context
            echo "$POD_JSON" | jq -r '.spec.containers[].name' 2>/dev/null | while read -r container; do
                CONTAINER_JSON=$(echo "$POD_JSON" | jq ".spec.containers[] | select(.name==\"$container\")")
                CONTAINER_SC=$(echo "$CONTAINER_JSON" | jq '.securityContext // {}')

                echo "  Container: $container" >> "$report"
                echo "    privileged: $(echo "$CONTAINER_SC" | jq -r '.privileged // false')" >> "$report"
                echo "    allowPrivilegeEscalation: $(echo "$CONTAINER_SC" | jq -r '.allowPrivilegeEscalation // "not set"')" >> "$report"
                echo "    readOnlyRootFilesystem: $(echo "$CONTAINER_SC" | jq -r '.readOnlyRootFilesystem // false')" >> "$report"
                echo "    runAsNonRoot: $(echo "$CONTAINER_SC" | jq -r '.runAsNonRoot // "not set"')" >> "$report"

                # Capabilities
                CAPS_ADD=$(echo "$CONTAINER_SC" | jq -r '.capabilities.add // [] | join(",")')
                CAPS_DROP=$(echo "$CONTAINER_SC" | jq -r '.capabilities.drop // [] | join(",")')

                if [ -n "$CAPS_ADD" ] && [ "$CAPS_ADD" != "" ]; then
                    echo "    capabilities.add: $CAPS_ADD" >> "$report"
                fi
                if [ -n "$CAPS_DROP" ] && [ "$CAPS_DROP" != "" ]; then
                    echo "    capabilities.drop: $CAPS_DROP" >> "$report"
                fi
            done
        done
    done

    log_info "Relatório de Security Context salvo em: $report"
}

#############################################################################
# Resource Limits Analysis
#############################################################################
analyze_resources() {
    log_section "Análise de Resource Limits"

    local report="$OUTPUT_DIR/resource-limits.txt"
    echo "Resource Limits Analysis Report" > "$report"
    echo "Generated: $(date)" >> "$report"
    echo "" >> "$report"

    NO_LIMITS_COUNT=0
    NO_REQUESTS_COUNT=0
    TOTAL_CONTAINERS=0

    for ns in $NAMESPACES; do
        PODS=$(kubectl get pods -n "$ns" -o json 2>/dev/null)

        echo "$PODS" | jq -r '.items[].metadata.name' 2>/dev/null | while read -r pod; do
            POD_JSON=$(echo "$PODS" | jq ".items[] | select(.metadata.name==\"$pod\")")

            echo "$POD_JSON" | jq -r '.spec.containers[].name' 2>/dev/null | while read -r container; do
                ((TOTAL_CONTAINERS++)) || true
                CONTAINER_JSON=$(echo "$POD_JSON" | jq ".spec.containers[] | select(.name==\"$container\")")

                LIMITS=$(echo "$CONTAINER_JSON" | jq '.resources.limits // {}')
                REQUESTS=$(echo "$CONTAINER_JSON" | jq '.resources.requests // {}')

                CPU_LIMIT=$(echo "$LIMITS" | jq -r '.cpu // "not set"')
                MEM_LIMIT=$(echo "$LIMITS" | jq -r '.memory // "not set"')
                CPU_REQUEST=$(echo "$REQUESTS" | jq -r '.cpu // "not set"')
                MEM_REQUEST=$(echo "$REQUESTS" | jq -r '.memory // "not set"')

                if [ "$CPU_LIMIT" = "not set" ] || [ "$MEM_LIMIT" = "not set" ]; then
                    echo "NO LIMITS: $ns/$pod/$container" >> "$report"
                    log_warn "Sem limits: $ns/$pod/$container"
                fi

                if [ "$CPU_REQUEST" = "not set" ] || [ "$MEM_REQUEST" = "not set" ]; then
                    echo "NO REQUESTS: $ns/$pod/$container" >> "$report"
                fi
            done
        done
    done

    # Verificar LimitRange e ResourceQuota por namespace
    echo "" >> "$report"
    echo "=== LimitRange e ResourceQuota ===" >> "$report"

    for ns in $NAMESPACES; do
        LR=$(kubectl get limitrange -n "$ns" --no-headers 2>/dev/null | wc -l | tr -d ' ')
        RQ=$(kubectl get resourcequota -n "$ns" --no-headers 2>/dev/null | wc -l | tr -d ' ')

        echo "Namespace $ns: LimitRange=$LR, ResourceQuota=$RQ" >> "$report"

        if [ "$LR" -eq 0 ]; then
            log_warn "Namespace '$ns' sem LimitRange"
        fi
        if [ "$RQ" -eq 0 ]; then
            log_warn "Namespace '$ns' sem ResourceQuota"
        fi
    done

    log_info "Relatório de Resource Limits salvo em: $report"
}

#############################################################################
# Network Policy Analysis
#############################################################################
analyze_network_policies() {
    log_section "Análise de Network Policies"

    local report="$OUTPUT_DIR/network-policies.txt"
    echo "Network Policy Analysis Report" > "$report"
    echo "Generated: $(date)" >> "$report"
    echo "" >> "$report"

    for ns in $NAMESPACES; do
        echo "" >> "$report"
        echo "=== Namespace: $ns ===" >> "$report"

        NP_COUNT=$(kubectl get networkpolicies -n "$ns" --no-headers 2>/dev/null | wc -l | tr -d ' ')
        POD_COUNT=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | wc -l | tr -d ' ')

        echo "Network Policies: $NP_COUNT" >> "$report"
        echo "Pods: $POD_COUNT" >> "$report"

        if [ "$NP_COUNT" -eq 0 ]; then
            log_fail "Namespace '$ns' sem Network Policies - tráfego irrestrito!"
            echo "STATUS: UNPROTECTED" >> "$report"
        else
            log_pass "Namespace '$ns' tem $NP_COUNT Network Policies"

            # Verificar se há default deny
            DEFAULT_DENY=$(kubectl get networkpolicies -n "$ns" -o json | \
                jq -r '.items[] | select(.spec.podSelector == {} and (.spec.policyTypes[]? == "Ingress" or .spec.policyTypes[]? == "Egress")) | .metadata.name')

            if [ -n "$DEFAULT_DENY" ]; then
                echo "Default Deny Policy: $DEFAULT_DENY" >> "$report"
                log_pass "  Default deny encontrado: $DEFAULT_DENY"
            else
                echo "Default Deny Policy: NONE" >> "$report"
                log_warn "  Sem default deny policy em $ns"
            fi
        fi

        # Listar policies existentes
        kubectl get networkpolicies -n "$ns" -o json 2>/dev/null | \
            jq -r '.items[] | "  - \(.metadata.name): podSelector=\(.spec.podSelector)"' >> "$report" 2>/dev/null || true
    done

    log_info "Relatório de Network Policies salvo em: $report"
}

#############################################################################
# RBAC Analysis
#############################################################################
analyze_rbac() {
    log_section "Análise de RBAC"

    local report="$OUTPUT_DIR/rbac-analysis.txt"
    echo "RBAC Analysis Report" > "$report"
    echo "Generated: $(date)" >> "$report"
    echo "" >> "$report"

    # ServiceAccounts com permissões excessivas
    echo "=== ServiceAccounts com ClusterRoleBindings ===" >> "$report"

    kubectl get clusterrolebindings -o json | jq -r '
        .items[] |
        select(.subjects != null) |
        .subjects[] |
        select(.kind == "ServiceAccount") |
        "\(.namespace)/\(.name) -> \(.roleRef.name // "unknown")"
    ' 2>/dev/null >> "$report" || true

    # Roles com permissões perigosas
    echo "" >> "$report"
    echo "=== Roles/ClusterRoles com Permissões Perigosas ===" >> "$report"

    # Secrets access
    echo "" >> "$report"
    echo "Podem acessar secrets:" >> "$report"
    kubectl get clusterroles -o json | jq -r '
        .items[] |
        select(.rules[]? | select(.resources[]? == "secrets" and (.verbs[]? == "get" or .verbs[]? == "list" or .verbs[]? == "*"))) |
        .metadata.name
    ' 2>/dev/null | head -20 >> "$report" || true

    # Pod exec
    echo "" >> "$report"
    echo "Podem executar em pods:" >> "$report"
    kubectl get clusterroles -o json | jq -r '
        .items[] |
        select(.rules[]? | select(.resources[]? == "pods/exec" and (.verbs[]? == "create" or .verbs[]? == "*"))) |
        .metadata.name
    ' 2>/dev/null | head -20 >> "$report" || true

    # Create pods
    echo "" >> "$report"
    echo "Podem criar pods:" >> "$report"
    kubectl get clusterroles -o json | jq -r '
        .items[] |
        select(.rules[]? | select(.resources[]? == "pods" and (.verbs[]? == "create" or .verbs[]? == "*"))) |
        .metadata.name
    ' 2>/dev/null | head -20 >> "$report" || true

    # Wildcard
    echo "" >> "$report"
    echo "Têm permissões wildcard:" >> "$report"
    kubectl get clusterroles -o json | jq -r '
        .items[] |
        select(.rules[]? | select(.verbs[]? == "*" and .resources[]? == "*")) |
        .metadata.name
    ' 2>/dev/null >> "$report" || true

    log_info "Relatório de RBAC salvo em: $report"
}

#############################################################################
# Generate Summary Report
#############################################################################
generate_summary() {
    log_section "Gerando Relatório Resumido"

    local summary="$OUTPUT_DIR/SUMMARY.txt"

    cat > "$summary" << EOF
╔══════════════════════════════════════════════════════════════════════════╗
║           KUBERNETES CONTAINER SECURITY AUDIT SUMMARY                    ║
║           Generated: $(date)
╚══════════════════════════════════════════════════════════════════════════╝

ESCOPO DA AUDITORIA:
$(if [ -z "$NAMESPACE" ]; then echo "  - Todos os namespaces"; else echo "  - Namespace: $NAMESPACE"; fi)

RELATÓRIOS GERADOS:
  - cis-benchmark.txt      : Verificações do CIS Kubernetes Benchmark
  - image-analysis.txt     : Análise de imagens de container
  - security-context.txt   : Análise de Security Context dos pods
  - resource-limits.txt    : Análise de Resource Limits
  - network-policies.txt   : Análise de Network Policies
  - rbac-analysis.txt      : Análise de RBAC

═══════════════════════════════════════════════════════════════════════════
RECOMENDAÇÕES PRIORITÁRIAS:
═══════════════════════════════════════════════════════════════════════════

1. IMAGENS:
   - Use tags imutáveis (versões específicas ou SHA256)
   - Implemente image scanning (Trivy, Clair, etc.)
   - Use registros privados com autenticação

2. SECURITY CONTEXT:
   - Configure runAsNonRoot: true em todos os pods
   - Configure allowPrivilegeEscalation: false
   - Configure readOnlyRootFilesystem: true
   - Drop ALL capabilities e adicione apenas as necessárias

3. RESOURCE LIMITS:
   - Configure limits e requests para todos os containers
   - Implemente LimitRange em todos os namespaces
   - Implemente ResourceQuota para limitar consumo total

4. NETWORK POLICIES:
   - Implemente default-deny em todos os namespaces
   - Crie políticas explícitas para tráfego permitido
   - Segmente comunicação entre namespaces

5. RBAC:
   - Aplique princípio de menor privilégio
   - Evite usar cluster-admin exceto quando necessário
   - Audite regularmente permissões de ServiceAccounts
   - Desabilite automountServiceAccountToken quando possível

═══════════════════════════════════════════════════════════════════════════
PRÓXIMOS PASSOS:
═══════════════════════════════════════════════════════════════════════════

1. Revise cada relatório individualmente
2. Priorize correções baseado no risco
3. Implemente Pod Security Standards (restricted)
4. Configure ferramentas de runtime security (Falco)
5. Estabeleça pipeline de CI/CD com scanning de segurança
6. Realize auditorias periódicas

═══════════════════════════════════════════════════════════════════════════
EOF

    echo ""
    log_info "Resumo salvo em: $summary"
    echo ""
    echo -e "${GREEN}Auditoria concluída! Resultados em: $OUTPUT_DIR${NC}"
}

#############################################################################
# Main
#############################################################################
main() {
    print_banner
    setup
    cis_benchmark_checks
    analyze_images
    analyze_security_context
    analyze_resources
    analyze_network_policies
    analyze_rbac
    generate_summary
}

main "$@"
