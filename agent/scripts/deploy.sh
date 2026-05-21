#!/bin/bash

# Script para deploy/redeploy do Kodo Agent no Kubernetes
# Uso: ./scripts/deploy.sh [versão]
#   Ex: ./scripts/deploy.sh v0.2.82
#       ./scripts/deploy.sh          (mantém imagem existente, apenas reinicia)

set -e

NAMESPACE="kodo"
DEPLOYMENT="kodo-agent"
CONTAINER="agent"
IMAGE_NAME="ghcr.io/kubenetworks-group/kodo-agent"
VERSION=${1:-""}

echo "🚀 Checking if namespace exists..."
if kubectl get namespace ${NAMESPACE} &> /dev/null; then
  echo "✅ Namespace ${NAMESPACE} exists"
else
  echo "📦 Creating namespace ${NAMESPACE}..."
  kubectl create namespace ${NAMESPACE}
fi

echo "🔄 Applying Kubernetes manifests..."
kubectl apply -f kubernetes/deployment.yaml

if [ -n "${VERSION}" ]; then
  echo "📦 Updating image to ${IMAGE_NAME}:${VERSION}..."
  kubectl set image deployment/${DEPLOYMENT} \
    ${CONTAINER}=${IMAGE_NAME}:${VERSION} \
    -n ${NAMESPACE}
else
  echo "♻️  Restarting deployment to pull latest image..."
  kubectl rollout restart deployment/${DEPLOYMENT} -n ${NAMESPACE}
fi

echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/${DEPLOYMENT} -n ${NAMESPACE}

echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Check agent status:"
echo "  kubectl get pods -n ${NAMESPACE}"
echo "  kubectl logs -n ${NAMESPACE} -l app=${DEPLOYMENT} --tail=50 -f"
