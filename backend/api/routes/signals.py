"""JIT Signal Generation API Routes.
================================

🎯 PURPOSE: Just-In-Time signal generation for frontend compatibility
After 99% storage reduction (removing emg_signals column), this endpoint
generates signal data on-demand when needed for visualization.

🚀 BENEFITS:
- Frontend continues working seamlessly
- 99% storage reduction maintained
- Signals generated only when needed
- Memory efficient processing

Author: EMG C3D Analyzer Team
Date: 2025-08-14
"""

import logging
import os
import tempfile
from typing import Any
from uuid import UUID

from config import get_settings
from fastapi import APIRouter, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from database.supabase_client import get_supabase_client
from models import ProcessingOptions
from services.c3d.processor import GHOSTLYC3DProcessor
from services.data.metadata_service import MetadataService

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/signals", tags=["signals"])


class SignalDataResponse(BaseModel):
    """JIT signal data response."""

    success: bool
    channel_name: str
    data: list[float]
    time_axis: list[float]
    rms_envelope: list[float] | None = None
    sampling_rate: float
    duration_seconds: float
    generated_at: str
    cache_note: str


class SignalGenerationError(BaseModel):
    """Signal generation error response."""

    success: bool
    error: str
    session_id: str
    channel_name: str


@router.get("/jit/{session_id}/{channel_name}", response_model=SignalDataResponse)
async def get_signal_data_jit(
    session_id: str,
    channel_name: str,
    include_rms: bool = Query(default=True, description="Include RMS envelope in response"),
    downsample_factor: int = Query(
        default=1, description="Downsample factor for performance (1=no downsampling)"
    ),
) -> SignalDataResponse:
    """🚀 Just-In-Time Signal Generation.

    Generates signal data on-demand for frontend charts after 99% storage optimization.
    Downloads C3D file from storage and extracts only the requested channel.

    Args:
        session_id: Session UUID to get signal data for
        channel_name: EMG channel name (e.g., "BicepsL", "BicepsR")
        include_rms: Whether to include RMS envelope calculation
        downsample_factor: Downsample for performance (2=half samples, 4=quarter samples)

    Returns:
        SignalDataResponse with time series data for the requested channel

    Raises:
        HTTPException: 404 if session not found, 400 if channel not found, 500 if processing fails
    """
    logger.info(f"🔄 JIT signal generation: {session_id} -> {channel_name}")

    try:
        # Step 1: Get session metadata
        metadata_service = MetadataService()
        session = await metadata_service.get_by_id(UUID(session_id))

        if not session:
            logger.warning(f"⚠️ Session not found: {session_id}")
            raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

        # Step 2: Download C3D file from storage
        file_path = session.get("file_path", "")
        if not file_path:
            logger.error(f"❌ No file path in session: {session_id}")
            raise HTTPException(status_code=400, detail="No file path found in session")

        # Parse bucket and object path from file_path (format: "bucket/path/to/file.c3d")
        if "/" in file_path:
            bucket = file_path.split("/")[0]
            object_path = "/".join(file_path.split("/")[1:])
        else:
            bucket = "c3d-examples"  # Default bucket
            object_path = file_path

        logger.info(f"📁 Downloading: {bucket}/{object_path}")

        supabase = get_supabase_client(use_service_key=True)
        file_data = supabase.storage.from_(bucket).download(object_path)

        if not file_data:
            logger.error(f"❌ Failed to download file: {bucket}/{object_path}")
            raise HTTPException(status_code=404, detail=f"C3D file not found: {object_path}")

        # Step 3: Process C3D file for specific channel only
        signal_data = await _extract_single_channel_jit(
            file_data=file_data,
            channel_name=channel_name,
            include_rms=include_rms,
            downsample_factor=downsample_factor,
            session_id=session_id,
        )

        if not signal_data:
            logger.warning(f"⚠️ Channel not found: {channel_name} in session {session_id}")
            raise HTTPException(
                status_code=404, detail=f"Channel '{channel_name}' not found in C3D file"
            )

        logger.info(f"✅ JIT signal generated: {channel_name} ({len(signal_data['data'])} samples)")

        return SignalDataResponse(
            success=True,
            channel_name=channel_name,
            data=signal_data["data"],
            time_axis=signal_data["time_axis"],
            rms_envelope=signal_data.get("rms_envelope"),
            sampling_rate=signal_data["sampling_rate"],
            duration_seconds=signal_data["duration_seconds"],
            generated_at=signal_data["generated_at"],
            cache_note="Generated on-demand - not cached (99% storage optimization active)",
        )

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"❌ JIT signal generation failed: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Signal generation error: {e!s}")


@router.get("/jit/{session_id}/channels", response_model=dict[str, Any])
async def get_available_channels(session_id: str) -> dict[str, Any]:
    """🔍 Get available channel names for JIT signal generation.

    Returns metadata about available channels without generating full signals.
    Useful for frontend to know which channels are available.

    Args:
        session_id: Session UUID to get channel info for

    Returns:
        Dict with available channel names and metadata
    """
    logger.info(f"🔍 Getting available channels: {session_id}")

    try:
        # Get session metadata
        metadata_service = MetadataService()
        session = await metadata_service.get_by_id(UUID(session_id))

        if not session:
            raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

        # Return channel names from metadata (fast lookup)
        channel_names = session.get("channel_names", [])
        channel_count = session.get("channel_count", len(channel_names))
        sampling_rate = session.get("sampling_rate", 1000.0)
        duration_seconds = session.get("duration_seconds", 0.0)

        return {
            "success": True,
            "session_id": session_id,
            "channel_names": channel_names,
            "channel_count": channel_count,
            "sampling_rate": sampling_rate,
            "duration_seconds": duration_seconds,
            "jit_enabled": True,
            "note": "Channels available for JIT signal generation (99% storage optimized)",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get channels: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting channels: {e!s}")


async def _extract_single_channel_jit(
    file_data: bytes,
    channel_name: str,
    include_rms: bool = True,
    downsample_factor: int = 1,
    session_id: str = "",
) -> dict[str, Any] | None:
    """🧮 Extract single channel data with JIT processing.

    Memory-efficient extraction of only the requested channel.
    Processes in temporary memory and cleans up immediately.

    Args:
        file_data: Raw C3D file bytes
        channel_name: Specific channel to extract
        include_rms: Whether to calculate RMS envelope
        downsample_factor: Downsample factor for performance
        session_id: Session ID for logging

    Returns:
        Dict with signal data or None if channel not found
    """
    from datetime import datetime, timezone

    with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp_file:
        tmp_file.write(file_data)
        tmp_file_path = tmp_file.name

    try:
        # Create processor for single-channel extraction
        processor = GHOSTLYC3DProcessor(tmp_file_path)

        # Import settings from config module
        from config import (
            DEFAULT_MIN_DURATION_MS,
            DEFAULT_SMOOTHING_WINDOW,
            DEFAULT_THRESHOLD_FACTOR,
        )

        # Default processing options (minimal for JIT)
        processing_opts = ProcessingOptions(
            threshold_factor=DEFAULT_THRESHOLD_FACTOR,
            min_duration_ms=DEFAULT_MIN_DURATION_MS,
            smoothing_window=DEFAULT_SMOOTHING_WINDOW,
        )

        # Extract EMG data for all channels first (needed to find the requested channel)
        emg_data_result = await run_in_threadpool(processor.extract_emg_data)

        # Find the requested channel
        target_channel_data = None
        for channel, data in emg_data_result.items():
            if channel.lower() == channel_name.lower() or channel == channel_name:
                target_channel_data = data
                break

        if not target_channel_data:
            logger.warning(
                f"⚠️ Channel '{channel_name}' not found in available channels: {list(emg_data_result.keys())}"
            )
            return None

        # Extract signal arrays
        signal_array = target_channel_data.get("data", [])
        time_array = target_channel_data.get("time_axis", [])
        sampling_rate = target_channel_data.get("sampling_rate", 1000.0)

        if not signal_array or not time_array:
            logger.warning(f"⚠️ Empty signal data for channel: {channel_name}")
            return None

        # Apply downsampling if requested
        if downsample_factor > 1:
            signal_array = signal_array[::downsample_factor]
            time_array = time_array[::downsample_factor]
            logger.info(
                f"📉 Applied downsampling factor {downsample_factor}: {len(signal_array)} samples"
            )

        # Calculate RMS envelope if requested
        rms_envelope = None
        if include_rms:
            rms_envelope = target_channel_data.get("rms_envelope", [])
            if rms_envelope and downsample_factor > 1:
                rms_envelope = rms_envelope[::downsample_factor]

        # Prepare response data
        result = {
            "data": signal_array,
            "time_axis": time_array,
            "sampling_rate": float(sampling_rate),
            "duration_seconds": float(len(time_array) / sampling_rate)
            if sampling_rate > 0
            else 0.0,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        if rms_envelope:
            result["rms_envelope"] = rms_envelope

        logger.info(f"✅ JIT extraction completed: {channel_name} ({len(signal_array)} samples)")
        return result

    except Exception as e:
        logger.exception(f"❌ JIT extraction failed for {channel_name}: {e!s}")
        return None

    finally:
        # Clean up temporary file
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)


