"""Analysis Routes.
==============

Analysis recalculation endpoints.
Single responsibility: EMG analysis recalculation without file re-upload.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models import (
    ChannelAnalytics,
    EMGAnalysisResult,
    GameMetadata,
    GameSessionParameters,
)
from services.c3d.processor import GHOSTLYC3DProcessor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])


class RecalcRequest(BaseModel):
    """Request model for analysis recalculation."""

    existing: EMGAnalysisResult
    session_params: GameSessionParameters


@router.post("/recalc", response_model=EMGAnalysisResult)
async def recalc_analysis(request: RecalcRequest):
    """Recalculate analytics from an existing EMGAnalysisResult with updated session parameters.
    This avoids re-processing the entire C3D file and only updates counts/flags/thresholds
    based on the new parameters (e.g., duration threshold, MVC settings).

    Args:
        request: Recalculation request with existing results and new parameters

    Returns:
        EMGAnalysisResult: Updated analysis results

    Raises:
        HTTPException: 500 for processing errors
    """
    try:
        # Use processor helper to recalc from existing analytics
        processor = GHOSTLYC3DProcessor(file_path="")
        updated = processor.recalculate_scores_from_data(
            existing_analytics={
                "metadata": request.existing.metadata.model_dump()
                if request.existing.metadata
                else {},
                "analytics": {k: v.model_dump() for k, v in request.existing.analytics.items()},
            },
            session_game_params=request.session_params,
        )

        # Build updated response model reusing original file info and signals
        updated_analytics = {k: ChannelAnalytics(**v) for k, v in updated["analytics"].items()}

        # Update metadata with the new session parameters used
        updated_metadata = request.existing.metadata
        if updated_metadata is not None:
            updated_metadata.session_parameters_used = request.session_params

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
        import traceback

        logger.exception("ERROR in /analysis/recalc: %s", e)
        logger.exception(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error recalculating analytics: {e!s}")
