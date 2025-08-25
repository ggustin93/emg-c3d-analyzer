"""
Upload Routes
============

C3D file upload and processing endpoints.
Single responsibility: File upload and EMG analysis.
"""

import os
import uuid
import shutil
import logging
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool

from models.models import (
    EMGAnalysisResult, ProcessingOptions, 
    GameMetadata, ChannelAnalytics, GameSessionParameters
)
from config import MAX_FILE_SIZE
from services.clinical.therapy_session_processor import TherapySessionProcessor
from api.dependencies.validation import (
    get_processing_options, get_session_parameters, get_file_metadata
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

# Initialize therapy session processor (same as webhook route)
session_processor = TherapySessionProcessor()


@router.post("/", response_model=EMGAnalysisResult)
async def upload_file(
    file: UploadFile = File(...),
    processing_opts: ProcessingOptions = Depends(get_processing_options),
    session_params: GameSessionParameters = Depends(get_session_parameters),
    file_metadata: dict = Depends(get_file_metadata)
):
    """
    Upload and process a C3D file.
    
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
    if not file.filename.lower().endswith('.c3d'):
        raise HTTPException(status_code=400, detail="File must be a C3D file (.c3d extension required)")
    
    # Check file size (basic validation)
    if hasattr(file, 'size') and file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_FILE_SIZE/1024/1024:.1f}MB")
    
    logger.info(f"Processing upload request for file: {file.filename}")
    tmp_path = ""
    
    try:
        # Use a temporary file to handle the upload to be able to pass a path to the processor
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Process the file using TherapySessionProcessor (SINGLE SOURCE OF TRUTH)
        # Same processing logic as webhook route - unified approach
        # Wrap CPU-bound sync processing in thread pool
        processing_result = await run_in_threadpool(
            session_processor.process_c3d_file_stateless,
            file_path=tmp_path,
            processing_opts=processing_opts,
            session_params=session_params
        )
        
        result_data = processing_result["processing_result"]

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
            file_id=str(uuid.uuid4()), # Generate a new UUID for this stateless request
            timestamp=datetime.now().strftime("%Y%m%d_%H%M%S"),
            source_filename=file.filename,
            metadata=GameMetadata(**{
                **game_metadata.model_dump(),
                'session_parameters_used': session_params
            }),
            analytics=analytics,
            available_channels=result_data['available_channels'],
            emg_signals=result_data.get('emg_signals', {}), # EMG signal data from processing result
            c3d_parameters=c3d_params,  # Include comprehensive C3D parameters
            user_id=file_metadata["user_id"],
            patient_id=file_metadata["patient_id"],
            session_id=file_metadata["session_id"]
        )
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