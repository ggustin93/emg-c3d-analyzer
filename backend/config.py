"""
GHOSTLY+ Backend Configuration
=============================

Configuration file for the GHOSTLY+ backend system.
Contains parameters and settings organized by functional areas.

"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# =============================================================================
# 1. EMG SIGNAL PROCESSING PARAMETERS
# =============================================================================
# Core signal processing configuration
DEFAULT_SAMPLING_RATE = 2000  # Hz (updated for GHOSTLY+ protocol)
DEFAULT_LOWPASS_CUTOFF = 500  # Hz  
DEFAULT_FILTER_ORDER = 4
DEFAULT_RMS_WINDOW_MS = 50  # milliseconds

# EMG-specific filtering
EMG_HIGH_PASS_CUTOFF = 20.0  # Hz - Standard EMG high-pass filter
RMS_OVERLAP_PERCENTAGE = 50.0  # RMS window overlap percentage
NYQUIST_SAFETY_FACTOR = 0.9  # 90% of Nyquist frequency for safety

# Contraction detection thresholds (research-based 2024)
DEFAULT_THRESHOLD_FACTOR = 0.10  # 10% of max amplitude for RMS envelope
ACTIVATED_THRESHOLD_FACTOR = 0.05  # 5% for clean Activated signals
DEFAULT_MIN_DURATION_MS = 100  # Minimum contraction duration
DEFAULT_SMOOTHING_WINDOW = 100  # Smoothing window size in samples

# Temporal analysis configuration
DEFAULT_TEMPORAL_WINDOW_SIZE_MS = 1000  # 1 second windows
DEFAULT_TEMPORAL_OVERLAP_PERCENTAGE = 50.0  # 50% overlap
MIN_TEMPORAL_WINDOWS_REQUIRED = 3  # Minimum windows for valid statistics

# Duration thresholds
DEFAULT_CONTRACTION_DURATION_THRESHOLD_MS = 250  # Detection threshold
DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS = 2000  # Therapeutic goal (patient-specific)

# Advanced contraction detection
MERGE_THRESHOLD_MS = 150  # Maximum gap to merge contractions
REFRACTORY_PERIOD_MS = 50  # Minimum time between contractions
MAX_CONTRACTION_DURATION_MS = 10000  # Maximum contraction duration (10s)

# MVC analysis
MVC_WINDOW_SECONDS = 3.0  # MVC calculation window


# =============================================================================
# 2. CLINICAL PROTOCOL PARAMETERS
# =============================================================================
# Maximum Voluntary Contraction (MVC) workflow - 4-level priority cascade
DEFAULT_MVC_THRESHOLD_PERCENTAGE = 75.0  # 75% MVC for therapeutic exercise

# Per-channel therapeutic targets (asymmetric rehabilitation support)
DEFAULT_TARGET_CONTRACTIONS_CH1 = 12  # Left muscle target
DEFAULT_TARGET_CONTRACTIONS_CH2 = 12  # Right muscle target

# Clinical assessment scales
BORG_CR10_SCALE_MAX = 10  # Rating of Perceived Exertion (0-10 scale)


# =============================================================================
# 3. SCORING CONFIGURATION DEFAULTS
# =============================================================================
from dataclasses import field

@dataclass(frozen=True)
class ScoringDefaults:
    """
    Default scoring configuration from metricsDefinitions.md - Single Source of Truth.
    
    These values represent the clinically validated weights and RPE mapping
    for the GHOSTLY+ performance scoring system.
    """
    
    # Main component weights (must sum to 1.0) - from metricsDefinitions.md Section 3
    WEIGHT_COMPLIANCE: float = 0.50   # 50% - Therapeutic Compliance
    WEIGHT_SYMMETRY: float = 0.25     # 25% - Muscle Symmetry  
    WEIGHT_EFFORT: float = 0.25       # 25% - Subjective Effort (RPE)
    WEIGHT_GAME: float = 0.00         # 0% - Game Performance (optional, game-dependent)
    
    # Sub-component weights for compliance (must sum to 1.0)
    WEIGHT_COMPLETION: float = 0.333  # Equal weight for completion rate
    WEIGHT_INTENSITY: float = 0.333   # Equal weight for intensity rate
    WEIGHT_DURATION: float = 0.334    # Equal weight for duration rate (adjusted for sum)
    
    # Default RPE mapping matching database schema - clinically validated
    # Based on Borg CR-10 scale (0-10) for elderly rehabilitation
    DEFAULT_RPE_MAPPING: dict = field(default_factory=lambda: {
        "0": {"score": 10, "category": "no_exertion", "clinical": "concerning_lack_of_effort"},
        "1": {"score": 25, "category": "very_light", "clinical": "below_therapeutic_minimum"},
        "2": {"score": 50, "category": "light", "clinical": "warm_up_intensity"},
        "3": {"score": 85, "category": "moderate_low", "clinical": "therapeutic_entry_range"},
        "4": {"score": 100, "category": "optimal_moderate", "clinical": "ideal_therapeutic_intensity"},
        "5": {"score": 100, "category": "optimal_moderate", "clinical": "peak_therapeutic_intensity"},
        "6": {"score": 75, "category": "somewhat_hard", "clinical": "approaching_upper_limit"},
        "7": {"score": 50, "category": "hard", "clinical": "excessive_for_elderly"},
        "8": {"score": 25, "category": "very_hard", "clinical": "dangerous_overexertion"},
        "9": {"score": 15, "category": "extremely_hard", "clinical": "immediate_intervention_needed"},
        "10": {"score": 10, "category": "maximum", "clinical": "emergency_stop_protocol"}
    })


# =============================================================================
# 4. SESSION DEFAULTS & FALLBACKS
# =============================================================================
@dataclass(frozen=True)
class ClinicalDefaults:
    """
    Single source of truth for all clinical defaults and therapeutic parameters.
    
    Thread-safe, immutable configuration for consistent session parameters.
    Fallback hierarchy:
    1. C3D metadata (if available)
    2. Previous session from same patient (if exists)
    3. These system defaults
    """
    
    # MVC values (development fallback, production from C3D/database)
    MVC_CH1: float = 1.5e-4  # 150μV development default
    MVC_CH2: float = 1.5e-4  # 150μV development default
    
    # MVC threshold percentage (percentage of MVC for therapeutic activation)
    MVC_THRESHOLD_PERCENTAGE: float = 75.0  # 75% MVC
    
    # Therapeutic duration thresholds (explicit per-channel naming)
    TARGET_DURATION_CH1_MS: int = 2000  # 2 seconds for channel 1
    TARGET_DURATION_CH2_MS: int = 2000  # 2 seconds for channel 2
    
    # Therapeutic contraction targets (per-channel flexibility for asymmetric rehabilitation)
    TARGET_CONTRACTIONS_CH1: int = 12
    TARGET_CONTRACTIONS_CH2: int = 12
    
    # Clinical assessment
    RPE_POST_SESSION: int = 4  # Optimal RPE on 0-10 scale
    
    # BFR (Blood Flow Restriction) pressure defaults
    TARGET_PRESSURE_AOP: float = 50.0  # 50% AOP (middle of 40-60% safe range)
    BFR_RANGE_MIN: float = 40.0  # Minimum therapeutic range
    BFR_RANGE_MAX: float = 60.0  # Maximum therapeutic range
    BFR_APPLICATION_TIME_MINUTES: int = 15  # Standard application time
    
    # Therapist identification (from C3D metadata in production)
    THERAPIST_ID: Optional[str] = None
    THERAPIST_CODE: str = "DEV001"  # Development fallback

# Legacy alias for backward compatibility
SessionDefaults = ClinicalDefaults


@dataclass(frozen=True)
class UserDefaults:
    """
    Default user codes for testing, development, and fallback scenarios.
    
    These codes provide human-readable identifiers for users in the system.
    Format: [Role][Number] where Role = T (therapist), R (researcher), A (admin)
    """
    
    # Default codes for each role (used in testing/development)
    DEFAULT_THERAPIST_CODE: str = "T001"
    DEFAULT_RESEARCHER_CODE: str = "R001"
    DEFAULT_ADMIN_CODE: str = "A001"
    
    # Special codes for fallback scenarios
    UNKNOWN_THERAPIST_CODE: str = "T000"  # Used when therapist cannot be identified from C3D
    UNKNOWN_RESEARCHER_CODE: str = "R000"  # Reserved for future use
    UNKNOWN_ADMIN_CODE: str = "A000"      # Reserved for future use


# =============================================================================
# 4. TECHNICAL INFRASTRUCTURE
# =============================================================================
# File processing
SUPPORTED_FILE_EXTENSIONS = [".c3d"]
TEMP_DIR = "data/temp_uploads"
ALLOWED_EXTENSIONS = SUPPORTED_FILE_EXTENSIONS
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

# API configuration
API_TITLE = "GHOSTLY+ EMG C3D Analyzer"
API_VERSION = "2.1.0"
API_DESCRIPTION = "EMG analysis and therapeutic assessment for C3D files"

# CORS configuration
# Dynamic CORS origins from environment or defaults
ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip()
COOLIFY_PUBLIC_URL = os.getenv("COOLIFY_PUBLIC_URL", "").strip()

# Build CORS origins list
CORS_ORIGINS = [
    # Allow common Vite development ports
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:3001", "http://127.0.0.1:3001", 
    "http://localhost:3002", "http://127.0.0.1:3002",
    "http://localhost:3003", "http://127.0.0.1:3003",
    "http://localhost:3004", "http://127.0.0.1:3004",
    "http://localhost:3005", "http://127.0.0.1:3005",
    "http://localhost:3006", "http://127.0.0.1:3006",
    "http://localhost:3007", "http://127.0.0.1:3007",
    "http://localhost:3008", "http://127.0.0.1:3008",
    "http://localhost:3009", "http://127.0.0.1:3009",
    # Production deployments - Vercel
    "https://emg-c3d-analyzer.vercel.app",  # Vercel frontend production
    "https://emg-c3d-analyzer-*.vercel.app",  # Vercel preview deployments
]

# Add dynamic origins from environment
if ALLOWED_ORIGINS_ENV:
    # Support comma-separated list of origins from env
    additional_origins = [origin.strip() for origin in ALLOWED_ORIGINS_ENV.split(",") if origin.strip()]
    CORS_ORIGINS.extend(additional_origins)

if FRONTEND_URL:
    # Add explicit frontend URL (used in Docker deployments)
    CORS_ORIGINS.append(FRONTEND_URL)

if COOLIFY_PUBLIC_URL:
    # Add Coolify deployment URL
    CORS_ORIGINS.append(COOLIFY_PUBLIC_URL)
CORS_CREDENTIALS = True
CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]  # Added OPTIONS for preflight
CORS_HEADERS = ["*"]

# Server configuration
DEFAULT_HOST = "localhost"
DEFAULT_PORT = 8080
LOG_LEVEL = "INFO"

# Database configuration (loaded from environment)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Redis cache configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_SSL = os.getenv("REDIS_SSL", "false").lower() == "true"

# Redis performance settings
REDIS_SOCKET_TIMEOUT = 5.0
REDIS_CONNECTION_POOL_SIZE = 10
REDIS_RETRY_ON_TIMEOUT = True
DEFAULT_CACHE_TTL_HOURS = 24
ENABLE_REDIS_COMPRESSION = True
REDIS_MAX_MEMORY_POLICY = "allkeys-lru"
REDIS_KEY_PREFIX = "ghostly:"
REDIS_CACHE_TTL_SECONDS = 3600
REDIS_MAX_CACHE_SIZE_MB = 256

# Webhook configuration
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET")
PROCESSING_VERSION = "2.1.0"

# File processing behavior
ENABLE_FILE_HASH_DEDUPLICATION = os.getenv("ENABLE_FILE_HASH_DEDUPLICATION", "true").lower() == "true"

# Storage configuration
STORAGE_BUCKET_NAME = os.getenv("STORAGE_BUCKET_NAME", "c3d-examples")  # Supabase storage bucket for C3D files


# =============================================================================
# 5. ENVIRONMENT-SPECIFIC FUNCTIONS
# =============================================================================
def get_host() -> str:
    """Get server host from environment or default."""
    return os.getenv("HOST", DEFAULT_HOST)


def get_port() -> int:
    """Get server port from environment or default."""
    return int(os.getenv("PORT", DEFAULT_PORT))


def get_log_level() -> str:
    """Get log level from environment or default."""
    return os.getenv("LOG_LEVEL", LOG_LEVEL)


def get_settings() -> dict:
    """Get application settings as a simple object."""
    return {
        "host": get_host(),
        "port": get_port(),
        "log_level": get_log_level(),
        "api_title": API_TITLE,
        "api_version": API_VERSION,
    }


def ensure_temp_dir() -> Path:
    """Ensure temporary directory exists."""
    temp_path = Path(TEMP_DIR)
    temp_path.mkdir(parents=True, exist_ok=True)
    return temp_path


# =============================================================================
# VALIDATION & UTILITIES
# =============================================================================
def validate_configuration() -> bool:
    """Validate entire configuration for consistency."""
    try:
        # Validate SessionDefaults
        defaults = SessionDefaults()
        
        # Validate MVC values are physiologically reasonable
        min_emg, max_emg = 1e-6, 1e-2  # 1μV to 10mV
        if not (min_emg <= defaults.MVC_CH1 <= max_emg):
            raise ValueError(f"Invalid MVC_CH1: {defaults.MVC_CH1}")
        if not (min_emg <= defaults.MVC_CH2 <= max_emg):
            raise ValueError(f"Invalid MVC_CH2: {defaults.MVC_CH2}")
            
        # Validate therapeutic targets
        min_contractions, max_contractions = 5, 20
        if not (min_contractions <= defaults.TARGET_CONTRACTIONS_CH1 <= max_contractions):
            raise ValueError(f"Invalid TARGET_CONTRACTIONS_CH1: {defaults.TARGET_CONTRACTIONS_CH1}")
        if not (min_contractions <= defaults.TARGET_CONTRACTIONS_CH2 <= max_contractions):
            raise ValueError(f"Invalid TARGET_CONTRACTIONS_CH2: {defaults.TARGET_CONTRACTIONS_CH2}")
        
        # Validate required environment variables in production
        env = os.getenv("ENVIRONMENT", "development").lower()
        if env == "production":
            required_vars = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]
            missing = [var for var in required_vars if not os.getenv(var)]
            if missing:
                raise ValueError(f"Missing production environment variables: {missing}")
        
        return True
        
    except Exception as e:
        print(f"❌ Configuration validation failed: {e}")
        return False


def get_configuration_info() -> dict:
    """Get information about the current configuration structure."""
    return {
        "architecture": "single_file_clean",
        "sections": [
            "emg_signal_processing", 
            "clinical_protocol", 
            "session_defaults", 
            "technical_infrastructure", 
            "environment_functions"
        ],
        "validation": "built_in",
        "environment_support": True,
        "thread_safe": True,
        "total_constants": len([k for k in globals() if k.isupper() and not k.startswith('_')]),
    }


# =============================================================================
# CONFIGURATION SUMMARY
# =============================================================================
# Automatically validate configuration on import
if __name__ != "__main__":
    if not validate_configuration():
        import warnings
        warnings.warn("Configuration validation failed - check settings", UserWarning)

# For debugging/introspection
if __name__ == "__main__":
    print("🔧 GHOSTLY+ Configuration Summary")
    print("=" * 50)
    info = get_configuration_info()
    for key, value in info.items():
        print(f"{key}: {value}")
    
    print(f"\n✅ Validation: {'PASSED' if validate_configuration() else 'FAILED'}")
    print(f"📊 Total constants: {info['total_constants']}")
    print(f"🏗️ Architecture: {info['architecture']}")