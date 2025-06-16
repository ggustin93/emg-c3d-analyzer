#!/bin/bash

# GHOSTLY+ EMG C3D Analyzer Development Startup Script
#
# This script automates the setup and running of the development environment
# for the EMG C3D Analyzer, including both the backend API server and the
# frontend development server. It also handles logging and process management.
#
# Usage:
#   ./start_dev.sh
#   ./start_dev.sh --clean   # Forces a clean reinstall of frontend dependencies
#   ./start_dev.sh --kill    # Tries to kill processes on ports 8080 and 3000 before starting

# --- Configuration ---
LOG_DIR_NAME="logs" # Just the directory name
PID_FILE_NAME=".dev_pids"

# --- ANSI Color Codes ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

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
    echo -e "\n${YELLOW}${BOLD}--- $1 ---${NC}"
    echo -e "${YELLOW}${BOLD}$(printf '=%.0s' $(seq 1 ${#1}))${NC}\n"
}

# --- Cleanup Function ---
cleanup() {
    log_info "Initiating shutdown..."
    if [ -f "$BASE_DIR/$PID_FILE_NAME" ]; then
        PIDS_TO_KILL=$(cat "$BASE_DIR/$PID_FILE_NAME")
        if [ -n "$PIDS_TO_KILL" ]; then
            log_info "Stopping processes with PIDs: $PIDS_TO_KILL"
            # Loop through PIDs to kill them individually
            for pid_to_kill in $PIDS_TO_KILL; do
                if kill -0 "$pid_to_kill" 2>/dev/null; then
                    kill "$pid_to_kill"
                    # Add a small delay and check if process is still alive
                    sleep 0.5
                    if kill -0 "$pid_to_kill" 2>/dev/null; then
                        log_warning "Process $pid_to_kill did not terminate gracefully, sending SIGKILL."
                        kill -9 "$pid_to_kill"
                    fi
                else
                    log_warning "Process with PID $pid_to_kill already stopped or not found."
                fi
            done
            log_success "Processes stopped."
        else
            log_info "PID file was empty."
        fi
        # Remove PID file after attempting to kill processes
        rm -f "$BASE_DIR/$PID_FILE_NAME"
    else
        log_info "No PID file found, nothing to clean up based on PID file."
    fi
    log_success "Development environment shutdown complete."
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM to call cleanup
trap cleanup SIGINT SIGTERM

# --- Main Script ---

# Set base directory to the script's location
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Note: We will cd into project root or subdirectories as needed later.

# Define full paths for log files and PID file, relative to BASE_DIR
LOG_DIR="$BASE_DIR/$LOG_DIR_NAME"
BACKEND_LOG_FILE="$LOG_DIR/backend.log"
BACKEND_ERROR_LOG_FILE="$LOG_DIR/backend.error.log"
FRONTEND_LOG_FILE="$LOG_DIR/frontend.log"
FRONTEND_ERROR_LOG_FILE="$LOG_DIR/frontend.error.log"
PID_FILE="$BASE_DIR/$PID_FILE_NAME"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"
if [ $? -ne 0 ]; then
    log_error "Failed to create log directory: $LOG_DIR"
    exit 1
fi

# Parse arguments
CLEAN_INSTALL=false
KILL_PORTS=false
for arg in "$@"
do
    case $arg in
        --clean)
        CLEAN_INSTALL=true
        shift
        ;;
        --kill)
        KILL_PORTS=true
        shift
        ;;
    esac
done


# --- Port Check and Kill Function ---
check_and_kill_port() {
    local port=$1
    local name=$2
    log_info "Checking if port $port for $name is in use..."
    PID_ON_PORT=$(lsof -t -i:$port)

    if [ -n "$PID_ON_PORT" ]; then
        if [ "$KILL_PORTS" = true ]; then
            log_warning "Port $port is in use by PID(s): $PID_ON_PORT. Attempting to kill due to --kill flag..."
            for p in $PID_ON_PORT; do
                kill -9 "$p"
                sleep 0.5
            done
            PID_ON_PORT=$(lsof -t -i:$port) # Re-check
            if [ -n "$PID_ON_PORT" ]; then
                log_error "Failed to free port $port for $name. Please free it up manually."
                exit 1
            else
                log_success "Port $port for $name is now free."
            fi
        else
            log_error "Port $port for $name is already in use by PID(s): $PID_ON_PORT."
            log_error "Please free it up or run script with '--kill' to attempt automatic termination."
            exit 1
        fi
    else
        log_success "Port $port for $name is available."
    fi
}


# Clear previous PID file
if [ -f "$PID_FILE" ]; then
    log_info "Clearing previous PID file: $PID_FILE"
    rm -f "$PID_FILE"
fi


# --- Backend API Server ---
log_header "Starting Backend API Server"

# Check required port for backend
check_and_kill_port 8080 "Backend"

log_info "Starting backend with 'poetry run'..."
(
    # Ensure dependencies are installed
    log_info "Checking backend dependencies with 'poetry check'..."
    if ! poetry check >/dev/null; then
        log_warning "Poetry check failed. Running 'poetry install' to fix..."
        poetry install
        if [ $? -ne 0 ]; then
            log_error "Failed to install backend dependencies with Poetry."
            exit 1
        fi
    fi

    log_info "Starting Uvicorn server for the backend..."
    # Start the server in the background, redirecting stdout and stderr to log files
    poetry run python -m uvicorn backend.api:app --host 0.0.0.0 --port 8080 --reload --reload-dir backend >> "$BACKEND_LOG_FILE" 2>> "$BACKEND_ERROR_LOG_FILE" &
    BACKEND_PID=$!
    echo $BACKEND_PID >> "$PID_FILE"
    log_success "Backend server started with PID $BACKEND_PID."
    log_info "Backend logs are being written to $BACKEND_LOG_FILE and $BACKEND_ERROR_LOG_FILE"
)


# --- Frontend Development Server ---
log_header "Starting Frontend Development Server"
check_and_kill_port 3000 "Frontend"

if [ -d "$BASE_DIR/frontend" ]; then
    FRONTEND_START_SUCCESS=false
    (
        cd "$BASE_DIR/frontend"

        # --- Conditional NPM Install ---
        NEEDS_NPM_INSTALL=false
        if [ "$CLEAN_INSTALL" = true ]; then
            log_warning "Performing a clean install of frontend dependencies (--clean flag detected)..."
            if [ -d "node_modules" ]; then rm -rf node_modules; fi
            if [ -f "package-lock.json" ]; then rm -f package-lock.json; fi
            NEEDS_NPM_INSTALL=true
        elif [ ! -d "node_modules" ]; then
            log_info "node_modules directory not found. Installing frontend dependencies..."
            NEEDS_NPM_INSTALL=true
        else
            TIMESTAMP_FILE="node_modules/.install_timestamp"
            if [ ! -f "$TIMESTAMP_FILE" ] || \
               [ "package.json" -nt "$TIMESTAMP_FILE" ] || \
               [ "package-lock.json" -nt "$TIMESTAMP_FILE" ]; then
                log_info "package.json or lock file updated. Re-installing frontend dependencies..."
                NEEDS_NPM_INSTALL=true
            else
                log_info "Frontend dependencies appear up to date."
            fi
        fi

        if [ "$NEEDS_NPM_INSTALL" = true ]; then
            log_info "Running npm install..."
            # Redirect npm install output to logs to avoid cluttering main console
            npm install >> "$FRONTEND_LOG_FILE" 2>> "$FRONTEND_ERROR_LOG_FILE"
            if [ $? -ne 0 ]; then
                log_error "Failed to install frontend dependencies. Check $FRONTEND_ERROR_LOG_FILE."
                exit 1 # Exit this subshell
            fi
            touch "node_modules/.install_timestamp"
            log_success "Frontend dependencies installed."
        fi
        # --- End Conditional NPM Install ---

        # Determine frontend script
        if grep -q '"start"' package.json; then
            FRONTEND_SCRIPT="start"
        elif grep -q '"dev"' package.json; then
            FRONTEND_SCRIPT="dev"
        else
            log_error "No 'start' or 'dev' script found in frontend/package.json"
            exit 1 # Exit this subshell
        fi

        log_info "Starting frontend server with 'npm run $FRONTEND_SCRIPT' (logs in $FRONTEND_LOG_FILE, $FRONTEND_ERROR_LOG_FILE)..."
        npm run $FRONTEND_SCRIPT >> "$FRONTEND_LOG_FILE" 2>> "$FRONTEND_ERROR_LOG_FILE" &
        FRONTEND_PID=$!
        echo $FRONTEND_PID >> "$PID_FILE"

        sleep 8 # Give CRA dev server more time

        if ps -p $FRONTEND_PID > /dev/null; then
            log_success "Frontend server process started with PID $FRONTEND_PID."
            FRONTEND_URL_DETECTED=$(grep -o 'http://[0-9a-zA-Z.:-]*[0-9]\{4\}' "$FRONTEND_LOG_FILE" | grep 'localhost:3000\|127.0.0.1:3000' | head -n 1)
            if [ -n "$FRONTEND_URL_DETECTED" ]; then
                log_success "Frontend should be available at $FRONTEND_URL_DETECTED"
            else
                log_warning "Could not auto-detect frontend URL. Assuming http://localhost:3000"
                log_warning "Check $FRONTEND_LOG_FILE for details."
            fi
            FRONTEND_START_SUCCESS=true
        else
            log_error "Frontend server process failed to start or exited quickly. Check $FRONTEND_ERROR_LOG_FILE."
            log_error "Last 10 lines of $FRONTEND_ERROR_LOG_FILE:"
            tail -n 10 "$FRONTEND_ERROR_LOG_FILE" | sed "s/^/    ${RED}| ${NC}/"
        fi
    )
    if [ $? -ne 0 ] && [ "$FRONTEND_START_SUCCESS" = false ]; then
        log_error "Frontend startup failed. Exiting script."
        cleanup # Call cleanup before exiting
        exit 1
    fi
else
    log_warning "Frontend directory not found, skipping frontend server startup."
fi

# --- Keep Alive ---
log_header "Development Environment is Running"
echo -e "${BOLD}Backend API:${NC}  http://localhost:8080"
if [ -n "$FRONTEND_URL_DETECTED" ]; then
    echo -e "${BOLD}Frontend App:${NC} $FRONTEND_URL_DETECTED"
else
    echo -e "${BOLD}Frontend App:${NC} http://localhost:3000 (assumed)"
fi
echo ""
log_info "Monitoring server health. Press ${BOLD}Ctrl+C${NC} to stop all services."

# Wait indefinitely, allowing the trap to handle cleanup.
# The health monitoring loop is removed to simplify; logs and manual checks are primary.
# If you want the health monitoring loop back, it can be added here.
# For now, `wait` will keep the script alive until Ctrl+C.
wait