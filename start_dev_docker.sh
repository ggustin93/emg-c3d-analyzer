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

# --- Logging Functions ---
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
        HEADER)  echo -e "\n${PURPLE}${BOLD}═══ ${message} ═══${NC}\n" ;;
        *)       echo "[${timestamp}] ${message}" ;;
    esac
}

# --- Error Handling ---
error_handler() {
    local line_no=$1
    local exit_code=$2
    log ERROR "Script failed at line ${line_no} with exit code ${exit_code}"
    log ERROR "Last command: ${BASH_COMMAND}"
    
    # Cleanup on error
    if [[ "${CLEANUP_ON_ERROR:-true}" == "true" ]]; then
        log INFO "Attempting cleanup..."
        docker_compose down 2>/dev/null || true
    fi
    
    exit "${exit_code}"
}

trap 'error_handler ${LINENO} $?' ERR

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
    
    # Use the appropriate docker compose command
    if [[ "$USE_LEGACY_COMPOSE" == "true" ]]; then
        docker-compose -f "$compose_file" --project-name "$PROJECT_NAME" "$@"
    else
        docker compose -f "$compose_file" --project-name "$PROJECT_NAME" "$@"
    fi
}

# --- Environment Setup ---

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
    log HEADER "Cleanup"
    
    # Stop containers
    docker_compose down -v --remove-orphans
    
    # Remove unused resources
    log INFO "Removing unused Docker resources..."
    docker system prune -f --volumes
    
    log SUCCESS "Cleanup complete"
}

# --- Usage Information ---

usage() {
    cat <<EOF
${BOLD}${CYAN}EMG C3D Analyzer - Docker Development Environment${NC}

${BOLD}Usage:${NC}
  ${SCRIPT_NAME} [COMMAND] [OPTIONS]

${BOLD}Commands:${NC}
  ${GREEN}up${NC}        Start all services (default)
  ${GREEN}down${NC}      Stop all services
  ${GREEN}restart${NC}   Restart all services
  ${GREEN}status${NC}    Show service status
  ${GREEN}logs${NC}      Show logs (optionally specify service)
  ${GREEN}shell${NC}     Open shell in container (default: backend)
  ${GREEN}test${NC}      Run all tests
  ${GREEN}cleanup${NC}   Stop services and remove volumes
  ${GREEN}help${NC}      Show this help message

${BOLD}Options:${NC}
  ${GREEN}--build${NC}       Rebuild images before starting
  ${GREEN}--staging${NC}    Use staging configuration
  ${GREEN}--production${NC} Use production configuration

${BOLD}Examples:${NC}
  ${SCRIPT_NAME}                    # Start development environment
  ${SCRIPT_NAME} up --build         # Rebuild and start
  ${SCRIPT_NAME} logs backend       # View backend logs
  ${SCRIPT_NAME} shell frontend     # Open shell in frontend container
  ${SCRIPT_NAME} test               # Run all tests

${BOLD}Environment:${NC}
  Configure settings in ${CYAN}.env${NC} file
  Docker Compose files in: ${CYAN}${COMPOSE_DIR}/${NC}

EOF
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
            --help|-h) usage; exit 0 ;;
            *) 
                if [[ "$command" == "logs" || "$command" == "shell" ]]; then
                    # These commands accept a service name
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
    
    # Pre-flight checks
    check_docker
    detect_architecture
    setup_environment
    
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