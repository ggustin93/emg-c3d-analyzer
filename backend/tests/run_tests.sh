#!/bin/bash

# GHOSTLY+ EMG C3D Analyzer Test Runner Script
#
# This script automates the setup and running of tests for the EMG C3D Analyzer.
# It ensures all dependencies are installed and the environment is properly set up.

# --- Script Configuration ---
set -e # Exit immediately if a command exits with a non-zero status.
set -u # Treat unset variables as an error when substituting.
set -o pipefail # Pipelines fail if any command in the pipeline fails.

# --- ANSI Color Codes ---
readonly C_RESET='\033[0m'
readonly C_RED='\033[0;31m'
readonly C_GREEN='\033[0;32m'
readonly C_YELLOW='\033[0;33m'
readonly C_BLUE='\033[0;34m'
readonly C_MAGENTA='\033[0;35m'
readonly C_CYAN='\033[0;36m'
readonly C_BOLD='\033[1m'

# --- Script Globals ---
readonly BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
readonly PROJECT_ROOT="$(cd "$BASE_DIR/../.." &>/dev/null && pwd)"

# --- Logging Functions ---
log_info() {
    echo -e "${C_CYAN}⚙️  [$(date +"%H:%M:%S")] INFO:${C_RESET} $1"
}
log_success() {
    echo -e "${C_GREEN}✅ [$(date +"%H:%M:%S")] SUCCESS:${C_RESET} $1"
}
log_warning() {
    echo -e "${C_YELLOW}⚠️  [$(date +"%H:%M:%S")] WARNING:${C_RESET} $1"
}
log_error() {
    echo -e "${C_RED}❌ [$(date +"%H:%M:%S")] ERROR:${C_RESET} $1"
}
log_header() {
    local title="$1"
    echo -e "\n${C_MAGENTA}${C_BOLD}🚀 --- ${title} --- 🚀${C_RESET}"
}

# --- Utility Functions ---
activate_venv() {
    log_info "Searching for a virtual environment..."
    if [[ -d "$PROJECT_ROOT/.venv" ]]; then
        log_info "Activating virtual environment from '.venv'..."
        source "$PROJECT_ROOT/.venv/bin/activate"
    elif [[ -d "$PROJECT_ROOT/venv" ]]; then
        log_info "Activating virtual environment from 'venv'..."
        source "$PROJECT_ROOT/venv/bin/activate"
    else
        log_warning "No virtual environment found. Using system Python."
    fi
}

usage() {
    cat <<EOF
GHOSTLY+ EMG C3D Analyzer Test Runner Script

This script automates the setup and running of tests for the EMG C3D Analyzer.
It automatically handles virtual environment activation and dependency installation.

Usage:
  ./run_tests.sh [OPTIONS]

Options:
  -v, --verbose       Run tests in verbose mode.
  -h, --help          Show this help message.
EOF
}

ensure_dependencies() {
    log_header "Checking & Installing Dependencies"
    
    local req_file="$PROJECT_ROOT/backend/requirements-dev.txt"
    if [[ ! -f "$req_file" ]]; then
        log_warning "requirements-dev.txt not found. Skipping dependency installation."
        return
    fi
    
    log_info "Installing/verifying dependencies from requirements-dev.txt..."
    pip install -q -r "$req_file"
    log_success "Dependencies are up to date."
}

run_tests() {
    log_header "Executing Test Suite"
    
    export PYTHONPATH="$PROJECT_ROOT"
    log_info "PYTHONPATH set to: $PYTHONPATH"
    
    local test_cmd="python $BASE_DIR/run_tests.py"
    if [[ "$VERBOSE" == true ]]; then
        log_info "Running tests in verbose mode..."
        test_cmd+=" --verbose"
    else
        log_info "Running tests..."
    fi
    
    eval "$test_cmd"
    local test_exit_code=$?
    
    log_header "Test Run Summary"
    if [[ $test_exit_code -eq 0 ]]; then
        log_success "🎉 All tests passed successfully! Great work! 🎉"
    else
        log_error "🔥 Some tests failed. Please review the output above. 🔥"
        exit $test_exit_code
    fi
}

# --- Main Execution ---
main() {
    local VERBOSE=false
    
    while getopts ":vh" opt; do
        case "${opt}" in
            v) VERBOSE=true ;;
            h) usage; exit 0 ;;
            \?) echo "Invalid option: -${OPTARG}" >&2; usage; exit 1 ;;
        esac
    done
    
    activate_venv
    ensure_dependencies
    run_tests
}

main "$@" 