#!/bin/bash

# GHOSTLY+ EMG C3D Analyzer - Simple Development Startup Script
#
# v1.0 - Non-Docker Implementation for Fast Development
#
# This script runs the development environment directly on the host machine
# without Docker containers for faster startup and easier debugging.

set -e  # Exit immediately if a command exits with a non-zero status
set -u  # Treat unset variables as an error when substituting
set -o pipefail  # Pipelines fail if any command fails, not just the last one

# --- Configuration ---
readonly PROJECT_NAME="emg-c3d-analyzer"
readonly BACKEND_DIR="backend"
readonly FRONTEND_DIR="frontend"
readonly BACKEND_PORT=8080
readonly FRONTEND_PORT=3000
readonly REDIS_PORT=6379
readonly PID_FILE_NAME=".dev_pids"
readonly BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
readonly PID_FILE="$BASE_DIR/$PID_FILE_NAME"

# Global variables for process tracking
BACKEND_PID=""
FRONTEND_PID=""
FRONTEND_URL=""
NGROK_PID=""
NGROK_PUBLIC_URL=""

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
  ${GREEN}--webhook${NC}            Start with ngrok tunnel for webhook testing
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
  - ngrok (for webhook testing - install with: brew install ngrok)

${BOLD}Examples:${NC}
  ./start_dev_simple.sh                  # Start both backend and frontend
  ./start_dev_simple.sh --install        # Install deps and start services
  ./start_dev_simple.sh --backend-only   # Start only backend API
  ./start_dev_simple.sh --webhook        # Start with ngrok webhook tunnel
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
    
    # Check for ngrok (optional)
    if command -v ngrok >/dev/null 2>&1; then
        log_info "ngrok available: $(ngrok version | head -n1)"
    else
        log_warning "ngrok not found. Install with 'brew install ngrok' for webhook testing."
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
    
    # Create venv if it doesn't exist
    if [ ! -d "venv" ]; then
        log_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate venv
    log_info "Activating virtual environment..."
    source venv/bin/activate
    
    # Upgrade pip first
    log_info "Upgrading pip..."
    python -m pip install --upgrade pip
    
    if [ -f "pyproject.toml" ] && command -v poetry >/dev/null 2>&1; then
        log_info "Using Poetry for backend dependencies"
        poetry install
    elif [ -f "requirements.txt" ]; then
        log_info "Using pip for backend dependencies in venv"
        python -m pip install -r requirements.txt --upgrade
    else
        log_error "No requirements.txt or pyproject.toml found in backend/"
        exit 1
    fi
    
    # Deactivate venv
    deactivate
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
    
    # Kill ngrok processes
    if command -v ngrok >/dev/null 2>&1; then
        local ngrok_pids=$(pgrep -f "ngrok.*http.*$BACKEND_PORT" 2>/dev/null || echo "")
        if [ -n "$ngrok_pids" ]; then
            log_info "Killing ngrok processes: $ngrok_pids"
            echo "$ngrok_pids" | xargs kill -TERM 2>/dev/null || true
            sleep 2
        fi
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

start_ngrok() {
    if ! command -v ngrok >/dev/null 2>&1; then
        log_error "ngrok not installed. Please install with: brew install ngrok"
        log_error "Then configure with: ngrok config add-authtoken YOUR_TOKEN"
        return 1
    fi
    
    # Check if ngrok is already running for our port
    if pgrep -f "ngrok.*http.*$BACKEND_PORT" >/dev/null 2>&1; then
        log_info "ngrok is already running for port $BACKEND_PORT"
        # Try to get the existing public URL
        NGROK_PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for tunnel in data['tunnels']:
        if tunnel['config']['addr'] == 'http://localhost:$BACKEND_PORT':
            print(tunnel['public_url'])
            break
except:
    pass
" 2>/dev/null || echo "")
        return 0
    fi
    
    log_info "Starting ngrok tunnel for port $BACKEND_PORT..."
    
    # Ensure logs directory exists
    mkdir -p "logs"
    local ngrok_log="logs/ngrok.log"
    
    # Start ngrok in background with fixed domain if available
    # Try to use a reserved domain first, fallback to random
    if ngrok config check | grep -q "authtoken" 2>/dev/null; then
        # Try with reserved domain (modify this to your reserved domain)
        ngrok http $BACKEND_PORT --domain=emg-webhook.ngrok-free.app --log=stdout >"$ngrok_log" 2>&1 &
        local ngrok_domain_used="emg-webhook.ngrok-free.app"
    else
        ngrok http $BACKEND_PORT --log=stdout >"$ngrok_log" 2>&1 &
        local ngrok_domain_used="random"
    fi
    NGROK_PID=$!
    echo "$NGROK_PID" >> "$PID_FILE"
    
    log_info "ngrok started with PID: $NGROK_PID"
    
    # Wait for ngrok to start and get the public URL
    local attempts=0
    local max_attempts=30
    while [ $attempts -lt $max_attempts ]; do
        # Try to get public URL from ngrok API
        NGROK_PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for tunnel in data['tunnels']:
        if tunnel['config']['addr'] == 'http://localhost:$BACKEND_PORT':
            print(tunnel['public_url'])
            break
except:
    pass
" 2>/dev/null || echo "")
        
        if [[ -n "$NGROK_PUBLIC_URL" ]]; then
            log_success "ngrok tunnel established: $NGROK_PUBLIC_URL"
            return 0
        fi
        
        # Check if ngrok process is still alive
        if ! kill -0 "$NGROK_PID" 2>/dev/null; then
            log_error "ngrok process died during startup!"
            log_error "Check ngrok configuration and auth token"
            log_error "Run: ngrok config add-authtoken YOUR_TOKEN"
            return 1
        fi
        
        sleep 1
        attempts=$((attempts + 1))
    done
    
    log_error "Failed to get ngrok public URL"
    log_error "Check logs: $ngrok_log"
    return 1
}

start_backend() {
    log_header "Starting Backend API Server"
    cd "$BACKEND_DIR"
    
    # Ensure logs directory exists
    mkdir -p "../logs"
    local backend_console_log="../logs/backend_dev.log"
    
    # Check for venv and activate it
    if [ -d "venv" ]; then
        log_info "Activating Python virtual environment"
        source venv/bin/activate
        log_info "Using venv Python: $(which python)"

        log_info "Ensuring backend dependencies are up to date..."
        ./venv/bin/python -m pip install -r requirements.txt --upgrade --quiet
        log_success "Backend dependencies are synchronized."
    else
        log_error "No virtual environment found. Please run with --install first."
        exit 1
    fi
    
    # Set PYTHONPATH for proper module resolution (same as CI/CD pipeline)
    export PYTHONPATH="$(cd .. && pwd)/backend:$(cd .. && pwd)"
    log_info "Set PYTHONPATH: $PYTHONPATH"
    
    log_info "Starting Uvicorn server for the backend..."
    log_info "✅ Backend logs with timestamps: ../logs/backend.log"
    log_info "✅ Error logs with timestamps: ../logs/backend.error.log"
    log_info "📄 Console output also saved to: $backend_console_log"
    
    # Start backend - app handles internal file logging with timestamps
    if [ -f "pyproject.toml" ] && command -v poetry >/dev/null 2>&1; then
        log_info "Using Poetry to start backend"
        poetry run python -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --reload \
            >"$backend_console_log" 2>&1 &
    else
        log_info "Using uvicorn with activated venv"
        ./venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --reload \
            >"$backend_console_log" 2>&1 &
    fi
    
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$PID_FILE"  # Start PID file
    cd ..
    
    log_success "Backend server started with PID: $BACKEND_PID"
    log_info "📊 Structured logs: logs/backend.log (timestamped)"
    log_info "🚨 Error logs: logs/backend.error.log (errors only)"
    log_info "🖥️  Console output: logs/backend_dev.log (from uvicorn)"
}

start_frontend() {
    log_header "Starting Frontend Development Server"
    local frontend_dir="$FRONTEND_DIR"
    
    if [[ ! -d "$frontend_dir" ]]; then
        log_warning "Frontend directory not found, skipping frontend server startup."
        return
    fi
    
    cd "$frontend_dir"
    
    # Ensure logs directory exists
    mkdir -p "../logs"
    local frontend_console_log="../logs/frontend_dev.log"
    local frontend_timestamped_log="../logs/frontend.log"
    
    # Set environment variables
    export REACT_APP_API_URL="http://localhost:$BACKEND_PORT"
    
    log_info "Ensuring frontend dependencies are installed..."
    # Use npm ci if lockfile exists, otherwise npm install
    if [[ -f "package-lock.json" ]]; then
        log_info "Using 'npm ci' for fast, clean installation from lockfile."
        npm ci
    else
        log_warning "No package-lock.json found. Using 'npm install'."
        npm install
    fi
    log_success "Frontend dependencies are up to date."
    
    # Determine start script (dev preferred over start)
    local start_script
    if grep -q '"dev"' package.json; then
        start_script="dev"
    elif grep -q '"start"' package.json; then
        start_script="start"
    else
        log_error "No 'start' or 'dev' script found in frontend/package.json"
        exit 1
    fi
    
    log_info "Starting frontend server with 'npm run $start_script'..."
    log_info "✅ Frontend logs with timestamps: ../logs/frontend.log"
    log_info "📄 Console output also saved to: $frontend_console_log"
    
    # Start frontend with timestamped logging using a wrapper
    # First, start the process and capture output
    npm run "$start_script" -- --host 0.0.0.0 --port $FRONTEND_PORT \
        > >(while IFS= read -r line; do echo "$(date '+%Y-%m-%d %H:%M:%S') [FRONTEND] $line"; done | tee -a "$frontend_timestamped_log") \
        2> >(while IFS= read -r line; do echo "$(date '+%Y-%m-%d %H:%M:%S') [FRONTEND] $line"; done | tee -a "$frontend_timestamped_log" >&2) &
    FRONTEND_PID=$!
    
    # Also save raw output for compatibility
    npm run "$start_script" -- --host 0.0.0.0 --port $FRONTEND_PORT \
        >"$frontend_console_log" 2>&1 &
    local RAW_FRONTEND_PID=$!
    
    # Kill the raw process and use only the timestamped one
    sleep 1
    kill "$RAW_FRONTEND_PID" 2>/dev/null || true
    
    echo "$FRONTEND_PID" >> "$PID_FILE"  # Append to PID file
    
    # Wait for frontend to be ready by polling the timestamped log file
    log_info "Waiting for frontend server to be ready... (PID: $FRONTEND_PID)"
    local ready=false
    for _ in $(seq 1 30); do # Timeout after 30 seconds
        # Look for URL patterns in both logs
        FRONTEND_URL=$(grep -o 'http://[0-9a-zA-Z.:-]*[0-9]\{4\}' "$frontend_timestamped_log" "$frontend_console_log" 2>/dev/null | head -n 1 || true)
        if [[ -n "$FRONTEND_URL" ]]; then
            log_success "Frontend server is ready!"
            ready=true
            break
        fi
        sleep 1
    done
    
    if [[ "$ready" == false ]]; then
        log_error "Frontend server failed to start or is taking too long."
        log_error "Check timestamped logs: $frontend_timestamped_log"
        log_error "Check console logs: $frontend_console_log"
        log_error "Last 10 lines of timestamped log:"
        if [ -f "$frontend_timestamped_log" ]; then
            tail -n 10 "$frontend_timestamped_log" | sed "s/^/    ${RED}| ${NC}/"
        else
            tail -n 10 "$frontend_console_log" | sed "s/^/    ${RED}| ${NC}/"
        fi
        cleanup
    fi
    
    cd ..
    log_success "Frontend started with PID: $FRONTEND_PID"
    log_info "📊 Timestamped logs: logs/frontend.log"
    log_info "🖥️  Console output: logs/frontend_dev.log"
}

run_tests() {
    log_header "Running Tests"
    
    # Backend tests
    log_info "Running backend tests..."
    cd "$BACKEND_DIR"
    
    # Set PYTHONPATH for proper module resolution (same as CI/CD pipeline)
    export PYTHONPATH="$(cd .. && pwd)/backend:$(cd .. && pwd)"
    log_info "Set PYTHONPATH for tests: $PYTHONPATH"
    
    # Activate venv if it exists
    if [ -d "venv" ]; then
        log_info "Activating virtual environment for tests"
        source venv/bin/activate
    fi
    
    if [ -f "pyproject.toml" ] && command -v poetry >/dev/null 2>&1; then
        poetry run python -m pytest tests/ -v || true
    else
        ./venv/bin/python -m pytest tests/ -v || true
    fi
    
    # Deactivate venv if it was activated
    if [ -d "venv" ]; then
        deactivate
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
    
    # Wait for backend health check
    if [[ -n "$BACKEND_PID" ]]; then
        local attempts=0
        local max_attempts=30
        while [ $attempts -lt $max_attempts ]; do
            if curl -s http://localhost:$BACKEND_PORT/health >/dev/null 2>&1; then
                log_success "Backend is ready and healthy at http://localhost:$BACKEND_PORT"
                break
            fi
            
            # Check if backend process is still alive
            if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
                log_error "Backend process died during startup!"
                log_error "Check detailed logs: logs/backend.log and logs/backend.error.log"
                log_error "Console log: logs/backend_dev.log"
                log_error "Last 10 lines of error log:"
                if [ -f "logs/backend.error.log" ]; then
                    tail -n 10 "logs/backend.error.log" | sed "s/^/    ${RED}| ${NC}/"
                else
                    tail -n 10 "logs/backend_dev.log" | sed "s/^/    ${RED}| ${NC}/"
                fi
                cleanup
            fi
            
            sleep 1
            attempts=$((attempts + 1))
        done
        
        if [ $attempts -eq $max_attempts ]; then
            log_warning "Backend health check timed out, but process is running"
            log_warning "Check logs if you experience issues: logs/backend_dev.log"
        fi
    fi
    
    # Frontend doesn't need health check - already verified during startup
    if [[ -n "$FRONTEND_PID" ]]; then
        log_success "Frontend should be ready at ${FRONTEND_URL:-http://localhost:$FRONTEND_PORT}"
    fi
}

show_status() {
    log_header "Development Environment is Running"
    
    echo -e "${BOLD}Backend API:${NC}      http://localhost:$BACKEND_PORT"
    echo -e "${BOLD}Backend Health:${NC}   http://localhost:$BACKEND_PORT/health"
    echo -e "${BOLD}API Docs:${NC}         http://localhost:$BACKEND_PORT/docs"
    echo -e "${BOLD}Frontend App:${NC}     ${FRONTEND_URL:-http://localhost:$FRONTEND_PORT (assumed)}"
    
    if check_redis_running; then
        echo -e "${BOLD}Redis Cache:${NC}      redis://localhost:$REDIS_PORT"
    else
        echo -e "${BOLD}Redis Cache:${NC}      ${RED}Not Running${NC}"
    fi
    
    if [[ -n "$NGROK_PUBLIC_URL" ]]; then
        echo ""
        echo -e "${PURPLE}${BOLD}🌐 WEBHOOK CONFIGURATION${NC}"
        echo -e "${PURPLE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}Public URL:${NC}       $NGROK_PUBLIC_URL"
        echo -e "${BOLD}Webhook URL:${NC}      $NGROK_PUBLIC_URL/webhooks/storage/c3d-upload"
        echo ""
        echo -e "${YELLOW}${BOLD}📋 CONFIGURE IN SUPABASE DASHBOARD:${NC}"
        echo -e "  1. Go to Storage → Settings → Webhooks"
        echo -e "  2. Create new webhook:"
        echo -e "     - URL: ${GREEN}$NGROK_PUBLIC_URL/webhooks/storage/c3d-upload${NC}"
        echo -e "     - Events: ${GREEN}INSERT${NC} on storage.objects"
        echo -e "     - Bucket: ${GREEN}c3d-examples${NC} (optional filter)"
        echo ""
        echo -e "${CYAN}🎯 Ready to test! Upload a C3D file to Supabase Storage bucket 'c3d-examples'${NC}"
    fi
    
    echo ""
    log_info "Monitoring server health. Press ${BOLD}Ctrl+C${NC} to stop all services."
    log_info "Or run ${BOLD}./start_dev_simple.sh --kill${NC} from another terminal."
}

cleanup() {
    echo ""
    log_info "Initiating shutdown..."
    
    if [[ -f "$PID_FILE" ]]; then
        # Read all PIDs into an array (compatible with older bash)
        pids_to_kill=()
        while IFS= read -r pid; do
            [[ -n "$pid" ]] && pids_to_kill+=("$pid")
        done < "$PID_FILE"
        if (( ${#pids_to_kill[@]} > 0 )); then
            log_info "Stopping processes with PIDs: ${pids_to_kill[*]}"
            # Send SIGTERM first for graceful shutdown
            kill "${pids_to_kill[@]}" 2>/dev/null || true
            
            # Wait a moment for graceful shutdown
            sleep 2
            
            # Force kill any that are still running
            for pid in "${pids_to_kill[@]}"; do
                if kill -0 "$pid" 2>/dev/null; then
                    log_warning "Process $pid did not terminate gracefully, sending SIGKILL."
                    kill -9 "$pid" 2>/dev/null || true
                fi
            done
            log_success "Processes stopped."
        else
            log_info "PID file was empty."
        fi
        rm -f "$PID_FILE"
    else
        log_info "No PID file found. Cleanup complete."
    fi
    
    # Clean up legacy pid files
    rm -f backend.pid frontend.pid 2>/dev/null || true
    
    log_success "Development environment shutdown complete."
    exit 0
}

main() {
    # Ensure logs directory exists early
    mkdir -p "$BASE_DIR/logs"
    
    # Redirect all output of the script to a log file and the console
    exec > >(tee -a "$BASE_DIR/logs/script_runner.log") 2>&1

    local BACKEND_ONLY=false
    local FRONTEND_ONLY=false
    local START_REDIS=true  # Default to starting Redis
    local WEBHOOK_MODE=false
    local INSTALL_DEPS=false
    local RUN_TESTS=false
    local KILL_ONLY=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backend-only) BACKEND_ONLY=true ;;
            --frontend-only) FRONTEND_ONLY=true ;;
            --webhook) WEBHOOK_MODE=true ;;
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
    
    # Set up cleanup trap for graceful shutdown
    trap cleanup SIGINT SIGTERM EXIT
    
    # Handle kill-only mode
    if [ "$KILL_ONLY" = true ]; then
        kill_servers
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
    
    # Start ngrok if webhook mode is enabled
    if [ "$WEBHOOK_MODE" = true ] && [ "$FRONTEND_ONLY" != true ]; then
        start_ngrok || log_warning "Continuing without ngrok (webhook testing disabled)"
    fi
    
    if [ "$BACKEND_ONLY" != true ]; then
        start_frontend
    fi
    
    # Wait for services to be ready
    if [ "$FRONTEND_ONLY" != true ]; then
        wait_for_services
    fi
    
    show_status
    
    # Robust monitoring loop - check if processes are still alive
    while true; do
        # Check if backend is still running
        if [[ -n "$BACKEND_PID" ]] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            log_error "Backend process (PID $BACKEND_PID) has died unexpectedly!"
            log_error "Check logs for details: logs/backend_dev.log"
            break # Exit loop to trigger cleanup
        fi
        
        # Check if frontend is still running (if it was started)
        if [[ -n "$FRONTEND_PID" ]] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
            log_error "Frontend process (PID $FRONTEND_PID) has died unexpectedly!"
            log_error "Check logs for details: logs/frontend_dev.log"
            break # Exit loop to trigger cleanup
        fi
        
        # Check if ngrok is still running (if it was started)
        if [[ -n "$NGROK_PID" ]] && ! kill -0 "$NGROK_PID" 2>/dev/null; then
            log_warning "ngrok process (PID $NGROK_PID) has died unexpectedly!"
            log_warning "Webhook testing may not work properly"
            # Don't break for ngrok - continue running other services
        fi
        
        sleep 5
    done
    
    log_warning "One or more services stopped. Shutting down the environment."
    cleanup
}

# Run main function with all arguments
main "$@"