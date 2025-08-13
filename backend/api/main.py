"""
GHOSTLY+ EMG Analysis API - Main Application
===========================================

Organized FastAPI application with modular route structure.
"""

import logging
from typing import Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import configuration
from config import (
    API_TITLE, API_VERSION, API_DESCRIPTION,
    CORS_ORIGINS, CORS_CREDENTIALS, CORS_METHODS, CORS_HEADERS
)

# Import models and services
from models.models import (
    EMGAnalysisResult, ChannelAnalytics, GameSessionParameters
)
from services.c3d_processor import GHOSTLYC3DProcessor

# Import route modules
from .routes import health, upload
from .webhooks import router as webhook_router

# Import existing endpoints that need refactoring
from services.mvc_service import mvc_service
from services.performance_scoring_service import PerformanceScoringService

# Initialize logger
logger = logging.getLogger(__name__)

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

# Include organized route modules
app.include_router(health.router)
app.include_router(upload.router)
app.include_router(webhook_router)

# Include cache monitoring if available
try:
    from .cache_monitoring import router as cache_router
    app.include_router(cache_router)
    logger.info("Cache monitoring endpoints enabled")
except ImportError as e:
    logger.warning(f"Cache monitoring endpoints disabled: {e}")
except Exception as e:
    logger.warning(f"Error loading cache monitoring: {e}")


# TODO: Move these to separate route modules (mvc.py, scores.py)

# Lightweight Recalculation Endpoint
class RecalcRequest(BaseModel):
    existing: EMGAnalysisResult
    session_params: GameSessionParameters


@app.post("/recalc", response_model=EMGAnalysisResult)
async def recalc_analysis(request: RecalcRequest):
    """Recalculate analytics from existing EMGAnalysisResult with updated session parameters."""
    try:
        processor = GHOSTLYC3DProcessor(file_path="")
        updated = processor.recalculate_scores_from_data(
            existing_analytics={
                "metadata": request.existing.metadata.model_dump() if request.existing.metadata else {},
                "analytics": {k: v.model_dump() for k, v in request.existing.analytics.items()},
            },
            session_game_params=request.session_params,
        )

        updated_analytics = {k: ChannelAnalytics(**v) for k, v in updated["analytics"].items()}
        updated_metadata = request.existing.metadata
        if updated_metadata is not None:
            updated_metadata.session_parameters_used = request.session_params

        from models.models import GameMetadata
        response_model = EMGAnalysisResult(
            file_id=request.existing.file_id,
            timestamp=request.existing.timestamp,
            source_filename=request.existing.source_filename,
            metadata=updated_metadata if updated_metadata is not None else GameMetadata(),
            analytics=updated_analytics,
            available_channels=list(updated.get("available_channels", [])),
            emg_signals=request.existing.emg_signals,
            c3d_parameters=request.existing.c3d_parameters,
            user_id=request.existing.user_id,
            patient_id=request.existing.patient_id,
            session_id=request.existing.session_id,
        )
        return response_model
    except Exception as e:
        logger.error(f"Error in /recalc: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error recalculating analytics: {str(e)}")


# MVC Estimation Endpoint (TODO: Move to mvc.py)
@app.post("/mvc/estimate", response_model=Dict[str, Dict])
async def estimate_mvc_values(
    file,
    user_id=None,
    session_id=None,
    threshold_percentage: float = 75.0
):
    """Estimate MVC values from uploaded C3D file using clinical algorithms."""
    # Implementation moved to upload.py for now
    # TODO: Create dedicated mvc.py route module
    raise HTTPException(status_code=501, detail="MVC estimation endpoint needs refactoring")