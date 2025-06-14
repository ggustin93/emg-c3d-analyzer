"""
GHOSTLY+ EMG Analysis API
=========================

FastAPI application for processing C3D files from the GHOSTLY game,
extracting EMG data, and providing analytics for rehabilitation monitoring.

ENDPOINTS:
==========
- GET / - Root endpoint with API information
- POST /upload - Upload and process C3D file
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
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .processor import GHOSTLYC3DProcessor, DEFAULT_THRESHOLD_FACTOR, DEFAULT_MIN_DURATION_MS, DEFAULT_SMOOTHING_WINDOW
from .models import EMGAnalysisResult, EMGRawData, ProcessingOptions, GameMetadata, ChannelAnalytics

# Storage directories
UPLOAD_DIR = Path("./data/uploads")
RESULTS_DIR = Path("./data/results")
PLOTS_DIR = Path("./data/plots")

for directory in [UPLOAD_DIR, RESULTS_DIR, PLOTS_DIR]:
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
    return {
        "name": "GHOSTLY+ EMG Analysis API",
        "version": "1.0.0",
        "description":
        "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game",
        "endpoints": {
            "upload":
            "POST /upload - Upload and process a C3D file",
            "results":
            "GET /results - List all available result files",
            "result_detail":
            "GET /results/{result_id} - Get processing results for a specific file",
            "raw_data":
            "GET /raw-data/{result_id}/{channel} - Get raw EMG data for a specific channel",
            "plot":
            "GET /plot/{result_id}/{channel} - Generate and return a plot image for a specific channel",
            "report":
            "GET /report/{result_id} - Generate and return a full report image",
            "patients":
            "GET /patients - List all patient IDs",
            "patient_results":
            "GET /patients/{patient_id}/results - Get all results for a specific patient"
        }
    }


@app.post("/upload", response_model=EMGAnalysisResult)
async def upload_file(file: UploadFile = File(...),
                      user_id: Optional[str] = Form(None),
                      patient_id: Optional[str] = Form(None),
                      session_id: Optional[str] = Form(None),
                      threshold_factor: float = Form(DEFAULT_THRESHOLD_FACTOR),
                      min_duration_ms: int = Form(DEFAULT_MIN_DURATION_MS),
                      smoothing_window: int = Form(DEFAULT_SMOOTHING_WINDOW),
                      generate_plots: bool = Form(False)):
    """Upload and process a C3D file."""
    if not file.filename.lower().endswith('.c3d'):
        raise HTTPException(status_code=400, detail="File must be a C3D file")

    # Create unique filename to avoid collisions
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_id = str(uuid.uuid4())
    unique_filename = f"{timestamp}_{file_id}_{file.filename}"
    file_path = UPLOAD_DIR / unique_filename

    # Save uploaded file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error saving file: {str(e)}")

    # Process the file
    try:
        processor = GHOSTLYC3DProcessor(str(file_path))
        result_data = processor.process_file(
            threshold_factor=threshold_factor,
            min_duration_ms=min_duration_ms,
            smoothing_window=smoothing_window
        )

        # Ensure all metadata values are strings to prevent type errors
        for key, value in result_data['metadata'].items():
            result_data['metadata'][key] = str(value)

        # Generate plots if requested
        plots = {}
        if generate_plots:
            # Create plot directory for this file
            plot_dir = PLOTS_DIR / file_id
            plot_dir.mkdir(parents=True, exist_ok=True)

            # Generate individual channel plots
            for channel in result_data['analytics'].keys():
                try:
                    plot_path = plot_dir / f"{channel}.png"
                    processor.plot_emg_with_contractions(
                        channel=channel, save_path=str(plot_path))
                    plots[channel] = f"/static/plots/{file_id}/{channel}.png"
                except Exception as plot_err:
                    print(f"Error generating plot for {channel}: {plot_err}")

            # Generate summary report
            try:
                report_path = plot_dir / "report.png"
                processor.plot_ghostly_report(save_path=str(report_path))
                plots["report"] = f"/static/plots/{file_id}/report.png"
            except Exception as report_err:
                print(f"Error generating report: {report_err}")

        # Create result object
        result = EMGAnalysisResult(
            file_id=file_id,
            timestamp=timestamp,
            source_filename=file.filename,
            metadata=GameMetadata(**result_data['metadata']),
            analytics={
                k: ChannelAnalytics(**v)
                for k, v in result_data['analytics'].items()
            },
            available_channels=result_data['available_channels'],
            plots=plots)

        # Add optional fields if provided
        if user_id:
            result.user_id = user_id
        if patient_id:
            result.patient_id = patient_id
        if session_id:
            result.session_id = session_id

        # Save result to JSON file
        result_filename = f"{timestamp}_{file_id}"
        if patient_id:
            result_filename = f"{patient_id}_{result_filename}"
        if session_id:
            result_filename = f"{session_id}_{result_filename}"

        result_path = RESULTS_DIR / f"{result_filename}.json"

        # Handle Pydantic serialization based on version
        try:
            # Try Pydantic v2 serialization first
            if hasattr(result, "model_dump_json"):
                json_data = result.model_dump_json(indent=2)
            else:
                # Fallback to Pydantic v1
                json_data = result.json(indent=2)

            with open(result_path, "w") as f:
                f.write(json_data)
        except Exception as json_err:
            # Direct JSON serialization as final fallback
            with open(result_path, "w") as f:
                result_dict = result.dict() if hasattr(
                    result, "dict") else result.model_dump()
                json.dump(result_dict, f, indent=2, default=str)

        return result

    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error processing file: {str(e)}")


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


@app.get("/raw-data/{result_id}/{channel}", response_model=EMGRawData)
async def get_raw_data(result_id: str, channel: str):
    """Get raw EMG data for a specific channel and its corresponding activated signal."""
    try:
        # Find the result file
        result_file = None
        for f in RESULTS_DIR.glob(f"*{result_id}*.json"):
            result_file = f
            break

        if not result_file:
            raise HTTPException(status_code=404, detail="Result not found")

        # Load result JSON
        with open(result_file, "r") as f:
            result_data = json.load(f)

        # Find the original uploaded C3D file by its unique file_id
        upload_file = None
        for f in UPLOAD_DIR.glob(f"*{result_id}*.c3d"):
            upload_file = f
            break

        if not upload_file:
            raise HTTPException(
                status_code=404,
                detail=
                f"Original C3D file not found for result ID {result_id}")

        # Re-process the C3D file to get all raw data
        processor = GHOSTLYC3DProcessor(str(upload_file))
        emg_data = processor.extract_emg_data()

        # The `channel` parameter can be a base name ("CH1") or a full name ("CH1 Raw").
        # The API needs to be flexible enough to handle both.
        main_channel_data = emg_data.get(channel)
        requested_channel_name = channel

        # If the exact channel name isn't found, assume it's a base name and try appending " Raw".
        if not main_channel_data:
            raw_channel_guess = f"{channel} Raw"
            main_channel_data = emg_data.get(raw_channel_guess)
            if main_channel_data:
                requested_channel_name = raw_channel_guess # Update to the name that was actually found
        
        # If we still haven't found data, the channel doesn't exist.
        if not main_channel_data:
            raise HTTPException(
                status_code=404,
                detail=f"Channel '{channel}' not found in the C3D file."
            )

        # Now, determine the base name from the channel we found, and get its "activated" counterpart.
        base_channel_name = requested_channel_name.replace(' Raw', '').replace(' activated', '')
        activated_channel_name = f"{base_channel_name} activated"
        activated_channel_data = emg_data.get(activated_channel_name)

        return EMGRawData(
            channel_name=requested_channel_name,
            data=main_channel_data['data'],
            time_axis=main_channel_data['time_axis'],
            sampling_rate=main_channel_data['sampling_rate'],
            activated_data=activated_channel_data['data'] if activated_channel_data else None
        )

    except HTTPException as http_exc:
        raise http_exc # Re-raise HTTPException
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error retrieving raw data: {str(e)}")


@app.get("/plot/{result_id}/{channel}")
async def generate_plot(
    result_id: str,
    channel: str,
    regenerate: bool = Query(
        False,
        description="Force regeneration of plot even if it already exists")):
    """Generate and return a plot image for a specific channel."""
    try:
        plot_dir = PLOTS_DIR / result_id
        plot_path = plot_dir / f"{channel}.png"

        if plot_path.exists() and not regenerate:
            return FileResponse(plot_path)

        # Find the result file to get the original C3D path
        result_file = None
        for f in RESULTS_DIR.glob(f"*{result_id}*.json"):
            result_file = f
            break

        if not result_file:
            raise HTTPException(status_code=404, detail="Result not found")

        # Find the original uploaded C3D file by its unique file_id
        upload_file = None
        for f in UPLOAD_DIR.glob(f"*{result_id}*.c3d"):
            upload_file = f
            break

        if not upload_file:
            raise HTTPException(
                status_code=404,
                detail=
                f"Original C3D file not found for result ID {result_id}")

        processor = GHOSTLYC3DProcessor(str(upload_file))
        processor.process_file()

        plot_dir.mkdir(parents=True, exist_ok=True)
        saved_path = processor.plot_emg_with_contractions(
            channel=channel, save_path=str(plot_path))

        if saved_path and os.path.exists(saved_path):
            return FileResponse(saved_path)
        else:
            raise HTTPException(status_code=500,
                                detail="Error generating plot")
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error generating plot: {str(e)}")


@app.get("/report/{result_id}")
async def generate_report(
    result_id: str,
    regenerate: bool = Query(
        False,
        description="Force regeneration of report even if it already exists")):
    """Generate and return a full report image."""
    try:
        plot_dir = PLOTS_DIR / result_id
        report_path = plot_dir / "report.png"

        if report_path.exists() and not regenerate:
            return FileResponse(report_path)

        result_file = None
        for f in RESULTS_DIR.glob(f"*{result_id}*.json"):
            result_file = f
            break
        
        if not result_file:
            raise HTTPException(status_code=404, detail="Result not found")

        # Find the original uploaded C3D file by its unique file_id
        upload_file = None
        for f in UPLOAD_DIR.glob(f"*{result_id}*.c3d"):
            upload_file = f
            break

        if not upload_file:
            raise HTTPException(
                status_code=404,
                detail=
                f"Original C3D file not found for result ID {result_id}")

        processor = GHOSTLYC3DProcessor(str(upload_file))
        processor.process_file()

        plot_dir.mkdir(parents=True, exist_ok=True)
        saved_path = processor.plot_ghostly_report(save_path=str(report_path))

        if saved_path and os.path.exists(saved_path):
            return FileResponse(saved_path)
        else:
            raise HTTPException(status_code=500,
                                detail="Error generating report")
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
