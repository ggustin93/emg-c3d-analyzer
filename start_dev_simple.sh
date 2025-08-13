#!/bin/bash

# GHOSTLY+ EMG C3D Analyzer - Simple Development Startup Script
#
# v1.0 - Non-Docker Implementation for Fast Development
#
# This script runs the development environment directly on the host machine
# without Docker containers for faster startup and easier debugging.

set -e  # Exit immediately if a command exits with a non-zero status
set -u  # Treat unset variables as an error when substituting

# --- Configuration ---
readonly PROJECT_NAME="emg-c3d-analyzer"
readonly BACKEND_DIR="backend"
readonly FRONTEND_DIR="frontend"
readonly BACKEND_PORT=8080
readonly FRONTEND_PORT=3000
readonly REDIS_PORT=6379

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
    echo -e "\n${PURPLE}${BOLD}🚀 ${title} 🚀${NC}"
    echo -e "${PURPLE}${BOLD}$(printf '=%.0s' $(seq 1 $((${#title} + 6))))${NC}\n"
}

usage() {
    cat <<EOF
${BOLD}GHOSTLY+ EMG C3D Analyzer - Simple Development Environment${NC}

This script runs the development environment directly on your machine
without Docker for faster startup and easier debugging.

Note: Existing log files are cleared at startup to ensure a clean session.

${BOLD}Usage:${NC}
  ./start_dev_simple.sh [OPTIONS]

${BOLD}Options:${NC}
  ${GREEN}--backend-only${NC}       Start only the backend server
  ${GREEN}--frontend-only${NC}      Start only the frontend server
  ${GREEN}--redis${NC}              Start Redis server (recommended for caching)
  ${GREEN}--no-redis${NC}           Skip Redis server startup
  ${GREEN}--install${NC}            Install dependencies first
  ${GREEN}--test${NC}               Run tests instead of starting services
  ${GREEN}--kill${NC}               Kill any running servers on ports $BACKEND_PORT, $FRONTEND_PORT, and $REDIS_PORT
  ${GREEN}-h, --help${NC}           Show this help message

${BOLD}Requirements:${NC}
  - Python 3.11+ with pip/poetry
  - Node.js 18+ with npm
  - Redis (optional, for caching)

${BOLD}Examples:${NC}
  ./start_dev_simple.sh                  # Start both backend and frontend
  ./start_dev_simple.sh --install        # Install deps and start services
  ./start_dev_simple.sh --backend-only   # Start only backend API
  ./start_dev_simple.sh --test           # Run tests
  ./start_dev_simple.sh --kill           # Kill running servers

EOF
}

check_requirements() {
    log_header "System Requirements Check"
    
    # Check Python
    if ! command -v python3 >/dev/null 2>&1; then
        log_error "Python 3 is not installed. Please install Python 3.11+."
        exit 1
    fi
    
    local python_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    log_info "Python version: $python_version"
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js is not installed. Please install Node.js 18+."
        exit 1
    fi
    
    local node_version=$(node --version)
    log_info "Node.js version: $node_version"
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    local npm_version=$(npm --version)
    log_info "npm version: $npm_version"
    
    # Check for Redis (optional)
    if command -v redis-cli >/dev/null 2>&1; then
        log_info "Redis available: $(redis-cli --version)"
    else
        log_warning "Redis not found. Install Redis for caching support."
    fi
    
    # Check for uvicorn
    if ! python3 -c "import uvicorn" 2>/dev/null; then
        log_warning "uvicorn not found. Will try to install with backend dependencies."
    fi
    
    log_success "System requirements check complete"
}

install_dependencies() {
    log_header "Installing Dependencies"
    
    # Backend dependencies
    log_info "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    
    if [ -f "pyproject.toml" ] && command -v poetry >/dev/null 2>&1; then
        log_info "Using Poetry for backend dependencies"
        poetry install
    elif [ -f "requirements.txt" ]; then
        log_info "Using pip for backend dependencies"
        python3 -m pip install -r requirements.txt
    else
        log_error "No requirements.txt or pyproject.toml found in backend/"
        exit 1
    fi
    
    cd ..
    
    # Frontend dependencies
    log_info "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    cd ..
    log_success "Dependencies installed"
}

kill_servers() {
    log_header "Stopping Running Servers"
    
    # Kill processes on backend port
    local backend_pid=$(lsof -ti:$BACKEND_PORT 2>/dev/null || echo "")
    if [ -n "$backend_pid" ]; then
        log_info "Killing backend server on port $BACKEND_PORT (PID: $backend_pid)"
        kill -TERM $backend_pid || kill -KILL $backend_pid 2>/dev/null || true
        sleep 2
    fi
    
    # Kill processes on frontend port
    local frontend_pid=$(lsof -ti:$FRONTEND_PORT 2>/dev/null || echo "")
    if [ -n "$frontend_pid" ]; then
        log_info "Killing frontend server on port $FRONTEND_PORT (PID: $frontend_pid)"
        kill -TERM $frontend_pid || kill -KILL $frontend_pid 2>/dev/null || true
        sleep 2
    fi
    
    # Kill Redis processes
    local redis_pid=$(lsof -ti:$REDIS_PORT 2>/dev/null || echo "")
    if [ -n "$redis_pid" ]; then
        log_info "Killing Redis server on port $REDIS_PORT (PID: $redis_pid)"
        kill -TERM $redis_pid || kill -KILL $redis_pid 2>/dev/null || true
        sleep 2
    fi
    
    log_success "Servers stopped"
}

clear_logs() {
	log_header "Clearing Logs"
	# Ensure log directories exist
	mkdir -p logs
	mkdir -p backend/logs
	# Remove common log files from previous sessions
	rm -f logs/*.log backend/logs/*.log redis.log 2>/dev/null || true
	log_success "Logs cleared"
}

check_redis_running() {
    if lsof -ti:$REDIS_PORT >/dev/null 2>&1; then
        return 0  # Redis is running
    else
        return 1  # Redis is not running
    fi
}

start_redis() {
    if check_redis_running; then
        log_info "Redis is already running on port $REDIS_PORT"
        return 0
    fi
    
    if ! command -v redis-server >/dev/null 2>&1; then
        log_warning "Redis not installed. Skipping Redis startup."
        log_warning "Install Redis with: brew install redis (macOS) or apt install redis (Ubuntu)"
        return 1
    fi
    
    log_info "Starting Redis server on port $REDIS_PORT..."
    
    # Start Redis in the background with minimal logging
    redis-server --port $REDIS_PORT --daemonize yes --loglevel notice --logfile redis.log
    
    # Wait for Redis to start
    local attempts=0
    local max_attempts=10
    while [ $attempts -lt $max_attempts ]; do
        if check_redis_running; then
            log_success "Redis started successfully"
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
    done
    
    log_error "Failed to start Redis server"
    return 1
}

start_backend() {
    log_info "Starting backend server on port $BACKEND_PORT..."
    cd "$BACKEND_DIR"
    
    # Check if we should use poetry
    if [ -f "pyproject.toml" ] && command -v poetry >/dev/null 2>&1; then
        log_info "Using Poetry to start backend"
        poetry run uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
    else
        log_info "Using direct uvicorn"
        python3 -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
    fi
    
    local backend_pid=$!
    echo $backend_pid > ../backend.pid
    cd ..
    
    log_info "Backend started with PID: $backend_pid"
}

start_frontend() {
    log_info "Starting frontend server on port $FRONTEND_PORT..."
    cd "$FRONTEND_DIR"
    
    # Set environment variables
    export REACT_APP_API_URL="http://localhost:$BACKEND_PORT"
    
    npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT &
    local frontend_pid=$!
    echo $frontend_pid > ../frontend.pid
    cd ..
    
    log_info "Frontend started with PID: $frontend_pid"
}

run_tests() {
    log_header "Running Tests"
    
    # Backend tests
    log_info "Running backend tests..."
    cd "$BACKEND_DIR"
    if [ -f "pyproject.toml" ] && command -v poetry >/dev/null 2>&1; then
        poetry run python -m pytest tests/ -v || true
    else
        python3 -m pytest tests/ -v || true
    fi
    cd ..
    
    # Frontend tests
    log_info "Running frontend tests..."
    cd "$FRONTEND_DIR"
    npm test -- --run || true
    cd ..
    
    log_success "Test execution complete"
}

wait_for_services() {
    log_info "Waiting for services to start..."
    
    # Wait for backend
    local attempts=0
    local max_attempts=30
    while [ $attempts -lt $max_attempts ]; do
        if curl -s http://localhost:$BACKEND_PORT/health >/dev/null 2>&1; then
            log_success "Backend is ready at http://localhost:$BACKEND_PORT"
            break
        fi
        sleep 1
        attempts=$((attempts + 1))
    done
    
    if [ $attempts -eq $max_attempts ]; then
        log_warning "Backend may not be fully ready"
    fi
    
    # Wait a bit for frontend
    sleep 3
    log_success "Frontend should be ready at http://localhost:$FRONTEND_PORT"
}

show_status() {
    log_header "Development Environment Status"
    
    echo -e "  ${CYAN}🔗 Backend API:${NC}      http://localhost:$BACKEND_PORT"
    echo -e "  ${CYAN}🔗 Backend Health:${NC}   http://localhost:$BACKEND_PORT/health"
    echo -e "  ${CYAN}🌐 Frontend:${NC}         http://localhost:$FRONTEND_PORT"
    echo -e "  ${CYAN}📊 API Docs:${NC}         http://localhost:$BACKEND_PORT/docs"
    
    if check_redis_running; then
        echo -e "  ${CYAN}📦 Redis Cache:${NC}      redis://localhost:$REDIS_PORT"
    else
        echo -e "  ${YELLOW}📦 Redis Cache:${NC}      ${RED}Not Running${NC}"
    fi
    
    echo ""
    log_info "Press ${BOLD}Ctrl+C${NC} to stop all services"
    log_info "Or run ${BOLD}./start_dev_simple.sh --kill${NC} to stop services"
}

cleanup() {
    echo ""
    log_info "Shutting down services..."
    
    # Kill backend
    if [ -f backend.pid ]; then
        local backend_pid=$(cat backend.pid)
        kill $backend_pid 2>/dev/null || true
        rm -f backend.pid
    fi
    
    # Kill frontend  
    if [ -f frontend.pid ]; then
        local frontend_pid=$(cat frontend.pid)
        kill $frontend_pid 2>/dev/null || true
        rm -f frontend.pid
    fi
    
    # Clean up any remaining processes
    kill_servers
    
    log_success "Development environment stopped"
    exit 0
}

main() {
    local BACKEND_ONLY=false
    local FRONTEND_ONLY=false
    local START_REDIS=true  # Default to starting Redis
    local INSTALL_DEPS=false
    local RUN_TESTS=false
    local KILL_ONLY=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backend-only) BACKEND_ONLY=true ;;
            --frontend-only) FRONTEND_ONLY=true ;;
            --redis) START_REDIS=true ;;
            --no-redis) START_REDIS=false ;;
            --install) INSTALL_DEPS=true ;;
            --test) RUN_TESTS=true ;;
            --kill) KILL_ONLY=true ;;
            -h|--help) usage; exit 0 ;;
            *) log_error "Unknown option: $1"; usage; exit 1 ;;
        esac
        shift
    done
    
    # Set up cleanup trap
    trap cleanup SIGINT SIGTERM
    
    # Handle kill-only mode
    if [ "$KILL_ONLY" = true ]; then
        kill_servers
        clear_logs
        exit 0
    fi
    
    # Handle test-only mode
    if [ "$RUN_TESTS" = true ]; then
        check_requirements
        run_tests
        exit 0
    fi
    
    # Normal startup flow
    check_requirements
    
    if [ "$INSTALL_DEPS" = true ]; then
        install_dependencies
    fi
    
    # Clean up any existing servers
    kill_servers
    clear_logs
    
    log_header "Starting Development Environment"
    
    # Start Redis first if requested (backend depends on it)
    if [ "$START_REDIS" = true ] && [ "$FRONTEND_ONLY" != true ]; then
        start_redis || log_warning "Continuing without Redis (caching disabled)"
    fi
    
    # Start services based on options
    if [ "$FRONTEND_ONLY" != true ]; then
        start_backend
    fi
    
    if [ "$BACKEND_ONLY" != true ]; then
        start_frontend
    fi
    
    # Wait for services to be ready
    if [ "$FRONTEND_ONLY" != true ]; then
        wait_for_services
    fi
    
    show_status
    
    # Wait for user interrupt
    while true; do
        sleep 1
    done
}

# Run main function with all arguments
main "$@"