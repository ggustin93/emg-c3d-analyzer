#!/bin/bash

# Enhanced Development Server Stop Script
# Gracefully stops all services started by start_dev_enhanced.sh
# Compatible with Bash 3.2+ (macOS)
# Version: 2.0.0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# File paths
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="${PROJECT_ROOT}/logs/dev_server.pid"
DEV_STATE_FILE="${PROJECT_ROOT}/.dev_state"
METRICS_FILE="${PROJECT_ROOT}/logs/metrics.json"

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}     Stopping Enhanced Development Servers              ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"

# Function to safely kill a process
safe_kill() {
    local pid=$1
    local name=$2
    
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        echo -e "${BLUE}Stopping ${name} (PID: ${pid})...${NC}"
        kill -TERM "$pid" 2>/dev/null
        
        # Wait up to 5 seconds for graceful shutdown
        local count=0
        while [[ $count -lt 10 ]] && kill -0 "$pid" 2>/dev/null; do
            sleep 0.5
            ((count++))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}Force killing ${name}...${NC}"
            kill -9 "$pid" 2>/dev/null
        fi
        
        echo -e "${GREEN}✓ ${name} stopped${NC}"
    fi
}

# Show final metrics if available
if [[ -f "$METRICS_FILE" ]]; then
    echo -e "\n${BLUE}Final Metrics:${NC}"
    echo -e "${BLUE}─────────────────────────────────────────────────────────${NC}"
    
    # Parse and display key metrics
    local uptime=$(grep '"uptime_seconds"' "$METRICS_FILE" | sed 's/.*: *\([0-9]*\).*/\1/')
    local health_checks=$(grep '"health_checks"' "$METRICS_FILE" | sed 's/.*: *\([0-9]*\).*/\1/')
    local errors=$(grep '"errors"' "$METRICS_FILE" | sed 's/.*: *\([0-9]*\).*/\1/')
    local success_rate=$(grep '"success_rate"' "$METRICS_FILE" | sed 's/.*: *\([0-9]*\).*/\1/')
    
    [[ -n "$uptime" ]] && echo -e "Total Uptime: ${uptime} seconds"
    [[ -n "$health_checks" ]] && echo -e "Health Checks Performed: ${health_checks}"
    [[ -n "$errors" ]] && echo -e "Total Errors: ${errors}"
    [[ -n "$success_rate" ]] && echo -e "Success Rate: ${success_rate}%"
    echo -e "${BLUE}─────────────────────────────────────────────────────────${NC}\n"
fi

# Read PIDs from state file
if [[ -f "$DEV_STATE_FILE" ]]; then
    # Extract PIDs
    backend_pid=$(grep "^backend_pid=" "$DEV_STATE_FILE" | cut -d= -f2)
    frontend_pid=$(grep "^frontend_pid=" "$DEV_STATE_FILE" | cut -d= -f2)
    redis_pid=$(grep "^redis_pid=" "$DEV_STATE_FILE" | cut -d= -f2)
    ngrok_pid=$(grep "^ngrok_pid=" "$DEV_STATE_FILE" | cut -d= -f2)
    monitoring_pid=$(grep "^monitoring_pid=" "$DEV_STATE_FILE" | cut -d= -f2)
    
    # Stop services in reverse order
    safe_kill "$monitoring_pid" "Health Monitoring"
    safe_kill "$ngrok_pid" "Ngrok Tunnel"
    safe_kill "$frontend_pid" "Frontend Server"
    safe_kill "$backend_pid" "Backend Server"
    
    # Stop Redis if it was started by us
    if [[ -n "$redis_pid" ]]; then
        echo -e "${BLUE}Stopping Redis server...${NC}"
        redis-cli shutdown 2>/dev/null || kill -TERM "$redis_pid" 2>/dev/null
        echo -e "${GREEN}✓ Redis stopped${NC}"
    fi
else
    echo -e "${YELLOW}No state file found. Attempting to find processes...${NC}"
    
    # Fallback: Try to find and kill processes by pattern
    pkill -f "uvicorn main:app" 2>/dev/null && echo -e "${GREEN}✓ Backend stopped${NC}"
    pkill -f "vite" 2>/dev/null && echo -e "${GREEN}✓ Frontend stopped${NC}"
    pkill -f "ngrok" 2>/dev/null && echo -e "${GREEN}✓ Ngrok stopped${NC}"
fi

# Stop main script if PID file exists
if [[ -f "$PID_FILE" ]]; then
    main_pid=$(cat "$PID_FILE")
    safe_kill "$main_pid" "Main Script"
fi

# Clean up files
echo -e "\n${BLUE}Cleaning up...${NC}"
rm -f "$PID_FILE"
rm -f "$DEV_STATE_FILE"
rm -f "${PROJECT_ROOT}/logs/dev_server.lock"

echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}       ✓ All servers stopped successfully!              ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Logs preserved in: ${PROJECT_ROOT}/logs/${NC}"