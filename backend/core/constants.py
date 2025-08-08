"""
Core constants for EMG C3D Analyzer

Contains system-wide constants and configuration values.
"""

# Signal Processing Constants
DEFAULT_SAMPLING_RATE = 2000  # Hz
DEFAULT_LOWPASS_CUTOFF = 500  # Hz
DEFAULT_FILTER_ORDER = 4
DEFAULT_RMS_WINDOW_MS = 50  # milliseconds

# Analysis Constants
DEFAULT_MVC_THRESHOLD_PERCENTAGE = 75  # %
DEFAULT_CONTRACTION_DURATION_THRESHOLD_MS = 250  # milliseconds
MIN_CONTRACTION_DURATION_MS = 100  # milliseconds

# File Processing Constants
MAX_FILE_SIZE_MB = 100
SUPPORTED_FILE_EXTENSIONS = ['.c3d']
TEMP_DIR_PREFIX = 'emg_analysis_'

# Performance Constants
CACHE_TIMEOUT_SECONDS = 3600  # 1 hour
MAX_CACHE_SIZE = 100  # number of cached results

# Clinical Constants
BORG_CR10_SCALE_MAX = 10
BFR_PRESSURE_RANGE = (40, 80)  # % AOP
THERAPEUTIC_COMPLIANCE_THRESHOLD = 0.8