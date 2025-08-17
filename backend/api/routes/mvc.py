"""
MVC Routes
=========

Maximum Voluntary Contraction estimation endpoints.
Single responsibility: MVC value estimation from C3D files.
"""

import os
import shutil
import logging
import tempfile
from typing import Optional, Dict

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse

from services.c3d_processor import GHOSTLYC3DProcessor
from services.mvc_service import mvc_service, MVCEstimation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mvc", tags=["mvc"])


@router.post("/estimate", response_model=Dict[str, Dict])
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
    
    Args:
        file: C3D file upload
        user_id: User identifier for tracking
        session_id: Session identifier for tracking
        threshold_percentage: MVC threshold percentage (default 75%)
        
    Returns:
        Dict: MVC estimations for all channels with metadata
        
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
        logger.error(f"ERROR in /mvc/estimate: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error estimating MVC: {str(e)}")
    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)