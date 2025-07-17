"""
GHOSTLY+ Backend Configuration
==============================

Centralized configuration for the GHOSTLY+ EMG C3D Analyzer backend.
"""

import os
from pathlib import Path

# --- EMG Processing Parameters ---
DEFAULT_SAMPLING_RATE = 1000  # Hz
DEFAULT_THRESHOLD_FACTOR = 0.3  # 30% of max amplitude
DEFAULT_MIN_DURATION_MS = 50  # Minimum contraction duration in ms
DEFAULT_SMOOTHING_WINDOW = 25  # Smoothing window size in samples
DEFAULT_MVC_THRESHOLD_PERCENTAGE = 75.0  # Default MVC threshold percentage

# --- Analysis Parameters ---
RMS_ENVELOPE_WINDOW_MS = 100  # Window size for RMS envelope calculation in ms

# Contraction Detection Parameters
MERGE_THRESHOLD_MS = 500  # Maximum time gap between contractions to merge them (ms)
                          # Clinical rationale: 500ms accommodates brief signal drops during 
                          # sustained contractions typical in rehabilitation exercises.
                          # This prevents physiologically single contractions from being
                          # split into multiple detected events due to EMG signal oscillations.
REFRACTORY_PERIOD_MS = 0  # Minimum time after contraction before detecting new one

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

# --- Ensure temp directory exists ---
def ensure_temp_dir():
    """Ensure temporary directory exists."""
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    return TEMP_DIR