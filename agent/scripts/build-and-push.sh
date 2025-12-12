#!/bin/bash

# Script para build e push da imagem Docker do Kodo Agent
# Uso: ./scripts/build-and-push.sh [versão]

set -e

VERSION=${1:-v0.0.14}
IMAGE_NAME="denercavalcante/kodo-agent"
FULL_IMAGE="${IMAGE_NAME}:${VERSION}"

echo "🔨 Building multi-platform Docker image: ${FULL_IMAGE}"
docker buildx create --use --name kodo-builder 2>/dev/null || docker buildx use kodo-builder

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ${FULL_IMAGE} \
  -t ${IMAGE_NAME}:latest \
  --push \
  .

echo "✅ Build and push completed successfully!"
echo "📝 Next step: Run ./scripts/deploy.sh to deploy to Kubernetes"
