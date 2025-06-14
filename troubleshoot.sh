#!/bin/bash

# GHOSTLY+ EMG C3D Analyzer Troubleshooting Script
# ================================================
# This script helps diagnose common issues with the development environment.

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${RESET} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${RESET} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${RESET} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${RESET} $1"
}

log_header() {
    echo -e "\n${BOLD}$1${RESET}"
    echo -e "${BOLD}$(printf '=%.0s' $(seq 1 ${#1}))${RESET}\n"
}

# Set the base directory to the location of the script
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$BASE_DIR"

log_header "GHOSTLY+ EMG C3D Analyzer Troubleshooting"

# Check if the servers are running
log_header "Checking Server Status"

# Check backend
BACKEND_RUNNING=false
BACKEND_PID=$(ps aux | grep "[p]ython -m uvicorn backend.main:app" | awk '{print $2}')
if [ ! -z "$BACKEND_PID" ]; then
    log_success "Backend server is running with PID: $BACKEND_PID"
    BACKEND_RUNNING=true
    
    # Check if it's responding
    if curl -s http://localhost:8080/ > /dev/null; then
        log_success "Backend API is responding at http://localhost:8080/"
    else
        log_error "Backend API is running but not responding"
    fi
else
    log_error "Backend server is not running"
fi

# Check frontend
FRONTEND_RUNNING=false
# Check for both npm run dev and npm run start processes
FRONTEND_PID=$(ps aux | grep -E "[n]pm run (dev|start)" | awk '{print $2}')
if [ ! -z "$FRONTEND_PID" ]; then
    log_success "Frontend server is running with PID: $FRONTEND_PID"
    FRONTEND_RUNNING=true
else
    log_error "Frontend server is not running"
fi

# Check directory structure
log_header "Checking Directory Structure"

# Required directories
required_dirs=("backend" "frontend" "data/uploads" "data/results" "data/plots")
for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        log_success "Directory '$dir' exists"
    else
        log_error "Directory '$dir' is missing"
    fi
done

# Check Python environment
log_header "Checking Python Environment"

# Check if virtual environment exists
if [ -d ".venv" ]; then
    log_success "Virtual environment exists at .venv"
    
    # Activate virtual environment
    source .venv/bin/activate
    if [ $? -eq 0 ]; then
        log_success "Virtual environment activated successfully"
    else
        log_error "Failed to activate virtual environment"
    fi
else
    log_warning "No virtual environment found at .venv"
fi

# Check Python version
PYTHON_VERSION=$(python --version 2>&1)
log_info "Python version: $PYTHON_VERSION"

# Check required packages
log_info "Checking required Python packages..."
required_packages=("uvicorn" "fastapi" "ezc3d" "numpy" "scipy" "matplotlib")
for package in "${required_packages[@]}"; do
    if python -c "import $package" 2>/dev/null; then
        version=$(python -c "import $package; print($package.__version__)" 2>/dev/null)
        if [ $? -eq 0 ]; then
            log_success "$package is installed (version: $version)"
        else
            log_success "$package is installed"
        fi
    else
        log_error "$package is not installed"
    fi
done

# Check frontend package.json
log_header "Checking Frontend Configuration"

if [ -f "frontend/package.json" ]; then
    log_success "Frontend package.json exists"
    
    # Check for start script
    if grep -q '"start"' frontend/package.json; then
        log_success "Frontend has 'start' script defined"
        FRONTEND_SCRIPT="start"
    else
        log_warning "Frontend does not have 'start' script defined"
    fi
    
    # Check for dev script
    if grep -q '"dev"' frontend/package.json; then
        log_success "Frontend has 'dev' script defined"
        FRONTEND_SCRIPT="dev"
    else
        log_warning "Frontend does not have 'dev' script defined"
    fi
    
    if [ -z "$FRONTEND_SCRIPT" ]; then
        log_error "Frontend has neither 'start' nor 'dev' script defined"
    else
        log_info "Frontend should be started with 'npm run $FRONTEND_SCRIPT'"
    fi
else
    log_error "Frontend package.json does not exist"
fi

# Check log files for errors
log_header "Checking Log Files for Errors"

# Backend error log
if [ -f "backend.error.log" ]; then
    log_info "Checking backend.error.log for errors..."
    ERROR_COUNT=$(grep -c "ERROR" backend.error.log)
    if [ $ERROR_COUNT -gt 0 ]; then
        log_error "Found $ERROR_COUNT errors in backend.error.log"
        log_info "Last 5 errors:"
        grep "ERROR" backend.error.log | tail -n 5 | while read line; do
            echo -e "${RED}  | $line${RESET}"
        done
    else
        log_success "No errors found in backend.error.log"
    fi
else
    log_warning "backend.error.log does not exist"
fi

# Frontend error log
if [ -f "frontend.error.log" ]; then
    log_info "Checking frontend.error.log for errors..."
    ERROR_COUNT=$(grep -c "ERR!" frontend.error.log)
    if [ $ERROR_COUNT -gt 0 ]; then
        log_error "Found $ERROR_COUNT errors in frontend.error.log"
        log_info "Last 5 errors:"
        grep "ERR!" frontend.error.log | tail -n 5 | while read line; do
            echo -e "${RED}  | $line${RESET}"
        done
    else
        log_success "No errors found in frontend.error.log"
    fi
else
    log_warning "frontend.error.log does not exist"
fi

# Network check
log_header "Checking Network Ports"

# Check if port 8080 is in use
if netstat -tuln 2>/dev/null | grep -q ":8080 "; then
    log_success "Port 8080 is in use (expected for backend)"
else
    log_error "Port 8080 is not in use (backend should be using this port)"
fi

# Final summary
log_header "Troubleshooting Summary"

if $BACKEND_RUNNING && $FRONTEND_RUNNING; then
    log_success "Both backend and frontend servers are running"
    echo -e "${BOLD}Everything appears to be working correctly!${RESET}"
elif $BACKEND_RUNNING; then
    log_warning "Backend is running but frontend is not"
    
    if [ ! -z "$FRONTEND_SCRIPT" ]; then
        echo -e "${BOLD}Recommended action:${RESET} Start the frontend server with 'cd frontend && npm run $FRONTEND_SCRIPT'"
    else
        echo -e "${BOLD}Recommended action:${RESET} Add a 'start' or 'dev' script to frontend/package.json"
    fi
elif $FRONTEND_RUNNING; then
    log_warning "Frontend is running but backend is not"
    echo -e "${BOLD}Recommended action:${RESET} Start the backend server with 'python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080'"
else
    log_error "Neither backend nor frontend servers are running"
    echo -e "${BOLD}Recommended action:${RESET} Start both servers with './start_dev.sh'"
fi

echo -e "\n${BOLD}For more detailed logs:${RESET}"
echo "  - Backend logs: backend.log and backend.error.log"
echo "  - Frontend logs: frontend.log and frontend.error.log"
echo ""
echo -e "${BOLD}If you continue to have issues:${RESET}"
echo "  1. Try restarting the servers with './start_dev.sh'"
echo "  2. Check that all dependencies are installed with 'pip install -r requirements.txt'"
echo "  3. Check for port conflicts (another application might be using port 8080)"
echo "" 