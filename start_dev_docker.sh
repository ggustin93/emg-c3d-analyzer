#!/bin/bash

# GHOSTLY+ EMG C3D Analyzer - Docker Development Startup Script
#
# This script manages the containerized development environment using Docker Compose v2.
# Features: health monitoring, modern Docker commands, comprehensive error handling.

# --- Strict Error Handling ---
set -euo pipefail
IFS=$'\n\t'

# --- Configuration ---
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_NAME="${PROJECT_NAME:-emg-c3d-analyzer}"

# Docker Compose file locations - fixed to actual paths
readonly COMPOSE_DIR="${SCRIPT_DIR}/docker/compose"
readonly COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.dev.yml"
readonly COMPOSE_STAGING_FILE="${COMPOSE_DIR}/docker-compose.staging.yml"
readonly COMPOSE_PROD_FILE="${COMPOSE_DIR}/docker-compose.production.yml"

# Directories
readonly LOG_DIR="${SCRIPT_DIR}/logs"
readonly DATA_DIR="${SCRIPT_DIR}/data"

# --- ANSI Color Codes ---
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# --- Debug and Diagnostic Configuration ---
DEBUG_MODE=${DEBUG_MODE:-false}
DIAGNOSTIC_LOG_FILE="${LOG_DIR}/diagnostic.log"
STARTUP_LOG_FILE="${LOG_DIR}/startup.log"

# --- Enhanced Logging Functions ---
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date +"%Y-%m-%d %H:%M:%S")"
    
    # Create logs directory if it doesn't exist
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    
    # Format message for console
    local console_msg=""
    case "$level" in
        ERROR)   console_msg="${RED}[${timestamp}] ERROR:${NC} ${message}" ;;
        WARNING) console_msg="${YELLOW}[${timestamp}] WARNING:${NC} ${message}" ;;
        SUCCESS) console_msg="${GREEN}[${timestamp}] SUCCESS:${NC} ${message}" ;;
        INFO)    console_msg="${BLUE}[${timestamp}] INFO:${NC} ${message}" ;;
        DEBUG)   console_msg="${CYAN}[${timestamp}] DEBUG:${NC} ${message}" ;;
        HEADER)  console_msg="\n${PURPLE}${BOLD}═══ ${message} ═══${NC}\n" ;;
        *)       console_msg="[${timestamp}] ${message}" ;;
    esac
    
    # Output to console
    if [[ "$level" == "ERROR" ]]; then
        echo -e "$console_msg" >&2
    else
        echo -e "$console_msg"
    fi
    
    # Write to log file (strip ANSI codes for clean file logging)
    local clean_msg="[${timestamp}] ${level}: ${message}"
    echo "$clean_msg" >> "$STARTUP_LOG_FILE" 2>/dev/null || true
    
    # Debug messages only go to file unless DEBUG_MODE is enabled
    if [[ "$level" == "DEBUG" && "$DEBUG_MODE" != "true" ]]; then
        return
    fi
}

# Enhanced diagnostic logging function
log_diagnostic() {
    local message="$*"
    local timestamp="$(date +"%Y-%m-%d %H:%M:%S")"
    
    # Always write diagnostic info to both console and diagnostic log
    echo -e "${CYAN}[${timestamp}] DIAGNOSTIC:${NC} ${message}"
    echo "[${timestamp}] DIAGNOSTIC: ${message}" >> "$DIAGNOSTIC_LOG_FILE" 2>/dev/null || true
}

# --- Enhanced Error Handling ---
error_handler() {
    local line_no=$1
    local exit_code=$2
    local timestamp="$(date +"%Y-%m-%d %H:%M:%S")"
    
    # Create detailed error report
    log ERROR "════════════════════════════════════════════════════════"
    log ERROR "SCRIPT FAILURE REPORT - ${timestamp}"
    log ERROR "════════════════════════════════════════════════════════"
    log ERROR "Script: ${SCRIPT_NAME}"
    log ERROR "Failed at line: ${line_no}"
    log ERROR "Exit code: ${exit_code}"
    log ERROR "Last command: ${BASH_COMMAND}"
    log ERROR "Working directory: $(pwd)"
    log ERROR "User: $(whoami 2>/dev/null || echo 'unknown')"
    log ERROR "Environment: $(uname -a 2>/dev/null || echo 'unknown')"
    
    # Log current function stack if available
    if [[ ${#FUNCNAME[@]} -gt 1 ]]; then
        log ERROR "Function stack: ${FUNCNAME[*]}"
    fi
    
    # Additional context for common failure points
    case $line_no in
        *) 
            log ERROR "Context: Check diagnostic log at: ${DIAGNOSTIC_LOG_FILE}"
            log ERROR "Full startup log at: ${STARTUP_LOG_FILE}"
            ;;
    esac
    
    # Write error details to diagnostic log
    {
        echo "FATAL ERROR REPORT - ${timestamp}"
        echo "Script: ${SCRIPT_NAME} (line ${line_no})"
        echo "Exit code: ${exit_code}"
        echo "Command: ${BASH_COMMAND}"
        echo "PWD: $(pwd)"
        echo "User: $(whoami 2>/dev/null || echo 'unknown')"
        echo "System: $(uname -a 2>/dev/null || echo 'unknown')"
        echo "Docker status: $(docker --version 2>&1 || echo 'Docker not available')"
        echo "Docker Compose: $(docker compose version 2>&1 || echo 'Docker Compose not available')"
        echo "WSL info: $([[ -f /proc/version ]] && grep -i microsoft /proc/version 2>/dev/null || echo 'Not WSL')"
        echo "════════════════════════════════════════════════════════"
    } >> "$DIAGNOSTIC_LOG_FILE" 2>/dev/null || true
    
    log ERROR "════════════════════════════════════════════════════════"
    
    # Cleanup on error
    if [[ "${CLEANUP_ON_ERROR:-true}" == "true" ]]; then
        log INFO "Attempting cleanup..."
        docker_compose down 2>/dev/null || true
    fi
    
    exit "${exit_code}"
}

trap 'error_handler ${LINENO} $?' ERR

# --- Early System Diagnostics ---
run_system_diagnostics() {
    log_diagnostic "════════════════════════════════════════════════════════"
    log_diagnostic "EMG C3D Analyzer - System Diagnostics Report"
    log_diagnostic "════════════════════════════════════════════════════════"
    log_diagnostic "Script: ${SCRIPT_NAME} started at $(date)"
    log_diagnostic "Script directory: ${SCRIPT_DIR}"
    log_diagnostic "Working directory: $(pwd)"
    
    # Basic system information
    log_diagnostic "System Architecture: $(uname -m 2>/dev/null || echo 'unknown')"
    log_diagnostic "Operating System: $(uname -s 2>/dev/null || echo 'unknown')"
    log_diagnostic "Kernel Version: $(uname -r 2>/dev/null || echo 'unknown')"
    log_diagnostic "Full System Info: $(uname -a 2>/dev/null || echo 'unknown')"
    
    # User and environment context
    log_diagnostic "Current User: $(whoami 2>/dev/null || echo 'unknown')"
    log_diagnostic "User ID: $(id 2>/dev/null || echo 'unknown')"
    log_diagnostic "Shell: ${SHELL:-unknown}"
    log_diagnostic "PATH: ${PATH:-not set}"
    
    # Windows/WSL2 Detection
    if [[ -f /proc/version ]]; then
        local wsl_info=$(grep -i microsoft /proc/version 2>/dev/null || echo "")
        if [[ -n "$wsl_info" ]]; then
            log_diagnostic "WSL Detected: ${wsl_info}"
            log_diagnostic "WSL Version: $(wsl.exe --status 2>/dev/null || echo 'WSL command not available')"
        else
            log_diagnostic "WSL: Not detected (native Linux)"
        fi
    else
        log_diagnostic "WSL: /proc/version not found (likely Windows or other OS)"
    fi
    
    # Docker availability check (non-fatal)
    log_diagnostic "Docker Command Test:"
    if command -v docker &>/dev/null; then
        log_diagnostic "  ✓ Docker command found at: $(command -v docker)"
        local docker_version=$(docker --version 2>&1)
        if [[ $? -eq 0 ]]; then
            log_diagnostic "  ✓ Docker version: ${docker_version}"
        else
            log_diagnostic "  ⚠ Docker command exists but failed: ${docker_version}"
        fi
        
        # Test Docker daemon connectivity (non-fatal)
        local docker_info=$(docker info 2>&1)
        if [[ $? -eq 0 ]]; then
            log_diagnostic "  ✓ Docker daemon is accessible"
            log_diagnostic "  ✓ Docker context: $(docker context show 2>&1 || echo 'unknown')"
        else
            log_diagnostic "  ❌ Docker daemon not accessible: ${docker_info}"
        fi
    else
        log_diagnostic "  ❌ Docker command not found in PATH"
    fi
    
    # Docker Compose availability check (non-fatal)
    log_diagnostic "Docker Compose Test:"
    if docker compose version &>/dev/null; then
        local compose_version=$(docker compose version 2>&1)
        log_diagnostic "  ✓ Docker Compose v2: ${compose_version}"
    elif command -v docker-compose &>/dev/null; then
        local compose_version=$(docker-compose --version 2>&1)
        log_diagnostic "  ⚠ Docker Compose v1 (legacy): ${compose_version}"
    else
        log_diagnostic "  ❌ Docker Compose not available"
    fi
    
    # File system and permissions check
    log_diagnostic "File System Checks:"
    log_diagnostic "  Script permissions: $(ls -la "${BASH_SOURCE[0]}" 2>/dev/null || echo 'unknown')"
    log_diagnostic "  Script directory writable: $(test -w "${SCRIPT_DIR}" && echo 'yes' || echo 'no')"
    log_diagnostic "  Logs directory: ${LOG_DIR} $(test -d "${LOG_DIR}" && echo '(exists)' || echo '(will be created)')"
    
    # Project structure validation
    log_diagnostic "Project Structure:"
    local compose_dir="${SCRIPT_DIR}/docker/compose"
    if [[ -d "$compose_dir" ]]; then
        log_diagnostic "  ✓ Docker compose directory exists: ${compose_dir}"
        for compose_file in "docker-compose.dev.yml" "docker-compose.staging.yml" "docker-compose.production.yml"; do
            if [[ -f "${compose_dir}/${compose_file}" ]]; then
                log_diagnostic "    ✓ ${compose_file} found"
            else
                log_diagnostic "    ❌ ${compose_file} missing"
            fi
        done
    else
        log_diagnostic "  ❌ Docker compose directory missing: ${compose_dir}"
    fi
    
    # Environment file check
    if [[ -f "${SCRIPT_DIR}/.env" ]]; then
        log_diagnostic "  ✓ .env file exists"
        local env_size=$(wc -l < "${SCRIPT_DIR}/.env" 2>/dev/null || echo 0)
        log_diagnostic "    ${env_size} lines in .env file"
    else
        log_diagnostic "  ⚠ .env file not found"
        if [[ -f "${SCRIPT_DIR}/.env.example" ]]; then
            log_diagnostic "    ✓ .env.example available for template"
        else
            log_diagnostic "    ❌ .env.example also missing"
        fi
    fi
    
    log_diagnostic "════════════════════════════════════════════════════════"
    log_diagnostic "End of diagnostics - script execution will continue"
    log_diagnostic "Log files: ${STARTUP_LOG_FILE} | ${DIAGNOSTIC_LOG_FILE}"
    log_diagnostic "════════════════════════════════════════════════════════"
}

# --- Architecture Detection ---

detect_architecture() {
    local arch=$(uname -m)
    log INFO "Detected system architecture: ${arch}"
    
    # Set platform configuration for ARM64 systems
    if [[ "$arch" == "arm64" || "$arch" == "aarch64" ]]; then
        log WARNING "ARM64 architecture detected (Apple Silicon)"
        log INFO "Configuring Docker for x86_64 emulation via Rosetta 2"
        
        # Export platform variables for Docker build
        export DOCKER_DEFAULT_PLATFORM=linux/amd64
        export TARGETPLATFORM=linux/amd64
        export BUILDPLATFORM=linux/amd64
        
        # Enable BuildKit for better performance
        export DOCKER_BUILDKIT=1
        export COMPOSE_DOCKER_CLI_BUILD=1
        
        log SUCCESS "Platform configuration set for ARM64 compatibility"
    else
        # x86_64 systems
        export DOCKER_DEFAULT_PLATFORM=linux/amd64
        export TARGETPLATFORM=linux/amd64
        export BUILDPLATFORM=linux/amd64
        export DOCKER_BUILDKIT=1
        export COMPOSE_DOCKER_CLI_BUILD=1
    fi
}

# --- Docker Utilities ---

# Check if Docker is installed and running
check_docker() {
    log HEADER "Docker Environment Check"
    
    # Check Docker installation
    if ! command -v docker &>/dev/null; then
        log ERROR "Docker is not installed. Please install Docker first:"
        log ERROR "  Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &>/dev/null; then
        log ERROR "Docker daemon is not running. Please start Docker Desktop."
        exit 1
    fi
    
    # Check Docker Compose v2
    if ! docker compose version &>/dev/null; then
        log WARNING "Docker Compose v2 not found. Attempting to use legacy docker-compose..."
        if ! command -v docker-compose &>/dev/null; then
            log ERROR "Neither 'docker compose' nor 'docker-compose' found."
            log ERROR "Please ensure Docker Desktop is installed with Compose v2."
            exit 1
        fi
        # Set fallback to legacy command
        USE_LEGACY_COMPOSE=true
    else
        USE_LEGACY_COMPOSE=false
    fi
    
    if [[ "$USE_LEGACY_COMPOSE" == "true" ]]; then
        log SUCCESS "Docker environment ready (using: docker-compose)"
    else
        log SUCCESS "Docker environment ready (using: docker compose)"
    fi
}

# Wrapper for docker compose commands with proper error handling
docker_compose() {
    local compose_file="${CURRENT_COMPOSE_FILE:-$COMPOSE_FILE}"
    
    # Check if compose file exists
    if [[ ! -f "$compose_file" ]]; then
        log ERROR "Docker Compose file not found: ${compose_file}"
        log ERROR "Expected location: ${COMPOSE_DIR}/"
        exit 1
    fi
    
    # Build env-file argument if .env exists
    local env_file_arg=""
    if [[ -f "${SCRIPT_DIR}/.env" ]]; then
        env_file_arg="--env-file=${SCRIPT_DIR}/.env"
    fi
    
    # Use the appropriate docker compose command
    if [[ "$USE_LEGACY_COMPOSE" == "true" ]]; then
        docker-compose -f "$compose_file" --project-name "$PROJECT_NAME" $env_file_arg "$@"
    else
        docker compose -f "$compose_file" --project-name "$PROJECT_NAME" $env_file_arg "$@"
    fi
}

# --- Environment Setup ---

# =============================================================================
# SUPABASE SELF-HOSTING OPTION (Future Enhancement)
# =============================================================================
# 
# For self-hosted Supabase instead of cloud, see:
# - Official docs: https://supabase.com/docs/guides/self-hosting/docker
# - Example config: docker/compose/docker-compose.staging.yml (lines 214-235)
#
# Required services: PostgreSQL, PostgREST, GoTrue (Auth), Storage, 
# Realtime, Kong Gateway, Studio Dashboard, and optional Vector/Logflare
#
# Key environment variables:
#   SUPABASE_MODE=local|cloud  # Toggle between modes
#   SUPABASE_JWT_SECRET        # 32+ char secret (openssl rand -hex 32)
#   POSTGRES_PASSWORD          # Database password
#   SUPABASE_ANON_KEY         # Generated from JWT secret
#   SUPABASE_SERVICE_KEY      # Generated from JWT secret
#
# Resource requirements: ~4GB RAM, 2+ CPU cores
# Ports: 5433 (DB), 8000 (API), 3001 (Studio)
#
# =============================================================================

setup_environment() {
    log HEADER "Environment Setup"
    
    # Create required directories
    local dirs=(
        "$LOG_DIR"
        "$DATA_DIR"
        "${DATA_DIR}/uploads"
        "${DATA_DIR}/results"
        "${DATA_DIR}/cache"
        "${DATA_DIR}/plots"
        "${DATA_DIR}/temp_uploads"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log INFO "Creating directory: ${dir}"
            mkdir -p "$dir"
        fi
    done
    
    # Check for .env file
    if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
        if [[ -f "${SCRIPT_DIR}/.env.example" ]]; then
            log WARNING "No .env file found. Copying from .env.example..."
            cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
            log WARNING "Please configure your environment variables in .env"
        else
            log ERROR "No .env or .env.example file found."
            create_env_template
        fi
    fi
    
    # Load environment variables from .env file
    if [[ -f "${SCRIPT_DIR}/.env" ]]; then
        log INFO "Loading environment variables from .env file..."
        # Export variables, skipping comments and empty lines
        set -a
        source <(grep -v '^#' "${SCRIPT_DIR}/.env" | grep -v '^[[:space:]]*$')
        set +a
        log SUCCESS "Environment variables loaded from .env"
    fi
    
    # Validate Docker Compose files exist
    if [[ ! -d "$COMPOSE_DIR" ]]; then
        log ERROR "Docker Compose directory not found: ${COMPOSE_DIR}"
        log ERROR "Please ensure the Docker configuration is properly set up."
        exit 1
    fi
    
    log SUCCESS "Environment setup complete"
}

create_env_template() {
    log INFO "Creating .env.example template..."
    cat > "${SCRIPT_DIR}/.env.example" <<'EOF'
# EMG C3D Analyzer - Environment Configuration
# Copy this file to .env and configure for your environment

# === Supabase Configuration ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_KEY=your-service-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# === Application Settings ===
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO
SECRET_KEY=your-secret-key-here
WEBHOOK_SECRET=your-webhook-secret-here

# === Service URLs ===
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8080

# === Redis Configuration ===
REDIS_URL=redis://redis:6379/0
REDIS_CACHE_TTL_SECONDS=3600
REDIS_MAX_CACHE_SIZE_MB=100

# === Docker Settings ===
COMPOSE_PROJECT_NAME=emg-c3d-analyzer
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
EOF
    
    if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
        cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
        log SUCCESS "Created .env file from template"
    fi
}

# --- Service Management ---

start_services() {
    log HEADER "Starting Services"
    
    # Build if needed
    if [[ "${BUILD:-false}" == "true" ]]; then
        log INFO "Building Docker images..."
        docker_compose build --pull
    fi
    
    # Start services
    log INFO "Starting containers..."
    docker_compose up -d --remove-orphans
    
    # Wait for health checks
    wait_for_services
    
    show_status
}

stop_services() {
    log HEADER "Stopping Services"
    docker_compose down --remove-orphans
    log SUCCESS "Services stopped"
}

restart_services() {
    log HEADER "Restarting Services"
    stop_services
    start_services
}

wait_for_services() {
    log INFO "Waiting for services to be healthy..."
    
    local max_wait=60
    local elapsed=0
    local interval=2
    
    while [[ $elapsed -lt $max_wait ]]; do
        if check_health; then
            log SUCCESS "All services are healthy"
            return 0
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        echo -n "."
    done
    
    echo ""
    log WARNING "Some services may not be fully ready after ${max_wait} seconds"
    return 1
}

check_health() {
    local unhealthy=0
    
    # Get list of running services
    local services=$(docker_compose ps --services 2>/dev/null || echo "")
    
    for service in $services; do
        local health=$(docker_compose ps --format json "$service" 2>/dev/null | \
                      jq -r '.[0].Health // "unknown"' 2>/dev/null || echo "unknown")
        
        if [[ "$health" != "healthy" && "$health" != "none" ]]; then
            ((unhealthy++))
        fi
    done
    
    return $unhealthy
}

show_status() {
    log HEADER "Service Status"
    
    # Show container status
    docker_compose ps
    
    echo ""
    log INFO "Service URLs:"
    echo -e "  ${CYAN}Frontend:${NC}     http://localhost:3000"
    echo -e "  ${CYAN}Backend API:${NC}  http://localhost:8080"
    echo -e "  ${CYAN}API Docs:${NC}     http://localhost:8080/docs"
    echo -e "  ${CYAN}Redis:${NC}        redis://localhost:6379"
    echo ""
    
    log INFO "Commands:"
    echo -e "  View logs:    ${BOLD}${SCRIPT_NAME} logs${NC}"
    echo -e "  Stop:         ${BOLD}${SCRIPT_NAME} down${NC}"
    echo -e "  Shell:        ${BOLD}${SCRIPT_NAME} shell [service]${NC}"
}

# --- Utility Functions ---

show_logs() {
    local service="${1:-}"
    
    if [[ -n "$service" ]]; then
        log INFO "Showing logs for: ${service}"
        docker_compose logs -f "$service"
    else
        log INFO "Showing all logs (Ctrl+C to exit)"
        docker_compose logs -f
    fi
}

open_shell() {
    local service="${1:-backend}"
    
    if ! docker_compose ps --services | grep -q "^${service}$"; then
        log ERROR "Service '${service}' not found"
        exit 1
    fi
    
    log INFO "Opening shell in '${service}' container..."
    docker_compose exec "$service" sh -c 'bash || sh'
}

run_tests() {
    log HEADER "Running Tests"
    
    # Backend tests
    log INFO "Running backend tests..."
    docker_compose exec -T backend pytest tests/ -v --tb=short || {
        log ERROR "Backend tests failed"
        return 1
    }
    
    # Frontend tests
    log INFO "Running frontend tests..."
    docker_compose exec -T frontend npm test -- --run || {
        log ERROR "Frontend tests failed"
        return 1
    }
    
    log SUCCESS "All tests passed"
}

cleanup() {
    log HEADER "Basic Cleanup"
    
    # Stop containers
    docker_compose down -v --remove-orphans
    
    # Remove unused resources
    log INFO "Removing unused Docker resources..."
    docker system prune -f --volumes
    
    log SUCCESS "Basic cleanup complete"
}

# Enhanced Docker cleanup with disk space management
clean_docker() {
    log HEADER "Docker Deep Clean"
    
    local aggressive=false
    local all=false
    local dry_run=false
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --aggressive) aggressive=true ;;
            --all) all=true ;;
            --dry-run) dry_run=true ;;
            *) ;;
        esac
        shift
    done
    
    # Show current disk usage
    log INFO "Current Docker disk usage:"
    docker system df
    echo ""
    
    # Show available disk space
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    local disk_free=$(df -h / | awk 'NR==2 {print $4}')
    log INFO "System disk: ${disk_usage}% used, ${disk_free} free"
    
    # Warn if disk space is low
    if [[ $(df / | awk 'NR==2 {print $4}') -lt 10485760 ]]; then  # Less than 10GB
        log WARNING "Low disk space detected! Less than 10GB free."
    fi
    
    echo ""
    
    if [[ "$dry_run" == "true" ]]; then
        log INFO "DRY RUN MODE - No changes will be made"
        echo ""
    fi
    
    # Step 1: Clean stopped containers
    log INFO "Step 1/5: Cleaning stopped containers..."
    if [[ "$dry_run" == "true" ]]; then
        docker container ls -a --filter status=exited --filter status=created -q | wc -l | xargs -I {} echo "Would remove {} stopped containers"
    else
        local containers_before=$(docker container ls -a -q | wc -l)
        docker container prune -f
        local containers_after=$(docker container ls -a -q | wc -l)
        log SUCCESS "Removed $((containers_before - containers_after)) containers"
    fi
    echo ""
    
    # Step 2: Clean dangling images
    log INFO "Step 2/5: Cleaning dangling images..."
    if [[ "$dry_run" == "true" ]]; then
        docker images -f "dangling=true" -q | wc -l | xargs -I {} echo "Would remove {} dangling images"
    else
        local images_before=$(docker images -q | wc -l)
        docker image prune -f
        local images_after=$(docker images -q | wc -l)
        log SUCCESS "Removed $((images_before - images_after)) dangling images"
    fi
    echo ""
    
    # Step 3: Clean all unused images (if aggressive)
    if [[ "$aggressive" == "true" ]]; then
        log INFO "Step 3/5: Cleaning ALL unused images (aggressive mode)..."
        if [[ "$dry_run" == "true" ]]; then
            docker images -q | wc -l | xargs -I {} echo "Would potentially remove up to {} images"
        else
            read -p "$(echo -e "${YELLOW}⚠️  This will remove ALL unused images. Continue? (y/N): ${NC}")" -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker image prune -a -f
                log SUCCESS "Removed all unused images"
            else
                log INFO "Skipped removing unused images"
            fi
        fi
    else
        log INFO "Step 3/5: Skipping unused images (use --aggressive to remove)"
    fi
    echo ""
    
    # Step 4: Clean build cache
    log INFO "Step 4/5: Cleaning build cache..."
    if [[ "$dry_run" == "true" ]]; then
        docker builder du --filter=unused=true | grep -E "^[0-9]" | awk '{sum+=$2} END {print "Would remove approximately", sum/1024/1024, "MB of build cache"}'
    else
        docker builder prune -f
        log SUCCESS "Cleaned build cache"
    fi
    echo ""
    
    # Step 5: Clean volumes (if --all specified)
    if [[ "$all" == "true" ]]; then
        log WARNING "Step 5/5: Cleaning unused volumes (THIS WILL DELETE DATA)..."
        if [[ "$dry_run" == "true" ]]; then
            docker volume ls -f dangling=true -q | wc -l | xargs -I {} echo "Would remove {} unused volumes"
        else
            read -p "$(echo -e "${RED}⚠️  WARNING: This will DELETE unused volumes and their data. Continue? (y/N): ${NC}")" -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker volume prune -f
                log SUCCESS "Removed unused volumes"
            else
                log INFO "Skipped removing volumes"
            fi
        fi
    else
        log INFO "Step 5/5: Skipping volumes (use --all to clean)"
    fi
    echo ""
    
    # Final system prune for networks and remaining items
    if [[ "$dry_run" != "true" ]]; then
        log INFO "Final cleanup pass..."
        docker network prune -f 2>/dev/null || true
    fi
    
    # Show final disk usage
    echo ""
    log INFO "Final Docker disk usage:"
    docker system df
    echo ""
    
    # Show reclaimed space
    local new_disk_free=$(df -h / | awk 'NR==2 {print $4}')
    log SUCCESS "Cleanup complete! Free space: ${disk_free} → ${new_disk_free}"
}

# Check disk space and suggest cleanup if needed
check_disk_space() {
    local available_gb=$(df / | awk 'NR==2 {print $4}' | awk '{print int($1/1024/1024)}')
    
    if [[ $available_gb -lt 5 ]]; then
        log ERROR "Critical: Less than 5GB free disk space!"
        log WARNING "Run '${SCRIPT_NAME} clean-docker --aggressive' to free up space"
        return 1
    elif [[ $available_gb -lt 10 ]]; then
        log WARNING "Warning: Less than 10GB free disk space"
        log INFO "Consider running '${SCRIPT_NAME} clean-docker' to free up space"
    fi
    
    return 0
}

# --- Usage Information ---

usage() {
    cat <<EOF
${BOLD}${CYAN}EMG C3D Analyzer - Docker Development Environment${NC}

${BOLD}Usage:${NC}
  ${SCRIPT_NAME} [COMMAND] [OPTIONS]

${BOLD}Commands:${NC}
  ${GREEN}up${NC}           Start all services (default)
  ${GREEN}down${NC}         Stop all services
  ${GREEN}restart${NC}      Restart all services
  ${GREEN}status${NC}       Show service status
  ${GREEN}logs${NC}         Show logs (optionally specify service)
  ${GREEN}shell${NC}        Open shell in container (default: backend)
  ${GREEN}test${NC}         Run all tests
  ${GREEN}cleanup${NC}      Stop services and remove volumes (basic)
  ${GREEN}clean-docker${NC} Deep clean Docker resources (advanced)
  ${GREEN}diagnose${NC}     Full system diagnostics and troubleshooting
  ${GREEN}check-env${NC}    Quick environment validation
  ${GREEN}help${NC}         Show this help message

${BOLD}Options:${NC}
  ${GREEN}--build${NC}       Rebuild images before starting
  ${GREEN}--staging${NC}    Use staging configuration
  ${GREEN}--production${NC} Use production configuration
  ${GREEN}--debug${NC}      Enable debug output and detailed logging
  ${GREEN}--verbose${NC}    Enable bash debug mode for troubleshooting

${BOLD}Examples:${NC}
  ${SCRIPT_NAME}                    # Start development environment
  ${SCRIPT_NAME} up --build         # Rebuild and start
  ${SCRIPT_NAME} logs backend       # View backend logs
  ${SCRIPT_NAME} shell frontend     # Open shell in frontend container
  ${SCRIPT_NAME} test               # Run all tests
  ${SCRIPT_NAME} clean-docker       # Clean Docker resources
  ${SCRIPT_NAME} clean-docker --aggressive  # Remove all unused images
  ${SCRIPT_NAME} clean-docker --all # Clean everything (including volumes)

${BOLD}Troubleshooting:${NC}
  ${SCRIPT_NAME} check-env          # Quick environment validation
  ${SCRIPT_NAME} diagnose           # Full diagnostics report
  ${SCRIPT_NAME} up --debug         # Start with debug output
  ${SCRIPT_NAME} up --verbose       # Start with bash debug mode

${BOLD}Environment:${NC}
  Configure settings in ${CYAN}.env${NC} file
  Docker Compose files in: ${CYAN}${COMPOSE_DIR}/${NC}

EOF
}

# --- New Diagnostic Commands ---

# Full diagnostic report with all checks
run_full_diagnostics() {
    log HEADER "Full System Diagnostics Report"
    
    # Run the comprehensive system diagnostics
    run_system_diagnostics
    
    # Additional diagnostics specific to full report
    log_diagnostic ""
    log_diagnostic "═══ Additional Docker Environment Analysis ═══"
    
    # Docker context and configuration
    if command -v docker &>/dev/null; then
        log_diagnostic "Docker Configuration Details:"
        
        # Docker contexts
        local contexts=$(docker context ls 2>&1)
        if [[ $? -eq 0 ]]; then
            log_diagnostic "  Docker Contexts:"
            echo "$contexts" | while IFS= read -r line; do
                log_diagnostic "    ${line}"
            done
        else
            log_diagnostic "  Docker contexts: ${contexts}"
        fi
        
        # Docker system information (if daemon accessible)
        local system_info=$(docker system df 2>&1)
        if [[ $? -eq 0 ]]; then
            log_diagnostic "  Docker Disk Usage:"
            echo "$system_info" | while IFS= read -r line; do
                log_diagnostic "    ${line}"
            done
        else
            log_diagnostic "  Docker system info unavailable: ${system_info}"
        fi
        
        # Network information
        local networks=$(docker network ls 2>&1)
        if [[ $? -eq 0 ]]; then
            log_diagnostic "  Docker Networks:"
            echo "$networks" | while IFS= read -r line; do
                log_diagnostic "    ${line}"
            done
        else
            log_diagnostic "  Docker networks unavailable: ${networks}"
        fi
    fi
    
    # Test compose file validity
    log_diagnostic ""
    log_diagnostic "═══ Docker Compose File Validation ═══"
    for compose_file in "$COMPOSE_FILE" "$COMPOSE_STAGING_FILE" "$COMPOSE_PROD_FILE"; do
        if [[ -f "$compose_file" ]]; then
            local file_name=$(basename "$compose_file")
            log_diagnostic "Testing ${file_name}:"
            local compose_test=$(docker compose -f "$compose_file" config 2>&1)
            if [[ $? -eq 0 ]]; then
                log_diagnostic "  ✓ ${file_name} is valid"
            else
                log_diagnostic "  ❌ ${file_name} validation failed:"
                echo "$compose_test" | head -5 | while IFS= read -r line; do
                    log_diagnostic "    ${line}"
                done
            fi
        else
            log_diagnostic "❌ $(basename "$compose_file") not found"
        fi
    done
    
    log_diagnostic ""
    log_diagnostic "═══ Troubleshooting Recommendations ═══"
    
    # Generate specific recommendations based on findings
    if ! command -v docker &>/dev/null; then
        log_diagnostic "🔧 CRITICAL: Install Docker Desktop from https://docker.com/products/docker-desktop"
    elif ! docker info &>/dev/null; then
        log_diagnostic "🔧 CRITICAL: Start Docker Desktop and ensure daemon is running"
        if [[ -f /proc/version ]] && grep -qi microsoft /proc/version; then
            log_diagnostic "🔧 WSL2: Enable WSL2 integration in Docker Desktop Settings → Resources → WSL Integration"
        fi
    else
        log_diagnostic "✅ Docker environment appears functional"
    fi
    
    if ! docker compose version &>/dev/null && ! command -v docker-compose &>/dev/null; then
        log_diagnostic "🔧 Install Docker Compose v2 (usually included with Docker Desktop)"
    fi
    
    log_diagnostic ""
    log_diagnostic "📋 Report complete. Check log files for details:"
    log_diagnostic "   Diagnostic log: ${DIAGNOSTIC_LOG_FILE}"
    log_diagnostic "   Startup log: ${STARTUP_LOG_FILE}"
}

# Environment check only (lightweight validation)
run_environment_check() {
    log HEADER "Environment Check"
    
    # Temporarily disable strict error handling for checks
    set +e
    
    local all_good=true
    
    # Check 1: Docker command
    log INFO "Checking Docker installation..."
    if command -v docker &>/dev/null; then
        log SUCCESS "✓ Docker command found"
        
        # Check Docker daemon
        if docker info &>/dev/null; then
            log SUCCESS "✓ Docker daemon accessible"
        else
            log ERROR "❌ Docker daemon not running"
            all_good=false
        fi
    else
        log ERROR "❌ Docker command not found"
        all_good=false
    fi
    
    # Check 2: Docker Compose
    log INFO "Checking Docker Compose..."
    if docker compose version &>/dev/null; then
        log SUCCESS "✓ Docker Compose v2 available"
    elif command -v docker-compose &>/dev/null; then
        log WARNING "⚠ Only Docker Compose v1 found (legacy)"
    else
        log ERROR "❌ Docker Compose not available"
        all_good=false
    fi
    
    # Check 3: Project structure
    log INFO "Checking project structure..."
    if [[ -d "${SCRIPT_DIR}/docker/compose" ]]; then
        log SUCCESS "✓ Docker compose directory found"
        
        local compose_files=("docker-compose.dev.yml" "docker-compose.staging.yml" "docker-compose.production.yml")
        for file in "${compose_files[@]}"; do
            if [[ -f "${SCRIPT_DIR}/docker/compose/${file}" ]]; then
                log SUCCESS "✓ ${file} found"
            else
                log WARNING "⚠ ${file} missing"
            fi
        done
    else
        log ERROR "❌ Docker compose directory missing"
        all_good=false
    fi
    
    # Check 4: Environment file
    log INFO "Checking environment configuration..."
    if [[ -f "${SCRIPT_DIR}/.env" ]]; then
        log SUCCESS "✓ .env file found"
    else
        log WARNING "⚠ .env file missing"
        if [[ -f "${SCRIPT_DIR}/.env.example" ]]; then
            log INFO "ℹ .env.example available as template"
        fi
    fi
    
    # Check 5: WSL2 (if applicable)
    if [[ -f /proc/version ]] && grep -qi microsoft /proc/version; then
        log INFO "WSL2 environment detected"
        if docker context show | grep -q "default"; then
            log SUCCESS "✓ Docker context configured for WSL2"
        else
            log WARNING "⚠ Docker context may need WSL2 configuration"
        fi
    fi
    
    # Re-enable strict error handling
    set -e
    
    # Summary
    echo ""
    if [[ "$all_good" == "true" ]]; then
        log SUCCESS "🎉 Environment check passed! You can run: ${SCRIPT_NAME} up"
    else
        log ERROR "❌ Environment issues detected. Run '${SCRIPT_NAME} diagnose' for detailed analysis"
        exit 1
    fi
}

# --- Main Execution ---

main() {
    local command="${1:-up}"
    
    # Check for help first
    if [[ "$command" == "--help" || "$command" == "-h" || "$command" == "help" ]]; then
        usage
        exit 0
    fi
    
    shift || true
    
    # Parse options
    BUILD=false
    CURRENT_COMPOSE_FILE="$COMPOSE_FILE"
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --build) BUILD=true ;;
            --staging) CURRENT_COMPOSE_FILE="$COMPOSE_STAGING_FILE" ;;
            --prod|--production) CURRENT_COMPOSE_FILE="$COMPOSE_PROD_FILE" ;;
            --debug) DEBUG_MODE=true ;;
            --verbose) set -x ;; # Enable bash debug mode
            --help|-h) usage; exit 0 ;;
            *) 
                if [[ "$command" == "logs" || "$command" == "shell" || "$command" == "clean-docker" || "$command" == "diagnose" || "$command" == "check-env" ]]; then
                    # These commands accept additional arguments
                    break
                else
                    log ERROR "Unknown option: $1"
                    usage
                    exit 1
                fi
                ;;
        esac
        shift
    done
    
    # Run system diagnostics for non-diagnostic commands (unless they're help/diagnostic commands)
    if [[ "$command" != "help" && "$command" != "diagnose" && "$command" != "check-env" && "$command" != "--help" && "$command" != "-h" ]]; then
        log DEBUG "Running system diagnostics..."
        run_system_diagnostics
    fi
    
    # Pre-flight checks (skip for diagnostic-only commands)
    if [[ "$command" != "diagnose" && "$command" != "check-env" ]]; then
        check_docker
        detect_architecture
        setup_environment
    fi
    
    # Check disk space for operations that need it
    if [[ "$command" == "up" || "$command" == "start" || "$command" == "restart" ]]; then
        check_disk_space || true  # Warn but don't block
    fi
    
    # Execute command
    case "$command" in
        up|start)     start_services ;;
        down|stop)    stop_services ;;
        restart)      restart_services ;;
        status|ps)    show_status ;;
        logs)         show_logs "$@" ;;
        shell|exec)   open_shell "$@" ;;
        test)         run_tests ;;
        cleanup|clean) cleanup ;;
        clean-docker) clean_docker "$@" ;;
        diagnose)     run_full_diagnostics ;;
        check-env)    run_environment_check ;;
        help|-h)      usage ;;
        *)
            log ERROR "Unknown command: ${command}"
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"