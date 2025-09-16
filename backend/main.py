"""Backend entry point for GHOSTLY+ EMG C3D Analyzer.

This module serves as the application entry point, handling:
- Environment configuration
- Logging setup
- FastAPI app initialization
- Development server launch
"""

import sys
from pathlib import Path

import structlog
import uvicorn
from dotenv import load_dotenv

from config import ensure_temp_dir, get_host, get_log_level, get_port
from utils.logging_config import setup_logging

# Load environment variables
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Setup logging
log_level = get_log_level()
setup_logging(log_level)
logger = structlog.get_logger(__name__)

# Startup diagnostics for Coolify debugging
import os
logger.info("=== BACKEND STARTUP DIAGNOSTICS ===")
logger.info(f"Python version: {sys.version}")
logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'not set')}")
logger.info(f"SUPABASE_URL: {'SET' if os.getenv('SUPABASE_URL') else 'MISSING'}")
logger.info(f"SUPABASE_ANON_KEY: {'SET' if os.getenv('SUPABASE_ANON_KEY') else 'MISSING'}")
logger.info(f"SUPABASE_SERVICE_KEY: {'SET' if os.getenv('SUPABASE_SERVICE_KEY') else 'MISSING'}")
logger.info(f"REDIS_URL: {os.getenv('REDIS_URL', 'not set')}")
logger.info(f"Working directory: {os.getcwd()}")
logger.info(f"Files in directory: {os.listdir('.')[:10]}")  # First 10 files

# Import FastAPI application
try:
    from api.main import app
    logger.info("FastAPI app imported successfully")
except ImportError as e:
    # Allow tests to run without FastAPI app
    if "pytest" in sys.modules or "test" in sys.argv[0].lower():
        logger.warning(f"Test context detected - continuing without app: {e}")
        app = None
    else:
        logger.error(f"Failed to import FastAPI app: {e}")
        sys.exit(1)

# Verify temporary directory for file uploads
try:
    temp_dir = ensure_temp_dir()
    logger.info(f"Temporary directory ready: {temp_dir}")
except Exception as e:
    logger.error(f"Failed to setup temporary directory: {e}")
    sys.exit(1)


def main():
    """Start the uvicorn server for development."""
    if app is None:
        logger.error("No FastAPI app available")
        sys.exit(1)
    
    host = get_host()
    port = get_port()
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        log_level=log_level.lower(),
        log_config=None  # Use our custom logging configuration
    )


if __name__ == "__main__":
    main()