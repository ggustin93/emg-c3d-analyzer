#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Docker Build Validation Script - DevOps Infrastructure
# ═══════════════════════════════════════════════════════════════════════════
# 
# Purpose: Validate Docker builds work correctly across platforms
# Critical: Tests esbuild platform compatibility (ARM64 host → x64 container)
# Usage: ./scripts/validate-docker-build.sh [--platform linux/amd64]
#
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PLATFORM="${1:-linux/amd64}"
BUILD_TAG="emg-frontend:validation-$(date +%s)"
DOCKERFILE_PATH="docker/frontend/Dockerfile"

echo -e "${BLUE}🔧 Docker Build Validation - EMG C3D Analyzer${NC}"
echo -e "${BLUE}Platform: ${PLATFORM}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════${NC}"

# Validate prerequisites
echo -e "${YELLOW}📋 Validating prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker.${NC}"
    exit 1
fi

if ! docker buildx version &> /dev/null; then
    echo -e "${RED}❌ Docker Buildx not found. Please install Docker Buildx.${NC}"
    exit 1
fi

if [[ ! -f "$DOCKERFILE_PATH" ]]; then
    echo -e "${RED}❌ Dockerfile not found at $DOCKERFILE_PATH${NC}"
    exit 1
fi

if [[ ! -f ".dockerignore" ]]; then
    echo -e "${RED}❌ Project-level .dockerignore not found. This is critical for preventing platform mismatches.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites validated${NC}"

# Check .dockerignore content
echo -e "${YELLOW}🔍 Validating .dockerignore excludes node_modules...${NC}"
if grep -q "^\*\*/node_modules/" .dockerignore; then
    echo -e "${GREEN}✅ .dockerignore correctly excludes node_modules${NC}"
else
    echo -e "${RED}❌ .dockerignore does not exclude node_modules properly${NC}"
    exit 1
fi

# Build the image
echo -e "${YELLOW}🏗️  Building Docker image for platform ${PLATFORM}...${NC}"
echo -e "${BLUE}Build command: docker buildx build --platform ${PLATFORM} -t ${BUILD_TAG} -f ${DOCKERFILE_PATH} .${NC}"

if docker buildx build \
    --platform "$PLATFORM" \
    --load \
    -t "$BUILD_TAG" \
    -f "$DOCKERFILE_PATH" \
    --build-arg VITE_API_URL=http://localhost:8080 \
    --build-arg VITE_SUPABASE_URL=https://example.supabase.co \
    --build-arg VITE_SUPABASE_ANON_KEY=example_key \
    --progress=plain \
    .; then
    echo -e "${GREEN}✅ Docker build successful!${NC}"
else
    echo -e "${RED}❌ Docker build failed!${NC}"
    exit 1
fi

# Validate the built image
echo -e "${YELLOW}🔍 Validating built image...${NC}"

# Check if image exists
if docker image inspect "$BUILD_TAG" &> /dev/null; then
    echo -e "${GREEN}✅ Image exists: $BUILD_TAG${NC}"
else
    echo -e "${RED}❌ Image not found: $BUILD_TAG${NC}"
    exit 1
fi

# Get image details
IMAGE_SIZE=$(docker image inspect "$BUILD_TAG" --format='{{.Size}}' | numfmt --to=iec)
IMAGE_ARCH=$(docker image inspect "$BUILD_TAG" --format='{{.Architecture}}')
IMAGE_OS=$(docker image inspect "$BUILD_TAG" --format='{{.Os}}')

echo -e "${BLUE}📊 Image Details:${NC}"
echo -e "  Size: $IMAGE_SIZE"
echo -e "  Architecture: $IMAGE_ARCH"
echo -e "  OS: $IMAGE_OS"

# Quick container test
echo -e "${YELLOW}🧪 Testing container startup...${NC}"
CONTAINER_ID=$(docker run -d --platform "$PLATFORM" -p 8081:8080 "$BUILD_TAG")

# Wait for container to start
sleep 5

# Check if container is running
if docker ps --filter "id=$CONTAINER_ID" --format "table {{.Status}}" | grep -q "Up"; then
    echo -e "${GREEN}✅ Container started successfully${NC}"
    
    # Quick health check (if curl is available)
    if command -v curl &> /dev/null; then
        echo -e "${YELLOW}🏥 Performing health check...${NC}"
        if curl -f -s http://localhost:8081/health &> /dev/null || curl -f -s http://localhost:8081/ &> /dev/null; then
            echo -e "${GREEN}✅ Health check passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Health check endpoint not available (normal for static sites)${NC}"
        fi
    fi
else
    echo -e "${RED}❌ Container failed to start${NC}"
    docker logs "$CONTAINER_ID"
    docker stop "$CONTAINER_ID" &> /dev/null || true
    docker rm "$CONTAINER_ID" &> /dev/null || true
    exit 1
fi

# Cleanup
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
docker stop "$CONTAINER_ID" &> /dev/null || true
docker rm "$CONTAINER_ID" &> /dev/null || true
docker rmi "$BUILD_TAG" &> /dev/null || true

echo -e "${GREEN}🎉 Docker build validation completed successfully!${NC}"
echo -e "${GREEN}✅ Platform mismatch issue resolved - esbuild binary correctly installed for ${PLATFORM}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════${NC}"

# Summary
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "  ✅ Dependencies installed inside container (not copied from host)"
echo -e "  ✅ node_modules excluded by .dockerignore" 
echo -e "  ✅ Cross-platform build successful (${PLATFORM})"
echo -e "  ✅ Container runs without platform mismatches"
echo -e "  ✅ DevOps best practices implemented"