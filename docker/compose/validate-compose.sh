#!/bin/bash

# ══════════════════════════════════════════════════════════════════════════════
# Docker Compose Validation Script for EMG C3D Analyzer
# ══════════════════════════════════════════════════════════════════════════════
#
# Purpose: Validate all Docker Compose configurations before deployment
# Usage: ./validate-compose.sh [environment]
# Environment options: dev, staging, production, all
#
# This script helps prevent the "dependency cycle detected" issue and other
# common Docker Compose configuration problems during Coolify deployments.
#
# ══════════════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to validate a docker-compose file
validate_compose_file() {
    local file=$1
    local env_name=$2
    
    print_status $BLUE "🔍 Validating ${env_name} environment..."
    
    if [ ! -f "$file" ]; then
        print_status $RED "❌ File not found: $file"
        return 1
    fi
    
    # Test basic configuration
    if docker-compose -f "$file" config >/dev/null 2>&1; then
        print_status $GREEN "✅ Basic configuration: Valid"
    else
        print_status $RED "❌ Basic configuration: Invalid"
        echo "Errors:"
        docker-compose -f "$file" config 2>&1 | grep -E "(ERROR|error|dependency cycle)" || echo "Unknown validation error"
        return 1
    fi
    
    # Test with Redis profile (if staging/production)
    if [[ "$env_name" == "staging" || "$env_name" == "production" ]]; then
        if docker-compose -f "$file" --profile redis config >/dev/null 2>&1; then
            print_status $GREEN "✅ Redis profile: Valid"
        else
            print_status $RED "❌ Redis profile: Invalid"
            return 1
        fi
        
        # Show service counts
        local basic_services=$(docker-compose -f "$file" config --services 2>/dev/null | wc -l)
        local redis_services=$(docker-compose -f "$file" --profile redis config --services 2>/dev/null | wc -l)
        print_status $YELLOW "ℹ️  Services: Basic($basic_services), With Redis($redis_services)"
    fi
    
    print_status $GREEN "✅ ${env_name} environment validation complete\n"
    return 0
}

# Function to check for common issues
check_common_issues() {
    local file=$1
    local env_name=$2
    
    print_status $BLUE "🔍 Checking common issues in ${env_name}..."
    
    # Check for circular dependencies
    if grep -q "REDIS_DEPENDS_ON.*backend" "$file" 2>/dev/null; then
        print_status $RED "❌ Found potential circular dependency pattern"
        return 1
    fi
    
    # Check for self-references in depends_on
    if grep -A 5 "depends_on:" "$file" | grep -q "\${.*backend.*backend"; then
        print_status $RED "❌ Found self-reference in depends_on"
        return 1
    fi
    
    # Check for obsolete version field
    if grep -q "^version:" "$file"; then
        print_status $YELLOW "⚠️  Obsolete 'version' field found (causes warnings)"
    fi
    
    print_status $GREEN "✅ No common issues detected"
    return 0
}

# Main validation function
main() {
    local environment=${1:-all}
    
    print_status $BLUE "===========================================" 
    print_status $BLUE "🐳 Docker Compose Validation Tool"
    print_status $BLUE "🎯 Target: $environment"
    print_status $BLUE "==========================================="
    echo
    
    local exit_code=0
    
    case $environment in
        "dev")
            validate_compose_file "$SCRIPT_DIR/docker-compose.dev.yml" "dev" || exit_code=1
            check_common_issues "$SCRIPT_DIR/docker-compose.dev.yml" "dev" || exit_code=1
            ;;
        "staging")
            validate_compose_file "$SCRIPT_DIR/docker-compose.staging.yml" "staging" || exit_code=1
            check_common_issues "$SCRIPT_DIR/docker-compose.staging.yml" "staging" || exit_code=1
            ;;
        "production")
            validate_compose_file "$SCRIPT_DIR/docker-compose.production.yml" "production" || exit_code=1
            check_common_issues "$SCRIPT_DIR/docker-compose.production.yml" "production" || exit_code=1
            ;;
        "all")
            validate_compose_file "$SCRIPT_DIR/docker-compose.dev.yml" "dev" || exit_code=1
            check_common_issues "$SCRIPT_DIR/docker-compose.dev.yml" "dev" || exit_code=1
            
            validate_compose_file "$SCRIPT_DIR/docker-compose.staging.yml" "staging" || exit_code=1
            check_common_issues "$SCRIPT_DIR/docker-compose.staging.yml" "staging" || exit_code=1
            
            validate_compose_file "$SCRIPT_DIR/docker-compose.production.yml" "production" || exit_code=1
            check_common_issues "$SCRIPT_DIR/docker-compose.production.yml" "production" || exit_code=1
            ;;
        *)
            print_status $RED "❌ Invalid environment: $environment"
            echo "Usage: $0 [dev|staging|production|all]"
            exit 1
            ;;
    esac
    
    echo
    if [ $exit_code -eq 0 ]; then
        print_status $GREEN "🎉 All validations passed!"
        print_status $GREEN "📦 Ready for Coolify deployment"
    else
        print_status $RED "💥 Validation failed!"
        print_status $RED "🔧 Fix the issues before deployment"
    fi
    
    exit $exit_code
}

# Run main function
main "$@"