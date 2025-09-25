#!/bin/bash

# CORS Fix for Staging Deployment
# This script helps test and deploy the CORS fixes for the staging environment

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Script configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date +"%Y-%m-%d %H:%M:%S")"
    
    case "$level" in
        ERROR)   echo -e "${RED}[${timestamp}] ERROR:${NC} ${message}" >&2 ;;
        WARNING) echo -e "${YELLOW}[${timestamp}] WARNING:${NC} ${message}" ;;
        SUCCESS) echo -e "${GREEN}[${timestamp}] SUCCESS:${NC} ${message}" ;;
        INFO)    echo -e "${BLUE}[${timestamp}] INFO:${NC} ${message}" ;;
    esac
}

# Test CORS configuration locally
test_cors_locally() {
    log INFO "Testing CORS configuration locally..."
    
    cd "$PROJECT_ROOT"
    
    # Check if backend is running
    if ! curl -s -o /dev/null http://localhost:8080/health; then
        log ERROR "Backend is not running on localhost:8080"
        log INFO "Start backend with: ./start_dev_simple.sh"
        return 1
    fi
    
    # Test CORS with staging origin
    log INFO "Testing CORS with staging origin: http://104.248.143.107:3000"
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Origin: http://104.248.143.107:3000" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        http://localhost:8080/health)
    
    if [[ "$response" == "200" ]]; then
        log SUCCESS "CORS preflight request successful (HTTP $response)"
    else
        log ERROR "CORS preflight request failed (HTTP $response)"
        return 1
    fi
    
    # Test actual GET request
    local get_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Origin: http://104.248.143.107:3000" \
        http://localhost:8080/health)
    
    if [[ "$get_response" == "200" ]]; then
        log SUCCESS "CORS GET request successful (HTTP $get_response)"
    else
        log ERROR "CORS GET request failed (HTTP $get_response)"
        return 1
    fi
    
    # Test multiple endpoints that were failing
    local endpoints=("/upload" "/scoring/adherence/P005" "/therapists/resolve/batch")
    for endpoint in "${endpoints[@]}"; do
        log INFO "Testing CORS for endpoint: $endpoint"
        local endpoint_response=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Origin: http://104.248.143.107:3000" \
            -H "Access-Control-Request-Method: POST" \
            -H "Access-Control-Request-Headers: Content-Type" \
            -X OPTIONS \
            "http://localhost:8080$endpoint")
        
        if [[ "$endpoint_response" == "200" ]]; then
            log SUCCESS "CORS preflight for $endpoint successful (HTTP $endpoint_response)"
        else
            log ERROR "CORS preflight for $endpoint failed (HTTP $endpoint_response)"
            return 1
        fi
    done
    
    log SUCCESS "All CORS tests passed locally!"
    return 0
}

# Deploy to staging
deploy_to_staging() {
    log INFO "Deploying CORS fixes to staging..."
    
    cd "$PROJECT_ROOT"
    
    # Check if we're in the right directory
    if [[ ! -f "docker/compose/docker-compose.staging.yml" ]]; then
        log ERROR "Staging compose file not found"
        return 1
    fi
    
    # Build and deploy
    log INFO "Building and deploying staging environment..."
    docker compose -f docker/compose/docker-compose.staging.yml down
    docker compose -f docker/compose/docker-compose.staging.yml build --no-cache
    docker compose -f docker/compose/docker-compose.staging.yml up -d
    
    # Wait for services to be healthy
    log INFO "Waiting for services to be healthy..."
    sleep 30
    
    # Test staging deployment
    test_staging_deployment
}

# Test staging deployment
test_staging_deployment() {
    log INFO "Testing staging deployment..."
    
    local backend_url="http://104.248.143.107:8080"
    local frontend_url="http://104.248.143.107:3000"
    
    # Test backend health
    log INFO "Testing backend health at $backend_url"
    if curl -s -o /dev/null -w "%{http_code}" "$backend_url/health" | grep -q "200"; then
        log SUCCESS "Backend is healthy"
    else
        log ERROR "Backend health check failed"
        return 1
    fi
    
    # Test CORS from frontend origin
    log INFO "Testing CORS from frontend origin"
    local cors_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Origin: $frontend_url" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        "$backend_url/health")
    
    if [[ "$cors_response" == "200" ]]; then
        log SUCCESS "CORS preflight successful on staging"
    else
        log ERROR "CORS preflight failed on staging (HTTP $cors_response)"
        return 1
    fi
    
    # Test frontend accessibility
    log INFO "Testing frontend accessibility at $frontend_url"
    if curl -s -o /dev/null -w "%{http_code}" "$frontend_url" | grep -q "200"; then
        log SUCCESS "Frontend is accessible"
    else
        log ERROR "Frontend is not accessible"
        return 1
    fi
    
    log SUCCESS "Staging deployment test completed successfully!"
    log INFO "Frontend: $frontend_url"
    log INFO "Backend API: $backend_url"
    log INFO "API Docs: $backend_url/docs"
}

# Show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  test-local    Test CORS configuration locally"
    echo "  deploy        Deploy CORS fixes to staging"
    echo "  test-staging  Test staging deployment"
    echo "  all           Run all tests and deploy"
    echo ""
    echo "Examples:"
    echo "  $0 test-local     # Test CORS locally before deployment"
    echo "  $0 deploy         # Deploy fixes to staging"
    echo "  $0 all            # Test locally, deploy, and test staging"
}

# Main execution
main() {
    local command="${1:-}"
    
    case "$command" in
        test-local)
            test_cors_locally
            ;;
        deploy)
            deploy_to_staging
            ;;
        test-staging)
            test_staging_deployment
            ;;
        all)
            log INFO "Running complete CORS fix workflow..."
            test_cors_locally && deploy_to_staging && test_staging_deployment
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
