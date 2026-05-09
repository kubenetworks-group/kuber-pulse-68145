# Kubernetes Ethical Hacking Toolkit

Scripts de teste de segurança para uso **exclusivo** em clusters próprios ou com autorização explícita.

## Estrutura

```
hacker-etico/
├── 01-recon/           # Reconhecimento e enumeração
├── 02-authn-authz/     # Ataques de autenticação e autorização
├── 03-network/         # Ataques de rede e movimentação lateral
├── 04-workloads/       # Escape de container, privilege escalation
├── 05-dos/             # Denial of Service no cluster
├── 06-secrets/         # Exfiltração de secrets
├── 07-supply-chain/    # Ataques na cadeia de supply chain
└── run-all.sh          # Executa todos os testes e gera relatório
```

## Pré-requisitos

```bash
brew install kubectl helm kube-bench kubescape trivy
pip3 install kube-hunter
```

## Uso rápido

```bash
chmod +x run-all.sh
./run-all.sh
```

## Referências

- [OWASP Kubernetes Top 10](https://owasp.org/www-project-kubernetes-top-10/)
- [MITRE ATT&CK for Containers](https://attack.mitre.org/matrices/enterprise/containers/)
- [NSA/CISA Kubernetes Hardening Guide](https://media.defense.gov/2022/Aug/29/2003066362/-1/-1/0/CTR_KUBERNETES_HARDENING_GUIDANCE_1.2_20220829.PDF)
