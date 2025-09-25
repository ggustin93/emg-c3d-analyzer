#!/bin/bash

# Enhanced Development Server Start Script
# Starts both backend and frontend development servers with monitoring
# Compatible with Bash 3.2+ (macOS)
# Version: 2.1.0 - Added port cleanup management
#
# Port Management Features:
# - Automatically detects and kills processes on required ports (8080, 5173, 3000, 6379, 4040)
# - Uses graceful termination (SIGTERM) followed by force kill (SIGKILL) if necessary
# - Cross-platform support for macOS and Linux
# - Safety checks to prevent killing critical system processes
# - User confirmation prompts for safety (skipped in verbose mode or CI environments)
# - Comprehensive logging of all port cleanup actions

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
LOG_DIR="${PROJECT_ROOT}/logs"
METRICS_FILE="${LOG_DIR}/metrics.json"
DEV_STATE_FILE="${PROJECT_ROOT}/.dev_state"
PID_FILE="${LOG_DIR}/dev_server.pid"
LOCK_FILE="${LOG_DIR}/dev_server.lock"

# Process management
BACKEND_PID=""
FRONTEND_PID=""
REDIS_PID=""
NGROK_PID=""
MONITORING_PID=""
START_TIME=$(date +%s)
ERROR_COUNT=0
HEALTH_CHECK_COUNT=0

# Configuration flags
USE_WEBHOOK=false
RUN_TESTS=false
VERBOSE=false
KILL_PORTS=true

# Circuit breaker configuration
MAX_RETRIES=3
RETRY_COUNT=0
RETRY_DELAY=5
CIRCUIT_OPEN=false
LAST_FAILURE_TIME=0
CIRCUIT_RESET_TIMEOUT=60

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --webhook)
            USE_WEBHOOK=true
            shift
            ;;
        --test)
            RUN_TESTS=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --kill-ports)
            KILL_PORTS=true
            shift
            ;;
        --no-kill-ports)
            KILL_PORTS=false
            shift
            ;;
        --help|-h)
            cat << EOF
Usage: $0 [OPTIONS]

Options:
  --webhook         Enable webhook support with ngrok tunnel
  --test            Run test suite before starting servers
  --verbose         Enable verbose output
  --kill-ports      Kill processes on required ports before starting (default)
  --no-kill-ports   Skip port cleanup (use existing processes)
  --help            Show this help message

Environment Variables:
  BACKEND_PORT   Backend server port (default: 8080)
  FRONTEND_PORT  Frontend dev server port (default: 5173)
  REDIS_PORT     Redis server port (default: 6379)
  LOG_LEVEL      Logging level (default: INFO)

Examples:
  $0                       # Start with automatic port cleanup
  $0 --no-kill-ports       # Start without killing existing processes
  $0 --webhook --verbose   # Start with webhook support and verbose output

EOF
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Cross-platform virtual environment activation
activate_venv() {
    # Detect platform and use appropriate activation method
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ -n "$WINDIR" ]]; then
        # Windows environment (Git Bash, MSYS2, or native Windows)
        if [[ -f "venv/Scripts/activate" ]]; then
            source venv/Scripts/activate
        elif [[ -f "venv\\Scripts\\activate" ]]; then
            source "venv\\Scripts\\activate"
        else
            echo -e "${RED}✗ Windows virtual environment activation script not found${NC}"
            return 1
        fi
    else
        # Unix-like environment (Linux, macOS, WSL)
        if [[ -f "venv/bin/activate" ]]; then
            source venv/bin/activate
        else
            echo -e "${RED}✗ Unix virtual environment activation script not found${NC}"
            return 1
        fi
    fi
}

deactivate_venv() {
    # Deactivate is the same on all platforms
    if command -v deactivate &> /dev/null; then
        deactivate
    fi
}

# Lock file management
acquire_lock() {
    local timeout=30
    local elapsed=0
    
    while [[ -f "$LOCK_FILE" && $elapsed -lt $timeout ]]; do
        echo -e "${YELLOW}Waiting for lock (another instance may be running)...${NC}"
        sleep 2
        ((elapsed += 2))
    done
    
    if [[ -f "$LOCK_FILE" ]]; then
        echo -e "${RED}Could not acquire lock after ${timeout}s${NC}"
        echo -e "${YELLOW}Remove lock with: rm $LOCK_FILE${NC}"
        exit 1
    fi
    
    echo $$ > "$LOCK_FILE"
}

release_lock() {
    rm -f "$LOCK_FILE"
}

# Enhanced logging functions
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Structured log format
    echo -e "[${timestamp}] [${level}] ${message}" >> "${LOG_DIR}/dev_server.log"
    
    # Also log to appropriate level files
    case $level in
        ERROR|CRITICAL)
            echo -e "[${timestamp}] ${message}" >> "${LOG_DIR}/dev_server.error.log"
            ((ERROR_COUNT++))
            ;;
        WARNING)
            echo -e "[${timestamp}] ${message}" >> "${LOG_DIR}/dev_server.warning.log"
            ;;
    esac
    
    # Console output based on verbosity
    if [[ "$VERBOSE" == "true" || "$level" == "ERROR" || "$level" == "CRITICAL" ]]; then
        case $level in
            INFO)    echo -e "${BLUE}[INFO]${NC} ${message}" ;;
            WARNING) echo -e "${YELLOW}[WARN]${NC} ${message}" ;;
            ERROR)   echo -e "${RED}[ERROR]${NC} ${message}" ;;
            CRITICAL) echo -e "${RED}[CRITICAL]${NC} ${message}" ;;
            SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} ${message}" ;;
        esac
    fi
}

# Circuit breaker functions
circuit_breaker_open() {
    CIRCUIT_OPEN=true
    LAST_FAILURE_TIME=$(date +%s)
    log "CRITICAL" "Circuit breaker opened due to repeated failures"
}

circuit_breaker_should_attempt() {
    if [[ "$CIRCUIT_OPEN" == "false" ]]; then
        return 0
    fi
    
    local current_time=$(date +%s)
    local time_since_failure=$((current_time - LAST_FAILURE_TIME))
    
    if [[ $time_since_failure -gt $CIRCUIT_RESET_TIMEOUT ]]; then
        log "INFO" "Circuit breaker reset after timeout"
        CIRCUIT_OPEN=false
        RETRY_COUNT=0
        return 0
    fi
    
    return 1
}

# Metrics collection
update_metrics() {
    local current_time=$(date +%s)
    local uptime=$((current_time - START_TIME))
    local success_rate=0
    
    if [[ $HEALTH_CHECK_COUNT -gt 0 ]]; then
        local successful_checks=$((HEALTH_CHECK_COUNT - ERROR_COUNT))
        success_rate=$((successful_checks * 100 / HEALTH_CHECK_COUNT))
    fi
    
    cat > "$METRICS_FILE" << EOF
{
  "start_time": ${START_TIME},
  "current_time": ${current_time},
  "uptime_seconds": ${uptime},
  "error_count": ${ERROR_COUNT},
  "health_checks": ${HEALTH_CHECK_COUNT},
  "success_rate": ${success_rate},
  "backend_pid": "${BACKEND_PID}",
  "frontend_pid": "${FRONTEND_PID}",
  "redis_pid": "${REDIS_PID}",
  "ngrok_pid": "${NGROK_PID}",
  "circuit_breaker_open": ${CIRCUIT_OPEN},
  "retry_count": ${RETRY_COUNT}
}
EOF
}

# Process state management
save_state() {
    cat > "$DEV_STATE_FILE" << EOF
backend_pid=${BACKEND_PID}
frontend_pid=${FRONTEND_PID}
redis_pid=${REDIS_PID}
ngrok_pid=${NGROK_PID}
monitoring_pid=${MONITORING_PID}
start_time=${START_TIME}
webhook_enabled=${USE_WEBHOOK}
EOF
}

# Enhanced cleanup with log rotation
cleanup_old_logs() {
    log "INFO" "Cleaning up old logs..."
    
    # Create archive directory
    local archive_base="${LOG_DIR}/archive"
    mkdir -p "$archive_base"
    
    # Archive previous session logs if they exist
    if [[ -s "${LOG_DIR}/backend.log" ]] || [[ -s "${LOG_DIR}/frontend.log" ]]; then
        local archive_dir="${archive_base}/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$archive_dir"
        
        # Move old logs to archive
        for logfile in backend.log frontend.log backend.error.log dev_server.log dev_server.error.log; do
            if [[ -f "${LOG_DIR}/${logfile}" ]]; then
                mv "${LOG_DIR}/${logfile}" "${archive_dir}/" 2>/dev/null
            fi
        done
        
        log "INFO" "Archived previous logs to ${archive_dir}"
    fi
    
    # Clean up old metrics (keep last 5)
    local metric_count=$(ls -1 "${LOG_DIR}"/metrics_*.json 2>/dev/null | wc -l)
    if [[ $metric_count -gt 5 ]]; then
        ls -t1 "${LOG_DIR}"/metrics_*.json | tail -n +6 | xargs rm -f
        log "INFO" "Cleaned up old metric files"
    fi
    
    # Remove duplicate logs from other scripts
    for duplicate in backend_dev.log backend.debug.log frontend_dev.log; do
        if [[ -f "${LOG_DIR}/${duplicate}" ]]; then
            rm -f "${LOG_DIR}/${duplicate}"
            log "INFO" "Removed duplicate log: ${duplicate}"
        fi
    done
    
    # Clean up archives older than 7 days
    if [[ -d "$archive_base" ]]; then
        find "$archive_base" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null
        log "INFO" "Cleaned up archives older than 7 days"
    fi
    
    # Rotate large logs during runtime (will be called periodically)
    rotate_large_logs
}

rotate_large_logs() {
    local max_size=$((50 * 1024 * 1024))  # 50MB
    
    for logfile in "${LOG_DIR}"/*.log; do
        if [[ -f "$logfile" ]]; then
            local size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
            if [[ $size -gt $max_size ]]; then
                local basename=$(basename "$logfile" .log)
                local rotated="${LOG_DIR}/${basename}_$(date +%Y%m%d_%H%M%S).log"
                mv "$logfile" "$rotated"
                touch "$logfile"
                log "INFO" "Rotated large log: ${basename}.log (${size} bytes)"
                
                # Compress the rotated log
                gzip "$rotated" 2>/dev/null &
            fi
        fi
    done
}

# Enhanced cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down development servers...${NC}"
    
    # Save final metrics
    update_metrics
    
    # Show summary
    local current_time=$(date +%s)
    local total_runtime=$((current_time - START_TIME))
    echo -e "${BLUE}Session Summary:${NC}"
    echo -e "  Runtime: ${total_runtime} seconds"
    echo -e "  Errors: ${ERROR_COUNT}"
    echo -e "  Health Checks: ${HEALTH_CHECK_COUNT}"
    
    # Kill processes
    for pid in $MONITORING_PID $NGROK_PID $FRONTEND_PID $BACKEND_PID $REDIS_PID; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null
            log "INFO" "Stopped process $pid"
        fi
    done
    
    # Wait for processes to exit
    sleep 2
    
    # Force kill if still running
    for pid in $MONITORING_PID $NGROK_PID $FRONTEND_PID $BACKEND_PID $REDIS_PID; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
            log "WARNING" "Force killed process $pid"
        fi
    done
    
    # Archive final metrics
    if [[ -f "$METRICS_FILE" ]]; then
        cp "$METRICS_FILE" "${LOG_DIR}/metrics_$(date +%Y%m%d_%H%M%S).json"
    fi
    
    # Clean up files
    rm -f "$PID_FILE" "$DEV_STATE_FILE"
    release_lock
    
    log "SUCCESS" "Cleanup completed"
    echo -e "${GREEN}✓ All servers stopped successfully${NC}"
}

# Port management functions
get_port_processes() {
    local port=$1
    local processes=()
    
    # Cross-platform port detection (macOS and Linux)
    if command -v lsof &> /dev/null; then
        # Use lsof (preferred on macOS)
        while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                processes+=("$line")
            fi
        done < <(lsof -ti :$port 2>/dev/null)
    elif command -v ss &> /dev/null; then
        # Use ss (modern Linux)
        while IFS= read -r line; do
            local pid=$(echo "$line" | grep -o 'pid=[0-9]*' | cut -d'=' -f2)
            if [[ -n "$pid" ]]; then
                processes+=("$pid")
            fi
        done < <(ss -tlnp | grep ":$port " 2>/dev/null)
    elif command -v netstat &> /dev/null; then
        # Fallback to netstat
        if [[ "$(uname)" == "Darwin" ]]; then
            # macOS netstat
            while IFS= read -r line; do
                local pid=$(echo "$line" | awk '{print $9}' | cut -d'/' -f1)
                if [[ "$pid" =~ ^[0-9]+$ ]]; then
                    processes+=("$pid")
                fi
            done < <(netstat -anp tcp 2>/dev/null | grep "\.${port} " | grep LISTEN)
        else
            # Linux netstat
            while IFS= read -r line; do
                local pid=$(echo "$line" | awk '{print $7}' | cut -d'/' -f1)
                if [[ "$pid" =~ ^[0-9]+$ ]]; then
                    processes+=("$pid")
                fi
            done < <(netstat -tlnp 2>/dev/null | grep ":$port ")
        fi
    fi
    
    printf '%s\n' "${processes[@]}"
}

get_process_info() {
    local pid=$1
    local info=""
    
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        # Get process command and user (cross-platform)
        if command -v ps &> /dev/null; then
            if [[ "$(uname)" == "Darwin" ]]; then
                # macOS ps format
                info=$(ps -p "$pid" -o pid,user,command 2>/dev/null | tail -1)
            else
                # Linux ps format
                info=$(ps -p "$pid" -o pid,user,command --no-headers 2>/dev/null | head -1)
            fi
        fi
        
        # Fallback if ps fails
        if [[ -z "$info" ]]; then
            info="PID: $pid (process info unavailable)"
        fi
    fi
    
    echo "$info"
}

is_safe_to_kill() {
    local pid=$1
    local cmd_info="$(get_process_info "$pid")"
    
    # Safety checks - DO NOT kill these critical processes
    local unsafe_patterns=(
        "systemd"
        "kernel"
        "init"
        "/sbin/"
        "/usr/sbin/"
        "ssh"
        "NetworkManager"
        "launchd"
        "WindowServer"
        "Finder"
    )
    
    for pattern in "${unsafe_patterns[@]}"; do
        if [[ "$cmd_info" =~ $pattern ]]; then
            log "WARNING" "Refusing to kill potentially critical process: $cmd_info"
            return 1
        fi
    done
    
    # Additional checks
    local user=$(echo "$cmd_info" | awk '{print $2}')
    if [[ "$user" == "root" ]] && [[ ! "$cmd_info" =~ (node|python|uvicorn|npm|redis|ngrok) ]]; then
        log "WARNING" "Refusing to kill root process that's not a known dev tool: $cmd_info"
        return 1
    fi
    
    return 0
}

kill_port_processes() {
    local port=$1
    local port_name=$2
    local killed_any=false
    
    log "INFO" "Checking for processes on port $port ($port_name)..."
    
    local processes=($(get_port_processes "$port"))
    
    if [[ ${#processes[@]} -eq 0 ]]; then
        log "INFO" "✓ Port $port is available"
        return 0
    fi
    
    log "INFO" "Found ${#processes[@]} process(es) on port $port"
    
    # Show what processes will be affected
    for pid in "${processes[@]}"; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            local info="$(get_process_info "$pid")"
            echo -e "${YELLOW}  → Process: $info${NC}"
            log "INFO" "Process on port $port: $info"
        fi
    done
    
    # Ask for confirmation for safety (skip in verbose mode or CI environments)
    if [[ "$VERBOSE" != "true" ]] && [[ -t 0 ]] && [[ ${#processes[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Kill these processes on port $port? [y/N]${NC}"
        read -r -n 1 confirmation
        echo
        if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
            log "INFO" "User chose not to kill processes on port $port"
            return 1
        fi
    elif [[ "$VERBOSE" == "true" ]]; then
        log "INFO" "Auto-proceeding to kill processes (verbose mode enabled)"
    fi
    
    # Kill processes gracefully, then forcefully if needed
    for pid in "${processes[@]}"; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            if ! is_safe_to_kill "$pid"; then
                continue
            fi
            
            local info="$(get_process_info "$pid")"
            
            # Graceful termination (SIGTERM)
            log "INFO" "Sending SIGTERM to PID $pid..."
            if kill -TERM "$pid" 2>/dev/null; then
                # Wait up to 5 seconds for graceful shutdown
                local count=0
                while [[ $count -lt 5 ]] && kill -0 "$pid" 2>/dev/null; do
                    sleep 1
                    ((count++))
                done
                
                # Check if process is still running
                if kill -0 "$pid" 2>/dev/null; then
                    log "WARNING" "Process $pid did not respond to SIGTERM, sending SIGKILL..."
                    if kill -9 "$pid" 2>/dev/null; then
                        echo -e "${GREEN}✓ Force killed process: $info${NC}"
                        log "SUCCESS" "Force killed process on port $port: $info"
                        killed_any=true
                    else
                        echo -e "${RED}✗ Failed to kill process: $info${NC}"
                        log "ERROR" "Failed to kill process on port $port: $info"
                    fi
                else
                    echo -e "${GREEN}✓ Gracefully stopped process: $info${NC}"
                    log "SUCCESS" "Gracefully stopped process on port $port: $info"
                    killed_any=true
                fi
            else
                log "ERROR" "Failed to send SIGTERM to PID $pid"
            fi
        fi
    done
    
    # Final verification
    sleep 1
    local remaining_processes=($(get_port_processes "$port"))
    if [[ ${#remaining_processes[@]} -eq 0 ]]; then
        if [[ "$killed_any" == "true" ]]; then
            echo -e "${GREEN}✓ Port $port is now available${NC}"
            log "SUCCESS" "Port $port cleanup completed"
        fi
        return 0
    else
        echo -e "${RED}✗ Some processes on port $port could not be killed${NC}"
        log "ERROR" "Port $port cleanup incomplete - ${#remaining_processes[@]} processes remain"
        return 1
    fi
}

cleanup_development_ports() {
    if [[ "$KILL_PORTS" != "true" ]]; then
        log "INFO" "Port cleanup disabled by --no-kill-ports flag"
        return 0
    fi
    
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                   Port Cleanup Manager                 ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    
    log "INFO" "Starting port cleanup for development servers..."
    
    local ports_to_check=(
        "${BACKEND_PORT:-8080}:Backend"
        "${FRONTEND_PORT:-5173}:Frontend (Vite)"
        "3000:Frontend (React)"
        "${REDIS_PORT:-6379}:Redis"
        "4040:Ngrok API"
    )
    
    local cleanup_success=true
    
    for port_info in "${ports_to_check[@]}"; do
        local port="${port_info%:*}"
        local name="${port_info#*:}"
        
        if ! kill_port_processes "$port" "$name"; then
            cleanup_success=false
        fi
    done
    
    if [[ "$cleanup_success" == "true" ]]; then
        echo -e "${GREEN}✓ Port cleanup completed successfully${NC}"
        log "SUCCESS" "All required ports are now available"
    else
        echo -e "${YELLOW}⚠ Some ports could not be cleaned up${NC}"
        echo -e "${YELLOW}  Services may fail to start or use alternative ports${NC}"
        log "WARNING" "Port cleanup completed with warnings"
    fi
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Main execution starts here
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}     Enhanced Development Server Manager v2.1           ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"

# Acquire lock
acquire_lock

# Store PID
echo $$ > "$PID_FILE"

# Clean up old logs
cleanup_old_logs

# Check prerequisites
check_prerequisites() {
    local has_error=false
    
    echo -e "\n${BLUE}Checking prerequisites...${NC}"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}✗ Python 3 is not installed${NC}"
        has_error=true
    else
        echo -e "${GREEN}✓ Python 3 found${NC}"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js is not installed${NC}"
        has_error=true
    else
        echo -e "${GREEN}✓ Node.js found${NC}"
    fi
    
    # Check Redis
    if ! command -v redis-server &> /dev/null; then
        echo -e "${YELLOW}⚠ Redis is not installed (optional)${NC}"
    else
        echo -e "${GREEN}✓ Redis found${NC}"
    fi
    
    # Check ngrok for webhook support
    if [[ "$USE_WEBHOOK" == "true" ]]; then
        if ! command -v ngrok &> /dev/null; then
            echo -e "${RED}✗ ngrok is not installed (required for webhook support)${NC}"
            has_error=true
        else
            echo -e "${GREEN}✓ ngrok found${NC}"
        fi
    fi
    
    # Check virtual environment
    if [[ ! -d "${BACKEND_DIR}/venv" ]]; then
        echo -e "${YELLOW}⚠ Python virtual environment not found${NC}"
        echo -e "${BLUE}Creating virtual environment...${NC}"
        cd "$BACKEND_DIR"
        python3 -m venv venv
        activate_venv
        pip install -r requirements.txt
        deactivate_venv
        cd - > /dev/null
    else
        echo -e "${GREEN}✓ Python virtual environment found${NC}"
    fi
    
    # Check node_modules
    if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
        echo -e "${YELLOW}⚠ Node modules not installed${NC}"
        echo -e "${BLUE}Installing dependencies...${NC}"
        cd "$FRONTEND_DIR"
        npm install
        cd - > /dev/null
    else
        echo -e "${GREEN}✓ Node modules found${NC}"
    fi
    
    if [[ "$has_error" == "true" ]]; then
        echo -e "${RED}Prerequisites check failed. Please install missing dependencies.${NC}"
        exit 1
    fi
}

# Run tests if requested
run_tests() {
    if [[ "$RUN_TESTS" != "true" ]]; then
        return 0
    fi
    
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    Running Test Suite                  ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    
    local tests_passed=true
    
    # Backend tests
    echo -e "\n${YELLOW}Running backend tests...${NC}"
    cd "$BACKEND_DIR"
    activate_venv
    if python -m pytest tests/ -v --tb=short; then
        echo -e "${GREEN}✓ Backend tests passed${NC}"
        log "SUCCESS" "Backend tests passed"
    else
        echo -e "${RED}✗ Backend tests failed${NC}"
        log "ERROR" "Backend tests failed"
        tests_passed=false
    fi
    deactivate_venv
    cd - > /dev/null
    
    # Frontend tests
    echo -e "\n${YELLOW}Running frontend tests...${NC}"
    cd "$FRONTEND_DIR"
    if npm test -- --run; then
        echo -e "${GREEN}✓ Frontend tests passed${NC}"
        log "SUCCESS" "Frontend tests passed"
    else
        echo -e "${RED}✗ Frontend tests failed${NC}"
        log "ERROR" "Frontend tests failed"
        tests_passed=false
    fi
    cd - > /dev/null
    
    if [[ "$tests_passed" != "true" ]]; then
        echo -e "${RED}Tests failed. Fix issues before starting servers.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}              ✓ All tests passed successfully           ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
}

# Start Redis if available
start_redis() {
    if command -v redis-server &> /dev/null; then
        echo -e "\n${BLUE}Starting Redis server...${NC}"
        redis-server --daemonize yes --port ${REDIS_PORT:-6379} --logfile "${LOG_DIR}/redis.log"
        REDIS_PID=$(pgrep -f "redis-server.*${REDIS_PORT:-6379}" | head -1)
        if [[ -n "$REDIS_PID" ]]; then
            echo -e "${GREEN}✓ Redis started (PID: $REDIS_PID)${NC}"
            log "SUCCESS" "Redis started with PID $REDIS_PID"
        else
            echo -e "${YELLOW}⚠ Redis failed to start${NC}"
            log "WARNING" "Redis failed to start"
        fi
    fi
}

# Start backend server with circuit breaker
start_backend() {
    if ! circuit_breaker_should_attempt; then
        echo -e "${RED}Circuit breaker is open. Skipping backend start.${NC}"
        log "ERROR" "Circuit breaker prevented backend start"
        return 1
    fi
    
    echo -e "\n${BLUE}Starting backend server...${NC}"
    cd "$BACKEND_DIR"
    
    # Activate virtual environment and start server
    activate_venv
    uvicorn main:app \
        --reload \
        --port ${BACKEND_PORT:-8080} \
        --log-level ${LOG_LEVEL:-info} \
        > "${LOG_DIR}/backend.log" 2>&1 &
    
    BACKEND_PID=$!
    deactivate_venv
    cd - > /dev/null
    
    # Wait for backend to start
    echo -n "Waiting for backend to start"
    local count=0
    while [[ $count -lt 30 ]]; do
        if curl -s -o /dev/null http://localhost:${BACKEND_PORT:-8080}/health; then
            echo -e "\n${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
            log "SUCCESS" "Backend started with PID $BACKEND_PID"
            RETRY_COUNT=0
            return 0
        fi
        echo -n "."
        sleep 1
        ((count++))
    done
    
    echo -e "\n${RED}✗ Backend failed to start${NC}"
    log "ERROR" "Backend failed to start after 30 seconds"
    ((RETRY_COUNT++))
    
    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
        circuit_breaker_open
    fi
    
    return 1
}

# Start frontend server
start_frontend() {
    if ! circuit_breaker_should_attempt; then
        echo -e "${RED}Circuit breaker is open. Skipping frontend start.${NC}"
        log "ERROR" "Circuit breaker prevented frontend start"
        return 1
    fi
    
    echo -e "\n${BLUE}Starting frontend server...${NC}"
    cd "$FRONTEND_DIR"
    
    # Start Vite dev server
    npm run dev > "${LOG_DIR}/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    cd - > /dev/null
    
    # Wait for frontend to start (Frontend runs on port 3000)
    echo -n "Waiting for frontend to start"
    local count=0
    while [[ $count -lt 60 ]]; do  # Increased timeout for Vite
        if curl -s -o /dev/null http://localhost:3000; then
            echo -e "\n${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
            log "SUCCESS" "Frontend started with PID $FRONTEND_PID"
            return 0
        fi
        echo -n "."
        sleep 1
        ((count++))
    done
    
    echo -e "\n${RED}✗ Frontend failed to start${NC}"
    log "ERROR" "Frontend failed to start after 60 seconds"
    ((RETRY_COUNT++))
    
    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
        circuit_breaker_open
    fi
    
    return 1
}

# Start ngrok for webhook support
start_ngrok() {
    if [[ "$USE_WEBHOOK" != "true" ]]; then
        return 0
    fi
    
    echo -e "\n${BLUE}Starting ngrok tunnel for webhooks...${NC}"
    
    # Start ngrok
    ngrok http ${BACKEND_PORT:-8080} --log=stdout > "${LOG_DIR}/ngrok.log" 2>&1 &
    NGROK_PID=$!
    
    # Wait for ngrok to start and get URL
    echo -n "Waiting for ngrok tunnel"
    local count=0
    while [[ $count -lt 20 ]]; do
        if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
            local ngrok_url=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)
            if [[ -n "$ngrok_url" ]]; then
                echo -e "\n${GREEN}✓ Ngrok tunnel established${NC}"
                echo -e "${BLUE}Public URL: ${ngrok_url}${NC}"
                echo -e "${YELLOW}Webhook endpoint: ${ngrok_url}/webhooks/storage/c3d-upload${NC}"
                log "SUCCESS" "Ngrok tunnel established: ${ngrok_url}"
                return 0
            fi
        fi
        echo -n "."
        sleep 1
        ((count++))
    done
    
    echo -e "\n${YELLOW}⚠ Ngrok tunnel failed to establish${NC}"
    log "WARNING" "Ngrok tunnel failed to establish"
    return 1
}

# Health monitoring
start_health_monitoring() {
    (
        while true; do
            sleep 30
            
            # Update metrics
            update_metrics
            ((HEALTH_CHECK_COUNT++))
            
            # Check backend health
            if ! curl -s -o /dev/null http://localhost:${BACKEND_PORT:-8080}/health; then
                log "ERROR" "Backend health check failed"
                ((ERROR_COUNT++))
            fi
            
            # Check frontend health (Frontend runs on port 3000)
            if ! curl -s -o /dev/null http://localhost:3000; then
                log "ERROR" "Frontend health check failed"
                ((ERROR_COUNT++))
            fi
            
            # Rotate logs if needed
            rotate_large_logs
            
            # Check circuit breaker status
            if [[ "$CIRCUIT_OPEN" == "true" ]]; then
                local current_time=$(date +%s)
                local time_since_failure=$((current_time - LAST_FAILURE_TIME))
                if [[ $time_since_failure -gt $CIRCUIT_RESET_TIMEOUT ]]; then
                    log "INFO" "Attempting circuit breaker reset"
                    CIRCUIT_OPEN=false
                    RETRY_COUNT=0
                fi
            fi
        done
    ) &
    MONITORING_PID=$!
    log "INFO" "Started health monitoring with PID $MONITORING_PID"
}

# Main execution
check_prerequisites
run_tests
cleanup_development_ports
start_redis
start_backend || exit 1
start_frontend || exit 1
start_ngrok
start_health_monitoring

# Save state
save_state

# Display status dashboard
echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}       ✓ Development Environment Started Successfully    ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Backend:${NC}  http://localhost:${BACKEND_PORT:-8080}"
echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
if [[ "$USE_WEBHOOK" == "true" ]] && [[ -n "$NGROK_PID" ]]; then
    echo -e "${BLUE}Webhook:${NC}  Check ngrok dashboard at http://localhost:4040"
fi
echo -e "${BLUE}Logs:${NC}     ${LOG_DIR}/"
echo -e "${BLUE}Metrics:${NC}  ${METRICS_FILE}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"

# Keep script running and show metrics periodically
while true; do
    sleep 60
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "\n${BLUE}[$(date '+%H:%M:%S')] Status Update:${NC}"
        echo -e "  Uptime: $(($(date +%s) - START_TIME))s"
        echo -e "  Health Checks: ${HEALTH_CHECK_COUNT}"
        echo -e "  Errors: ${ERROR_COUNT}"
        if [[ "$CIRCUIT_OPEN" == "true" ]]; then
            echo -e "  ${RED}Circuit Breaker: OPEN${NC}"
        fi
    fi
done