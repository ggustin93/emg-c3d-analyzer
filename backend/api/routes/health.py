"""Health Check Routes.
==================

System health monitoring endpoints.
Single responsibility: Application health status.
"""

import os
import sys
from datetime import datetime

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """Health check endpoint for container health monitoring."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@router.get("/health/debug")
async def health_debug():
    """Debug endpoint showing environment status for troubleshooting."""
    return {
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "environment": {
            "SUPABASE_URL": "SET" if os.getenv("SUPABASE_URL") else "MISSING",
            "SUPABASE_ANON_KEY": "SET" if os.getenv("SUPABASE_ANON_KEY") else "MISSING",
            "SUPABASE_SERVICE_KEY": "SET" if os.getenv("SUPABASE_SERVICE_KEY") else "MISSING",
            "REDIS_URL": os.getenv("REDIS_URL", "not set"),
            "ENVIRONMENT": os.getenv("ENVIRONMENT", "not set"),
            "HOST": os.getenv("HOST", "not set"),
            "PORT": os.getenv("PORT", "not set"),
            "LOG_LEVEL": os.getenv("LOG_LEVEL", "not set"),
        },
        "system": {
            "working_dir": os.getcwd(),
            "python_version": sys.version,
            "python_executable": sys.executable,
        }
    }


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
            "export": "POST /export - Export comprehensive analysis data as JSON",
            "mvc_estimate": "POST /mvc/estimate - Estimate MVC values for EMG signals",
            "scores": {
                "calculate": "POST /scores/calculate - Calculate GHOSTLY+ performance scores",
                "update_rpe": "POST /scores/update-rpe - Update RPE for a session",
                "update_game": "POST /scores/update-game - Update game scores for a session",
                "adherence": "GET /scores/adherence - Get adherence score for a patient",
                "synthetic": "POST /scores/synthetic - Generate synthetic scoring data",
            },
        },
    }
