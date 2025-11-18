#!/bin/bash

# Script para build e push da imagem Docker do Kuberpulse Agent
# Uso: ./scripts/build-and-push.sh [versão]

set -e

VERSION=${1:-v0.0.6}
IMAGE_NAME="denercavalcante/kuberpulse-agent"
FULL_IMAGE="${IMAGE_NAME}:${VERSION}"

echo "🔨 Building Docker image: ${FULL_IMAGE}"
docker build -t ${FULL_IMAGE} .

echo "📤 Pushing to Docker Hub: ${FULL_IMAGE}"
docker push ${FULL_IMAGE}

echo "✅ Build and push completed successfully!"
echo "📝 Next step: Run ./scripts/deploy.sh to deploy to Kubernetes"
