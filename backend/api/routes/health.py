"""
Health Check Routes
==================

Provides health monitoring and system status endpoints.
"""

import logging
from datetime import datetime
from fastapi import APIRouter
from fastapi.responses import JSONResponse

# Initialize router and logger
router = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    """Health check endpoint for container health monitoring."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@router.get("/")
async def root():
    """Root endpoint returning API information."""
    return JSONResponse(content={
        "name": "GHOSTLY+ EMG Analysis API",
        "version": "1.0.0", 
        "description": "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game",
        "endpoints": {
            "health": "GET /health - Health check endpoint",
            "upload": "POST /upload - Upload and process a C3D file",
            "export": "POST /upload/export - Export comprehensive analysis data as JSON",
            "mvc_estimate": "POST /mvc/estimate - Estimate MVC values for EMG signals",
            "recalc": "POST /recalc - Recalculate analytics with updated parameters",
            "scores": {
                "calculate": "POST /scores/calculate - Calculate GHOSTLY+ performance scores",
                "update_rpe": "POST /scores/update-rpe - Update RPE for a session",
                "update_game": "POST /scores/update-game - Update game scores for a session",
                "adherence": "GET /scores/adherence - Get adherence score for a patient",
                "synthetic": "POST /scores/synthetic - Generate synthetic scoring data"
            }
        }
    })