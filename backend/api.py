"""
GHOSTLY+ EMG Analysis API
=========================

FastAPI application for processing C3D files from the GHOSTLY game,
extracting EMG data, and providing analytics for rehabilitation monitoring.

ENDPOINTS:
==========
- GET / - Root endpoint with API information
- POST /upload - Upload and process C3D file
- GET /recalculate-scores - Recalculate scores for an existing result with updated parameters
- GET /results - List all available result files
- GET /results/{result_id} - Get processing results for a specific file
- GET /raw-data/{result_id}/{channel} - Get raw EMG data for a specific channel
- GET /plot/{result_id}/{channel} - Generate and return a plot image for a specific channel
- GET /report/{result_id} - Generate and return a full report image
- GET /patients - List all patient IDs
- GET /patients/{patient_id}/results - Get all results for a specific patient
- DELETE /results/{result_id} - Delete a specific result
"""

import os
import json
import uuid
import shutil
import hashlib
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .processor import GHOSTLYC3DProcessor
from .models import (
    EMGAnalysisResult, EMGRawData, ProcessingOptions, GameMetadata, ChannelAnalytics,
    GameSessionParameters, DEFAULT_THRESHOLD_FACTOR, DEFAULT_MIN_DURATION_MS,
    DEFAULT_SMOOTHING_WINDOW, DEFAULT_MVC_THRESHOLD_PERCENTAGE
)

# Storage directories
UPLOAD_DIR = Path("./data/uploads")
RESULTS_DIR = Path("./data/results")
PLOTS_DIR = Path("./data/plots")
CACHE_DIR = Path("./data/cache")

for directory in [UPLOAD_DIR, RESULTS_DIR, PLOTS_DIR, CACHE_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

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

# Mount static files directory for serving plots
app.mount("/static", StaticFiles(directory="data"), name="static")


@app.get("/")
async def root():
    """Root endpoint returning API information."""
    return JSONResponse(content={
        "name": "GHOSTLY+ EMG Analysis API",
        "version": "1.0.0",
        "description": "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game",
        "endpoints": {
            "upload": "POST /upload - Upload and process a C3D file",
            "recalculate-scores": "POST /recalculate-scores - Recalculate scores for an existing result with updated parameters",
            "results": "GET /results - List all available result files",
            "result_detail": "GET /results/{result_id} - Get processing results for a specific file",
            "raw_data": "GET /raw-data/{result_id}/{channel} - Get raw EMG data for a specific channel",
            "plot": "GET /plot/{result_id}/{channel} - Generate and return a plot image for a specific channel",
            "report": "GET /report/{result_id} - Generate and return a full report image",
            "patients": "GET /patients - List all patient IDs",
            "patient_results": "GET /patients/{patient_id}/results - Get all results for a specific patient"
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

    # --- Caching Logic ---
    # Read file content for hashing
    file_content = await file.read()
    await file.seek(0)  # Reset file pointer after reading

    # Create a hash of the file content and processing parameters
    hasher = hashlib.sha256()
    hasher.update(file_content)
    hasher.update(str(threshold_factor).encode())
    hasher.update(str(min_duration_ms).encode())
    hasher.update(str(smoothing_window).encode())
    # Include identifiers in hash to ensure distinct cache entries
    if patient_id: hasher.update(patient_id.encode())
    if user_id: hasher.update(user_id.encode())
    if session_id: hasher.update(session_id.encode())
    # Add new game parameters to hash
    if session_mvc_value is not None: hasher.update(str(session_mvc_value).encode())
    if session_mvc_threshold_percentage is not None: hasher.update(str(session_mvc_threshold_percentage).encode())
    if session_expected_contractions is not None: hasher.update(str(session_expected_contractions).encode())
    if session_expected_contractions_ch1 is not None: hasher.update(str(session_expected_contractions_ch1).encode())
    if session_expected_contractions_ch2 is not None: hasher.update(str(session_expected_contractions_ch2).encode())
    
    request_hash = hasher.hexdigest()
    cache_marker_path = CACHE_DIR / request_hash

    # Check for cache hit
    if cache_marker_path.exists():
        try:
            result_path_str = cache_marker_path.read_text()
            result_path = Path(result_path_str)
            if result_path.exists():
                with open(result_path, "r") as f:
                    return json.load(f)
            else:
                # Stale cache marker, remove it and proceed
                cache_marker_path.unlink()
        except Exception:
            # Handle potential errors reading marker or JSON
            pass # Proceed to process as a cache miss

    # --- End Caching Logic ---

    # Create unique filename to avoid collisions
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_id = str(uuid.uuid4())
    unique_filename = f"{timestamp}_{file_id}_{file.filename}"
    file_path = UPLOAD_DIR / unique_filename

    # Save uploaded file
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_content) # Use the content we already read
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error saving file: {str(e)}")

    # Process the file
    try:
        processor = GHOSTLYC3DProcessor(str(file_path))
        
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

        result = EMGAnalysisResult(
            file_id=file_id,
            timestamp=timestamp,
            source_filename=file.filename,
            metadata=game_metadata,
            analytics=analytics,
            available_channels=result_data['available_channels'],
            plots={},
            user_id=user_id,
            patient_id=patient_id,
            session_id=session_id
        )

        # Save result to file
        result_filename = f"{file_id}_result.json"
        result_path = RESULTS_DIR / result_filename
        
        # Save raw EMG data to separate file for efficient retrieval
        raw_emg_data_path = RESULTS_DIR / f"{file_id}_result_raw_emg.json"
        
        try:
            with open(result_path, "w") as f:
                f.write(result.model_dump_json(indent=2))
                
            # Save raw EMG data separately for efficient retrieval
            with open(raw_emg_data_path, "w") as f:
                json.dump(processor.emg_data, f, indent=2)
                
            # Write cache marker pointing to the result file
            cache_marker_path.write_text(str(result_path.resolve()))
        except Exception as e:
            print(f"Warning: Error saving result or cache marker: {e}")

        return result

    except Exception as e:
        import traceback
        print(f"ERROR in /upload: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/recalculate-scores", response_model=EMGAnalysisResult)
async def recalculate_scores(
    result_id: str = Form(...),
    # Game-specific session parameters from GUI
    session_mvc_value: Optional[float] = Form(None),
    session_mvc_threshold_percentage: Optional[float] = Form(DEFAULT_MVC_THRESHOLD_PERCENTAGE),
    session_expected_contractions: Optional[int] = Form(None),
    session_expected_contractions_ch1: Optional[int] = Form(None),
    session_expected_contractions_ch2: Optional[int] = Form(None),
    session_expected_long_left: Optional[int] = Form(None),
    session_expected_short_left: Optional[int] = Form(None),
    session_expected_long_right: Optional[int] = Form(None),
    session_expected_short_right: Optional[int] = Form(None),
    contraction_duration_threshold: Optional[int] = Form(250),
    channel_muscle_mapping: Optional[str] = Form(None),
    session_mvc_values: Optional[str] = Form(None),
    session_mvc_threshold_percentages: Optional[str] = Form(None)):
    """Recalculate scores for an existing result with updated parameters."""
    
    # Find the result file
    result_filename = f"{result_id}_result.json"
    result_path = RESULTS_DIR / result_filename
    raw_emg_data_path = RESULTS_DIR / f"{result_id}_result_raw_emg.json"
    
    if not result_path.exists() or not raw_emg_data_path.exists():
        raise HTTPException(status_code=404, detail="Result not found")
    
    try:
        # Load the existing result
        with open(result_path, "r") as f:
            result_data = json.load(f)
        
        # Load the raw EMG data
        with open(raw_emg_data_path, "r") as f:
            emg_data = json.load(f)
        
        # Parse the channel_muscle_mapping JSON string if provided
        parsed_channel_muscle_mapping = None
        if channel_muscle_mapping:
            try:
                parsed_channel_muscle_mapping = json.loads(channel_muscle_mapping)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid channel_muscle_mapping JSON format")
        
        # Parse the session_mvc_values JSON string if provided
        parsed_mvc_values = None
        if session_mvc_values:
            try:
                parsed_mvc_values = json.loads(session_mvc_values)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid session_mvc_values JSON format")
        
        # Parse the session_mvc_threshold_percentages JSON string if provided
        parsed_mvc_threshold_percentages = None
        if session_mvc_threshold_percentages:
            try:
                parsed_mvc_threshold_percentages = json.loads(session_mvc_threshold_percentages)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid session_mvc_threshold_percentages JSON format")
        
        # Create session parameters object
        session_game_params = GameSessionParameters(
            session_mvc_value=session_mvc_value,
            session_mvc_threshold_percentage=session_mvc_threshold_percentage,
            session_expected_contractions=session_expected_contractions,
            session_expected_contractions_ch1=session_expected_contractions_ch1,
            session_expected_contractions_ch2=session_expected_contractions_ch2,
            session_expected_long_left=session_expected_long_left,
            session_expected_short_left=session_expected_short_left,
            session_expected_long_right=session_expected_long_right,
            session_expected_short_right=session_expected_short_right,
            contraction_duration_threshold=contraction_duration_threshold,
            channel_muscle_mapping=parsed_channel_muscle_mapping,
            session_mvc_values=parsed_mvc_values,
            session_mvc_threshold_percentages=parsed_mvc_threshold_percentages
        )
        
        # Create a processor instance
        processor = GHOSTLYC3DProcessor(None)  # No file path needed for recalculation
        processor.emg_data = emg_data  # Set the EMG data directly
        
        # Recalculate the scores
        updated_result_data = await run_in_threadpool(
            processor.recalculate_scores,
            result_data=result_data,
            session_game_params=session_game_params
        )
        
        # Create result object
        game_metadata = GameMetadata(**updated_result_data['metadata'])
        
        analytics = {
            k: ChannelAnalytics(**v)
            for k, v in updated_result_data['analytics'].items()
        }
        
        result = EMGAnalysisResult(
            file_id=result_id,
            timestamp=result_data.get('timestamp', datetime.now().strftime("%Y%m%d_%H%M%S")),
            source_filename=result_data.get('source_filename', 'unknown.c3d'),
            metadata=game_metadata,
            analytics=analytics,
            available_channels=updated_result_data['available_channels'],
            plots={},
            user_id=result_data.get('user_id'),
            patient_id=result_data.get('patient_id'),
            session_id=result_data.get('session_id')
        )
        
        # Save updated result to file
        with open(result_path, "w") as f:
            f.write(result.model_dump_json(indent=2))
        
        return result
        
    except Exception as e:
        import traceback
        print(f"ERROR in /recalculate-scores: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error recalculating scores: {str(e)}")


@app.get("/results", response_model=List[str])
async def list_results():
    """List all available result files."""
    try:
        results = [f.name for f in RESULTS_DIR.glob("*.json")]
        return results
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error listing results: {str(e)}")


@app.get("/results/{result_id}", response_model=EMGAnalysisResult)
async def get_result(result_id: str):
    """Get a specific result by ID."""
    try:
        # Check if the file exists directly
        direct_path = RESULTS_DIR / f"{result_id}.json"
        if direct_path.exists():
            with open(direct_path, "r") as f:
                return json.load(f)

        # Fallback to searching by prefix if not found
        for f in RESULTS_DIR.glob(f"*{result_id}*.json"):
            with open(f, "r") as file:
                return json.load(file)

        raise HTTPException(status_code=404, detail="Result not found")
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error retrieving result: {str(e)}")


# backend/api.py

@app.get("/raw-data/{result_id}/{channel}", response_model=EMGRawData)
async def get_raw_data(result_id: str, channel: str):
    """
    Get raw EMG data for a specific channel.
    The 'channel' parameter can be a base name (e.g., "CH1"),
    a raw name (e.g., "CH1 Raw"), or an activated name (e.g., "CH1 activated").
    The endpoint will return the data for the specifically requested channel in the 'data' field,
    and if the requested channel was "Raw", its "activated" counterpart will be in 'activated_data'.
    If the requested channel was "activated", its "Raw" counterpart could also be returned if needed
    (though the current EMGRawData model has only one 'activated_data' field).
    """
    result_filename_base = f"{result_id}_result" # This was from your /upload
    raw_emg_data_path = RESULTS_DIR / f"{result_filename_base}_raw_emg.json"
    result_json_path = RESULTS_DIR / f"{result_filename_base}.json" # For contractions

    if not raw_emg_data_path.exists():
        # Fallback for older results that might not have split raw EMG data
        # This part requires careful thought: if you *always* expect _raw_emg.json, remove this fallback.
        # If fallback is needed, it must re-process the C3D, which is slow.
        # For this fix, we'll assume _raw_emg.json *should* exist.
        error_detail = f"Raw EMG data file not found: {raw_emg_data_path}. C3D reprocessing fallback not implemented in this version for get_raw_data."
        print(f"ERROR: {error_detail}") # Log this
        # To make the frontend work even if this happens, you might return empty data or re-process.
        # For now, strict:
        raise HTTPException(status_code=404, detail=f"Raw EMG data file not found for result ID: {result_id}. File expected: {raw_emg_data_path.name}")

    if not result_json_path.exists():
         raise HTTPException(status_code=404, detail=f"Result JSON file not found for result ID: {result_id}")

    try:
        with open(raw_emg_data_path, "r") as f:
            all_emg_data_from_file = json.load(f) # This is the dict from processor.emg_data
        
        with open(result_json_path, "r") as f:
            main_result_data = json.load(f) # This is the EMGAnalysisResult model data

        # --- Smart Channel Detection Logic ---
        # The `channel` parameter from the URL.
        requested_channel_name = channel

        # Try to find the exact requested_channel_name first.
        primary_channel_dict = all_emg_data_from_file.get(requested_channel_name)
        
        # If not found, and if `requested_channel_name` looks like a base name (e.g., "CH1"),
        # try appending " Raw" as a common default for the primary signal.
        if not primary_channel_dict and not (" Raw" in requested_channel_name or " activated" in requested_channel_name):
            potential_raw_name = f"{requested_channel_name} Raw"
            primary_channel_dict = all_emg_data_from_file.get(potential_raw_name)
            if primary_channel_dict:
                # If we found "CH1 Raw" when "CH1" was requested, update what we consider the "primary"
                requested_channel_name = potential_raw_name 
        
        # If still not found, the channel truly doesn't exist in any common form.
        if not primary_channel_dict:
            # For debugging, list available channels if the requested one is not found.
            available_keys_in_raw_file = list(all_emg_data_from_file.keys())
            raise HTTPException(
                status_code=404, 
                detail=f"Channel '{channel}' (or its variants like '{channel} Raw') not found in pre-extracted raw data for result_id '{result_id}'. Available channels in raw file: {available_keys_in_raw_file}"
            )

        # At this point, `primary_channel_dict` is the data for `requested_channel_name`
        # `requested_channel_name` is the actual key found in the raw EMG data file (e.g., "CH1 Raw" or "CH1 activated")

        # Now, determine the `activated_data` to return based on what `requested_channel_name` is.
        # The `EMGRawData` model has `data` (for primary) and `activated_data` (for its activated counterpart).
        final_activated_data_list = None
        base_name_of_primary = requested_channel_name.replace(" Raw", "").replace(" activated", "")

        if requested_channel_name.endswith(" Raw"):
            # If primary is "CH1 Raw", then activated_data should be "CH1 activated"
            activated_counterpart_key = f"{base_name_of_primary} activated"
            activated_counterpart_dict = all_emg_data_from_file.get(activated_counterpart_key)
            if activated_counterpart_dict and 'data' in activated_counterpart_dict:
                final_activated_data_list = [float(x) for x in activated_counterpart_dict['data']]
        elif requested_channel_name.endswith(" activated"):
            # If primary is "CH1 activated", then `data` field gets "CH1 activated"
            # and `activated_data` field in the response model should also get "CH1 activated".
            # This seems a bit redundant by model design, but we'll fulfill it.
            # OR, if the model implies `activated_data` is *always* the '.activated' version
            # regardless of what was requested, then we just ensure it's populated.
            if primary_channel_dict and 'data' in primary_channel_dict: # primary_channel_dict is the activated one
                 final_activated_data_list = [float(x) for x in primary_channel_dict['data']]
        else:
            # If `requested_channel_name` is a base name (e.g., "EMG1" from C3D without suffix)
            # or some other name that doesn't end with " Raw" or " activated".
            # We should still look for its ".activated" counterpart.
            activated_counterpart_key = f"{base_name_of_primary} activated"
            activated_counterpart_dict = all_emg_data_from_file.get(activated_counterpart_key)
            if activated_counterpart_dict and 'data' in activated_counterpart_dict:
                final_activated_data_list = [float(x) for x in activated_counterpart_dict['data']]


        # Get contractions if they exist for the base muscle analytics
        # The `main_result_data` is the EMGAnalysisResult structure.
        # Analytics are keyed by base muscle names (e.g., "CH1").
        muscle_analytics_for_contractions = main_result_data.get("analytics", {}).get(base_name_of_primary, {})
        contractions_from_analytics = muscle_analytics_for_contractions.get("contractions") # This was your previous logic

        return EMGRawData(
            channel_name=requested_channel_name, # The actual key found and being returned in 'data'
            sampling_rate=float(primary_channel_dict['sampling_rate']),
            data=[float(x) for x in primary_channel_dict['data']],
            time_axis=[float(x) for x in primary_channel_dict['time_axis']],
            activated_data=final_activated_data_list,
            contractions=contractions_from_analytics # This might be None if not present
        )

    except FileNotFoundError: # More specific than generic Exception for this case
        raise HTTPException(status_code=404, detail=f"A required data file for result ID '{result_id}' was not found.")
    except HTTPException as http_exc: # Re-raise known HTTP exceptions
        raise http_exc
    except Exception as e:
        # Log the full error for debugging on the server
        import traceback
        print(f"ERROR in get_raw_data for result_id='{result_id}', channel='{channel}': {str(e)}")
        print(traceback.format_exc())
        # Return a generic 500 to the client
        raise HTTPException(status_code=500, detail=f"Internal server error while retrieving raw EMG data. Details: {str(e)}")


@app.get("/plot/{result_id}/{channel}")
async def generate_plot(
    result_id: str,
    channel: str,
    regenerate: bool = Query(
        False,
        description="Force regeneration of plot even if it already exists")):
    """Generate and return a plot image for a specific channel."""
    # Find the original C3D file path from the result JSON
    result_json_path = None
    for f in RESULTS_DIR.glob(f"*{result_id}*.json"):
        result_json_path = f
        break

    if not result_json_path:
        raise HTTPException(status_code=404, detail="Result JSON file not found.")

    with open(result_json_path, "r") as f:
        result_data = json.load(f)
        source_filename = result_data.get("source_filename")
        if not source_filename:
            raise HTTPException(status_code=500, detail="Source filename not in result JSON.")

    # Find the uploaded C3D file
    # This logic might need to be more robust if original filenames aren't unique
    c3d_file_path = None
    for f in UPLOAD_DIR.glob(f"*{result_id}*{source_filename}"):
        c3d_file_path = f
        break

    if not c3d_file_path or not c3d_file_path.exists():
        raise HTTPException(status_code=404, detail=f"Original C3D file not found for result ID: {result_id}")

    # Create plot directory
    plot_dir = PLOTS_DIR / result_id
    plot_dir.mkdir(parents=True, exist_ok=True)
    plot_path = plot_dir / f"{channel}.png"

    # If plot exists and not regenerating, return it
    if plot_path.exists() and not regenerate:
        return FileResponse(plot_path)

    # Generate the plot
    try:
        processor = GHOSTLYC3DProcessor(str(c3d_file_path))
        
        # Use run_in_threadpool for the potentially long-running plotting operation
        await run_in_threadpool(
            processor.plot_emg_with_contractions,
            channel=channel,
            save_path=str(plot_path)
        )
        
        return FileResponse(plot_path)
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error generating plot: {str(e)}")


@app.get("/report/{result_id}")
async def generate_report(
    result_id: str,
    regenerate: bool = Query(
        False,
        description="Force regeneration of report even if it already exists")):
    """Generate and return a full report for a specific result."""
    # Find the original C3D file path from the result JSON
    result_json_path = None
    for f in RESULTS_DIR.glob(f"*{result_id}*.json"):
        result_json_path = f
        break

    if not result_json_path:
        raise HTTPException(status_code=404, detail="Result JSON file not found.")

    with open(result_json_path, "r") as f:
        result_data = json.load(f)
        source_filename = result_data.get("source_filename")
        if not source_filename:
            raise HTTPException(status_code=500, detail="Source filename not in result JSON.")

    # Find the uploaded C3D file
    c3d_file_path = None
    for f in UPLOAD_DIR.glob(f"*{result_id}*{source_filename}"):
        c3d_file_path = f
        break

    if not c3d_file_path or not c3d_file_path.exists():
        raise HTTPException(status_code=404, detail=f"Original C3D file not found for result ID: {result_id}")

    # Create plot directory
    plot_dir = PLOTS_DIR / result_id
    plot_dir.mkdir(parents=True, exist_ok=True)
    report_path = plot_dir / "report.png"

    # If report exists and not regenerating, return it
    if report_path.exists() and not regenerate:
        return FileResponse(report_path)

    # Generate the report
    try:
        processor = GHOSTLYC3DProcessor(str(c3d_file_path))

        # Use run_in_threadpool for the potentially long-running plotting operation
        await run_in_threadpool(
             processor.plot_ghostly_report,
             save_path=str(report_path)
        )

        return FileResponse(report_path)
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error generating report: {str(e)}")


@app.get("/patients", response_model=List[str])
async def list_patients():
    """List all unique patient IDs from result filenames."""
    try:
        patient_ids = set()
        for f in RESULTS_DIR.glob("*.json"):
            parts = f.name.split('_')
            if len(parts) > 2:  # Assuming patientID_timestamp_uuid.json format
                patient_ids.add(parts[0])
        return list(patient_ids)
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error listing patients: {str(e)}")


@app.get("/patients/{patient_id}/results",
         response_model=List[EMGAnalysisResult])
async def get_patient_results(patient_id: str):
    """Get all results for a specific patient."""
    try:
        results = []
        for f in RESULTS_DIR.glob(f"{patient_id}_*.json"):
            with open(f, "r") as file:
                results.append(json.load(file))
        return results
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving patient results: {str(e)}")


@app.delete("/results/{result_id}")
async def delete_result(result_id: str):
    """Delete a result JSON file and its associated plots."""
    try:
        result_file = None
        for f in RESULTS_DIR.glob(f"*{result_id}*.json"):
            result_file = f
            break

        if not result_file:
            raise HTTPException(status_code=404, detail="Result not found")

        # Delete result file
        os.remove(result_file)

        # Delete associated plot directory
        plot_dir = PLOTS_DIR / result_id
        if plot_dir.exists():
            shutil.rmtree(plot_dir)

        return {"message": f"Result {result_id} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error deleting result: {str(e)}")


@app.get("/debug/file-structure/{filename}")
async def debug_file_structure(filename: str):
    """FOR DEBUGGING: Returns the structure of a C3D file's parameters."""
    try:
        file_path = UPLOAD_DIR / filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found in upload directory.")

        c3d = ezc3d.c3d(str(file_path))
        
        # A recursive function to serialize the parameter structure
        def serialize_params(params):
            output = {}
            for key, value in params.items():
                if 'value' in value:
                    # Try to convert numpy arrays to lists for JSON serialization
                    param_value = value['value']
                    if hasattr(param_value, 'tolist'):
                        output[key] = param_value.tolist()
                    else:
                        output[key] = param_value
                else:
                    # If it's another nested parameter group
                    output[key] = serialize_params(value)
            return output

        return JSONResponse(content=serialize_params(c3d['parameters']))

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to read C3D file structure: {e}"})


@app.get("/debug/spectral-analysis")
async def debug_spectral_analysis():
    """Debug endpoint to test spectral analysis functions with sample data."""
    import numpy as np
    from .emg_analysis import (
        calculate_rms,
        calculate_mav,
        calculate_mpf,
        calculate_mdf,
        calculate_fatigue_index_fi_nsm5
    )
    
    # Create sample data
    sampling_rate = 1000  # 1kHz
    duration = 1.0  # 1 second
    t = np.linspace(0, duration, int(sampling_rate * duration))
    
    # Good signal - should work for all functions
    good_signal = np.sin(2 * np.pi * 10 * t) + 0.5 * np.sin(2 * np.pi * 50 * t) + 0.25 * np.sin(2 * np.pi * 100 * t)
    
    # Short signal - should fail spectral analysis
    short_signal = np.sin(2 * np.pi * 10 * t[:100])  # Only 100 samples
    
    # Constant signal - should fail spectral analysis
    constant_signal = np.ones(1000)
    
    results = {
        "good_signal": {
            "rms": calculate_rms(good_signal, sampling_rate),
            "mav": calculate_mav(good_signal, sampling_rate),
            "mpf": calculate_mpf(good_signal, sampling_rate),
            "mdf": calculate_mdf(good_signal, sampling_rate),
            "fatigue_index": calculate_fatigue_index_fi_nsm5(good_signal, sampling_rate)
        },
        "short_signal": {
            "rms": calculate_rms(short_signal, sampling_rate),
            "mav": calculate_mav(short_signal, sampling_rate),
            "mpf": calculate_mpf(short_signal, sampling_rate),
            "mdf": calculate_mdf(short_signal, sampling_rate),
            "fatigue_index": calculate_fatigue_index_fi_nsm5(short_signal, sampling_rate)
        },
        "constant_signal": {
            "rms": calculate_rms(constant_signal, sampling_rate),
            "mav": calculate_mav(constant_signal, sampling_rate),
            "mpf": calculate_mpf(constant_signal, sampling_rate),
            "mdf": calculate_mdf(constant_signal, sampling_rate),
            "fatigue_index": calculate_fatigue_index_fi_nsm5(constant_signal, sampling_rate)
        }
    }
    
    return results
