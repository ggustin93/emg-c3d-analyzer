"""FastAPI application for GHOSTLY+ EMG C3D Analyzer.

This module creates and configures the FastAPI application with:
- Modular route organization
- CORS middleware for cross-origin requests
- Structured error handling
- Request ID tracking for debugging
"""

import uuid
from typing import Callable

import structlog
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import (
    analysis,
    cache_monitoring,
    clinical_notes,
    export,
    health,
    logs,
    mvc,
    signals,
    upload,
    webhooks,
)
from api.routes.scoring_config import router as scoring_router
from config import (
    API_DESCRIPTION,
    API_TITLE,
    API_VERSION,
    CORS_CREDENTIALS,
    CORS_HEADERS,
    CORS_METHODS,
    CORS_ORIGINS,
)

# Configure structured logging
logger = structlog.get_logger(__name__)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.
    
    Returns:
        FastAPI: Configured application instance with all routes and middleware.
    """
    # Initialize FastAPI
    app = FastAPI(
        title=API_TITLE,
        description=API_DESCRIPTION,
        version=API_VERSION,
    )
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=CORS_CREDENTIALS,
        allow_methods=CORS_METHODS,
        allow_headers=CORS_HEADERS,
    )
    
    # Add request ID middleware for tracing
    @app.middleware("http")
    async def add_request_id(request: Request, call_next: Callable):
        """Add unique request ID to each request for tracing."""
        request_id = str(uuid.uuid4())
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    
    # Configure error handlers
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions with structured response."""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "HTTP_ERROR",
                "message": exc.detail,
                "status_code": exc.status_code,
                "path": str(request.url),
            },
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle unexpected exceptions with structured response."""
        logger.error("Unhandled exception", exc_info=exc, path=str(request.url))
        return JSONResponse(
            status_code=500,
            content={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "An internal server error occurred",
                "status_code": 500,
                "path": str(request.url),
            },
        )
    
    # Register API routes
    app.include_router(health.router)  # Health checks
    app.include_router(upload.router)  # C3D file upload
    app.include_router(analysis.router)  # EMG analysis
    app.include_router(export.router)  # Data export
    app.include_router(mvc.router)  # MVC calibration
    app.include_router(signals.router)  # Signal processing
    app.include_router(webhooks.router)  # Supabase webhooks
    app.include_router(scoring_router)  # Scoring configuration
    app.include_router(cache_monitoring.router)  # Cache monitoring
    app.include_router(logs.router)  # Frontend log collection
    app.include_router(clinical_notes.router)  # Clinical notes management
    
    logger.info("FastAPI application configured", routes=11)
    return app


# Create application instance
app = create_app()

# Export for imports
__all__ = ["app", "create_app"]