# Kubernetes Security Pentest Suite

Scripts para testes de segurança em clusters Kubernetes.

**IMPORTANTE**: Use apenas em ambientes autorizados para testes de segurança.

## Scripts Disponíveis

### 1. k8s-pentest.sh - Scanner de Vulnerabilidades

Scanner passivo que verifica configurações de segurança sem modificar o cluster.

```bash
# Scan em namespace específico
./k8s-pentest.sh meu-namespace

# Scan com namespace default
./k8s-pentest.sh
```

**Verifica:**
- Pods privilegiados e host namespaces
- HostPath mounts perigosos
- Security Context (runAsNonRoot, allowPrivilegeEscalation, etc.)
- RBAC (permissões excessivas, wildcards)
- Secrets expostos
- Network Policies
- Tags de imagens (latest, etc.)
- Pod Security Standards
- Linux Capabilities
- Services expostos (LoadBalancer, NodePort)
- Resource Limits
- ServiceAccounts

---

### 2. k8s-attack-simulation.sh - Simulação de Ataques

Simula ataques reais baseados no MITRE ATT&CK Framework. Cria pods de teste para verificar se defesas funcionam.

```bash
# Executa em namespace de teste (criado automaticamente)
./k8s-attack-simulation.sh pentest-lab
```

**Ataques simulados:**
1. Service Account Token Theft
2. Container Escape via Privileged Pod
3. Secrets Enumeration
4. Lateral Movement
5. DNS Exfiltration
6. Cloud Metadata Service Access (AWS/GCP/Azure)
7. Internal Network Scanning
8. Resource Abuse (cryptomining simulation)
9. Persistence via CronJob
10. RBAC Privilege Escalation

---

### 3. k8s-container-audit.sh - Auditoria de Containers

Auditoria detalhada focada em containers e compliance com CIS Benchmark.

```bash
# Audita todos os namespaces
./k8s-container-audit.sh

# Audita namespace específico
./k8s-container-audit.sh meu-namespace
```

**Gera relatórios:**
- CIS Kubernetes Benchmark checks
- Análise de imagens (tags, registros, bases vulneráveis)
- Security Context detalhado
- Resource Limits
- Network Policies
- RBAC

---

## Requisitos

- `kubectl` configurado e conectado ao cluster
- `jq` para processamento de JSON
- Permissões de leitura no cluster (para scanning)
- Permissões de escrita no namespace de teste (para attack simulation)

## Estrutura de Saída

```
./attack-results-YYYYMMDD-HHMMSS/
├── sa-token-theft.txt
├── escape-attempt.txt
├── secrets-enum.txt
├── lateral-movement.txt
├── dns-exfil.txt
├── metadata-access.txt
├── network-scan.txt
├── resource-abuse.txt
├── persistence-test.txt
├── rbac-escalation-result.txt
└── FULL-REPORT.txt

./container-audit-YYYYMMDD-HHMMSS/
├── cis-benchmark.txt
├── image-analysis.txt
├── security-context.txt
├── resource-limits.txt
├── network-policies.txt
├── rbac-analysis.txt
└── SUMMARY.txt
```

## Exemplo de Fluxo de Pentest

```bash
# 1. Scanner inicial (passivo)
./k8s-pentest.sh

# 2. Auditoria detalhada
./k8s-container-audit.sh

# 3. Simulação de ataques (ativo - apenas em ambientes de teste)
./k8s-attack-simulation.sh pentest-lab
```

## Remediações Recomendadas

### Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: meu-namespace
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Security Context Hardened

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

### Network Policy Default Deny

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

### Desabilitar ServiceAccount Token Automático

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: minha-sa
automountServiceAccountToken: false
```

## Ferramentas Complementares

- **Trivy**: Scan de vulnerabilidades em imagens
- **Falco**: Runtime security monitoring
- **OPA/Gatekeeper**: Policy enforcement
- **kube-bench**: CIS Benchmark automatizado
- **kubeaudit**: Auditoria de configurações
