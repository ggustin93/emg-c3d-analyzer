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
    from api import app
    logger.info("Successfully imported FastAPI application")
except ImportError as e:
    logger.error(f"Failed to import API: {e}")
    logger.error(traceback.format_exc())
    sys.exit(1)

# Check if data directories exist and create them if needed
try:
    data_dirs = ["data/uploads", "data/results", "data/plots"]
    for dir_path in data_dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
    logger.info("Data directories verified")
except Exception as e:
    logger.error(f"Failed to create data directories: {e}")
    logger.error(traceback.format_exc())
    sys.exit(1)

# If running directly (for development)
if __name__ == "__main__":
    try:
        # Get port from environment variable or use default
        port = int(os.environ.get("PORT", 8080))
        host = os.environ.get("HOST", "0.0.0.0")
        
        logger.info(f"Starting uvicorn server on http://{host}:{port}")
        
        # Configure Uvicorn with appropriate settings for handling large files
        uvicorn_config = {
            "host": host,
            "port": port,
            "log_level": "info",
            # Increase timeouts for large file uploads
            "timeout_keep_alive": 120,  # Keep-alive timeout (seconds)
            "limit_concurrency": 10,    # Limit concurrent connections
            "limit_max_requests": 0,    # No limit on max requests
        }
        
        # Start Uvicorn with our configuration
        uvicorn.run(app, **uvicorn_config)
    except Exception as e:
        logger.error(f"Failed to start uvicorn server: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)