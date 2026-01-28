# Kodo Agent

CloudOps Agent leve que coleta métricas do Kubernetes e envia para o Kodo.

## 🚀 Instalação Rápida

### 1. Gerar API Key

Acesse o painel do Kodo em `/agents` e gere uma API key para seu cluster.

### 2. Configurar Credenciais

Use o script de atualização de secret:

```bash
cd agent
chmod +x scripts/*.sh
./scripts/update-secret.sh <API_KEY> <CLUSTER_ID>
```

Exemplo:
```bash
./scripts/update-secret.sh kp_27e0ee900e674092920c153af726804b 2ba92131-8573-4651-96e9-5ad888282a7b
```

### 3. Deploy Inicial

Se for o primeiro deploy:

```bash
kubectl apply -f kubernetes/deployment.yaml
```

### 4. Verificar Status

```bash
kubectl get pods -n kodo
kubectl logs -n kodo -l app=kodo-agent --tail=50 -f
```

Você deve ver logs como:
```
🚀 Kodo Agent starting...
✅ Connected to Kubernetes cluster
📡 Sending metrics every 15s
📊 Collecting metrics...
🔍 Sending to: https://...supabase.co/functions/v1/agent-receive-metrics
🔍 Headers: Content-Type=application/json, x-agent-key=kp_...
✅ Metrics sent successfully
```

## 📊 Métricas Coletadas

O agente coleta automaticamente:

- **CPU e Memória**: Uso total do cluster
- **Pods**: Status (running, pending, failed)
- **Nodes**: Total e status de saúde
- **Events**: Warnings e erros recentes
- **PVCs**: Uso real de storage via Kubelet Stats API ou fallback via `df` exec

### 🔍 Coleta de Uso Real de PVCs

O agente usa duas estratégias para coletar uso real de storage:

1. **Kubelet Stats API (preferencial)**: Coleta métricas de volume diretamente do Kubelet
2. **Fallback via `df` exec**: Para storage providers que não expõem métricas (ex: OpenStack Cinder), o agente executa `df -B1` dentro dos containers para obter uso real

**Limitações do fallback:**
- Só funciona em pods com status `Running`
- Containers distroless (sem `df`) não são suportados
- Namespaces de sistema são ignorados por segurança
- Máximo de 10 exec calls por ciclo de coleta
- Resultados são cacheados por 5 minutos

## 🔧 Configuração

Variáveis de ambiente disponíveis:

```yaml
API_ENDPOINT: https://sua-instancia.supabase.co/functions/v1
API_KEY: sua-api-key
CLUSTER_ID: id-do-cluster
COLLECT_INTERVAL: 30  # segundos entre coletas
```

## 🛡️ Permissões

O agente requer:
- `get`, `list`, `watch` em nodes, pods, events, PVCs, PVs, etc.
- `delete` em pods (para restart automático)
- `create` em pods/exec (para coletar uso real de PVCs via `df`)
- `update` em deployments (para scaling)

## 🏗️ Build e Deploy

### Build e Push da Imagem

```bash
cd agent
chmod +x scripts/build-and-push.sh
./scripts/build-and-push.sh v0.0.6
```

### Deploy/Redeploy no Kubernetes

```bash
./scripts/deploy.sh
```

### Atualizar API Key

Se precisar atualizar a API key:

```bash
./scripts/update-secret.sh <NOVA_API_KEY> <CLUSTER_ID>
```

## 🔍 Troubleshooting

**Agent não conecta:**
- Verifique se a API key está correta
- Verifique se o endpoint está acessível do cluster

**Métricas não aparecem:**
- Verifique se o metrics-server está instalado: `kubectl get apiservice v1beta1.metrics.k8s.io`
- Instale se necessário: `kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml`

**Comandos não executam:**
- Verifique as permissões RBAC
- Verifique os logs do agente

## 📝 Desenvolvimento

```bash
go mod download
go run main.go
```

Variáveis de ambiente para dev:
```bash
export API_ENDPOINT=http://localhost:54321/functions/v1
export API_KEY=your-dev-key
export CLUSTER_ID=test-cluster
```

## 🎯 Roadmap

- [ ] Coleta de métricas de PVCs
- [ ] Suporte a múltiplos clusters por agente
- [ ] Auto-healing configurável
- [ ] Métricas customizadas
- [ ] Alertas proativos
- [ ] Dashboard em tempo real

## 📄 Licença

MIT
