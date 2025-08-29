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

# Robust app import with comprehensive fallback for different execution contexts
def import_fastapi_app():
    """Import FastAPI app with multiple fallback strategies."""
    import os
    import importlib.util
    
    app = None
    import_errors = []
    
    # Method 1: Direct import from api.main
    try:
        from api.main import app
        logger.info("✅ Successfully imported FastAPI app from api.main")
        return app
    except ImportError as e:
        import_errors.append(f"api.main: {e}")
        logger.debug(f"Direct api.main import failed: {e}")
    
    # Method 2: Import with explicit path manipulation for CI/test environments
    try:
        backend_dir = Path(__file__).parent
        api_main_path = backend_dir / "api" / "main.py"
        
        if api_main_path.exists():
            spec = importlib.util.spec_from_file_location("api.main", api_main_path)
            if spec and spec.loader:
                api_main_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(api_main_module)
                app = api_main_module.app
                logger.info("✅ Successfully imported FastAPI app via importlib")
                return app
            else:
                raise ImportError("Could not create module spec for api.main")
        else:
            raise ImportError(f"api/main.py not found at {api_main_path}")
    except Exception as e:
        import_errors.append(f"importlib: {e}")
        logger.debug(f"Importlib fallback failed: {e}")
    
    # If we're in a test context, don't exit - just log and return None
    if "pytest" in sys.modules or "test" in sys.argv[0].lower():
        logger.warning(
            f"⚠️ Running in test context - FastAPI app import failed but continuing",
            import_errors=import_errors,
            context="test_execution"
        )
        return None
    
    # If we're in normal execution and all imports failed, this is a real error
    logger.error(
        f"❌ Failed to import FastAPI app after all attempts",
        import_errors=import_errors,
        backend_dir=str(Path(__file__).parent),
        api_main_exists=(Path(__file__).parent / "api" / "main.py").exists()
    )
    
    # Only exit if not in test context
    traceback.print_exc()
    sys.exit(1)

# Import the app
app = import_fastapi_app()

if app is not None:
    logger.info("🚀 FastAPI application ready for use")

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
