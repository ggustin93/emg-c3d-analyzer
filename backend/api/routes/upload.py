"""
Upload Routes
============

Handles C3D file upload and processing endpoints.
"""

import os
import uuid
import shutil
import logging
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.concurrency import run_in_threadpool

from services.c3d_processor import GHOSTLYC3DProcessor
from models.models import (
    EMGAnalysisResult, GameMetadata, ChannelAnalytics,
    ProcessingOptions, GameSessionParameters,
    DEFAULT_THRESHOLD_FACTOR, DEFAULT_MIN_DURATION_MS,
    DEFAULT_SMOOTHING_WINDOW, DEFAULT_MVC_THRESHOLD_PERCENTAGE
)
from config import MAX_FILE_SIZE
from services.export_service import EMGDataExporter

# Initialize router and logger
router = APIRouter(prefix="/upload", tags=["upload"])
logger = logging.getLogger(__name__)


@router.post("", response_model=EMGAnalysisResult)
async def upload_file(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    patient_id: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    # Standard processing options
    threshold_factor: float = Form(DEFAULT_THRESHOLD_FACTOR),
    min_duration_ms: int = Form(DEFAULT_MIN_DURATION_MS),
    smoothing_window: int = Form(DEFAULT_SMOOTHING_WINDOW),
    # Game-specific session parameters
    session_mvc_value: Optional[float] = Form(None),
    session_mvc_threshold_percentage: Optional[float] = Form(DEFAULT_MVC_THRESHOLD_PERCENTAGE),
    session_expected_contractions: Optional[int] = Form(None),
    session_expected_contractions_ch1: Optional[int] = Form(None),
    session_expected_contractions_ch2: Optional[int] = Form(None),
    contraction_duration_threshold: Optional[int] = Form(2000)
):
    """Upload and process a C3D file."""
    # Validate file
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
    if not file.filename.lower().endswith('.c3d'):
        raise HTTPException(status_code=400, detail="File must be a C3D file (.c3d extension required)")
    
    # Check file size (basic validation)
    if hasattr(file, 'size') and file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_FILE_SIZE/1024/1024:.1f}MB")
    
    logger.info(f"Processing upload request for file: {file.filename}")
    tmp_path = ""
    try:
        # Use a temporary file to handle the upload
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Process the file
        processor = GHOSTLYC3DProcessor(tmp_path)
        
        # Create processing options and session parameters objects
        processing_opts = ProcessingOptions(
            threshold_factor=threshold_factor,
            min_duration_ms=min_duration_ms,
            smoothing_window=smoothing_window
        )
        
        session_game_params = GameSessionParameters(
            session_mvc_value=session_mvc_value,
            session_mvc_threshold_percentage=session_mvc_threshold_percentage,
            session_expected_contractions=session_expected_contractions,
            session_expected_contractions_ch1=session_expected_contractions_ch1,
            session_expected_contractions_ch2=session_expected_contractions_ch2,
            contraction_duration_threshold=contraction_duration_threshold
        )

        # Wrap CPU-bound processing in threadpool
        result_data = await run_in_threadpool(
            processor.process_file,
            processing_opts=processing_opts,
            session_game_params=session_game_params
        )

        # Create result object
        game_metadata = GameMetadata(**result_data['metadata'])
        
        analytics = {
            k: ChannelAnalytics(**v)
            for k, v in result_data['analytics'].items()
        }

        # Extract C3D parameters from processing result
        try:
            c3d_params = result_data.get('c3d_parameters', {})
            if not c3d_params:
                # Fallback: extract basic parameters from file metadata
                c3d_params = {
                    "sampling_rate": result_data.get('sampling_rate'),
                    "duration": result_data.get('duration'),
                    "frame_count": result_data.get('frame_count'),
                    "channel_count": len(result_data.get('analytics', {}))
                }
        except Exception as e:
            logger.warning(f"Failed to extract C3D parameters: {str(e)}")
            c3d_params = {"error": f"Parameter extraction failed: {str(e)}"}
        
        response_model = EMGAnalysisResult(
            file_id=str(uuid.uuid4()),
            timestamp=datetime.now().strftime("%Y%m%d_%H%M%S"),
            source_filename=file.filename,
            metadata=GameMetadata(**{
                **game_metadata.model_dump(),
                'session_parameters_used': session_game_params
            }),
            analytics=analytics,
            available_channels=result_data['available_channels'],
            emg_signals=processor.emg_data,
            c3d_parameters=c3d_params,
            user_id=user_id,
            patient_id=patient_id,
            session_id=session_id
        )
        
        logger.info(f"Successfully processed file: {file.filename}")
        return response_model

    except Exception as e:
        logger.error(f"Upload processing error: {str(e)}", exc_info=True)
        # Provide more specific error messages based on error type
        if "C3D" in str(e):
            raise HTTPException(status_code=400, detail=f"C3D file processing error: {str(e)}")
        elif "permission" in str(e).lower() or "access" in str(e).lower():
            raise HTTPException(status_code=403, detail=f"File access error: {str(e)}")
        elif "size" in str(e).lower() or "memory" in str(e).lower():
            raise HTTPException(status_code=413, detail=f"File too large or memory error: {str(e)}")
        else:
            raise HTTPException(status_code=500, detail=f"Server error processing file: {str(e)}")
    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/export")
async def export_analysis_data(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    patient_id: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    # Standard processing options
    threshold_factor: float = Form(DEFAULT_THRESHOLD_FACTOR),
    min_duration_ms: int = Form(DEFAULT_MIN_DURATION_MS),
    smoothing_window: int = Form(DEFAULT_SMOOTHING_WINDOW),
    # Session parameters
    session_mvc_value: Optional[float] = Form(None),
    session_mvc_threshold_percentage: Optional[float] = Form(DEFAULT_MVC_THRESHOLD_PERCENTAGE),
    session_expected_contractions: Optional[int] = Form(None),
    session_expected_contractions_ch1: Optional[int] = Form(None),
    session_expected_contractions_ch2: Optional[int] = Form(None),
    contraction_duration_threshold: Optional[int] = Form(2000),
    # Export options
    include_raw_signals: bool = Form(True),
    include_debug_info: bool = Form(True)
):
    """Export comprehensive C3D analysis data as JSON."""
    if not file.filename.lower().endswith('.c3d'):
        raise HTTPException(status_code=400, detail="File must be a C3D file")

    tmp_path = ""
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Process the file
        processor = GHOSTLYC3DProcessor(tmp_path)
        
        # Create processing options and session parameters
        processing_opts = ProcessingOptions(
            threshold_factor=threshold_factor,
            min_duration_ms=min_duration_ms,
            smoothing_window=smoothing_window
        )
        
        session_game_params = GameSessionParameters(
            session_mvc_value=session_mvc_value,
            session_mvc_threshold_percentage=session_mvc_threshold_percentage,
            session_expected_contractions=session_expected_contractions,
            session_expected_contractions_ch1=session_expected_contractions_ch1,
            session_expected_contractions_ch2=session_expected_contractions_ch2,
            contraction_duration_threshold=contraction_duration_threshold
        )

        # Process the file completely
        result = processor.process_file(processing_opts, session_game_params)
        
        # Create comprehensive export
        exporter = EMGDataExporter(processor)
        comprehensive_export = exporter.create_comprehensive_export(
            session_params=session_game_params,
            processing_opts=processing_opts,
            include_raw_signals=include_raw_signals,
            include_debug_info=include_debug_info
        )
        
        # Add request metadata
        comprehensive_export["request_metadata"] = {
            "user_id": user_id,
            "patient_id": patient_id,
            "session_id": session_id,
            "filename": file.filename,
            "export_timestamp": datetime.now().isoformat()
        }
        
        from fastapi.responses import JSONResponse
        return JSONResponse(content=comprehensive_export)

    except Exception as e:
        logger.error(f"Export error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting data: {str(e)}")
    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)