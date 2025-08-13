"""
GHOSTLY+ Backend Configuration
==============================

Centralized configuration for the GHOSTLY+ EMG C3D Analyzer backend.
"""

import os
from pathlib import Path

# --- EMG Processing Parameters ---
DEFAULT_SAMPLING_RATE = 2000  # Hz (updated)
DEFAULT_LOWPASS_CUTOFF = 500  # Hz
DEFAULT_FILTER_ORDER = 4
DEFAULT_RMS_WINDOW_MS = 50  # milliseconds

# Optimized Contraction Detection Parameters (Research-Based 2024)
DEFAULT_THRESHOLD_FACTOR = 0.20  # 20% of max amplitude
DEFAULT_MIN_DURATION_MS = 100   # Minimum contraction duration in ms
DEFAULT_SMOOTHING_WINDOW = 100  # Smoothing window size in samples
DEFAULT_MVC_THRESHOLD_PERCENTAGE = 75.0  # Default MVC threshold percentage
DEFAULT_CONTRACTION_DURATION_THRESHOLD_MS = 250  # milliseconds

# Temporal Analysis Configuration (used for mean ± std over time)
DEFAULT_TEMPORAL_WINDOW_SIZE_MS = 1000  # 1 second windows
DEFAULT_TEMPORAL_OVERLAP_PERCENTAGE = 50.0  # 50% overlap
MIN_TEMPORAL_WINDOWS_REQUIRED = 3  # Minimum windows required for valid stats

# --- File Processing ---
MAX_FILE_SIZE_MB = 100
SUPPORTED_FILE_EXTENSIONS = ['.c3d']
TEMP_DIR_PREFIX = 'emg_analysis_'

# --- Performance & Caching ---
CACHE_TIMEOUT_SECONDS = 3600  # 1 hour
MAX_CACHE_SIZE = 100  # number of cached results

# --- Clinical Constants ---
BORG_CR10_SCALE_MAX = 10
BFR_PRESSURE_RANGE = (40, 80)  # % AOP
THERAPEUTIC_COMPLIANCE_THRESHOLD = 0.8

# Advanced Contraction Detection Parameters 
MERGE_THRESHOLD_MS = 200  # Maximum time gap between contractions to merge them (ms)
                         # Research-based: 200ms based on motor unit firing rates and muscle response times
                         # Reduced from 500ms for better temporal resolution while maintaining physiological accuracy
REFRACTORY_PERIOD_MS = 50  # Minimum time after contraction before detecting new one (ms)
                          # Added 50ms refractory period to prevent closely spaced artifacts
                          # Research indicates brief refractory periods improve specificity

# --- Visualization Settings ---
EMG_COLOR = '#1abc9c'  # Teal color for EMG signal
CONTRACTION_COLOR = '#3498db'  # Blue color for contractions
ACTIVITY_COLORS = {
    'jumping': '#1abc9c',  # Teal
    'shooting': '#e67e22'  # Orange
}

# Contraction Quality Visual Cues
CONTRACTION_QUALITY_COLORS = {
    'good': {
        'background': 'rgba(34, 197, 94, 0.15)',  # Green with transparency
        'border': '#22c55e',
        'badge': '#16a34a'
    },
    'poor': {
        'background': 'rgba(239, 68, 68, 0.15)',  # Red with transparency
        'border': '#ef4444',
        'badge': '#dc2626'
    },
    'subthreshold': {
        'background': 'rgba(156, 163, 175, 0.1)',  # Gray with transparency
        'border': '#9ca3af',
        'badge': '#6b7280'
    }
}

# Contraction Visualization Settings
CONTRACTION_HIGHLIGHT_OPACITY = 0.15  # Default opacity for contraction highlights
CONTRACTION_BADGE_SIZE = 4  # Radius of quality badges in pixels

# --- File Processing ---
# For stateless architecture, we only need temporary directories
TEMP_DIR = Path("data/temp_uploads")
ALLOWED_EXTENSIONS = {'.c3d'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# --- API Configuration ---
API_TITLE = "GHOSTLY+ EMG Analysis API"
API_VERSION = "1.0.0"
API_DESCRIPTION = "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game"

# --- CORS Configuration ---
CORS_ORIGINS = ["*"]  # In production, restrict this to specific origins
CORS_CREDENTIALS = True
CORS_METHODS = ["*"]
CORS_HEADERS = ["*"]

# --- Server Configuration ---
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8080
LOG_LEVEL = "info"

# --- Database Configuration ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# --- Redis Cache Configuration ---
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
REDIS_CACHE_TTL_SECONDS = int(os.environ.get("REDIS_CACHE_TTL_SECONDS", "3600"))  # 1 hour
REDIS_MAX_CACHE_SIZE_MB = int(os.environ.get("REDIS_MAX_CACHE_SIZE_MB", "100"))  # 100MB per entry
REDIS_KEY_PREFIX = os.environ.get("REDIS_KEY_PREFIX", "emg_analysis")

# --- Webhook Configuration ---
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", None)
PROCESSING_VERSION = "v2.1.0"

# --- Environment Variables ---
def get_host():
    """Get server host from environment or default."""
    return os.environ.get("HOST", DEFAULT_HOST)

def get_port():
    """Get server port from environment or default."""
    return int(os.environ.get("PORT", DEFAULT_PORT))

def get_log_level():
    """Get log level from environment or default."""
    return os.environ.get("LOG_LEVEL", LOG_LEVEL)

def get_settings():
    """Get application settings as a simple object"""
    class Settings:
        SUPABASE_URL = SUPABASE_URL
        SUPABASE_ANON_KEY = SUPABASE_ANON_KEY
        SUPABASE_SERVICE_KEY = SUPABASE_SERVICE_KEY
        WEBHOOK_SECRET = WEBHOOK_SECRET
        PROCESSING_VERSION = PROCESSING_VERSION
        
        # Redis Cache Settings
        REDIS_URL = REDIS_URL
        REDIS_CACHE_TTL_SECONDS = REDIS_CACHE_TTL_SECONDS
        REDIS_MAX_CACHE_SIZE_MB = REDIS_MAX_CACHE_SIZE_MB
        REDIS_KEY_PREFIX = REDIS_KEY_PREFIX
        
    return Settings()

# --- Ensure temp directory exists ---
def ensure_temp_dir():
    """Ensure temporary directory exists."""
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    return TEMP_DIR