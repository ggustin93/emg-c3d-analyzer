#!/bin/bash
# Logging Module
# Provides structured logging with levels and colors

# Log levels (check if already defined)
if [[ -z "${LOG_LEVEL_DEBUG:-}" ]]; then
    readonly LOG_LEVEL_DEBUG=0
    readonly LOG_LEVEL_INFO=1
    readonly LOG_LEVEL_WARN=2
    readonly LOG_LEVEL_ERROR=3
    readonly LOG_LEVEL_FATAL=4
fi

# Current log level (can be overridden)
LOG_LEVEL=${LOG_LEVEL:-$LOG_LEVEL_INFO}

# Log function with timestamp and level
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        DEBUG)
            [[ $LOG_LEVEL -le $LOG_LEVEL_DEBUG ]] && echo -e "${BLUE}[DEBUG]${NC} ${timestamp} - $message"
            ;;
        INFO)
            [[ $LOG_LEVEL -le $LOG_LEVEL_INFO ]] && echo -e "${GREEN}[INFO]${NC} ${timestamp} - $message"
            ;;
        WARN)
            [[ $LOG_LEVEL -le $LOG_LEVEL_WARN ]] && echo -e "${YELLOW}[WARN]${NC} ${timestamp} - $message" >&2
            ;;
        ERROR)
            [[ $LOG_LEVEL -le $LOG_LEVEL_ERROR ]] && echo -e "${RED}[ERROR]${NC} ${timestamp} - $message" >&2
            ;;
        FATAL)
            echo -e "${RED}[FATAL]${NC} ${timestamp} - $message" >&2
            exit 1
            ;;
        *)
            echo "${timestamp} - $message"
            ;;
    esac
}

# Convenience functions
log_debug() { log DEBUG "$@"; }
log_info() { log INFO "$@"; }
log_warn() { log WARN "$@"; }
log_error() { log ERROR "$@"; }
log_fatal() { log FATAL "$@"; }

# Progress indicator
log_progress() {
    local message=$1
    echo -en "\r${GREEN}▶${NC} ${message}..."
}

log_success() {
    echo -e "\r${GREEN}✅${NC} $1"
}

log_failure() {
    echo -e "\r${RED}❌${NC} $1"
}