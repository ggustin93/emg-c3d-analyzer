#!/bin/bash
# Configuration Management Module
# Centralizes all environment configuration and defaults

# Color codes for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color

# Default ports
export BACKEND_PORT=${BACKEND_PORT:-8080}
export FRONTEND_PORT=${FRONTEND_PORT:-3000}
export NGROK_PORT=${NGROK_PORT:-8080}

# Directory paths
export PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export BACKEND_DIR="${PROJECT_ROOT}/backend"
export FRONTEND_DIR="${PROJECT_ROOT}/frontend"
export LOG_DIR="${PROJECT_ROOT}/logs"
export PID_DIR="${PROJECT_ROOT}/.pids"

# Process configuration
export PROCESS_TIMEOUT=${PROCESS_TIMEOUT:-10}
export HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-30}
export HEALTH_CHECK_DELAY=${HEALTH_CHECK_DELAY:-2}

# Create necessary directories
mkdir -p "${LOG_DIR}" "${PID_DIR}" 2>/dev/null

# Environment detection
detect_environment() {
    if [[ -n "${CI:-}" ]]; then
        echo "ci"
    elif [[ -n "${DOCKER_CONTAINER:-}" ]]; then
        echo "docker"
    elif [[ "${NODE_ENV:-}" == "production" ]]; then
        echo "production"
    else
        echo "development"
    fi
}

export ENVIRONMENT=$(detect_environment)