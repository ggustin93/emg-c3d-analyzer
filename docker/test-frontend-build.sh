#!/bin/bash

# EMG C3D Analyzer - Frontend Docker Build Test Script
# This script tests the frontend Docker build to verify Rollup native binding issues are resolved

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build context
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_CONTEXT="$PROJECT_ROOT"

echo -e "${YELLOW}🚀 EMG C3D Analyzer - Frontend Docker Build Test${NC}"
echo "Build context: $BUILD_CONTEXT"
echo "Dockerfile: $SCRIPT_DIR/frontend/Dockerfile"
echo ""

# Check if we're on ARM64 (Apple Silicon)
ARCH=$(uname -m)
echo -e "${YELLOW}🖥️  Host Architecture: $ARCH${NC}"

if [[ "$ARCH" == "arm64" ]]; then
    echo -e "${YELLOW}⚠️  Running on Apple Silicon - testing cross-compilation to x86_64${NC}"
    PLATFORM_ARGS="--platform linux/amd64"
else
    echo -e "${GREEN}✅ Running on x86_64 - native compilation${NC}"
    PLATFORM_ARGS=""
fi

echo ""

# Build the frontend Docker image
echo -e "${YELLOW}🔨 Building frontend Docker image...${NC}"
echo "Command: docker build $PLATFORM_ARGS -f docker/frontend/Dockerfile -t emg-frontend-test ."
echo ""

cd "$BUILD_CONTEXT"

if docker build $PLATFORM_ARGS -f docker/frontend/Dockerfile -t emg-frontend-test .; then
    echo ""
    echo -e "${GREEN}✅ Frontend Docker build completed successfully!${NC}"
    echo ""
    
    # Test the image by running it briefly
    echo -e "${YELLOW}🧪 Testing the built image...${NC}"
    
    # Start container in background
    CONTAINER_ID=$(docker run -d -p 3001:8080 emg-frontend-test)
    echo "Started container: $CONTAINER_ID"
    
    # Wait a moment for nginx to start
    sleep 3
    
    # Test health endpoint
    if curl -f http://localhost:3001/health &>/dev/null; then
        echo -e "${GREEN}✅ Health check passed - nginx is serving correctly${NC}"
        STATUS="success"
    else
        echo -e "${RED}❌ Health check failed - nginx may not be running properly${NC}"
        STATUS="partial"
    fi
    
    # Cleanup
    docker stop "$CONTAINER_ID" &>/dev/null
    docker rm "$CONTAINER_ID" &>/dev/null
    
    echo ""
    echo -e "${GREEN}🎉 Build test completed with status: $STATUS${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test with docker-compose: docker compose -f docker/compose/docker-compose.dev.yml up frontend"
    echo "2. Check for any runtime issues in a full deployment"
    echo "3. Verify Rollup native bindings are working correctly"
    
else
    echo ""
    echo -e "${RED}❌ Frontend Docker build failed!${NC}"
    echo ""
    echo "Debugging steps:"
    echo "1. Check if Rollup native bindings are the issue:"
    echo "   docker build $PLATFORM_ARGS --no-cache -f docker/frontend/Dockerfile -t emg-frontend-debug ."
    echo ""
    echo "2. If the build fails at npm install, try building with verbose output:"
    echo "   docker build $PLATFORM_ARGS --progress=plain -f docker/frontend/Dockerfile -t emg-frontend-debug ."
    echo ""
    echo "3. Check logs for 'Cannot find module @rollup/rollup-linux-x64-gnu' errors"
    
    exit 1
fi