"""MVC Routes.
=========

Maximum Voluntary Contraction calibration endpoint.
Single responsibility: MVC calibration from files or existing data.
KISS principle: One endpoint, smart input detection.
"""

import json
import logging
import os
import shutil
import tempfile
from typing import Dict, Optional, Union

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from models import EMGAnalysisResult, GameSessionParameters
from services.analysis import mvc_service
from services.c3d.processor import GHOSTLYC3DProcessor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mvc", tags=["mvc"])


class MVCRecalibrateRequest(BaseModel):
    """Request model for MVC recalibration from existing analysis."""

    existing: EMGAnalysisResult
    session_params: GameSessionParameters


@router.post("/calibrate", response_model=dict[str, dict])
async def calibrate_mvc_values(
    request: Request,
    # File upload parameters
    file: UploadFile | None = File(None),
    user_id: str | None = Form(None),
    session_id: str | None = Form(None),
    threshold_percentage: float = Form(75.0),
):
    """Single MVC calibration endpoint - handles both file uploads and recalibration.

    Smart input detection:
    - FormData with file: Initial calibration from C3D file
    - JSON body: Recalibration from existing EMGAnalysisResult

    Args:
        file: C3D file upload (for initial calibration)
        user_id: User identifier for tracking
        session_id: Session identifier for tracking
        threshold_percentage: MVC threshold percentage (default 75%)

    Returns:
        Dict: MVC estimations for all channels with metadata

    Raises:
        HTTPException: 400 for invalid inputs, 500 for processing errors
    """
    content_type = request.headers.get("content-type", "")

    try:
        # Smart input detection: FormData (file) vs JSON (existing data)
        if file is not None:
            # Case 1: File upload - Initial calibration from C3D file
            logger.info(f"🔄 Starting initial MVC calibration from file: {file.filename}")
            return await _calibrate_from_file(file, user_id, session_id, threshold_percentage)

        elif "application/json" in content_type:
            # Case 2: JSON body - Recalibration from existing analysis
            logger.info("🔄 Starting MVC recalibration from existing analysis")
            body = await request.json()
            recalibrate_request = MVCRecalibrateRequest(**body)
            return await _calibrate_from_existing(recalibrate_request)

        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid request format. Send either FormData with file or JSON with existing analysis.",
            )

    except Exception as e:
        import traceback

        logger.exception(f"ERROR in /mvc/calibrate: {e!s}")
        logger.exception(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error calibrating MVC: {e!s}")


async def _calibrate_from_file(
    file: UploadFile, user_id: str | None, session_id: str | None, threshold_percentage: float
) -> dict[str, dict]:
    """Handle MVC calibration from uploaded C3D file."""
    if not file.filename.lower().endswith(".c3d"):
        raise HTTPException(status_code=400, detail="File must be a C3D file")

    tmp_path = ""
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Process the file to extract EMG signals
        processor = GHOSTLYC3DProcessor(tmp_path)

        # Extract raw EMG signals
        emg_signals = {}
        sampling_rate = None

        # Process file to get EMG signals
        processor._load_c3d_data()  # Load C3D file
        processor._identify_emg_channels()  # Identify EMG channels
        processor._extract_emg_data()  # Extract EMG data

        # Get RMS envelope signals for GOLD STANDARD MVC estimation
        for channel in processor.emg_channels:
            if hasattr(processor, "emg_data") and channel in processor.emg_data:
                # PRIORITY: Use RMS envelope if available (gold standard for MVC)
                if (
                    "rms_envelope" in processor.emg_data[channel]
                    and processor.emg_data[channel]["rms_envelope"]
                ):
                    emg_signals[channel] = np.array(processor.emg_data[channel]["rms_envelope"])
                    logger.info(f"🏆 Using RMS envelope for MVC estimation: {channel}")
                else:
                    # Fallback to raw signal (will be processed to RMS in mvc_service)
                    emg_signals[channel] = processor.emg_data[channel]["raw"]
                    logger.info(f"⚠️ Using raw signal (will calculate RMS): {channel}")

                if sampling_rate is None and "sampling_rate" in processor.emg_data[channel]:
                    sampling_rate = processor.emg_data[channel]["sampling_rate"]

        if not emg_signals:
            raise HTTPException(status_code=400, detail="No EMG channels found in C3D file")

        if sampling_rate is None:
            # Try to get from C3D file metadata
            sampling_rate = getattr(processor, "analog_sample_rate", 1000)  # Default fallback

        # Use MVC service for bulk estimation
        mvc_results = await mvc_service.bulk_estimate_mvc(
            signal_data_dict=emg_signals,
            sampling_rate=int(sampling_rate),
            user_id=user_id,
            session_id=session_id,
            threshold_percentage=threshold_percentage,
        )

        # Convert results to JSON-serializable format
        response_data = {}
        for channel, estimation in mvc_results.items():
            response_data[channel] = {
                "mvc_value": estimation.mvc_value,
                "threshold_value": estimation.threshold_value,
                "threshold_percentage": estimation.threshold_percentage,
                "estimation_method": estimation.estimation_method,
                "confidence_score": estimation.confidence_score,
                "metadata": estimation.metadata,
                "timestamp": estimation.timestamp.isoformat(),
            }

        logger.info(f"✅ Initial MVC calibration completed for {len(response_data)} channels")
        return {
            "status": "success",
            "calibration_type": "initial",
            "file_info": {
                "filename": file.filename,
                "channels_processed": list(emg_signals.keys()),
                "sampling_rate": sampling_rate,
            },
            "mvc_estimations": response_data,
        }

    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


async def _calibrate_from_existing(request: MVCRecalibrateRequest) -> dict[str, dict]:
    """Handle MVC recalibration from existing analysis."""
    # Extract EMG signals from existing analysis
    if not request.existing.emg_signals:
        raise HTTPException(status_code=400, detail="No EMG signals found in existing analysis")

    emg_signals = {}
    sampling_rate = None

    # Convert existing EMG signals to format expected by MVC service
    for channel, signal_data in request.existing.emg_signals.items():
        if isinstance(signal_data, dict) and "raw" in signal_data:
            emg_signals[channel] = signal_data["raw"]
            if sampling_rate is None and "sampling_rate" in signal_data:
                sampling_rate = signal_data["sampling_rate"]

    if not emg_signals:
        raise HTTPException(
            status_code=400, detail="No raw EMG signals available for MVC recalibration"
        )

    if sampling_rate is None:
        # Fallback to metadata or default
        sampling_rate = 1000  # Default sampling rate
        if request.existing.metadata and hasattr(request.existing.metadata, "sampling_rate"):
            sampling_rate = request.existing.metadata.sampling_rate

    # Get threshold percentage from session parameters
    threshold_percentage = getattr(request.session_params, "session_mvc_threshold_percentage", 75.0)

    # Use MVC service for bulk recalculation
    mvc_results = await mvc_service.bulk_estimate_mvc(
        signal_data_dict=emg_signals,
        sampling_rate=int(sampling_rate),
        user_id=request.existing.user_id,
        session_id=request.existing.session_id,
        threshold_percentage=threshold_percentage,
    )

    # Convert results to JSON-serializable format
    response_data = {}
    for channel, estimation in mvc_results.items():
        response_data[channel] = {
            "mvc_value": estimation.mvc_value,
            "threshold_value": estimation.threshold_value,
            "threshold_percentage": estimation.threshold_percentage,
            "estimation_method": estimation.estimation_method,
            "confidence_score": estimation.confidence_score,
            "metadata": estimation.metadata,
            "timestamp": estimation.timestamp.isoformat(),
        }

    logger.info(f"✅ MVC recalibration completed for {len(response_data)} channels")

    return {
        "status": "success",
        "calibration_type": "recalibration",
        "file_info": {
            "filename": request.existing.source_filename,
            "channels_processed": list(emg_signals.keys()),
            "sampling_rate": sampling_rate,
        },
        "mvc_estimations": response_data,
    }
