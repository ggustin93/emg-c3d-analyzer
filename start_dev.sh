#!/bin/bash

# GHOSTLY+ EMG C3D Analyzer Development Startup Script
# ===================================================
# This script launches the backend API and frontend development server concurrently.

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# Parse arguments
CLEAN_INSTALL=false
if [ "$1" == "--clean" ]; then
    CLEAN_INSTALL=true
    shift # remove the --clean argument
fi

# Logging functions
log_info() {
    echo -e "${BLUE}[$(date +"%H:%M:%S")] ${BOLD}INFO${RESET}: $1"
}

log_success() {
    echo -e "${GREEN}[$(date +"%H:%M:%S")] ${BOLD}SUCCESS${RESET}: $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +"%H:%M:%S")] ${BOLD}WARNING${RESET}: $1"
}

log_error() {
    echo -e "${RED}[$(date +"%H:%M:%S")] ${BOLD}ERROR${RESET}: $1"
}

log_header() {
    echo -e "\n${CYAN}${BOLD}$1${RESET}"
    echo -e "${CYAN}${BOLD}$(printf '=%.0s' $(seq 1 ${#1}))${RESET}\n"
}

# Set the base directory to the location of the script
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$BASE_DIR"

log_header "GHOSTLY+ EMG C3D Analyzer Development Environment"

# Check if port 8080 is already in use
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        log_error "Port $port is already in use. Trying to kill the process..."
        # Try to kill the process using the port
        pid=$(lsof -t -i:$port)
        if [ ! -z "$pid" ]; then
            log_warning "Killing process $pid that is using port $port"
            kill -9 $pid
            sleep 2
            if lsof -i :$port > /dev/null 2>&1; then
                log_error "Failed to free port $port. Please close the application using it and try again."
                return 1
            else
                log_success "Port $port is now free"
                return 0
            fi
        else
            log_error "Could not find process using port $port"
            return 1
        fi
    fi
    return 0
}

# --- Backend API Server ---
log_header "Starting Backend API Server"

# Check if port 8080 is available
if ! check_port 8080; then
    log_error "Cannot start backend server because port 8080 is in use"
    exit 1
fi

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    log_info "Activating Python virtual environment..."
    source .venv/bin/activate
    if [ $? -ne 0 ]; then
        log_error "Failed to activate virtual environment"
        exit 1
    fi
else
    log_warning "No virtual environment found at .venv, using system Python"
fi

# Check if required Python packages are installed
log_info "Checking for required Python packages..."
if ! python -c "import uvicorn, fastapi, ezc3d" 2>/dev/null; then
    log_error "Missing required Python packages. Please run: pip install -r requirements.txt"
    exit 1
fi

# Start the FastAPI server using uvicorn
(
    cd "$BASE_DIR" # Ensure we are in the project root
    log_info "Starting uvicorn server on port 8080..."
    python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload --reload-dir backend > logs/backend.log 2> logs/backend.error.log &
    BACKEND_PID=$!
    
    if [ $? -ne 0 ]; then
        log_error "Failed to start backend server"
        exit 1
    fi
    
    # Wait a moment for the server to start
    sleep 2
    
    # Check if the server is actually running
    if ps -p $BACKEND_PID > /dev/null; then
        log_success "Backend API server started with ${BOLD}PID: $BACKEND_PID${RESET}"
        
        # Check if the server is responding
        if curl -s http://localhost:8080/ > /dev/null; then
            log_success "Backend API is responding at ${BOLD}http://localhost:8080/${RESET}"
        else
            log_warning "Backend API started but not responding. Check logs/backend.error.log for details"
            tail -n 10 logs/backend.error.log | while read line; do
                echo -e "${YELLOW}  | $line${RESET}"
            done
        fi
    else
        log_error "Backend API server failed to start. Check logs/backend.error.log for details"
        tail -n 10 logs/backend.error.log | while read line; do
            echo -e "${RED}  | $line${RESET}"
        done
        exit 1
    fi
)

# --- Frontend Development Server ---
log_header "Starting Frontend Development Server"

if [ -d "frontend" ]; then
    (
        cd frontend

        if [ "$CLEAN_INSTALL" = true ]; then
            log_warning "Performing a clean install of frontend dependencies (--clean flag detected)..."
            if [ -d "node_modules" ]; then rm -rf node_modules; fi
            if [ -f "package-lock.json" ]; then rm -f package-lock.json; fi
            if [ $? -ne 0 ]; then
                log_error "Failed to remove old frontend dependencies"
                exit 1
            fi
        fi

        log_info "Installing frontend dependencies..."
        npm install
        if [ $? -ne 0 ]; then
            log_error "Failed to install frontend dependencies"
            exit 1
        fi
        
        # Check which script is available in package.json
        if grep -q '"dev"' package.json; then
            FRONTEND_SCRIPT="dev"
        elif grep -q '"start"' package.json; then
            FRONTEND_SCRIPT="start"
        else
            log_error "No 'dev' or 'start' script found in package.json"
            exit 1
        fi
        
        log_info "Starting frontend development server with 'npm run $FRONTEND_SCRIPT'..."
        npm run $FRONTEND_SCRIPT > ../logs/frontend.log 2> ../logs/frontend.error.log &
        FRONTEND_PID=$!
        
        # Wait a moment for the server to start
        sleep 5
        
        # Check if the server is actually running
        if ps -p $FRONTEND_PID > /dev/null; then
            log_success "Frontend dev server started with ${BOLD}PID: $FRONTEND_PID${RESET}"
            
            # Try to extract the frontend URL from the log
            FRONTEND_URL=$(grep -o 'http://[0-9.]*:[0-9]*' ../logs/frontend.log | head -1)
            if [ ! -z "$FRONTEND_URL" ]; then
                log_success "Frontend is available at ${BOLD}$FRONTEND_URL${RESET}"
            else
                log_warning "Frontend started but URL not found in logs"
            fi
        else
            log_error "Frontend dev server failed to start. Check logs/frontend.error.log for details"
            tail -n 10 ../logs/frontend.error.log | while read line; do
                echo -e "${RED}  | $line${RESET}"
            done
            exit 1
        fi
    )
else
    log_warning "Frontend directory not found, skipping frontend server startup."
fi

# --- Cleanup ---
# Function to clean up background processes on script exit
cleanup() {
    log_header "Shutting Down Servers"
    
    if [ ! -z "$BACKEND_PID" ]; then
        log_info "Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        if [ $? -eq 0 ]; then
            log_success "Backend server stopped"
        else
            log_error "Failed to stop backend server"
        fi
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        log_info "Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        if [ $? -eq 0 ]; then
            log_success "Frontend server stopped"
        else
            log_error "Failed to stop frontend server"
        fi
    fi
    
    log_success "Development environment shut down"
    exit 0
}

# Trap signals to call the cleanup function
trap cleanup SIGINT SIGTERM

# --- Keep Alive ---
# Display status summary
log_header "Development Environment Status"
echo -e "${BOLD}Backend API:${RESET} http://localhost:8080/"
if [ ! -z "$FRONTEND_URL" ]; then
    echo -e "${BOLD}Frontend:${RESET}   $FRONTEND_URL"
fi
echo ""
log_info "Servers are running. Press ${BOLD}Ctrl+C${RESET} to stop."

# Check server status periodically
while true; do
    sleep 30
    
    # Check if backend is still running
    if ! ps -p $BACKEND_PID > /dev/null; then
        log_error "Backend server is no longer running! Check logs/backend.error.log for details"
        tail -n 10 logs/backend.error.log | while read line; do
            echo -e "${RED}  | $line${RESET}"
        done
    fi
    
    # Check if frontend is still running
    if [ ! -z "$FRONTEND_PID" ] && ! ps -p $FRONTEND_PID > /dev/null; then
        log_error "Frontend server is no longer running! Check logs/frontend.error.log for details"
        tail -n 10 logs/frontend.error.log | while read line; do
            echo -e "${RED}  | $line${RESET}"
        done
    fi
done