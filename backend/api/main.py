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
from api.routes.config_defaults import router as config_defaults_router
from api.routes.scoring_config import router as scoring_router
from api.routes.therapist_resolution import router as therapist_router
from config import (
    API_DESCRIPTION,
    API_TITLE,
    API_VERSION,
    CORS_CREDENTIALS,
    CORS_HEADERS,
    CORS_METHODS,
    CORS_ORIGINS,
    ScoringDefaults,
)
from database.supabase_client import get_supabase_client

# Configure structured logging
logger = structlog.get_logger(__name__)


async def ensure_default_scoring_configuration():
    """Ensure GHOSTLY-TRIAL-DEFAULT configuration exists in database.
    
    This startup validation guarantees the default scoring configuration
    is always available, creating it with defaults from config.py if missing.
    
    Gracefully handles Supabase connection issues to prevent startup failures.
    """
    try:
        # Test Supabase connectivity first
        supabase = get_supabase_client(use_service_key=True)
        default_config_id = "a0000000-0000-0000-0000-000000000001"
        
        logger.info("Testing Supabase connectivity for scoring configuration...")
        
        # Check if GHOSTLY-TRIAL-DEFAULT exists
        result = (
            supabase.table("scoring_configuration")
            .select("id, configuration_name")
            .eq("id", default_config_id)
            .execute()
        )
        
        if not result.data:
            # Create default configuration using config.py defaults
            logger.warning("GHOSTLY-TRIAL-DEFAULT not found, creating it with defaults")
            scoring_defaults = ScoringDefaults()
            
            default_config = {
                "id": default_config_id,
                "configuration_name": "GHOSTLY-TRIAL-DEFAULT",
                "description": "Default scoring configuration for GHOSTLY+ clinical trial. All patients use this configuration.",
                "weight_compliance": scoring_defaults.WEIGHT_COMPLIANCE,
                "weight_symmetry": scoring_defaults.WEIGHT_SYMMETRY,
                "weight_effort": scoring_defaults.WEIGHT_EFFORT,
                "weight_game": scoring_defaults.WEIGHT_GAME,
                "weight_completion": scoring_defaults.WEIGHT_COMPLETION,
                "weight_intensity": scoring_defaults.WEIGHT_INTENSITY,
                "weight_duration": scoring_defaults.WEIGHT_DURATION,
                "is_global": True,
                "active": True,
            }
            
            create_result = (
                supabase.table("scoring_configuration")
                .insert(default_config)
                .execute()
            )
            
            if create_result.data:
                logger.info("✅ Created GHOSTLY-TRIAL-DEFAULT configuration with defaults from config.py")
            else:
                logger.error("❌ Failed to create GHOSTLY-TRIAL-DEFAULT configuration")
        else:
            logger.info("✅ GHOSTLY-TRIAL-DEFAULT configuration validated successfully")
            
    except ValueError as e:
        # Missing environment variables
        logger.error(f"⚠️ Supabase configuration error: {e}")
        logger.error("   Application will start but default scoring configuration is unavailable")
        logger.error("   Please verify SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
        
    except Exception as e:
        # Any other error (network, auth, etc.)
        error_msg = str(e)
        
        if "401" in error_msg or "Invalid API key" in error_msg:
            logger.error("🔑 Supabase authentication failed - invalid service key")
            logger.error("   Check if SUPABASE_SERVICE_KEY is correct and project is active")
        elif "403" in error_msg:
            logger.error("🚫 Supabase access denied - insufficient permissions")
        elif "timeout" in error_msg.lower():
            logger.error("⏱️ Supabase connection timeout - network or server issues")
        else:
            logger.error(f"🚨 Unexpected Supabase error: {e}")
            
        logger.error("   Application will start in degraded mode")
        logger.error("   Default scoring configuration will use runtime fallbacks from config.py")
        
        # Don't fail startup - application can function with runtime fallbacks


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
    
    # Register startup event handler for configuration validation
    @app.on_event("startup")
    async def startup_event():
        """Run startup tasks including configuration validation."""
        await ensure_default_scoring_configuration()
    
    # Configure CORS with dynamic origin validation
    def is_allowed_origin(origin: str) -> bool:
        """Check if origin is allowed, supporting wildcards."""
        if not origin:
            return False
        
        # Check exact matches
        if origin in CORS_ORIGINS:
            return True
        
        # Check wildcard patterns for Vercel preview deployments
        if origin.startswith("https://emg-c3d-analyzer-") and origin.endswith(".vercel.app"):
            return True
        
        # Check Coolify deployments (if using subdomains)
        if "coolify" in origin.lower() or "emg-c3d" in origin.lower():
            logger.info(f"Allowing Coolify origin: {origin}")
            return True
        
        return False
    
    # Configure CORS with custom origin validation
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,  # Base list of allowed origins
        allow_origin_regex="https://emg-c3d-analyzer-.*\\.vercel\\.app",  # Regex for Vercel previews
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
    app.include_router(config_defaults_router)  # Backend configuration defaults
    app.include_router(scoring_router)  # Scoring configuration
    app.include_router(cache_monitoring.router)  # Cache monitoring
    app.include_router(logs.router)  # Frontend log collection
    app.include_router(clinical_notes.router)  # Clinical notes management
    app.include_router(therapist_router)  # Therapist resolution
    
    logger.info("FastAPI application configured", routes=13)
    return app


# Create application instance
app = create_app()

# Export for imports
__all__ = ["app", "create_app"]