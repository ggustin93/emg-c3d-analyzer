import uvicorn
import sys
import logging
from pathlib import Path
import traceback
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("backend.log"),
    ]
)
logger = logging.getLogger("backend")

# Try to import the app with proper error handling
try:
    from .api import app
    logger.info("Successfully imported FastAPI application")
except ImportError as e:
    logger.error(f"Failed to import API: {e}")
    logger.error(traceback.format_exc())
    sys.exit(1)

# Check if temporary directory exists and create it if needed
try:
    # In the stateless architecture, we only need a temporary directory for file uploads during processing
    # These files will not persist between requests
    from .config import ensure_temp_dir
    temp_dir = ensure_temp_dir()
    logger.info(f"Temporary upload directory verified: {temp_dir}")
except Exception as e:
    logger.error(f"Failed to create temporary directory: {e}")
    logger.error(traceback.format_exc())
    sys.exit(1)

# If running directly (for development)
if __name__ == "__main__":
    try:
        # Get configuration from config module
        from .config import get_port, get_host, get_log_level
        port = get_port()
        host = get_host()
        log_level = get_log_level()
        
        logger.info(f"Starting uvicorn server on http://{host}:{port}")
        # Remove reload=True to avoid the warning in production
        uvicorn.run("backend.api:app", host=host, port=port, log_level=log_level)
    except Exception as e:
        logger.error(f"Failed to start uvicorn server: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)