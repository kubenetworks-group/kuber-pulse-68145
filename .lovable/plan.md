

## Plano: Monitoramento de Uso Real de PVCs via Comando `df -h`

### Contexto do Problema

Atualmente, o agente coleta uso real de PVCs através da **Kubelet Stats Summary API** (linha 275-357 do `agent/main.go`). Porém, muitos provedores de storage (como OpenStack Cinder) **não expõem métricas de uso real** via essa API, resultando em `used_bytes = 0` e a UI exibindo "N/A" no campo de uso real.

### Solução Proposta

Implementar um mecanismo onde o agente executa `df -h` diretamente dentro dos containers que têm PVCs montados, coletando o uso real do filesystem de cada volume.

---

### Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              FLUXO DE DADOS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Agente identifica pods com PVCs                                      │
│           │                                                              │
│           ▼                                                              │
│  2. Para cada PVC, encontra o container que monta esse volume            │
│           │                                                              │
│           ▼                                                              │
│  3. Executa `df` no container para obter uso do mount point              │
│           │                                                              │
│           ▼                                                              │
│  4. Parseia output e envia métricas junto com dados de PVC               │
│           │                                                              │
│           ▼                                                              │
│  5. Backend atualiza tabela `pvcs` com `used_bytes` real                 │
│           │                                                              │
│           ▼                                                              │
│  6. UI exibe dados reais no StorageChart                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Detalhes Técnicos

#### 1. Modificações no Agente Go (`agent/main.go`)

**Adicionar capacidade de exec em containers:**

```go
import (
    "k8s.io/client-go/kubernetes/scheme"
    "k8s.io/client-go/tools/remotecommand"
)

// Estrutura para armazenar uso do PVC via df
type PVCDfUsage struct {
    MountPath      string
    UsedBytes      int64
    AvailableBytes int64
    TotalBytes     int64
    UsePercent     int
}

// Função para executar df no container
func execDfInContainer(clientset *kubernetes.Clientset, config *rest.Config, 
                       namespace, podName, containerName, mountPath string) (*PVCDfUsage, error) {
    // Executa: df -B1 <mountPath> (saída em bytes)
    cmd := []string{"df", "-B1", mountPath}
    
    // Cria request de exec
    req := clientset.CoreV1().RESTClient().Post().
        Resource("pods").
        Name(podName).
        Namespace(namespace).
        SubResource("exec").
        Param("container", containerName).
        Param("command", cmd[0]).
        Param("command", cmd[1]).
        Param("command", cmd[2]).
        Param("stdout", "true").
        Param("stderr", "true")
    
    // Executa e parseia resultado
    // ...
}
```

**Modificar `collectPVCs` para usar fallback de `df`:**

```go
func collectPVCs(clientset *kubernetes.Clientset, restConfig *rest.Config) []map[string]interface{} {
    // ... código existente ...
    
    // Tenta Kubelet Stats primeiro
    pvcVolumeStats := collectPVCVolumeStats(clientset)
    
    // Para PVCs sem dados do Kubelet, tenta df via exec
    for _, pvc := range pvcs.Items {
        pvcKey := pvc.Namespace + "/" + pvc.Name
        
        if _, exists := pvcVolumeStats[pvcKey]; !exists {
            // Encontra pod que usa este PVC
            usage, err := collectPVCUsageViaDf(clientset, restConfig, pvc)
            if err == nil && usage.UsedBytes > 0 {
                pvcVolumeStats[pvcKey] = PVCVolumeUsage{
                    UsedBytes:      usage.UsedBytes,
                    CapacityBytes:  usage.TotalBytes,
                    AvailableBytes: usage.AvailableBytes,
                }
            }
        }
    }
    // ...
}
```

#### 2. Lógica de Identificação de Mount Points

O agente precisa:
1. Listar todos os pods
2. Para cada pod, verificar `spec.volumes` para encontrar PVCs
3. Mapear o volume para o `volumeMounts` do container para obter o `mountPath`
4. Executar `df -B1 <mountPath>` no container

```go
func findPVCMountInPod(pod *corev1.Pod, pvcName string) (containerName, mountPath string, found bool) {
    // Encontra o volume que referencia o PVC
    var volumeName string
    for _, vol := range pod.Spec.Volumes {
        if vol.PersistentVolumeClaim != nil && vol.PersistentVolumeClaim.ClaimName == pvcName {
            volumeName = vol.Name
            break
        }
    }
    
    if volumeName == "" {
        return "", "", false
    }
    
    // Encontra o container e mount path
    for _, container := range pod.Spec.Containers {
        for _, mount := range container.VolumeMounts {
            if mount.Name == volumeName {
                return container.Name, mount.MountPath, true
            }
        }
    }
    return "", "", false
}
```

#### 3. Permissões RBAC Necessárias

Atualizar `agent/kubernetes/deployment.yaml` para adicionar permissão de `exec`:

```yaml
rules:
  # ... regras existentes ...
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create"]
```

#### 4. Tratamento de Erros e Fallbacks

- **Container sem `df`**: Alguns containers minimalistas (distroless) não têm o comando `df`. Nesses casos, manter `used_bytes = 0`.
- **Container não running**: Só executar em pods com status `Running`.
- **Timeout**: Limite de 5 segundos por exec para evitar travamentos.
- **Cache**: Não executar `df` a cada ciclo (15s). Usar intervalo maior (ex: 5 minutos).

#### 5. Otimização de Performance

Para evitar sobrecarga, implementar:
- **Rate limiting**: Máximo de 10 execs por ciclo
- **Cache de resultados**: Reutilizar dados por 5 minutos
- **Execução incremental**: Priorizar PVCs que retornaram 0 no Kubelet Stats

---

### Mudanças de Código Necessárias

| Arquivo | Mudança |
|---------|---------|
| `agent/main.go` | Adicionar função `execDfInContainer()` |
| `agent/main.go` | Adicionar função `findPVCMountInPod()` |
| `agent/main.go` | Adicionar função `collectPVCUsageViaDf()` |
| `agent/main.go` | Modificar `collectPVCs()` para usar fallback df |
| `agent/main.go` | Adicionar cache e rate limiting para execs |
| `agent/kubernetes/deployment.yaml` | Adicionar permissão `pods/exec` |
| `agent/README.md` | Documentar nova funcionalidade |

---

### Considerações de Segurança

1. **Comando seguro**: Executar apenas `df -B1 <path>`, sem permitir injeção
2. **Namespaces bloqueados**: Não executar em `kube-system`, `calico-system`, etc.
3. **Logging**: Registrar todos os execs para auditoria
4. **Timeout curto**: Evitar comandos que travam

---

### Benefícios

- Obtém uso real de storage mesmo em provedores que não expõem métricas via Kubelet
- Funciona com qualquer tipo de storage (NFS, Cinder, EBS, etc.)
- Fallback inteligente: usa Kubelet quando disponível, `df` quando necessário
- Dados mais precisos para recomendações de rightsizing de storage

