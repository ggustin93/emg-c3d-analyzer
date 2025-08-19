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

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configuration
from config import (
    API_TITLE, API_VERSION, API_DESCRIPTION,
    CORS_ORIGINS, CORS_CREDENTIALS, CORS_METHODS, CORS_HEADERS
)

# Route modules (SOLID principle: Single Responsibility)
from .routes import health, upload, analysis, export, mvc
from .routes import signals  # JIT signal generation
from .routes import webhooks  # Webhook processing
from .routes import cache_monitoring  # Cache monitoring (optional)

# Check cache monitoring availability
CACHE_MONITORING_AVAILABLE = True

logger = logging.getLogger(__name__)


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

    # Register route modules (SOLID: Open/Closed Principle)
    app.include_router(health.router)
    app.include_router(upload.router)
    app.include_router(analysis.router)
    app.include_router(export.router)
    app.include_router(mvc.router)
    app.include_router(signals.router)  # JIT signal generation for 99% storage optimization
    app.include_router(webhooks.router)

    # Include cache monitoring router
    app.include_router(cache_monitoring.router)
    logger.info("✅ Cache monitoring endpoints enabled")

    logger.info("🚀 FastAPI application created with modular architecture")
    
    return app


# Create application instance
app = create_app()


# Legacy compatibility: expose app directly for existing imports
__all__ = ["app", "create_app"]