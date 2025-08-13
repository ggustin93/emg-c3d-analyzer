#!/bin/bash

# GHOSTLY+ EMG C3D Analyzer - Containerized Development Startup Script
#
# v3.0 - Full Docker Container Implementation
#
# This script manages the complete containerized development environment using Docker Compose.
# All services (backend, frontend, Redis, nginx) run in Docker containers for consistent 
# development and production parity. Includes automatic cleanup, image management, 
# and Coolify deployment preparation.

# --- Script Configuration ---
set -e  # Exit immediately if a command exits with a non-zero status
set -u  # Treat unset variables as an error when substituting
set -o pipefail  # Pipelines fail if any command in the pipeline fails

# --- Configuration Variables ---
readonly PROJECT_NAME="emg-c3d-analyzer"
readonly COMPOSE_FILE="docker-compose.yml"
readonly COMPOSE_PROD_FILE="docker-compose.prod.yml"
readonly COMPOSE_DEV_FILE="docker-compose.dev.yml"
readonly LOG_DIR_NAME="logs"
readonly DATA_DIR_NAME="data"

# --- ANSI Color Codes ---
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# --- Script Globals ---
readonly BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
readonly LOG_DIR="$BASE_DIR/$LOG_DIR_NAME"
readonly DATA_DIR="$BASE_DIR/$DATA_DIR_NAME"

# --- Logging Functions ---
log_info() {
    echo -e "${BLUE}[$(date +"%H:%M:%S")] ${BOLD}INFO${NC}: $1"
}
log_success() {
    echo -e "${GREEN}[$(date +"%H:%M:%S")] ${BOLD}SUCCESS${NC}: $1"
}
log_warning() {
    echo -e "${YELLOW}[$(date +"%H:%M:%S")] ${BOLD}WARNING${NC}: $1"
}
log_error() {
    echo -e "${RED}[$(date +"%H:%M:%S")] ${BOLD}ERROR${NC}: $1"
}
log_header() {
    local title="$1"
    echo -e "\n${PURPLE}${BOLD}🐳 ${title} 🐳${NC}"
    echo -e "${PURPLE}${BOLD}$(printf '=%.0s' $(seq 1 $((${#title} + 6))))${NC}\n"
}

# --- Utility Functions ---

get_compose_file() {
    local compose_file="$COMPOSE_FILE"
    if [[ "${USE_PROD:-false}" == "true" ]]; then
        compose_file="$COMPOSE_PROD_FILE"
    elif [[ "${USE_DEV:-false}" == "true" ]]; then
        compose_file="$COMPOSE_DEV_FILE"
    fi
    echo "$compose_file"
}

usage() {
    cat <<EOF
${BOLD}GHOSTLY+ EMG C3D Analyzer - Containerized Development Environment${NC}

This script manages a complete Docker-based development environment with automatic
container lifecycle management, image cleanup, and production deployment preparation.

${BOLD}Usage:${NC}
  ./start_dev.sh [OPTIONS]

${BOLD}Service Management:${NC}
  ${GREEN}--up${NC}                 Start all development services (default)
  ${GREEN}--down${NC}               Stop and remove all containers
  ${GREEN}--restart${NC}            Restart all services  
  ${GREEN}--rebuild${NC}            Rebuild images and restart services
  ${GREEN}--status${NC}             Show status of all services
  ${GREEN}--dev${NC}                Start with hot reload (no rebuild needed for code changes)

${BOLD}Container Management:${NC}
  ${GREEN}--clean${NC}              Remove all containers, volumes, and networks
  ${GREEN}--prune${NC}              Remove unused Docker resources (images, containers, networks)
  ${GREEN}--reset${NC}              Complete reset: stop, clean, rebuild, start

${BOLD}Service Profiles:${NC}
  ${GREEN}--redis-gui${NC}          Include Redis Insight GUI
  ${GREEN}--reverse-proxy${NC}      Include Nginx reverse proxy
  ${GREEN}--full${NC}               Enable all optional services

${BOLD}Production & Deployment:${NC}
  ${GREEN}--prod${NC}               Use production configuration
  ${GREEN}--coolify${NC}            Generate Coolify deployment configuration
  ${GREEN}--build-prod${NC}         Build production images

${BOLD}Development Utilities:${NC}
  ${GREEN}--logs [service]${NC}     Show logs for service (or all services)
  ${GREEN}--shell [service]${NC}    Open shell in running container
  ${GREEN}--test${NC}               Run tests in containers

${BOLD}Data Management:${NC}
  ${GREEN}--backup-data${NC}        Backup application data
  ${GREEN}--restore-data${NC}       Restore application data
  ${GREEN}--clear-data${NC}         Clear application data directories

${BOLD}Examples:${NC}
  ./start_dev.sh                    # Start basic development environment
  ./start_dev.sh --full             # Start with all optional services
  ./start_dev.sh --rebuild --logs   # Rebuild and show logs
  ./start_dev.sh --prod             # Start production configuration
  ./start_dev.sh --clean --reset    # Complete environment reset

EOF
}

check_docker() {
    log_info "Checking Docker installation..."
    
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed. Please install Docker Desktop first:"
        log_error "  macOS: https://docs.docker.com/desktop/mac/"
        log_error "  Linux: https://docs.docker.com/engine/install/"
        log_error "  Windows: https://docs.docker.com/desktop/windows/"
        exit 1
    fi
    
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        log_error "Docker Compose is not available. Please ensure Docker Desktop is running."
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running. Please start Docker Desktop."
        exit 1
    fi
    
    log_success "Docker is ready"
}

check_environment() {
    log_header "Environment Validation"
    
    # Check required files
    local required_files=("$COMPOSE_FILE" "backend/Dockerfile" "frontend/Dockerfile")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$BASE_DIR/$file" ]]; then
            log_error "Required file missing: $file"
            exit 1
        fi
    done
    
    # Check for .env file
    if [[ ! -f "$BASE_DIR/.env" ]]; then
        log_warning "No .env file found. Creating template..."
        create_env_template
    fi
    
    # Create necessary directories
    mkdir -p "$LOG_DIR" "$DATA_DIR"/{uploads,results,cache,plots,temp_uploads}
    
    log_success "Environment validation complete"
}

create_env_template() {
    cat > "$BASE_DIR/.env.example" <<EOF
# EMG C3D Analyzer Environment Configuration
# Copy to .env and configure for your environment

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_KEY=your_supabase_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application Settings
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO
SECRET_KEY=your_secret_key_here
WEBHOOK_SECRET=your_webhook_secret_here

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
FRONTEND_PORT=3000
BACKEND_URL=http://localhost:8080
BACKEND_PORT=8080

# Redis Configuration
REDIS_CACHE_TTL_SECONDS=3600
REDIS_MAX_CACHE_SIZE_MB=100
REDIS_MAX_MEMORY=256mb

# Production Settings (for --prod mode)
VERSION=latest
BACKEND_WORKERS=2
SENTRY_DSN=
EOF
    
    if [[ ! -f "$BASE_DIR/.env" ]]; then
        cp "$BASE_DIR/.env.example" "$BASE_DIR/.env"
        log_warning "Created .env file. Please configure your environment variables."
    fi
}

cleanup_containers() {
    log_header "Container Cleanup"
    
    local compose_file="$(get_compose_file)"
    
    # Stop and remove containers
    if docker-compose -f "$compose_file" ps -q >/dev/null 2>&1; then
        log_info "Stopping containers..."
        docker-compose -f "$compose_file" down --remove-orphans 2>/dev/null || true
    fi
    
    # Remove project-specific containers
    local containers=$(docker ps -aq --filter "label=com.docker.compose.project=$PROJECT_NAME" 2>/dev/null)
    if [[ -n "$containers" ]]; then
        log_info "Removing remaining project containers..."
        docker rm -f $containers 2>/dev/null || true
    fi
    
    log_success "Container cleanup complete"
}

prune_docker_resources() {
    log_header "Docker Resource Cleanup"
    
    log_info "Removing unused Docker resources..."
    
    # Prune containers
    docker container prune -f >/dev/null 2>&1 || true
    
    # Prune images (keep base images)
    docker image prune -f >/dev/null 2>&1 || true
    
    # Prune networks
    docker network prune -f >/dev/null 2>&1 || true
    
    # Show disk space saved
    log_success "Docker resource cleanup complete"
    docker system df
}

clean_all() {
    log_header "Complete Environment Cleanup"
    
    cleanup_containers
    
    local compose_file="$COMPOSE_FILE"
    if [[ "${USE_PROD:-false}" == "true" ]]; then
        compose_file="$COMPOSE_PROD_FILE"
    fi
    
    # Remove volumes
    log_info "Removing Docker volumes..."
    docker-compose -f "$compose_file" down -v 2>/dev/null || true
    
    # Remove project images
    local images=$(docker images --filter "reference=*$PROJECT_NAME*" -q 2>/dev/null)
    if [[ -n "$images" ]]; then
        log_info "Removing project images..."
        docker rmi -f $images 2>/dev/null || true
    fi
    
    # Remove networks
    local networks=$(docker network ls --filter "name=$PROJECT_NAME" -q 2>/dev/null)
    if [[ -n "$networks" ]]; then
        log_info "Removing project networks..."
        docker network rm $networks 2>/dev/null || true
    fi
    
    prune_docker_resources
    log_success "Complete cleanup finished"
}

build_services() {
    log_header "Building Services"
    
    local compose_file="$COMPOSE_FILE"
    if [[ "${USE_PROD:-false}" == "true" ]]; then
        compose_file="$COMPOSE_PROD_FILE"
    fi
    local build_args=""
    
    # Add profiles if requested
    if [[ "${REDIS_GUI:-false}" == "true" ]]; then
        build_args="$build_args --profile redis-gui"
    fi
    
    if [[ "${REVERSE_PROXY:-false}" == "true" ]]; then
        build_args="$build_args --profile reverse-proxy"
    fi
    
    log_info "Building Docker images..."
    docker-compose -f "$compose_file" $build_args build --no-cache
    
    log_success "Build complete"
}

start_services() {
    log_header "Starting Development Environment"
    
    local compose_file="$COMPOSE_FILE"
    if [[ "${USE_PROD:-false}" == "true" ]]; then
        compose_file="$COMPOSE_PROD_FILE"
    fi
    local up_args="-d"
    
    # Add profiles if requested
    if [[ "${REDIS_GUI:-false}" == "true" ]]; then
        up_args="$up_args --profile redis-gui"
    fi
    
    if [[ "${REVERSE_PROXY:-false}" == "true" ]]; then
        up_args="$up_args --profile reverse-proxy"
    fi
    
    log_info "Starting containers..."
    docker-compose -f "$compose_file" up $up_args
    
    # Wait for services to be healthy
    log_info "Waiting for services to become healthy..."
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if check_services_health; then
            break
        fi
        ((attempt++))
        sleep 2
    done
    
    if [[ $attempt -ge $max_attempts ]]; then
        log_warning "Some services may not be fully ready. Check logs if needed."
    fi
    
    show_service_status
    log_success "Development environment started"
}

check_services_health() {
    local compose_file="$COMPOSE_FILE"
    if [[ "${USE_PROD:-false}" == "true" ]]; then
        compose_file="$COMPOSE_PROD_FILE"
    fi
    local unhealthy_services=()
    
    # Check if services are running and healthy
    local services=$(docker-compose -f "$compose_file" ps --services 2>/dev/null)
    for service in $services; do
        local status=$(docker-compose -f "$compose_file" ps -q "$service" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null)
        if [[ "$status" != "healthy" && "$status" != "" ]]; then
            unhealthy_services+=("$service")
        fi
    done
    
    return ${#unhealthy_services[@]}
}

show_service_status() {
    log_header "Service Status"
    
    local compose_file="$COMPOSE_FILE"
    if [[ "${USE_PROD:-false}" == "true" ]]; then
        compose_file="$COMPOSE_PROD_FILE"
    fi
    
    # Show container status
    docker-compose -f "$compose_file" ps
    
    echo ""
    log_info "${BOLD}Service URLs:${NC}"
    
    if [[ "${REVERSE_PROXY:-false}" == "true" ]]; then
        echo -e "  ${CYAN}🌐 Application:${NC}     http://localhost"
        echo -e "  ${CYAN}🔗 Backend API:${NC}     http://localhost/api"
    else
        echo -e "  ${CYAN}🌐 Frontend:${NC}        http://localhost:3000"
        echo -e "  ${CYAN}🔗 Backend API:${NC}     http://localhost:8080"
    fi
    
    echo -e "  ${CYAN}📊 Redis Cache:${NC}     redis://localhost:6379"
    
    if [[ "${REDIS_GUI:-false}" == "true" ]]; then
        echo -e "  ${CYAN}🖥️  Redis Insight:${NC}   http://localhost:5540"
    fi
    
    echo ""
    log_info "Use ${BOLD}Ctrl+C${NC} to stop, or run ${BOLD}./start_dev.sh --down${NC}"
}

show_logs() {
    local service="${1:-}"
    local compose_file="$COMPOSE_FILE"
    if [[ "${USE_PROD:-false}" == "true" ]]; then
        compose_file="$COMPOSE_PROD_FILE"
    fi
    
    if [[ -n "$service" ]]; then
        log_info "Showing logs for service: $service"
        docker-compose -f "$compose_file" logs -f "$service"
    else
        log_info "Showing logs for all services (use Ctrl+C to exit)"
        docker-compose -f "$compose_file" logs -f
    fi
}

open_shell() {
    local service="${1:-backend}"
    local compose_file="$COMPOSE_FILE"
    if [[ "${USE_PROD:-false}" == "true" ]]; then
        compose_file="$COMPOSE_PROD_FILE"
    fi
    
    log_info "Opening shell in $service container..."
    
    if docker-compose -f "$compose_file" ps -q "$service" >/dev/null 2>&1; then
        docker-compose -f "$compose_file" exec "$service" /bin/bash || \
        docker-compose -f "$compose_file" exec "$service" /bin/sh
    else
        log_error "Service $service is not running"
        exit 1
    fi
}

run_tests() {
    log_header "Running Tests"
    
    local compose_file="$COMPOSE_FILE"
    if [[ "${USE_PROD:-false}" == "true" ]]; then
        compose_file="$COMPOSE_PROD_FILE"
    fi
    
    # Backend tests
    log_info "Running backend tests..."
    docker-compose -f "$compose_file" exec backend python -m pytest tests/ -v || true
    
    # Frontend tests  
    log_info "Running frontend tests..."
    docker-compose -f "$compose_file" exec frontend npm test -- --run || true
    
    log_success "Test execution complete"
}

generate_coolify_config() {
    log_header "Generating Coolify Configuration"
    
    cat > "$BASE_DIR/coolify.yaml" <<EOF
# Coolify Deployment Configuration
# EMG C3D Analyzer - Production Ready

version: "3.8"

services:
  backend:
    build:
      context: ./backend
    environment:
      - SUPABASE_URL=\${SUPABASE_URL}
      - SUPABASE_KEY=\${SUPABASE_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=\${SUPABASE_SERVICE_ROLE_KEY}
      - REDIS_URL=redis://redis:6379/0
    labels:
      - "coolify.managed=true"
      - "coolify.name=emg-backend"
      - "coolify.type=application"

  frontend:
    build:
      context: ./frontend
    environment:
      - REACT_APP_SUPABASE_URL=\${SUPABASE_URL}
      - REACT_APP_SUPABASE_ANON_KEY=\${SUPABASE_ANON_KEY}
    labels:
      - "coolify.managed=true"
      - "coolify.name=emg-frontend"
      - "coolify.type=application"
      - "coolify.port=8080"

  redis:
    image: redis:7.2-alpine
    labels:
      - "coolify.managed=true"
      - "coolify.name=emg-redis"
      - "coolify.type=database"
EOF
    
    log_success "Coolify configuration generated: coolify.yaml"
    log_info "Upload this configuration to your Coolify instance"
}

# --- Main Execution ---
main() {
    # Default options
    local ACTION="up"
    local REDIS_GUI=false
    local REVERSE_PROXY=false
    local USE_PROD=false
    local USE_DEV=false
    local REBUILD=false
    local CLEAN=false
    local PRUNE=false
    local RESET=false
    local SHOW_LOGS=false
    local LOGS_SERVICE=""
    local OPEN_SHELL=false
    local SHELL_SERVICE="backend"
    local RUN_TESTS=false
    local GENERATE_COOLIFY=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --up) ACTION="up" ;;
            --down) ACTION="down" ;;
            --restart) ACTION="restart" ;;
            --rebuild) REBUILD=true ;;
            --status) ACTION="status" ;;
            --clean) CLEAN=true ;;
            --prune) PRUNE=true ;;
            --reset) RESET=true ;;
            --dev) USE_DEV=true ;;
            --redis-gui) REDIS_GUI=true ;;
            --reverse-proxy) REVERSE_PROXY=true ;;
            --full) REDIS_GUI=true; REVERSE_PROXY=true ;;
            --prod) USE_PROD=true ;;
            --coolify) GENERATE_COOLIFY=true ;;
            --build-prod) USE_PROD=true; REBUILD=true ;;
            --logs) 
                SHOW_LOGS=true
                if [[ -n "${2:-}" && ! "${2:-}" =~ ^-- ]]; then
                    LOGS_SERVICE="$2"
                    shift
                fi
                ;;
            --shell)
                OPEN_SHELL=true
                if [[ -n "${2:-}" && ! "${2:-}" =~ ^-- ]]; then
                    SHELL_SERVICE="$2"
                    shift
                fi
                ;;
            --test) RUN_TESTS=true ;;
            --clear-data) 
                rm -rf "$DATA_DIR"/{uploads,results,cache,plots,temp_uploads}/* 2>/dev/null || true
                log_success "Application data cleared"
                exit 0
                ;;
            -h|--help) usage; exit 0 ;;
            *) log_error "Unknown option: $1"; usage; exit 1 ;;
        esac
        shift
    done
    
    # Trap signals for cleanup
    trap cleanup_containers SIGINT SIGTERM
    
    # Pre-flight checks
    check_docker
    check_environment
    
    # Handle special actions first
    if [[ "$GENERATE_COOLIFY" == "true" ]]; then
        generate_coolify_config
        exit 0
    fi
    
    if [[ "$RESET" == "true" ]]; then
        log_warning "This will completely reset your Docker environment. Continue? [y/N]"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            clean_all
            build_services
            start_services
        fi
        exit 0
    fi
    
    if [[ "$CLEAN" == "true" ]]; then
        clean_all
        exit 0
    fi
    
    if [[ "$PRUNE" == "true" ]]; then
        prune_docker_resources
        exit 0
    fi
    
    if [[ "$SHOW_LOGS" == "true" ]]; then
        show_logs "$LOGS_SERVICE"
        exit 0
    fi
    
    if [[ "$OPEN_SHELL" == "true" ]]; then
        open_shell "$SHELL_SERVICE"
        exit 0
    fi
    
    if [[ "$RUN_TESTS" == "true" ]]; then
        run_tests
        exit 0
    fi
    
    # Handle main actions
    case "$ACTION" in
        up)
            if [[ "$REBUILD" == "true" ]]; then
                build_services
            fi
            start_services
            ;;
        down)
            cleanup_containers
            ;;
        restart)
            cleanup_containers
            sleep 2
            start_services
            ;;
        status)
            show_service_status
            ;;
    esac
}

# Run main function with all script arguments
main "$@"