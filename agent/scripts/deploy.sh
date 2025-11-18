#!/bin/bash

# Script para deploy/redeploy do Kuberpulse Agent no Kubernetes
# Uso: ./scripts/deploy.sh

set -e

NAMESPACE="kuberpulse"
DEPLOYMENT="kuberpulse-agent"

echo "🚀 Checking if namespace exists..."
if kubectl get namespace ${NAMESPACE} &> /dev/null; then
  echo "✅ Namespace ${NAMESPACE} exists"
else
  echo "📦 Creating namespace ${NAMESPACE}..."
  kubectl create namespace ${NAMESPACE}
fi

echo "🔄 Applying Kubernetes manifests..."
kubectl apply -f kubernetes/deployment.yaml

echo "♻️  Restarting deployment to pull new image..."
kubectl rollout restart deployment/${DEPLOYMENT} -n ${NAMESPACE}

echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/${DEPLOYMENT} -n ${NAMESPACE}

echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Check agent status:"
echo "  kubectl get pods -n ${NAMESPACE}"
echo "  kubectl logs -n ${NAMESPACE} -l app=${DEPLOYMENT} --tail=50 -f"
