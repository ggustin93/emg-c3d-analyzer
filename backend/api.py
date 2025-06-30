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
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path
import tempfile

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .processor import GHOSTLYC3DProcessor
from .models import (
    EMGAnalysisResult, EMGChannelSignalData, ProcessingOptions, GameMetadata, ChannelAnalytics,
    GameSessionParameters, DEFAULT_THRESHOLD_FACTOR, DEFAULT_MIN_DURATION_MS,
    DEFAULT_SMOOTHING_WINDOW, DEFAULT_MVC_THRESHOLD_PERCENTAGE
)

# Initialize FastAPI app
app = FastAPI(
    title="GHOSTLY+ EMG Analysis API",
    description=
    "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint returning API information."""
    return JSONResponse(content={
        "name": "GHOSTLY+ EMG Analysis API",
        "version": "1.0.0",
        "description": "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game",
        "endpoints": {
            "upload": "POST /upload - Upload and process a C3D file",
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
                      session_expected_contractions_ch2: Optional[int] = Form(None)):
    """Upload and process a C3D file."""
    if not file.filename.lower().endswith('.c3d'):
        raise HTTPException(status_code=400, detail="File must be a C3D file")

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
            session_expected_contractions_ch2=session_expected_contractions_ch2
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

        response_model = EMGAnalysisResult(
            file_id=str(uuid.uuid4()), # Generate a new UUID for this stateless request
            timestamp=datetime.now().strftime("%Y%m%d_%H%M%S"),
            source_filename=file.filename,
            metadata=game_metadata,
            analytics=analytics,
            available_channels=result_data['available_channels'],
            emg_signals=processor.emg_data, # Directly assign if structure matches EMGChannelSignalData
            user_id=user_id,
            patient_id=patient_id,
            session_id=session_id
        )
        return response_model

    except Exception as e:
        import traceback
        print(f"ERROR in /upload: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
