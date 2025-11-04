# Kuberpulse Agent

CloudOps Agent leve que coleta métricas do Kubernetes e envia para o Kuberpulse.

## 🚀 Instalação Rápida

### 1. Gerar API Key

Acesse o painel do Kuberpulse e gere uma API key para seu cluster:

```
Settings → Agentes → Gerar Nova API Key
```

### 2. Instalar no Cluster

Edite o arquivo `kubernetes/deployment.yaml` e substitua:
- `YOUR_API_KEY_HERE` pela API key gerada
- `YOUR_CLUSTER_ID_HERE` pelo ID do seu cluster

Depois aplique o deployment:

```bash
kubectl apply -f kubernetes/deployment.yaml
```

### 3. Verificar Status

```bash
kubectl get pods -n kuberpulse
kubectl logs -n kuberpulse deployment/kuberpulse-agent
```

Você deve ver logs como:
```
🚀 Kuberpulse Agent starting...
✅ Connected to Kubernetes cluster
📡 Sending metrics every 30s
📊 Collecting metrics...
✅ Sent 5 metrics successfully
```

## 📊 Métricas Coletadas

O agente coleta automaticamente:

- **CPU e Memória**: Uso total do cluster
- **Pods**: Status (running, pending, failed)
- **Nodes**: Total e status de saúde
- **Events**: Warnings e erros recentes
- **PVCs**: Uso de storage (futuro)

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
- `get`, `list`, `watch` em nodes, pods, events
- `delete` em pods (para restart automático)
- `update` em deployments (para scaling)

## 🏗️ Build Manual

Se quiser buildar a imagem Docker:

```bash
cd agent
docker build -t kuberpulse/agent:latest .
docker push kuberpulse/agent:latest
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
