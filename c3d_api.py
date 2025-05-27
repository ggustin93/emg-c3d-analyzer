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

from c3d_processor import GHOSTLYC3DProcessor, DEFAULT_THRESHOLD_FACTOR, DEFAULT_MIN_DURATION_MS, DEFAULT_SMOOTHING_WINDOW
from models import EMGAnalysisResult, EMGRawData, ProcessingOptions, GameMetadata, ChannelAnalytics

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

        # Check if process_file exists as a method or implement manually
        if hasattr(processor, 'process_file') and callable(
                getattr(processor, 'process_file')):
            result_data = processor.process_file(
                threshold_factor=threshold_factor,
                min_duration_ms=min_duration_ms,
                smoothing_window=smoothing_window)
        else:
            # Manually implement process_file functionality
            processor.load_file()
            processor.extract_metadata()
            processor.extract_emg_data()
            processor.detect_contractions(threshold_factor=threshold_factor,
                                          min_duration_ms=min_duration_ms,
                                          smoothing_window=smoothing_window)
            processor.calculate_analytics()

            # Create result dictionary
            result_data = {
                'metadata': processor.game_metadata,
                'analytics': processor.analytics,
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }

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
            metadata=GameMetadata(**result_data['metadata']),
            analytics={
                k: ChannelAnalytics(**v)
                for k, v in result_data['analytics'].items()
            },
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

        # If not, search for files containing the ID
        for file_path in RESULTS_DIR.glob("*.json"):
            if result_id in file_path.name:
                with open(file_path, "r") as f:
                    return json.load(f)

        raise HTTPException(status_code=404,
                            detail=f"Result not found: {result_id}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error retrieving result: {str(e)}")


@app.get("/raw-data/{result_id}/{channel}", response_model=EMGRawData)
async def get_raw_data(result_id: str, channel: str):
    """Get raw EMG data for a specific channel from a result."""
    try:
        # First, find the result
        result_file = None
        direct_path = RESULTS_DIR / f"{result_id}.json"

        if direct_path.exists():
            result_file = direct_path
        else:
            for file_path in RESULTS_DIR.glob("*.json"):
                if result_id in file_path.name:
                    result_file = file_path
                    break

        if not result_file:
            raise HTTPException(status_code=404,
                                detail=f"Result not found: {result_id}")

        # Now look for corresponding C3D file in uploads
        with open(result_file, "r") as f:
            result = json.load(f)

        # Get original file if possible
        c3d_file = None
        for file_path in UPLOAD_DIR.glob("*.c3d"):
            if result_id in file_path.name:
                c3d_file = file_path
                break

        if not c3d_file:
            # Return simulated data if original file not found
            # In a production system, you'd store the raw data along with the analysis
            return EMGRawData(
                channel_name=channel,
                sampling_rate=1000,
                data=[0.1] * 1000,  # Dummy data
                time_axis=[i / 1000 for i in range(1000)])

        # Process the file to get the actual data
        processor = GHOSTLYC3DProcessor(str(c3d_file))
        processor.extract_emg_data()

        # Find the channel
        found_channel = None
        for ch_name, ch_data in processor.emg_data.items():
            if channel.lower() in ch_name.lower():
                found_channel = ch_name
                channel_data = ch_data
                break

        if not found_channel:
            raise HTTPException(status_code=404,
                                detail=f"Channel {channel} not found")

        # Get contractions for this channel if available
        processor.detect_contractions()
        contractions = None
        for activity, contractions_list in processor.contractions.items():
            if channel.lower() in activity.lower():
                contractions = contractions_list
                break

        return EMGRawData(channel_name=found_channel,
                          sampling_rate=channel_data['sampling_rate'],
                          data=channel_data['data'],
                          time_axis=channel_data['time_axis'],
                          contractions=contractions)

    except HTTPException:
        raise
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
        # First check if a plot already exists
        plot_dir = PLOTS_DIR / result_id
        plot_path = plot_dir / f"{channel}.png"

        if plot_path.exists() and not regenerate:
            return FileResponse(plot_path, media_type="image/png")

        # Find the result
        result_file = None
        direct_path = RESULTS_DIR / f"{result_id}.json"

        if direct_path.exists():
            result_file = direct_path
        else:
            for file_path in RESULTS_DIR.glob("*.json"):
                if result_id in file_path.name:
                    result_file = file_path
                    break

        if not result_file:
            raise HTTPException(status_code=404,
                                detail=f"Result not found: {result_id}")

        # Get original file if possible
        c3d_file = None
        for file_path in UPLOAD_DIR.glob("*.c3d"):
            if result_id in file_path.name:
                c3d_file = file_path
                break

        if not c3d_file:
            raise HTTPException(status_code=404,
                                detail=f"Original C3D file not found")

        # Create plot directory if it doesn't exist
        plot_dir.mkdir(parents=True, exist_ok=True)

        # Process the file and generate the plot
        processor = GHOSTLYC3DProcessor(str(c3d_file))
        processor.extract_emg_data()
        processor.detect_contractions()
        processor.calculate_analytics()

        try:
            processor.plot_emg_with_contractions(channel=channel,
                                                 save_path=str(plot_path))
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

        # Return the plot
        return FileResponse(plot_path, media_type="image/png")

    except HTTPException:
        raise
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
        # First check if a report already exists
        plot_dir = PLOTS_DIR / result_id
        report_path = plot_dir / "report.png"

        if report_path.exists() and not regenerate:
            return FileResponse(report_path, media_type="image/png")

        # Find the result
        result_file = None
        direct_path = RESULTS_DIR / f"{result_id}.json"

        if direct_path.exists():
            result_file = direct_path
        else:
            for file_path in RESULTS_DIR.glob("*.json"):
                if result_id in file_path.name:
                    result_file = file_path
                    break

        if not result_file:
            raise HTTPException(status_code=404,
                                detail=f"Result not found: {result_id}")

        # Get original file if possible
        c3d_file = None
        for file_path in UPLOAD_DIR.glob("*.c3d"):
            if result_id in file_path.name:
                c3d_file = file_path
                break

        if not c3d_file:
            raise HTTPException(status_code=404,
                                detail=f"Original C3D file not found")

        # Create plot directory if it doesn't exist
        plot_dir.mkdir(parents=True, exist_ok=True)

        # Process the file and generate the report
        processor = GHOSTLYC3DProcessor(str(c3d_file))
        processor.extract_emg_data()
        processor.detect_contractions()
        processor.calculate_analytics()

        processor.plot_ghostly_report(save_path=str(report_path))

        # Return the report
        return FileResponse(report_path, media_type="image/png")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error generating report: {str(e)}")


@app.get("/patients", response_model=List[str])
async def list_patients():
    """List all patient IDs from the results."""
    try:
        patient_ids = set()
        for file_path in RESULTS_DIR.glob("*.json"):
            with open(file_path, "r") as f:
                data = json.load(f)
                if "patient_id" in data and data["patient_id"]:
                    patient_ids.add(data["patient_id"])
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
        for file_path in RESULTS_DIR.glob("*.json"):
            with open(file_path, "r") as f:
                data = json.load(f)
                if "patient_id" in data and data["patient_id"] == patient_id:
                    results.append(data)
        return results
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving patient results: {str(e)}")


@app.delete("/results/{result_id}")
async def delete_result(result_id: str):
    """Delete a specific result by ID and its associated files."""
    try:
        result_found = False

        # Check if the file exists directly
        direct_path = RESULTS_DIR / f"{result_id}.json"
        if direct_path.exists():
            os.remove(direct_path)
            result_found = True
        else:
            # If not, search for files containing the ID
            for file_path in RESULTS_DIR.glob("*.json"):
                if result_id in file_path.name:
                    os.remove(file_path)
                    result_found = True
                    break

        # Clean up plots if they exist
        plot_dir = PLOTS_DIR / result_id
        if plot_dir.exists():
            for file in plot_dir.glob("*"):
                os.remove(file)
            os.rmdir(plot_dir)

        # Clean up original C3D file
        for file_path in UPLOAD_DIR.glob("*.c3d"):
            if result_id in file_path.name:
                os.remove(file_path)
                break

        if result_found:
            return {
                "message":
                f"Result {result_id} and associated files deleted successfully"
            }
        else:
            raise HTTPException(status_code=404,
                                detail=f"Result not found: {result_id}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error deleting result: {str(e)}")


@app.get("/debug/file-structure/{filename}")
async def debug_file_structure(filename: str):
    """Debug endpoint to analyze C3D file structure."""
    import ezc3d

    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404,
                            detail=f"File not found: {filename}")

    try:
        c3d = ezc3d.c3d(str(file_path))
        structure = {
            "parameters":
            list(c3d['parameters'].keys()),
            "point_params":
            list(c3d['parameters']['POINT'].keys())
            if 'POINT' in c3d['parameters'] else [],
            "analog_params":
            list(c3d['parameters']['ANALOG'].keys())
            if 'ANALOG' in c3d['parameters'] else [],
            "analog_labels":
            c3d['parameters']['ANALOG']['LABELS']['value']
            if 'ANALOG' in c3d['parameters']
            and 'LABELS' in c3d['parameters']['ANALOG'] else [],
            "sampling_rate":
            c3d['parameters']['ANALOG']['RATE']['value'][0]
            if 'ANALOG' in c3d['parameters']
            and 'RATE' in c3d['parameters']['ANALOG'] else None,
            "point_count":
            c3d['parameters']['POINT']['USED']['value'][0]
            if 'POINT' in c3d['parameters']
            and 'USED' in c3d['parameters']['POINT'] else None,
            "analog_shape":
            c3d['data']['analogs'].shape
        }
        return structure
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Error analyzing file structure: {str(e)}")


# If running directly (for development)
if __name__ == "__main__":
    import uvicorn
    # Use port 8080 which Replit exposes by default
    uvicorn.run(app, host="0.0.0.0", port=8080)
