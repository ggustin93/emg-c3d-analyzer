"""Upload Routes - STATELESS EMG Processing.
================================================

PURPOSE: Direct C3D file upload for immediate EMG analysis WITHOUT database storage.

KEY BEHAVIORS:
- ✅ RETURNS: Full EMG signals and analysis results
- ❌ DOES NOT: Store data in Supabase database
- ❌ DOES NOT: Create therapy_sessions records

USE CASE: Testing, preview, or temporary analysis where persistence is not needed.

DIFFERENCE FROM WEBHOOK:
- Upload Route: Stateless processing → Returns signals → No DB storage
- Webhook Route: Stateful processing → No signal return → Full DB storage

SINGLE RESPONSIBILITY: Stateless file processing with EMG signal extraction.
"""

import logging
import os
import shutil
import tempfile
import uuid
from datetime import datetime

from config import MAX_FILE_SIZE
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from api.dependencies.validation import (
    get_file_metadata,
    get_processing_options,
    get_session_parameters,
)
from models import (
    ChannelAnalytics,
    EMGAnalysisResult,
    GameMetadata,
    GameSessionParameters,
    ProcessingOptions,
)
# Direct C3D processing for stateless upload endpoint
from services.c3d.processor import GHOSTLYC3DProcessor
from config import PROCESSING_VERSION

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])




@router.post("", response_model=EMGAnalysisResult)  # No slash = exact match on /upload
async def upload_file(
    file: UploadFile = File(...),
    processing_opts: ProcessingOptions = Depends(get_processing_options),
    session_params: GameSessionParameters = Depends(get_session_parameters),
    file_metadata: dict = Depends(get_file_metadata),
):
    """Upload and process a C3D file.

    Args:
        file: C3D file upload
        processing_opts: EMG processing configuration
        session_params: Game session parameters
        file_metadata: File metadata (user_id, patient_id, session_id)

    Returns:
        EMGAnalysisResult: Complete analysis results

    Raises:
        HTTPException: 400 for invalid files, 413 for too large, 500 for processing errors
    """
    # Validate file
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
    if not file.filename.lower().endswith(".c3d"):
        raise HTTPException(
            status_code=400, detail="File must be a C3D file (.c3d extension required)"
        )

    # Check file size (basic validation)
    if hasattr(file, "size") and file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.1f}MB",
        )

    logger.info(f"Processing upload request for file: {file.filename}")
    tmp_path = ""

    try:
        # Use a temporary file to handle the upload to be able to pass a path to the processor
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # STATELESS C3D Processing - NO database storage, returns signals directly
        # This is the correct architecture for upload endpoint (vs webhook which uses TherapySessionProcessor)
        logger.info(f"🔄 Starting stateless C3D processing: {tmp_path}")
        
        try:
            # Initialize C3D processor directly with the temporary file
            c3d_processor = GHOSTLYC3DProcessor(tmp_path)
            
            # Process the file stateless - returns all signals and analytics
            processing_result = await run_in_threadpool(
                c3d_processor.process_file,
                processing_opts=processing_opts if processing_opts else ProcessingOptions(),
                session_game_params=session_params,
                include_signals=True  # Always include signals for stateless upload
            )
            
            # Extract all C3D parameters from metadata (where C3DUtils puts them)
            metadata = processing_result.get("metadata", {})
            processing_result["c3d_parameters"] = {
                # Technical parameters from C3D file
                "sampling_rate": metadata.get("sampling_rate"),
                "duration": metadata.get("duration_seconds"),  # Note: field name is duration_seconds
                "frame_count": metadata.get("frame_count"), 
                "channel_count": metadata.get("channel_count", len(processing_result.get("analytics", {}))),
                # Game-related fields from C3D file
                "game_name": metadata.get("game_name"),
                "level": metadata.get("level"),
                "therapist_id": metadata.get("therapist_id"),
                "group_id": metadata.get("group_id"),
                "player_name": metadata.get("player_name"),
                "player_id": metadata.get("player_id"),  # If available
                "time": metadata.get("time"),
                # Processing metadata
                "processing_version": PROCESSING_VERSION,
                "processed_at": datetime.now().isoformat(),
                "stateless_mode": True
            }
            
            # Store EMG processing results with explicit naming
            raw_emg_analytics = processing_result
            logger.info(f"✅ EMG processing completed: {len(raw_emg_analytics.get('analytics', {}))} channels")
            
            # CLINICAL PROCESSING ORCHESTRATION: Convert EMG data to clinical format and calculate performance scores
            try:
                # Import clinical services (local import to avoid circular dependencies)
                from services.clinical.emg_analytics_adapter import convert_emg_analytics_to_clinical_session_metrics
                from services.clinical.performance_scoring_service import PerformanceScoringService
                
                # Step 1: Convert EMG analytics to clinical SessionMetrics format
                clinical_session_metrics = convert_emg_analytics_to_clinical_session_metrics(
                    raw_emg_analytics.get("analytics", {}), 
                    session_params
                )
                logger.info(f"🔌 Analytics converted to clinical format: session_id={clinical_session_metrics.session_id}")
                
                # Step 2: Calculate performance scores using existing clinical service  
                clinical_service = PerformanceScoringService()
                clinical_performance_scores = clinical_service.calculate_performance_scores(
                    session_id=clinical_session_metrics.session_id,
                    session_metrics=clinical_session_metrics
                )
                logger.info(f"📊 Clinical performance scores calculated: {list(clinical_performance_scores.keys())}")
                
                # Combine EMG processing results with clinical analysis
                result_data = raw_emg_analytics
                result_data["performance_analysis"] = clinical_performance_scores  # Add clinical scores
                
            except Exception as clinical_error:
                logger.exception(f"⚠️ Clinical processing failed, continuing with EMG data only: {clinical_error}")
                # Fallback: Use EMG processing results without clinical scores
                result_data = raw_emg_analytics
                result_data["performance_analysis"] = {
                    "error": f"Clinical processing failed: {str(clinical_error)}",
                    "emg_data_available": True,
                    "fallback_mode": True
                }
            
        except Exception as e:
            logger.exception(f"❌ C3D processing failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"C3D processing failed: {str(e)}"
            )

        # Create result object
        game_metadata = GameMetadata(**result_data["metadata"])

        analytics = {k: ChannelAnalytics(**v) for k, v in result_data["analytics"].items()}

        # Extract C3D parameters from processing result
        try:
            c3d_params = result_data.get("c3d_parameters", {})
            if not c3d_params:
                # Fallback: extract parameters from metadata (where they actually are)
                metadata = result_data.get("metadata", {})
                c3d_params = {
                    "sampling_rate": metadata.get("sampling_rate"),
                    "duration": metadata.get("duration_seconds"),
                    "frame_count": metadata.get("frame_count"),
                    "channel_count": metadata.get("channel_count", len(result_data.get("analytics", {}))),
                    "player_name": metadata.get("player_name"),
                    "therapist_id": metadata.get("therapist_id"),
                    "level": metadata.get("level"),
                }
        except Exception as e:
            logger.warning(f"Failed to extract C3D parameters: {e!s}")
            c3d_params = {"error": f"Parameter extraction failed: {e!s}"}

        response_model = EMGAnalysisResult(
            file_id=str(uuid.uuid4()),  # Generate a new UUID for this stateless request
            timestamp=datetime.now().strftime("%Y%m%d_%H%M%S"),
            source_filename=file.filename,
            metadata=GameMetadata(
                **{**game_metadata.model_dump(), "session_parameters_used": session_params}
            ),
            analytics=analytics,
            available_channels=result_data["available_channels"],
            emg_signals=result_data.get(
                "emg_signals", {}
            ),  # EMG signal data (raw, activated, processed) from C3D processor
            c3d_parameters=c3d_params,  # Include comprehensive C3D parameters
            user_id=file_metadata["user_id"],
            patient_id=file_metadata["patient_id"],
            session_id=file_metadata["session_id"],
            # NEW: Include clinical data from enhanced processor
            session_parameters=result_data.get("session_parameters"),
            processing_parameters=result_data.get("processing_parameters"),
            performance_analysis=result_data.get("performance_analysis"),
        )
        return response_model

    except Exception as e:
        logger.error(f"Upload processing error: {e!s}", exc_info=True)
        # Provide more specific error messages based on error type
        if "C3D" in str(e):
            raise HTTPException(status_code=400, detail=f"C3D file processing error: {e!s}")
        elif "permission" in str(e).lower() or "access" in str(e).lower():
            raise HTTPException(status_code=403, detail=f"File access error: {e!s}")
        elif "size" in str(e).lower() or "memory" in str(e).lower():
            raise HTTPException(status_code=413, detail=f"File too large or memory error: {e!s}")
        else:
            raise HTTPException(status_code=500, detail=f"Server error processing file: {e!s}")
    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
