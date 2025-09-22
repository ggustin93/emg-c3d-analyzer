"""Health Check Routes.
==================

System health monitoring endpoints.
Single responsibility: Application health status.
"""

from datetime import datetime

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """Health check endpoint for container health monitoring."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}




@router.get("/")
async def root():
    """Root endpoint returning API information."""
    return {
        "name": "GHOSTLY+ EMG Analysis API",
        "version": "1.0.0",
        "description": "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game",
        "endpoints": {
            "health": "GET /health - Health check endpoint",
            "upload": "POST /upload - Upload and process a C3D file",
            "analysis": "POST /analysis/recalc - Recalculate EMG analysis",
            "export": {
                "data": "POST /export - Export comprehensive analysis data",
                "session": "GET /export/session/{session_id} - Export session data"
            },
            "mvc": "POST /mvc/calibrate - Calibrate MVC values for EMG signals",
            "signals": {
                "get": "GET /signals/jit/{session_id}/{channel} - Get signal data",
                "channels": "GET /signals/jit/{session_id}/channels - Get channel info"
            },
            "scoring": {
                "configurations": "GET /scoring/configurations - List scoring configurations",
                "active": "GET /scoring/configurations/active - Get active configuration",
                "adherence": "GET /scoring/adherence/{patient_code} - Get adherence score"
            },
            "webhooks": "POST /webhooks/storage/c3d-upload - Process C3D file uploads",
            "therapists": "POST /therapists/lookup - Resolve therapist information"
        }
    }
