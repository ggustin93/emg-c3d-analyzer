#!/bin/bash

# ================================================
# EMG C3D Analyzer - Comprehensive Test Suite
# ================================================
# Usage: ./scripts/tests/run-all-tests.sh [category]
# Categories: all, health, integration, deployment
# ================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test category from argument or default to all
TEST_CATEGORY="${1:-all}"

# Base directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_TESTS++))
}

print_failure() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_TESTS++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_skip() {
    echo -e "${BLUE}⏭️  $1${NC}"
    ((SKIPPED_TESTS++))
}

# Function to run a test script
run_test() {
    local test_name="$1"
    local test_script="$2"
    
    ((TOTAL_TESTS++))
    print_test "$test_name"
    
    if [ ! -f "$test_script" ]; then
        print_skip "Test script not found: $test_script"
        return
    fi
    
    if bash "$test_script" > /tmp/test_output.txt 2>&1; then
        if grep -q "✅" /tmp/test_output.txt; then
            print_success "$test_name passed"
        else
            print_warning "$test_name completed with warnings"
            ((PASSED_TESTS++))
        fi
    else
        print_failure "$test_name failed"
        echo "  Error output:"
        cat /tmp/test_output.txt | head -5 | sed 's/^/    /'
    fi
}

# Main test execution
print_header "EMG C3D Analyzer - Test Suite Runner"
echo "Test Category: $TEST_CATEGORY"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

# Health Tests
if [[ "$TEST_CATEGORY" == "all" ]] || [[ "$TEST_CATEGORY" == "health" ]]; then
    print_header "Health Check Tests"
    
    # Quick health check
    run_test "Quick API Health Check" "$SCRIPT_DIR/health/quick-health-check.sh"
    
    # Backend health
    run_test "Backend Service Health" "$SCRIPT_DIR/health/backend-health.sh"
    
    # Frontend health
    run_test "Frontend Service Health" "$SCRIPT_DIR/health/frontend-health.sh"
fi

# Integration Tests
if [[ "$TEST_CATEGORY" == "all" ]] || [[ "$TEST_CATEGORY" == "integration" ]]; then
    print_header "Integration Tests"
    
    # Backend connection
    run_test "Backend Connection Verification" "$SCRIPT_DIR/integration/verify-backend-connection.sh"
    
    # Analysis route
    run_test "Analysis Route Test" "$SCRIPT_DIR/integration/test-analysis-route.sh"
    
    # API endpoints
    run_test "API Endpoints Test" "$SCRIPT_DIR/integration/test-api-endpoints.sh"
    
    # CORS validation
    run_test "CORS Configuration Test" "$SCRIPT_DIR/integration/test-cors.sh"
fi

# Deployment Tests
if [[ "$TEST_CATEGORY" == "all" ]] || [[ "$TEST_CATEGORY" == "deployment" ]]; then
    print_header "Deployment Verification Tests"
    
    # Production verification
    run_test "Production Deployment Verification" "$SCRIPT_DIR/deployment/verify-production.sh"
    
    # Environment variables
    run_test "Environment Configuration Test" "$SCRIPT_DIR/deployment/test-env-config.sh"
    
    # Build verification
    run_test "Build Process Test" "$SCRIPT_DIR/deployment/test-build.sh"
fi

# Test Summary
print_header "Test Results Summary"

echo -e "Total Tests:    ${TOTAL_TESTS}"
echo -e "Passed:         ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed:         ${RED}${FAILED_TESTS}${NC}"
echo -e "Skipped:        ${BLUE}${SKIPPED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed successfully!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    exit 1
fi