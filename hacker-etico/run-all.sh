#!/usr/bin/env bash
# =============================================================================
# ORQUESTRADOR - EXECUTAR TODOS OS TESTES E GERAR RELATÓRIO CONSOLIDADO
# =============================================================================

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
export REPORT_DIR="/tmp/k8s-pentest-${TIMESTAMP}"
mkdir -p "$REPORT_DIR"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}  ${BOLD}$1${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

banner "K8s Ethical Hacking Suite v1.0"
echo "  Cluster:   $(kubectl config current-context 2>/dev/null || echo 'N/A')"
echo "  Data/hora: $(date)"
echo "  Relatório: $REPORT_DIR"
echo ""

# Verificar dependências
echo -e "${BOLD}Verificando dependências...${NC}"
for dep in kubectl python3 curl; do
  if command -v "$dep" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $dep"
  else
    echo -e "  ${RED}✗${NC} $dep (FALTANDO)"
  fi
done
for opt_dep in helm trivy kubescape nmap; do
  if command -v "$opt_dep" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $opt_dep (opcional)"
  else
    echo -e "  ${YELLOW}○${NC} $opt_dep (opcional - não instalado)"
  fi
done
echo ""

# Confirmação
read -p "Iniciar todos os testes? (s/N): " CONFIRM
if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
  echo "Operação cancelada."
  exit 0
fi

MODULES=(
  "01-recon/enumerate-cluster.sh"
  "02-authn-authz/rbac-attack.sh"
  "03-network/network-attack.sh"
  "04-workloads/container-escape.sh"
  "06-secrets/secret-harvest.sh"
  "07-supply-chain/supply-chain-attack.sh"
)

# Nota: 05-dos/stress-cluster.sh tem confirmação própria, executar separado

PASSED=0; FAILED=0; SKIPPED=0

for module in "${MODULES[@]}"; do
  FULL_PATH="$SCRIPT_DIR/$module"
  MODULE_NAME=$(dirname "$module" | sed 's|/|-|g')

  banner "Executando: $module"

  if [[ -f "$FULL_PATH" ]]; then
    chmod +x "$FULL_PATH"
    if bash "$FULL_PATH" 2>&1 | tee "$REPORT_DIR/module-${MODULE_NAME}.log"; then
      echo -e "${GREEN}[OK]${NC} $module concluído"
      ((PASSED++))
    else
      echo -e "${YELLOW}[WARN]${NC} $module terminou com erros (verifique o log)"
      ((FAILED++))
    fi
  else
    echo -e "${RED}[SKIP]${NC} Arquivo não encontrado: $FULL_PATH"
    ((SKIPPED++))
  fi
  echo ""
done

# ------------------------------------------------------------------
# RELATÓRIO CONSOLIDADO
# ------------------------------------------------------------------
banner "Gerando Relatório Consolidado"

REPORT_FILE="$REPORT_DIR/RELATORIO-FINAL.md"

cat > "$REPORT_FILE" << EOF
# Relatório de Pentest Kubernetes

**Data:** $(date)
**Cluster:** $(kubectl config current-context 2>/dev/null || echo 'N/A')
**Usuário kubectl:** $(kubectl config view --minify -o jsonpath='{.users[0].name}' 2>/dev/null || echo 'N/A')

---

## Sumário Executivo

| Módulo | Status |
|--------|--------|
EOF

for module in "${MODULES[@]}"; do
  MODULE_NAME=$(dirname "$module" | sed 's|/|-|g')
  LOG="$REPORT_DIR/module-${MODULE_NAME}.log"
  if [[ -f "$LOG" ]]; then
    VULN_COUNT=$(grep -c "\[VULN\]" "$LOG" 2>/dev/null || echo 0)
    WARN_COUNT=$(grep -c "\[!\]" "$LOG" 2>/dev/null || echo 0)
    echo "| $module | $VULN_COUNT vulns, $WARN_COUNT warnings |" >> "$REPORT_FILE"
  fi
done

cat >> "$REPORT_FILE" << 'EOF'

---

## Vulnerabilidades Encontradas

EOF

# Consolidar todos os [VULN] encontrados
echo "### Crítico (VULN)" >> "$REPORT_FILE"
grep -rh "\[VULN\]" "$REPORT_DIR"/ 2>/dev/null | sort -u | while read -r line; do
  echo "- $line" >> "$REPORT_FILE"
done || echo "_Nenhuma_" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "### Atenção (WARN)" >> "$REPORT_FILE"
grep -rh "\[!\]" "$REPORT_DIR"/ 2>/dev/null | sort -u | head -30 | while read -r line; do
  echo "- $line" >> "$REPORT_FILE"
done || echo "_Nenhuma_" >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << 'EOF'

---

## Recomendações Gerais

1. **RBAC Mínimo**: Revisar todos os ClusterRoles com wildcards (`*`). Aplicar princípio de menor privilégio.
2. **Pod Security**: Habilitar Pod Security Admission com policy `restricted` em todos os namespaces de produção.
3. **NetworkPolicies**: Implementar NetworkPolicies default-deny em todos os namespaces.
4. **Secrets**: Usar external secret managers (Vault, AWS Secrets Manager). Nunca colocar credenciais em ConfigMaps.
5. **Imagens**: Fixar versões com digest SHA256. Escanear com Trivy/Grype em CI/CD.
6. **Admission Controllers**: Usar OPA/Gatekeeper ou Kyverno para policies adicionais.
7. **Resource Limits**: Definir LimitRange e ResourceQuota em todos os namespaces.
8. **Audit Logging**: Habilitar audit logs no API Server com policy granular.
9. **etcd**: Garantir que etcd está com TLS e autenticação. Criptografar secrets em repouso.
10. **Atualizações**: Manter cluster e componentes atualizados. Usar `kube-bench` regularmente.

---

## Ferramentas Recomendadas para Hardening

- `kube-bench` - CIS Benchmark
- `kubescape` - MITRE/NSA frameworks
- `trivy` - Vulnerability scanning
- `falco` - Runtime security monitoring
- `OPA Gatekeeper` / `Kyverno` - Policy enforcement

EOF

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN} Pentest concluído!${NC}"
echo "  Módulos: $PASSED OK, $FAILED com erros, $SKIPPED ignorados"
echo "  Relatório: $REPORT_FILE"
echo "  Logs:     $REPORT_DIR/"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Para ver o relatório:"
echo "  cat $REPORT_FILE"
echo ""
echo "Para executar DoS tests (separado por segurança):"
echo "  bash $SCRIPT_DIR/05-dos/stress-cluster.sh"
