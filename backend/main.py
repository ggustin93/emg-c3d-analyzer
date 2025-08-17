import uvicorn
import sys
import logging
from pathlib import Path
import traceback
import os
from dotenv import load_dotenv

# Load environment variables from .env file
from pathlib import Path
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Ensure logs directory exists
logs_dir = Path(__file__).parent.parent / "logs"
logs_dir.mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("backend.log"),  # Keep local backend.log
        logging.FileHandler(logs_dir / "backend.log"),  # Also write to logs/ folder
    ]
)
logger = logging.getLogger("backend")

# Try to import the app with proper error handling
try:
    from api.main import app
    logger.info("Successfully imported FastAPI application from modular structure")
except ImportError as e:
    logger.error(f"Failed to import API: {e}")
    logger.error(traceback.format_exc())
    sys.exit(1)

# Check if temporary directory exists and create it if needed
try:
    # In the stateless architecture, we only need a temporary directory for file uploads during processing
    # These files will not persist between requests
    from config import ensure_temp_dir
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
        from config import get_port, get_host, get_log_level
        port = get_port()
        host = get_host()
        log_level = get_log_level()
        
        logger.info(f"Starting uvicorn server on http://{host}:{port}")
        # Remove reload=True to avoid the warning in production
        uvicorn.run("backend.api.main:app", host=host, port=port, log_level=log_level)
    except Exception as e:
        logger.error(f"Failed to start uvicorn server: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)