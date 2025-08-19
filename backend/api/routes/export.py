"""
Export Routes
============

Data export endpoints.
Single responsibility: Comprehensive C3D analysis data export.
"""

import os
import shutil
import logging
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse

from models.models import ProcessingOptions, GameSessionParameters
from services.c3d_processor import GHOSTLYC3DProcessor
from services.export_service import EMGDataExporter
from api.dependencies.validation import (
    get_processing_options, get_session_parameters, get_file_metadata
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])


@router.post("/")
async def export_analysis_data(
    file: UploadFile = File(...),
    processing_opts: ProcessingOptions = Depends(get_processing_options),
    session_params: GameSessionParameters = Depends(get_session_parameters),
    file_metadata: dict = Depends(get_file_metadata),
    # Export options
    include_raw_signals: bool = Form(True),
    include_debug_info: bool = Form(True)
):
    """
    Export comprehensive C3D analysis data as JSON.
    
    This endpoint processes a C3D file and returns a comprehensive JSON structure
    containing all extracted data, analysis results, and debug information.
    Useful for debugging, data archival, and external analysis workflows.
    
    Args:
        file: C3D file upload
        processing_opts: EMG processing configuration
        session_params: Game session parameters
        file_metadata: File metadata (user_id, patient_id, session_id)
        include_raw_signals: Include raw signal data in export
        include_debug_info: Include debug information in export
        
    Returns:
        JSONResponse: Comprehensive export data
        
    Raises:
        HTTPException: 400 for invalid files, 500 for processing errors
    """
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

        # Process the file completely
        result = processor.process_file(processing_opts, session_params)
        
        # Create comprehensive export
        exporter = EMGDataExporter(processor)
        comprehensive_export = exporter.create_comprehensive_export(
            session_params=session_params,
            processing_opts=processing_opts,
            include_raw_signals=include_raw_signals,
            include_debug_info=include_debug_info
        )
        
        # Add request metadata
        comprehensive_export["request_metadata"] = {
            "user_id": file_metadata["user_id"],
            "patient_id": file_metadata["patient_id"],
            "session_id": file_metadata["session_id"],
            "filename": file.filename,
            "export_timestamp": datetime.now().isoformat()
        }
        
        return JSONResponse(content=comprehensive_export)

    except Exception as e:
        logger.error(f"Export processing error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting data: {str(e)}")
    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)