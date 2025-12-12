#!/bin/bash

# Script para atualizar o secret com a API key correta
# Uso: ./scripts/update-secret.sh <API_KEY> <CLUSTER_ID>

set -e

if [ $# -ne 2 ]; then
  echo "❌ Uso: $0 <API_KEY> <CLUSTER_ID>"
  echo "Exemplo: $0 kp_27e0ee900e674092920c153af726804b 2ba92131-8573-4651-96e9-5ad888282a7b"
  exit 1
fi

API_KEY=$1
CLUSTER_ID=$2
NAMESPACE="kodo"

echo "🔐 Updating Kubernetes secret..."

# Deletar o secret antigo se existir
kubectl delete secret kodo-secret -n ${NAMESPACE} --ignore-not-found

# Criar novo secret
kubectl create secret generic kodo-secret \
  --from-literal=API_KEY=${API_KEY} \
  --from-literal=CLUSTER_ID=${CLUSTER_ID} \
  -n ${NAMESPACE}

echo "✅ Secret updated successfully!"
echo "♻️  Restarting deployment to use new secret..."

kubectl rollout restart deployment/kodo-agent -n ${NAMESPACE}
kubectl rollout status deployment/kodo-agent -n ${NAMESPACE}

echo "✅ Deployment restarted with new credentials!"