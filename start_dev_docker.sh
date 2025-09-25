#!/bin/bash

# EMG C3D Analyzer - Docker Development Environment
# Wrapper script for Docker Compose development environment

set -euo pipefail

# Script configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly COMPOSE_FILE="${SCRIPT_DIR}/docker/compose/docker-compose.dev.yml"
readonly ENV_FILE="${SCRIPT_DIR}/.env"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Logging function
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

# Check if .env file exists
check_env_file() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log ERROR ".env file not found at ${ENV_FILE}"
        log INFO "Please create .env file from .env.example"
        exit 1
    fi
}

# Check if Docker is running
check_docker() {
    if ! docker info &>/dev/null; then
        log ERROR "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

# Check for port conflicts
check_ports() {
    local ports=("3000" "8080" "6379")
    local conflicts=()
    
    for port in "${ports[@]}"; do
        if lsof -ti :$port &>/dev/null; then
            conflicts+=("$port")
        fi
    done
    
    if [[ ${#conflicts[@]} -gt 0 ]]; then
        log WARNING "Port conflicts detected on: ${conflicts[*]}"
        log INFO "Attempting to stop existing Docker containers..."
        
        # Stop any existing containers
        docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
        
        # Check if ports are still in use
        local still_conflicts=()
        for port in "${conflicts[@]}"; do
            if lsof -ti :$port &>/dev/null; then
                still_conflicts+=("$port")
            fi
        done
        
        if [[ ${#still_conflicts[@]} -gt 0 ]]; then
            log ERROR "Ports still in use: ${still_conflicts[*]}"
            log INFO "Please stop other services using these ports:"
            for port in "${still_conflicts[@]}"; do
                log INFO "  Port $port: $(lsof -ti :$port | head -1)"
            done
            log INFO "Or use: ./start_dev_docker.sh down --force to kill processes"
            exit 1
        fi
    fi
}

# Force stop services and kill processes
force_stop() {
    log INFO "Force stopping all services..."
    
    # Stop Docker containers
    docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
    
    # Kill processes on required ports
    local ports=("3000" "8080" "6379")
    for port in "${ports[@]}"; do
        local pids=$(lsof -ti :$port 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            log INFO "Killing processes on port $port: $pids"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    done
    
    log SUCCESS "Force stop completed"
}

# Start services
start_services() {
    log INFO "Starting development environment..."
    
    # Check for port conflicts first
    check_ports
    
    # Check if --build flag is passed
    local build_flag=""
    if [[ "$*" == *"--build"* ]]; then
        log INFO "Rebuilding Docker images with latest environment variables..."
        build_flag="--build"
    fi
    
    # Use docker compose with proper environment file handling
    if [[ -f "$ENV_FILE" ]]; then
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d $build_flag "$@"
    else
        docker compose -f "$COMPOSE_FILE" up -d $build_flag "$@"
    fi
    
    log SUCCESS "Development environment started"
    log INFO "Frontend: http://localhost:3000"
    log INFO "Backend: http://localhost:8080"
    log INFO "API Docs: http://localhost:8080/docs"
    
    # Remind about rebuild if environment variables were recently changed
    if [[ -z "$build_flag" ]]; then
        log INFO "💡 Tip: If you changed environment variables, use './start_dev_docker.sh up --build' to rebuild"
    fi
}

# Stop services
stop_services() {
    log INFO "Stopping development environment..."
    docker compose -f "$COMPOSE_FILE" down
    log SUCCESS "Development environment stopped"
}

# Show status
show_status() {
    docker compose -f "$COMPOSE_FILE" ps
}

# Show logs
show_logs() {
    local service="${1:-}"
    if [[ -n "$service" ]]; then
        docker compose -f "$COMPOSE_FILE" logs -f "$service"
    else
        docker compose -f "$COMPOSE_FILE" logs -f
    fi
}

# Main execution
main() {
    local command="${1:-up}"
    
    # Pre-flight checks
        check_docker
    check_env_file
    
    case "$command" in
        up|start)
            start_services "${@:2}"
            ;;
        down|stop)
            if [[ "${2:-}" == "--force" ]]; then
                force_stop
            else
                stop_services
            fi
            ;;
        restart)
            stop_services
            start_services "${@:2}"
            ;;
        status|ps)
            show_status
            ;;
        logs)
            show_logs "${@:2}"
            ;;
        clean)
            force_stop
            log INFO "Cleaning up Docker resources..."
            docker system prune -f
            log SUCCESS "Cleanup completed"
            ;;
        *)
            echo "Usage: $0 [up|down|restart|status|logs|clean] [service] [--build] [--force]"
            echo "  up/start         - Start development environment"
            echo "  up --build       - Rebuild images and start (use after changing .env)"
            echo "  down/stop        - Stop development environment"
            echo "  down --force     - Force stop and kill processes on ports"
            echo "  restart          - Restart development environment"
            echo "  restart --build  - Rebuild and restart (for env var changes)"
            echo "  status/ps        - Show service status"
            echo "  logs             - Show logs (optionally specify service)"
            echo "  clean            - Force stop and clean Docker resources"
            echo ""
            echo "Examples:"
            echo "  $0 up                  # Start normally"
            echo "  $0 up --build          # Rebuild images (after .env changes)"
            echo "  $0 logs frontend       # View frontend logs"
            echo "  $0 down --force        # Force stop if ports are stuck"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"