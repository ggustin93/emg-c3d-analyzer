import logging
import sys
import traceback
from pathlib import Path

import structlog
import uvicorn
from dotenv import load_dotenv

from utils.logging_config import setup_logging
from config import get_log_level

# Load environment variables from .env file
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Ensure logs directory exists
logs_dir = Path(__file__).parent.parent / "logs"
logs_dir.mkdir(exist_ok=True)

# Configure logging
log_level = get_log_level()
setup_logging(log_level)
logger = structlog.get_logger("backend")

# Try to import the app with proper error handling
try:
    from api.main import app  # noqa: F401

    logger.info("Successfully imported FastAPI application from modular structure")
except ImportError as e:
    logger.exception(f"Failed to import API: {e}")
    traceback.print_exc()
    sys.exit(1)

# Check if temporary directory exists and create it if needed
try:
    # In the stateless architecture, we only need a temporary directory for file uploads during processing
    # These files will not persist between requests
    from config import ensure_temp_dir

    temp_dir = ensure_temp_dir()
    logger.info(f"Temporary upload directory verified", temp_dir=str(temp_dir))
except Exception as e:
    logger.exception(f"Failed to create temporary directory: {e}")
    traceback.print_exc()
    sys.exit(1)

# If running directly (for development)
if __name__ == "__main__":
    try:
        # Get configuration from config module
        from config import get_host, get_log_level, get_port

        port = get_port()
        host = get_host()
        log_level = get_log_level()

        logger.info(f"Starting uvicorn server", host=host, port=port)
        # Remove reload=True to avoid the warning in production
        uvicorn.run(
            "backend.api.main:app",
            host=host,
            port=port,
            log_level=log_level.lower(),
            log_config=None,  # We are managing logging, so uvicorn shouldn't
        )
    except Exception as e:
        logger.exception(f"Failed to start uvicorn server: {e}")
        traceback.print_exc()
        sys.exit(1)
