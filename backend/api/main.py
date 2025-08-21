"""
GHOSTLY+ EMG Analysis API - Main Application
===========================================

FastAPI application factory with modular route organization.
Follows SOLID principles with clean separation of concerns.

ARCHITECTURE:
============
- App Factory Pattern: Clean initialization and configuration
- Modular Routes: Single responsibility route modules
- Dependency Injection: Service abstraction and injection
- Middleware Management: CORS and error handling centralized

Author: EMG C3D Analyzer Team
Date: 2025-08-14
"""

# Standard library imports
import logging
import os
import sys

# Third-party imports
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# Local imports - Configuration
from config import (
    API_TITLE, API_VERSION, API_DESCRIPTION,
    CORS_ORIGINS, CORS_CREDENTIALS, CORS_METHODS, CORS_HEADERS
)

# Local imports - Route modules (SOLID principle: Single Responsibility)
from .routes import (
    health, upload, analysis, export, mvc,
    signals, webhooks, cache_monitoring
)
from .routes.scoring_config import router as scoring_router

# Check cache monitoring availability
CACHE_MONITORING_AVAILABLE = True

# Configure logging
def setup_logging():
    """Setup consistent logging configuration"""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
        ]
    )
    
    # Set specific logger levels
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    

# Initialize logging
setup_logging()
logger = logging.getLogger(__name__)


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions with structured response"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTP_ERROR",
            "message": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url)
        }
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle general exceptions with structured response"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "message": "An internal server error occurred",
            "status_code": 500,
            "path": str(request.url)
        }
    )


def create_app() -> FastAPI:
    """
    FastAPI application factory.
    
    Creates and configures the FastAPI application with all routes and middleware.
    Follows app factory pattern for clean initialization.
    
    Returns:
        FastAPI: Configured application instance
    """
    # Initialize FastAPI app
    app = FastAPI(
        title=API_TITLE,
        description=API_DESCRIPTION,
        version=API_VERSION,
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=CORS_CREDENTIALS,
        allow_methods=CORS_METHODS,
        allow_headers=CORS_HEADERS,
    )
    
    # Add exception handlers
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)

    # Register route modules (SOLID: Open/Closed Principle)
    app.include_router(health.router)
    app.include_router(upload.router)
    app.include_router(analysis.router)
    app.include_router(export.router)
    app.include_router(mvc.router)
    app.include_router(signals.router)  # JIT signal generation for 99% storage optimization
    app.include_router(webhooks.router)
    app.include_router(scoring_router)  # Scoring configuration management

    # Include cache monitoring router
    app.include_router(cache_monitoring.router)
    logger.info("✅ Cache monitoring endpoints enabled")
    logger.info("🎯 Scoring configuration endpoints enabled")

    logger.info("🚀 FastAPI application created successfully")
    logger.info("🏗️  Architecture: Modular routes with error handling")
    logger.info("📊 Logging: Configured with level %s", os.getenv("LOG_LEVEL", "INFO"))
    
    return app


# Create application instance
app = create_app()


# Legacy compatibility: expose app directly for existing imports
__all__ = ["app", "create_app"]