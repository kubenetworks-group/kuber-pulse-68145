# Plano Concluído ✅

## Monitoramento de Uso Real de PVCs via Comando `df`

**Status:** Implementado em v0.0.53

### Mudanças Realizadas

| Arquivo | Mudança |
|---------|---------|
| `agent/main.go` | Adicionadas funções `execDfInContainer()`, `findPVCMountInPod()`, `collectPVCUsageViaDf()`, `parseDfOutput()` |
| `agent/main.go` | `collectPVCs()` agora usa fallback df quando Kubelet Stats retorna 0 |
| `agent/main.go` | Cache de 5 minutos e rate limiting de 10 execs/ciclo |
| `agent/kubernetes/deployment.yaml` | Adicionada permissão `pods/exec` |
| `deploy.yaml` | Adicionada permissão `pods/exec` |
| `agent/README.md` | Documentação atualizada |

### Fluxo de Dados

1. Agente tenta coletar uso via **Kubelet Stats API**
2. Se `used_bytes = 0`, tenta **fallback via `df` exec**
3. Encontra pod running que usa o PVC
4. Executa `df -B1 <mountPath>` no container
5. Parseia output e envia métricas

### Segurança

- Namespaces bloqueados: kube-system, calico-system, istio-system, etc.
- Timeout de 5 segundos por exec
- Apenas comando `df -B1 <path>` é executado
