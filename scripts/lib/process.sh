#!/bin/bash
# Process Management Module
# Handles starting, stopping, and monitoring processes

source "$(dirname "${BASH_SOURCE[0]}")/logger.sh"

# Store process PID
save_pid() {
    local name=$1
    local pid=$2
    echo "$pid" > "${PID_DIR}/${name}.pid"
    log_debug "Saved PID $pid for $name"
}

# Get stored PID
get_pid() {
    local name=$1
    local pid_file="${PID_DIR}/${name}.pid"
    [[ -f "$pid_file" ]] && cat "$pid_file" || echo ""
}

# Check if process is running
is_running() {
    local pid=$1
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# Start a background process
start_process() {
    local name=$1
    local command=$2
    local log_file="${LOG_DIR}/${name}.log"
    
    log_info "Starting $name..."
    
    # Check if already running
    local existing_pid=$(get_pid "$name")
    if is_running "$existing_pid"; then
        log_warn "$name already running (PID: $existing_pid)"
        return 0
    fi
    
    # Start the process
    eval "$command" > "$log_file" 2>&1 &
    local pid=$!
    
    # Save PID immediately
    save_pid "$name" "$pid"
    
    # Wait briefly to check if it started
    sleep 2
    
    # Check if the process or any child processes are running
    if is_running "$pid" || pgrep -f "$name" > /dev/null 2>&1; then
        log_success "$name started (PID: $pid)"
        return 0
    else
        log_error "$name failed to start. Check $log_file"
        rm -f "${PID_DIR}/${name}.pid"
        return 1
    fi
}

# Stop a process gracefully
stop_process() {
    local name=$1
    local pid=$(get_pid "$name")
    
    if [[ -z "$pid" ]]; then
        log_debug "$name not running (no PID file)"
        # Also try to kill by name in case PID tracking failed
        pkill -f "$name" 2>/dev/null || true
        return 0
    fi
    
    if ! is_running "$pid"; then
        log_debug "$name not running (PID: $pid)"
        rm -f "${PID_DIR}/${name}.pid"
        # Also try to kill by name in case child processes exist
        pkill -f "$name" 2>/dev/null || true
        return 0
    fi
    
    log_info "Stopping $name (PID: $pid)..."
    
    # Try graceful shutdown first (kill process group)
    kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null
    
    # Wait for process to stop
    local count=0
    while (is_running "$pid" || pgrep -f "$name" > /dev/null 2>&1) && [[ $count -lt $PROCESS_TIMEOUT ]]; do
        sleep 1
        ((count++))
    done
    
    # Force kill if still running
    if is_running "$pid" || pgrep -f "$name" > /dev/null 2>&1; then
        log_warn "Force killing $name"
        kill -9 -- -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
        pkill -9 -f "$name" 2>/dev/null || true
        sleep 1
    fi
    
    rm -f "${PID_DIR}/${name}.pid"
    log_success "$name stopped"
}

# Stop all managed processes
stop_all_processes() {
    log_info "Stopping all processes..."
    
    for pid_file in "${PID_DIR}"/*.pid; do
        [[ -f "$pid_file" ]] || continue
        local name=$(basename "$pid_file" .pid)
        stop_process "$name"
    done
}

# Health check with retries
health_check() {
    local name=$1
    local check_command=$2
    local max_retries=${3:-$HEALTH_CHECK_RETRIES}
    local delay=${4:-$HEALTH_CHECK_DELAY}
    
    log_info "Checking $name health..."
    
    local count=0
    while [[ $count -lt $max_retries ]]; do
        if eval "$check_command" >/dev/null 2>&1; then
            log_success "$name is healthy"
            return 0
        fi
        ((count++))
        log_debug "Health check attempt $count/$max_retries failed"
        sleep "$delay"
    done
    
    log_error "$name health check failed after $max_retries attempts"
    return 1
}