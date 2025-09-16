"""
API endpoint for backend configuration defaults.

This endpoint provides MVC and duration defaults from config.py.
Scoring weights are now managed exclusively in the database.
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import (
    DEFAULT_TARGET_CONTRACTIONS_CH1,
    DEFAULT_TARGET_CONTRACTIONS_CH2,
    DEFAULT_MVC_THRESHOLD_PERCENTAGE,
    DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/config", tags=["configuration"])


class BackendDefaultsResponse(BaseModel):
    """Response model for backend configuration defaults."""
    
    # Per-channel therapeutic targets
    target_contractions_ch1: int
    target_contractions_ch2: int
    
    # MVC thresholds
    mvc_threshold_percentage: float
    
    # Duration thresholds
    therapeutic_duration_threshold_ms: int
    
    # Note: scoring_weights removed - now fetched from database only


@router.get("/defaults", response_model=BackendDefaultsResponse)
async def get_backend_defaults():
    """Get backend configuration defaults from config.py.
    
    This endpoint provides MVC and duration defaults only.
    Scoring weights must be fetched from the database via
    /api/scoring/configurations/active or /api/scoring/configurations/default.
    
    Returns:
        BackendDefaultsResponse: MVC and duration configuration values only
    """
    try:
        return BackendDefaultsResponse(
            target_contractions_ch1=DEFAULT_TARGET_CONTRACTIONS_CH1,
            target_contractions_ch2=DEFAULT_TARGET_CONTRACTIONS_CH2,
            mvc_threshold_percentage=DEFAULT_MVC_THRESHOLD_PERCENTAGE,
            therapeutic_duration_threshold_ms=DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS,
            # scoring_weights removed - single source of truth is database
        )
        
    except Exception as e:
        logger.exception(f"Failed to get backend defaults: {e}")
        raise HTTPException(status_code=500, detail=str(e))