# Kuberpulse Agent

CloudOps Agent leve que coleta métricas do Kubernetes e envia para o Kuberpulse.

## 🚀 Instalação Rápida

### 1. Gerar API Key

Acesse o painel do Kuberpulse em `/agents` e gere uma API key para seu cluster.

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
kubectl get pods -n kuberpulse
kubectl logs -n kuberpulse -l app=kuberpulse-agent --tail=50 -f
```

Você deve ver logs como:
```
🚀 Kuberpulse Agent starting...
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
