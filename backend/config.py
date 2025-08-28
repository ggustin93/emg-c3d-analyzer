"""GHOSTLY+ Backend Configuration
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
DEFAULT_THRESHOLD_FACTOR = 0.10  # 10% of max amplitude for RMS envelope
# Clinical rationale: 2024-2025 research supports 5-20% range for EMG detection
# 10% provides optimal balance between sensitivity and specificity for rehabilitation therapy
# Lower than previous 20% to detect physiologically relevant submaximal contractions
# Range: 5-8% (high sensitivity), 10-12% (balanced), 15-20% (high selectivity)

# Dual Signal Detection - Activated Signal Threshold
ACTIVATED_THRESHOLD_FACTOR = 0.05  # 5% of max amplitude for clean Activated signal
# Lower threshold for pre-processed Activated signals to detect smaller contractions
# Activated signals are cleaner (2x less noise) so can use higher sensitivity
DEFAULT_MIN_DURATION_MS = 100   # Minimum contraction duration in ms
DEFAULT_SMOOTHING_WINDOW = 100  # Smoothing window size in samples
DEFAULT_MVC_THRESHOLD_PERCENTAGE = 75.0  # Default MVC threshold percentage
DEFAULT_CONTRACTION_DURATION_THRESHOLD_MS = 250  # milliseconds (for detection)
DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS = 2000  # milliseconds (patient-specific therapeutic goal)

# Temporal Analysis Configuration (used for mean ± std over time)
DEFAULT_TEMPORAL_WINDOW_SIZE_MS = 1000  # 1 second windows
DEFAULT_TEMPORAL_OVERLAP_PERCENTAGE = 50.0  # 50% overlap
MIN_TEMPORAL_WINDOWS_REQUIRED = 3  # Minimum windows required for valid stats

# --- File Processing ---
SUPPORTED_FILE_EXTENSIONS = [".c3d"]

# --- Clinical Constants ---
BORG_CR10_SCALE_MAX = 10
BFR_PRESSURE_RANGE = (40, 80)  # % AOP
THERAPEUTIC_COMPLIANCE_THRESHOLD = 0.8

# EMG Signal Processing Constants
DEFAULT_MVC_THRESHOLD_VALUE = 1e-5  # 10μV - reasonable EMG threshold
MVC_PERCENTAGE_DIVISOR = 0.75  # 75% MVC threshold divisor
EMG_HIGH_PASS_CUTOFF = 20.0  # Standard EMG high-pass filter (Hz)
RMS_OVERLAP_PERCENTAGE = 50.0  # RMS window overlap
MVC_WINDOW_SECONDS = 3.0  # MVC calculation window
NYQUIST_SAFETY_FACTOR = 0.9  # 90% of Nyquist frequency for safety

# Clinical Protocol Constants
EXPECTED_CONTRACTIONS_PER_MUSCLE = 12  # GHOSTLY+ protocol

# =============================================================================
# DEVELOPMENT DEFAULTS (MVP - Only Critical Values)
# =============================================================================
# Simple fallback values for development when C3D metadata is incomplete.
# Production C3D files will have complete data.

class DevelopmentDefaults:
    """Default values for development/testing. KISS/MVP approach."""

    # Only the critical values that fix the immediate webhook issue
    BFR_PRESSURE_AOP: float = 50.0  # Safe BFR default
    RPE_POST_SESSION: int = 4  # Optimal RPE for development testing

# Advanced Contraction Detection Parameters
MERGE_THRESHOLD_MS = 150  # Maximum time gap between contractions to merge them (ms)
                         # Optimized at 150ms: balance between merging physiologically related contractions
                         # and maintaining good temporal resolution for rehabilitation assessment
REFRACTORY_PERIOD_MS = 50  # Minimum time after contraction before detecting new one (ms)
                         # Physiologically-based: 5-50ms range for EMG processing (Perplexity research)
                         # 50ms prevents double-detection while allowing rapid contractions
                         # Merge threshold (150ms) handles physiological burst grouping separately

# Physiological Limits for Contraction Detection
MAX_CONTRACTION_DURATION_MS = 10000  # Maximum allowable contraction duration (10 seconds)
                                    # Research-based: Conservative limit for sustained muscle contractions
                                    # Prevents merging of separate contractions into physiologically impossible durations
                                    # Contractions exceeding this limit will be split at natural valleys

# --- Visualization Settings ---
EMG_COLOR = "#1abc9c"  # Teal color for EMG signal
CONTRACTION_COLOR = "#3498db"  # Blue color for contractions
ACTIVITY_COLORS = {
    "jumping": "#1abc9c",  # Teal
    "shooting": "#e67e22"  # Orange
}

# Contraction Quality Visual Cues
CONTRACTION_QUALITY_COLORS = {
    "good": {
        "background": "rgba(34, 197, 94, 0.15)",  # Green with transparency
        "border": "#22c55e",
        "badge": "#16a34a"
    },
    "poor": {
        "background": "rgba(239, 68, 68, 0.15)",  # Red with transparency
        "border": "#ef4444",
        "badge": "#dc2626"
    },
    "subthreshold": {
        "background": "rgba(156, 163, 175, 0.1)",  # Gray with transparency
        "border": "#9ca3af",
        "badge": "#6b7280"
    }
}

# Contraction Visualization Settings
CONTRACTION_HIGHLIGHT_OPACITY = 0.15  # Default opacity for contraction highlights
CONTRACTION_BADGE_SIZE = 4  # Radius of quality badges in pixels

# --- File Processing ---
# For stateless architecture, we only need temporary directories
TEMP_DIR = Path("data/temp_uploads")
ALLOWED_EXTENSIONS = {".c3d"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# --- API Configuration ---
API_TITLE = "GHOSTLY+ EMG Analysis API"
API_VERSION = "1.0.0"
API_DESCRIPTION = "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game"

# --- CORS Configuration ---
# Development CORS settings - more restrictive than wildcard
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
]
CORS_CREDENTIALS = True
CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
CORS_HEADERS = ["*"]

# --- Server Configuration ---
DEFAULT_HOST = "0.0.0.0"  # nosec B104 - Intentional bind to all interfaces for containerized deployment
DEFAULT_PORT = 8080
LOG_LEVEL = "info"

# --- Database Configuration ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# --- Redis Cache Configuration ---
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_DB = int(os.environ.get("REDIS_DB", "0"))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", None)
REDIS_SSL = os.environ.get("REDIS_SSL", "false").lower() == "true"

# Redis Connection Pool Settings
REDIS_SOCKET_TIMEOUT = float(os.environ.get("REDIS_SOCKET_TIMEOUT", "5.0"))
REDIS_CONNECTION_POOL_SIZE = int(os.environ.get("REDIS_CONNECTION_POOL_SIZE", "10"))
REDIS_RETRY_ON_TIMEOUT = os.environ.get("REDIS_RETRY_ON_TIMEOUT", "true").lower() == "true"

# Cache Settings
DEFAULT_CACHE_TTL_HOURS = int(os.environ.get("DEFAULT_CACHE_TTL_HOURS", "24"))
ENABLE_REDIS_COMPRESSION = os.environ.get("ENABLE_REDIS_COMPRESSION", "true").lower() == "true"
REDIS_MAX_MEMORY_POLICY = os.environ.get("REDIS_MAX_MEMORY_POLICY", "allkeys-lru")
REDIS_KEY_PREFIX = os.environ.get("REDIS_KEY_PREFIX", "emg_c3d_analyzer")

# Legacy Redis settings (backward compatibility)
REDIS_CACHE_TTL_SECONDS = int(os.environ.get("REDIS_CACHE_TTL_SECONDS", "3600"))  # 1 hour
REDIS_MAX_CACHE_SIZE_MB = int(os.environ.get("REDIS_MAX_CACHE_SIZE_MB", "100"))  # 100MB per entry

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
