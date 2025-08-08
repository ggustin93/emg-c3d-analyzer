#!/bin/bash

# GHOSTLY+ EMG C3D Analyzer Development Startup Script
#
# v2.0 - Improved for Robustness and Standard Practices
#
# This script automates the setup and running of the development environment
# for the EMG C3D Analyzer, including both the backend API server and the
# frontend development server. It also handles logging and process management.

# --- Script Configuration ---
# Exit immediately if a command exits with a non-zero status.
set -e
# Treat unset variables as an error when substituting.
set -u
# Pipelines fail if any command in the pipeline fails, not just the last one.
set -o pipefail

# --- Configuration Variables ---
readonly LOG_DIR_NAME="logs"
readonly PID_FILE_NAME=".dev_pids"
readonly DATA_DIR_NAME="data"

# --- ANSI Color Codes ---
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# --- Script Globals ---
# Set base directory to the script's location
readonly BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
readonly LOG_DIR="$BASE_DIR/$LOG_DIR_NAME"
readonly PID_FILE="$BASE_DIR/$PID_FILE_NAME"
BACKEND_PID=""
FRONTEND_PID=""
FRONTEND_URL=""

# --- Logging Functions ---
# (These are already excellent, no major changes needed)
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
    echo -e "\n${YELLOW}${BOLD}--- ${title} ---${NC}"
    # A simpler way to create the underline
    echo -e "${YELLOW}${BOLD}$(printf '=%.0s' $(seq 1 ${#title}))===${NC}\n"
}

# --- Utility Functions ---

usage() {
    cat <<EOF
GHOSTLY+ EMG C3D Analyzer Development Startup Script

This script automates the setup and running of the development environment.

Usage:
  ./start_dev.sh [OPTIONS]

Options:
  -c, --clean         Forces a clean reinstall of frontend dependencies (removes node_modules).
  -k, --kill          Tries to kill processes on ports 8080 and 3000 before starting.
  -d, --clear-cache   Clears data cache directories (uploads, results, cache).
  -l, --keep-logs     Prevents clearing logs on startup.
  -h, --help          Show this help message.
EOF
}

cleanup() {
    log_info "Initiating shutdown..."
    if [[ -f "$PID_FILE" ]]; then
        # Read all PIDs into an array
        mapfile -t pids_to_kill < "$PID_FILE"
        if (( ${#pids_to_kill[@]} > 0 )); then
            log_info "Stopping processes with PIDs: ${pids_to_kill[*]}"
            # Use kill with the list of PIDs. Sends SIGTERM by default.
            kill "${pids_to_kill[@]}" 2>/dev/null || true

            # Wait a moment for graceful shutdown
            sleep 1

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
    log_success "Development environment shutdown complete."
    exit 0
}

clear_data_cache() {
    log_header "Clearing Data Cache"
    local data_base_dir="$BASE_DIR/$DATA_DIR_NAME"
    local dirs_to_clear=("uploads" "results" "cache" "plots" "temp_uploads")

    for dir in "${dirs_to_clear[@]}"; do
        local full_path="$data_base_dir/$dir"
        if [[ -d "$full_path" ]]; then
            log_info "Clearing '$dir' directory..."
            # Use a glob to remove contents, safer than `rm -rf path/*`
            rm -rf "$full_path"/{*,.*} 2>/dev/null || true
            log_success "'$dir' directory cleared."
        else
            log_info "'$dir' directory does not exist, skipping."
        fi
    done
    mkdir -p "$data_base_dir"
    log_success "Data cache clearing completed."
}

clear_logs() {
    log_header "Clearing Log Files"
    if [[ -d "$LOG_DIR" ]]; then
        log_info "Clearing log files in '$LOG_DIR'..."
        find "$LOG_DIR" -name "*.log" -type f -delete
        log_success "Log files cleared."
    fi
    # Also clear backend.log in the root directory if it exists
    if [[ -f "$BASE_DIR/backend.log" ]]; then
        log_info "Clearing legacy backend.log in project root..."
        rm -f "$BASE_DIR/backend.log"
    fi
    mkdir -p "$LOG_DIR"
    log_success "Log clearing completed."
}

check_and_kill_port() {
    local port="$1"
    local name="$2"
    local force_kill="${3:-false}"

    log_info "Checking if port $port ($name) is in use..."
    # Use -P and -n to speed up lsof
    local pids
    pids=$(lsof -t -i:"$port" -P -n) || true # `|| true` prevents exit on no-match from `set -e`

    if [[ -n "$pids" ]]; then
        if [[ "$force_kill" == true ]]; then
            log_warning "Port $port ($name) is in use by PID(s): $pids. Attempting to kill..."
            # Kill all PIDs at once
            kill -9 $pids 2>/dev/null || true
            sleep 0.5 # Give OS time to release port
            log_success "Port $port ($name) is now free."
        else
            log_error "Port $port ($name) is already in use by PID(s): $pids."
            log_error "Please free it up or run script with '--kill' (-k) to force termination."
            exit 1
        fi
    else
        log_success "Port $port ($name) is available."
    fi
}

start_backend() {
    log_header "Starting Backend API Server"
    check_and_kill_port 8080 "Backend" "$KILL_PORTS"

    log_info "Ensuring backend dependencies are installed..."
    # Use `if ! command` for cleaner logic with `set -e`
    if ! poetry check >/dev/null 2>&1; then
        log_warning "Poetry check failed or dependencies missing. Running 'poetry install'."
        poetry install
    fi

    log_info "Starting Uvicorn server for the backend..."
    local backend_log="$LOG_DIR/backend.log"
    local backend_err_log="$LOG_DIR/backend.error.log"

    # Start in background, redirecting output
    poetry run python -m uvicorn backend.interfaces.api:app --host 0.0.0.0 --port 8080 --reload --reload-dir backend \
        >"$backend_log" 2>"$backend_err_log" &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$PID_FILE" # Overwrite PID file with the first PID

    log_success "Backend server started with PID $BACKEND_PID."
    log_info "Logs: $backend_log (out), $backend_err_log (err)"
}

start_frontend() {
    log_header "Starting Frontend Development Server"
    local frontend_dir="$BASE_DIR/frontend"

    if [[ ! -d "$frontend_dir" ]]; then
        log_warning "Frontend directory not found, skipping frontend server startup."
        return
    fi

    # Always kill the frontend port, as dev servers can get stuck
    check_and_kill_port 3000 "Frontend" true

    cd "$frontend_dir"

    local frontend_log="$LOG_DIR/frontend.log"
    local frontend_err_log="$LOG_DIR/frontend.error.log"

    if [[ "$CLEAN_INSTALL" == true ]]; then
        log_warning "Performing a clean install of frontend dependencies (--clean)..."
        rm -rf node_modules package-lock.json
    fi

    log_info "Ensuring frontend dependencies are installed..."
    # npm ci is faster and more reliable if a lockfile exists
    if [[ -f "package-lock.json" ]]; then
        log_info "Using 'npm ci' for fast, clean installation from lockfile."
        npm ci --silent >"$frontend_log" 2>"$frontend_err_log"
    else
        log_warning "No package-lock.json found. Using 'npm install'."
        npm install --silent >"$frontend_log" 2>"$frontend_err_log"
    fi
    log_success "Frontend dependencies are up to date."

    # Determine start script
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
    npm run "$start_script" >>"$frontend_log" 2>>"$frontend_err_log" &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" >> "$PID_FILE" # Append second PID

    # Wait for frontend to be ready by polling the log file, instead of a fixed sleep
    log_info "Waiting for frontend server to be ready... (PID: $FRONTEND_PID)"
    local ready=false
    for _ in $(seq 1 30); do # Timeout after 30 seconds
        # Most dev servers (Vite, Next, CRA) print a URL with "localhost" or the local IP
        FRONTEND_URL=$(grep -o 'http://[0-9a-zA-Z.:-]*[0-9]\{4\}' "$frontend_log" | grep -E 'localhost|127.0.0.1' | head -n 1)
        if [[ -n "$FRONTEND_URL" ]]; then
            log_success "Frontend server is ready!"
            ready=true
            break
        fi
        sleep 1
    done

    if [[ "$ready" == false ]]; then
        log_error "Frontend server failed to start or is taking too long."
        log_error "Check logs for details: $frontend_err_log"
        log_error "Last 10 lines of error log:"
        tail -n 10 "$frontend_err_log" | sed "s/^/    ${RED}| ${NC}/"
        cleanup
    fi

    cd "$BASE_DIR"
}

# --- Main Execution ---
main() {
    # Trap SIGINT (Ctrl+C) and SIGTERM to call cleanup
    trap cleanup SIGINT SIGTERM

    # Default options
    local CLEAN_INSTALL=false
    local KILL_PORTS=false
    local CLEAR_CACHE=false
    local CLEAR_LOGS_ON_START=true

    # Parse arguments with getopts
    while getopts ":ckdlh-:" opt; do
        case "${opt}" in
            -) # For long options --foo
                case "${OPTARG}" in
                    clean) CLEAN_INSTALL=true ;;
                    kill) KILL_PORTS=true ;;
                    clear-cache) CLEAR_CACHE=true ;;
                    keep-logs) CLEAR_LOGS_ON_START=false ;;
                    help) usage; exit 0 ;;
                    *) echo "Invalid option: --${OPTARG}" >&2; usage; exit 1 ;;
                esac;;
            c) CLEAN_INSTALL=true ;;
            k) KILL_PORTS=true ;;
            d) CLEAR_CACHE=true ;;
            l) CLEAR_LOGS_ON_START=false ;;
            h) usage; exit 0 ;;
            \?) echo "Invalid option: -${OPTARG}" >&2; usage; exit 1 ;;
            :) echo "Option -${OPTARG} requires an argument." >&2; usage; exit 1 ;;
        esac
    done

    # Prepare environment
    if [[ "$CLEAR_CACHE" == true ]]; then clear_data_cache; fi
    if [[ "$CLEAR_LOGS_ON_START" == true ]]; then
        clear_logs
    else
        log_info "Log clearing disabled (--keep-logs)."
        mkdir -p "$LOG_DIR"
    fi

    # Clear previous PID file
    rm -f "$PID_FILE"

    # Start services
    start_backend
    start_frontend

    # --- Keep Alive and Monitor ---
    log_header "Development Environment is Running"
    echo -e "${BOLD}Backend API:${NC}  http://localhost:8080"
    echo -e "${BOLD}Frontend App:${NC} ${FRONTEND_URL:-http://localhost:3000 (assumed)}"
    echo ""
    log_info "Monitoring server health. Press ${BOLD}Ctrl+C${NC} to stop all services."

    # Robust monitoring loop
    while true; do
        # Check if backend is still running
        if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            log_error "Backend process (PID $BACKEND_PID) has died unexpectedly!"
            break # Exit loop to trigger cleanup
        fi
        # Check if frontend is still running (if it was started)
        if [[ -n "$FRONTEND_PID" ]] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
            log_error "Frontend process (PID $FRONTEND_PID) has died unexpectedly!"
            break # Exit loop to trigger cleanup
        fi
        sleep 5
    done

    log_warning "One or more services stopped. Shutting down the environment."
    cleanup
}

# Run the main function with all script arguments
main "$@"