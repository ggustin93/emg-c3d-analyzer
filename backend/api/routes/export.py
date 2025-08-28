"""Export Routes
============

Data export endpoints.
Single responsibility: Comprehensive C3D analysis data export.
"""

import logging
import os
import shutil
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

# from services.data.export_service import EMGDataExporter  # TODO: Implement export service
from api.dependencies.validation import (
    get_file_metadata,
    get_processing_options,
    get_session_parameters,
)
from models.models import GameSessionParameters, ProcessingOptions
from services.c3d.processor import GHOSTLYC3DProcessor

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
    """Export comprehensive C3D analysis data as JSON.
    
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
    if not file.filename.lower().endswith(".c3d"):
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

        # TODO: Implement comprehensive export
        # exporter = EMGDataExporter(processor)
        # comprehensive_export = exporter.create_comprehensive_export(
        #     session_params=session_params,
        #     processing_opts=processing_opts,
        #     include_raw_signals=include_raw_signals,
        #     include_debug_info=include_debug_info
        # )

        # Temporary basic export until EMGDataExporter is implemented
        comprehensive_export = {
            "analysis_results": result,
            "file_info": {
                "filename": file.filename,
                "processing_options": processing_opts.dict(),
                "session_parameters": session_params.dict()
            }
        }

        # Add request metadata
        comprehensive_export["request_metadata"] = {
            "user_id": file_metadata["user_id"],
            "patient_id": file_metadata["patient_id"],
            "session_id": file_metadata["session_id"],
            "filename": file.filename,
            "export_timestamp": datetime.now().isoformat(),
            "note": "Basic export - EMGDataExporter not yet implemented"
        }

        return JSONResponse(content=comprehensive_export)

    except Exception as e:
        logger.error(f"Export processing error: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting data: {e!s}")
    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
