#!/bin/bash

# GHOSTLY+ EMG C3D Analyzer - Webhook Development with Persistent ngrok
#
# This script creates a persistent ngrok tunnel that stays stable across restarts

set -e

# Configuration
readonly BACKEND_PORT=8080
readonly NGROK_CONFIG_DIR="$HOME/.config/ngrok"
readonly NGROK_CONFIG_FILE="$NGROK_CONFIG_DIR/emg-webhook.yml"
readonly TUNNEL_NAME="emg-webhook"
readonly BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly YELLOW='\033[0;33m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

log_info() {
    echo -e "${BLUE}[$(date +"%H:%M:%S")] ${BOLD}INFO${NC}: $1"
}

log_success() {
    echo -e "${GREEN}[$(date +"%H:%M:%S")] ${BOLD}SUCCESS${NC}: $1"
}

log_header() {
    local title="$1"
    echo -e "\n${PURPLE}${BOLD}🚀 ${title} 🚀${NC}"
    echo -e "${PURPLE}${BOLD}$(printf '=%.0s' $(seq 1 $((${#title} + 6))))${NC}\n"
}

# Create ngrok config for persistent tunnel
create_ngrok_config() {
    log_info "Creating persistent ngrok configuration..."
    
    # Ensure config directory exists
    mkdir -p "$NGROK_CONFIG_DIR"
    
    cat > "$NGROK_CONFIG_FILE" <<EOF
version: "2"
authtoken_from_env: true
tunnels:
  $TUNNEL_NAME:
    proto: http
    addr: $BACKEND_PORT
    bind_tls: true
EOF
    
    log_success "ngrok config created: $NGROK_CONFIG_FILE"
}

# Start persistent ngrok tunnel
start_persistent_ngrok() {
    log_header "Starting Persistent ngrok Tunnel"
    
    # Create config if not exists
    if [[ ! -f "$NGROK_CONFIG_FILE" ]]; then
        create_ngrok_config
    fi
    
    # Kill any existing ngrok processes
    pkill -f "ngrok.*$TUNNEL_NAME" 2>/dev/null || true
    sleep 2
    
    log_info "Starting persistent ngrok tunnel: $TUNNEL_NAME"
    
    # Start ngrok with config in background
    ngrok start $TUNNEL_NAME --config="$NGROK_CONFIG_FILE" --log=stdout > logs/ngrok.log 2>&1 &
    local ngrok_pid=$!
    
    log_info "ngrok started with PID: $ngrok_pid"
    
    # Wait for tunnel to establish
    log_info "Waiting for tunnel to establish..."
    local attempts=0
    local max_attempts=30
    local public_url=""
    
    while [ $attempts -lt $max_attempts ]; do
        public_url=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for tunnel in data['tunnels']:
        if tunnel.get('name') == '$TUNNEL_NAME' and 'https' in tunnel['public_url']:
            print(tunnel['public_url'])
            break
except:
    pass
" 2>/dev/null || echo "")
        
        if [[ -n "$public_url" ]]; then
            break
        fi
        
        sleep 1
        attempts=$((attempts + 1))
    done
    
    if [[ -n "$public_url" ]]; then
        log_success "Persistent tunnel established: $public_url"
        echo "export NGROK_WEBHOOK_URL='$public_url'" > .webhook_url
        
        echo ""
        echo -e "${PURPLE}${BOLD}🌐 PERSISTENT WEBHOOK CONFIGURATION${NC}"
        echo -e "${PURPLE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}Persistent URL:${NC}   $public_url"
        echo -e "${BOLD}Webhook URL:${NC}      $public_url/webhooks/storage/c3d-upload"
        echo ""
        echo -e "${YELLOW}${BOLD}📋 CONFIGURE ONCE IN SUPABASE:${NC}"
        echo -e "  • URL: ${GREEN}$public_url/webhooks/storage/c3d-upload${NC}"
        echo -e "  • This URL ${BOLD}stays the same${NC} across restarts!"
        echo ""
        echo -e "${CYAN}💡 Run ${BOLD}./start_dev_simple.sh --backend-only${NC} to start backend only${NC}"
        
        return 0
    else
        echo "Failed to establish persistent tunnel"
        return 1
    fi
}

# Check if tunnel is already running
check_tunnel_status() {
    local public_url=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for tunnel in data['tunnels']:
        if tunnel.get('name') == '$TUNNEL_NAME' and 'https' in tunnel['public_url']:
            print(tunnel['public_url'])
            break
except:
    pass
" 2>/dev/null || echo "")
    
    if [[ -n "$public_url" ]]; then
        echo -e "${GREEN}✅ Persistent tunnel already running: $public_url${NC}"
        echo -e "${BLUE}Webhook URL: $public_url/webhooks/storage/c3d-upload${NC}"
        return 0
    else
        return 1
    fi
}

main() {
    log_header "Persistent Webhook Development Setup"
    
    # Check if tunnel already exists
    if check_tunnel_status; then
        echo ""
        log_info "Tunnel is already running. Start backend with:"
        echo -e "  ${CYAN}./start_dev_simple.sh --backend-only${NC}"
        echo ""
        log_info "Or restart tunnel with:"
        echo -e "  ${CYAN}./start_webhook_dev.sh --restart${NC}"
    else
        start_persistent_ngrok
        echo ""
        log_info "Now start your backend with:"
        echo -e "  ${CYAN}unset WEBHOOK_SECRET && ./start_dev_simple.sh --backend-only${NC}"
    fi
}

# Handle restart option
if [[ "$1" == "--restart" ]]; then
    log_info "Restarting persistent tunnel..."
    pkill -f "ngrok.*$TUNNEL_NAME" 2>/dev/null || true
    sleep 3
    start_persistent_ngrok
    exit 0
fi

main "$@"