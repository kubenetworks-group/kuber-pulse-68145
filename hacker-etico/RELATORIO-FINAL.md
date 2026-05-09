# Relatório de Pentest Kubernetes

**Data:** Sat May  9 16:05:37 -03 2026
**Cluster:** Cluster-local-k8s
**Usuário kubectl:** admin

---

## Sumário Executivo

| Módulo | Status |
|--------|--------|
| 01-recon/enumerate-cluster.sh | 9 vulns, 0
0 warnings |
| 02-authn-authz/rbac-attack.sh | 9 vulns, 2 warnings |
| 03-network/network-attack.sh | 0
0 vulns, 0
0 warnings |
| 04-workloads/container-escape.sh | 0
0 vulns, 29 warnings |
| 06-secrets/secret-harvest.sh | 1 vulns, 0
0 warnings |
| 07-supply-chain/supply-chain-attack.sh | 0
0 vulns, 2 warnings |

---

## Vulnerabilidades Encontradas

### Crítico (VULN)
- [0;31m[VULN][0m NENHUMA NetworkPolicy encontrada! Todo o tráfego pod-a-pod é permitido.
- [0;31m[VULN][0m POSSO LER TODOS OS SECRETS DO CLUSTER!
- [0;31m[VULN][0m POSSO escalar privilégios via: bind clusterroles
- [0;31m[VULN][0m POSSO escalar privilégios via: create clusterrolebindings
- [0;31m[VULN][0m POSSO escalar privilégios via: create clusterroles
- [0;31m[VULN][0m POSSO escalar privilégios via: create rolebindings
- [0;31m[VULN][0m POSSO escalar privilégios via: escalate clusterroles
- [0;31m[VULN][0m POSSO escalar privilégios via: impersonate serviceaccounts
- [0;31m[VULN][0m POSSO escalar privilégios via: impersonate users
- [0;31m[VULN][0m POSSO escalar privilégios via: patch clusterroles
- [0;31m[VULN][0m POSSO escalar privilégios via: update clusterroles
- [0;31m[VULN][0m POSSO: create clusterrolebindings
- [0;31m[VULN][0m POSSO: create pods
- [0;31m[VULN][0m POSSO: delete pods
- [0;31m[VULN][0m POSSO: escalate clusterroles
- [0;31m[VULN][0m POSSO: exec pods
- [0;31m[VULN][0m POSSO: get clusterroles
- [0;31m[VULN][0m POSSO: get secrets
- [0;31m[VULN][0m POSSO: impersonate users

### Atenção (WARN)
- [1;33m[!][0m Anônimo recebe 403 (RBAC ativo, mas endpoint acessível sem autenticação)
- [1;33m[!][0m Kubescape não instalado.
- [1;33m[!][0m Namespace 'cattle-capi-system' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cattle-fleet-clusters-system' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cattle-fleet-local-system' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cattle-fleet-system' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cattle-global-data' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cattle-impersonation-system' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cattle-local-user-passwords' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cattle-system' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cattle-turtles-system' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cattle-ui-plugin-system' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cert-manager' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'cluster-fleet-local-local-1a3d67d0a899' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'default' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'demo' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'dev' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'fleet-default' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'fleet-local' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'ingress' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'kodo' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'kube-node-lease' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'kube-public' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'kube-system' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'lab-sec' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'lens-metrics' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'local' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'p-6j9wk' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'p-rfzcj' sem PSA enforce label (pods privilegiados podem ser criados!)
- [1;33m[!][0m Namespace 'user-b45x6' sem PSA enforce label (pods privilegiados podem ser criados!)

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

