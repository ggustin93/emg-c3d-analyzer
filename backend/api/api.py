"""
GHOSTLY+ EMG Analysis API
=========================

FastAPI application for processing C3D files from the GHOSTLY game,
extracting EMG data, and providing analytics for rehabilitation monitoring.

ENDPOINTS:
==========
- GET / - Root endpoint with API information
- POST /upload - Upload and process C3D file
"""

import os
import json
import uuid
import shutil
import hashlib
import logging
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path
import tempfile

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.c3d_processor import GHOSTLYC3DProcessor
from models.models import (
    EMGAnalysisResult, EMGChannelSignalData, ProcessingOptions, GameMetadata, ChannelAnalytics,
    GameSessionParameters, DEFAULT_THRESHOLD_FACTOR, DEFAULT_MIN_DURATION_MS,
    DEFAULT_SMOOTHING_WINDOW, DEFAULT_MVC_THRESHOLD_PERCENTAGE
)
from config import (
    API_TITLE, API_VERSION, API_DESCRIPTION,
    CORS_ORIGINS, CORS_CREDENTIALS, CORS_METHODS, CORS_HEADERS,
    ensure_temp_dir, MAX_FILE_SIZE
)
from services.mvc_service import mvc_service, MVCEstimation
from services.export_service import EMGDataExporter
from services.performance_scoring_service import PerformanceScoringService, SessionMetrics, ScoringWeights
from .webhooks import router as webhook_router
from .routes.signals import router as signals_router

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=CORS_CREDENTIALS,
    allow_methods=CORS_METHODS,
    allow_headers=CORS_HEADERS,
)

# Include routers
app.include_router(webhook_router)
app.include_router(signals_router)  # JIT signal generation for 99% storage optimization

# Import and include cache monitoring router
try:
    from .cache_monitoring import router as cache_router
    app.include_router(cache_router)
    print("✅ Cache monitoring endpoints enabled")
except ImportError as e:
    print(f"⚠️ Cache monitoring endpoints disabled: {e}")
except Exception as e:
    print(f"⚠️ Error loading cache monitoring: {e}")


@app.get("/health")
async def health_check():
    """Health check endpoint for container health monitoring."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/")
async def root():
    """Root endpoint returning API information."""
    return JSONResponse(content={
        "name": "GHOSTLY+ EMG Analysis API",
        "version": "1.0.0",
        "description": "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game",
        "endpoints": {
            "health": "GET /health - Health check endpoint",
            "upload": "POST /upload - Upload and process a C3D file",
            "export": "POST /export - Export comprehensive analysis data as JSON",
            "mvc_estimate": "POST /mvc/estimate - Estimate MVC values for EMG signals",
            "scores": {
                "calculate": "POST /scores/calculate - Calculate GHOSTLY+ performance scores",
                "update_rpe": "POST /scores/update-rpe - Update RPE for a session",
                "update_game": "POST /scores/update-game - Update game scores for a session",
                "adherence": "GET /scores/adherence - Get adherence score for a patient",
                "synthetic": "POST /scores/synthetic - Generate synthetic scoring data"
            }
        }
    })


@app.post("/upload", response_model=EMGAnalysisResult)
async def upload_file(file: UploadFile = File(...),
                      user_id: Optional[str] = Form(None),
                      patient_id: Optional[str] = Form(None),
                      session_id: Optional[str] = Form(None),
                      # Standard processing options
                      threshold_factor: float = Form(DEFAULT_THRESHOLD_FACTOR),
                      min_duration_ms: int = Form(DEFAULT_MIN_DURATION_MS),
                      smoothing_window: int = Form(DEFAULT_SMOOTHING_WINDOW),
                      # New game-specific session parameters from GUI
                      session_mvc_value: Optional[float] = Form(None),
                      session_mvc_threshold_percentage: Optional[float] = Form(DEFAULT_MVC_THRESHOLD_PERCENTAGE),
                      session_expected_contractions: Optional[int] = Form(None),
                      session_expected_contractions_ch1: Optional[int] = Form(None),
                      session_expected_contractions_ch2: Optional[int] = Form(None),
                      contraction_duration_threshold: Optional[int] = Form(2000)):
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
        # Use a temporary file to handle the upload to be able to pass a path to the processor
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Process the file from the temporary path
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

        # Wrap the CPU-bound processing in run_in_threadpool
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
            file_id=str(uuid.uuid4()), # Generate a new UUID for this stateless request
            timestamp=datetime.now().strftime("%Y%m%d_%H%M%S"),
            source_filename=file.filename,
            metadata=GameMetadata(**{
                **game_metadata.model_dump(),
                'session_parameters_used': session_game_params
            }),
            analytics=analytics,
            available_channels=result_data['available_channels'],
            emg_signals=processor.emg_data, # Directly assign if structure matches EMGChannelSignalData
            c3d_parameters=c3d_params,  # Include comprehensive C3D parameters
            user_id=user_id,
            patient_id=patient_id,
            session_id=session_id
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


@app.post("/export")
async def export_analysis_data(file: UploadFile = File(...),
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
                              include_debug_info: bool = Form(True)):
    """
    Export comprehensive C3D analysis data as JSON.
    
    This endpoint processes a C3D file and returns a comprehensive JSON structure
    containing all extracted data, analysis results, and debug information.
    Useful for debugging, data archival, and external analysis workflows.
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
        
        return JSONResponse(content=comprehensive_export)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting data: {str(e)}")
    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ----- Lightweight Recalculation Endpoint (no file re-upload required) -----
class RecalcRequest(BaseModel):
    existing: EMGAnalysisResult
    session_params: GameSessionParameters


@app.post("/recalc", response_model=EMGAnalysisResult)
async def recalc_analysis(request: RecalcRequest):
    """
    Recalculate analytics from an existing EMGAnalysisResult with updated session parameters.
    This avoids re-processing the entire C3D file and only updates counts/flags/thresholds
    based on the new parameters (e.g., duration threshold, MVC settings).
    """
    try:
        # Use processor helper to recalc from existing analytics
        processor = GHOSTLYC3DProcessor(file_path="")
        updated = processor.recalculate_scores_from_data(
            existing_analytics={
                "metadata": request.existing.metadata.model_dump() if request.existing.metadata else {},
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
        print(f"ERROR in /recalc: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error recalculating analytics: {str(e)}")


@app.post("/mvc/estimate", response_model=Dict[str, Dict])
async def estimate_mvc_values(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    threshold_percentage: float = Form(75.0)
):
    """
    Estimate MVC values from uploaded C3D file using clinical algorithms.
    
    Returns MVC estimations for all EMG channels found in the file with
    confidence scores, metadata, and threshold values.
    """
    if not file.filename.lower().endswith('.c3d'):
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
        
        # Get signals and sampling rate
        for channel in processor.emg_channels:
            if hasattr(processor, 'emg_data') and channel in processor.emg_data:
                emg_signals[channel] = processor.emg_data[channel]['raw']
                if sampling_rate is None and 'sampling_rate' in processor.emg_data[channel]:
                    sampling_rate = processor.emg_data[channel]['sampling_rate']
        
        if not emg_signals:
            raise HTTPException(status_code=400, detail="No EMG channels found in C3D file")
        
        if sampling_rate is None:
            # Try to get from C3D file metadata
            sampling_rate = getattr(processor, 'analog_sample_rate', 1000)  # Default fallback
        
        # Use MVC service for bulk estimation
        mvc_results = await mvc_service.bulk_estimate_mvc(
            signal_data_dict=emg_signals,
            sampling_rate=int(sampling_rate),
            user_id=user_id,
            session_id=session_id,
            threshold_percentage=threshold_percentage
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
                "timestamp": estimation.timestamp.isoformat()
            }
        
        return JSONResponse(content={
            "status": "success",
            "file_info": {
                "filename": file.filename,
                "channels_processed": list(emg_signals.keys()),
                "sampling_rate": sampling_rate
            },
            "mvc_estimations": response_data
        })

    except Exception as e:
        import traceback
        print(f"ERROR in /mvc/estimate: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error estimating MVC: {str(e)}")
    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
