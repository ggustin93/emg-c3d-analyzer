"""Export Routes.
============

Data export endpoints.
Single responsibility: Comprehensive C3D analysis data export.
"""

import logging
import os
import shutil
import tempfile
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Query
from fastapi.responses import JSONResponse, Response
from typing import Optional, Literal

from services.data.export_service import EnhancedEMGDataExporter
from services.data.converters import convert_export_to_csv
from api.dependencies.validation import (
    get_file_metadata,
    get_processing_options,
    get_session_parameters,
)
from models import GameSessionParameters, ProcessingOptions
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
    include_debug_info: bool = Form(True),
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
                "session_parameters": session_params.dict(),
            },
        }

        # Add request metadata
        comprehensive_export["request_metadata"] = {
            "user_id": file_metadata["user_id"],
            "patient_id": file_metadata["patient_id"],
            "session_id": file_metadata["session_id"],
            "filename": file.filename,
            "export_timestamp": datetime.now().isoformat(),
            "note": "Basic export - EMGDataExporter not yet implemented",
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


@router.get("/session/{session_id}")
async def export_session_data(
    session_id: str,
    format: Literal["json", "csv"] = Query("json", description="Export format: json or csv"),
):
    """Export existing session data with format selection.
    
    MVP implementation: Add missing performance data + CSV format support.
    Following backend CLAUDE.md: thin controller, business logic in services.
    
    Args:
        session_id: Session UUID to export
        format: Export format ('json' or 'csv')
        
    Returns:
        JSONResponse or CSV Response with comprehensive session data
        
    Raises:
        HTTPException: 404 for missing session, 500 for processing errors
    """
    try:
        # Import here to avoid circular imports
        from database.supabase_client import get_supabase_client
        
        # Get Supabase client (synchronous - CLAUDE.md #14)
        supabase = get_supabase_client()
        
        # Create enhanced exporter with session-based processor
        # For now, use a mock processor since we're working with existing session data
        mock_processor = type('MockProcessor', (), {
            'latest_analysis_result': type('MockResult', (), {
                'emg_signals': {},
                'analytics': {}
            })()
        })()
        
        export_service = EnhancedEMGDataExporter(mock_processor, supabase)
        
        # Get comprehensive export data (includes performance scores + config)
        export_data = export_service.get_comprehensive_export_data(session_id)
        
        if format == "csv":
            # Convert to CSV format
            csv_content = convert_export_to_csv(export_data)
            
            # Return CSV with appropriate headers
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=session_{session_id}_export.csv"
                }
            )
        else:
            # Return JSON (existing functionality)
            return JSONResponse(content=export_data)
            
    except Exception as e:
        logger.error(f"Session export error: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting session data: {e!s}")
