import uvicorn
import sys
import logging
from pathlib import Path
import traceback

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
    from backend.api import app
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
        logger.info("Starting uvicorn server on http://0.0.0.0:8080")
        uvicorn.run(app, host="0.0.0.0", port=8080, reload=True, log_level="info")
    except Exception as e:
        logger.error(f"Failed to start uvicorn server: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)