"""Frontend Log Collection Endpoint.

Simple, efficient endpoint for collecting frontend logs and writing them to disk.
Follows KISS principle - just receive logs and append to file.
"""

import os
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Create router
router = APIRouter(prefix="/api/logs", tags=["logs"])

# Log file path - use /app/logs in Docker, local path otherwise
if os.path.exists('/app'):
    # Running in Docker container
    FRONTEND_LOG_PATH = Path('/app/logs/frontend.log')
else:
    # Running locally
    FRONTEND_LOG_PATH = Path("../logs/frontend.log")

class FrontendLogsRequest(BaseModel):
    """Request model for frontend log batch."""
    logs: list[str]


@router.post("/frontend")
async def receive_frontend_logs(request: FrontendLogsRequest):
    """Receive frontend logs and append them to frontend.log file.
    
    This endpoint accepts batched log entries from the frontend logger
    and appends them to the centralized frontend.log file.
    
    Returns:
        Simple success confirmation
    """
    try:
        # Ensure logs directory exists
        FRONTEND_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        
        # Append logs to file
        with open(FRONTEND_LOG_PATH, "a", encoding="utf-8") as log_file:
            for log_entry in request.logs:
                log_file.write(f"{log_entry}\n")
            log_file.flush()  # Ensure immediate write to disk
        
        return {
            "success": True,
            "message": f"Received {len(request.logs)} log entries",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to write frontend logs: {str(e)}"
        )


@router.get("/frontend/tail")
async def tail_frontend_logs(lines: int = 50):
    """Get the last N lines from frontend.log for debugging.
    
    Args:
        lines: Number of lines to return from end of file (default: 50)
    
    Returns:
        Last N lines from the frontend log file
    """
    try:
        if not FRONTEND_LOG_PATH.exists():
            return {"logs": [], "message": "Log file does not exist yet"}
        
        with open(FRONTEND_LOG_PATH, "r", encoding="utf-8") as log_file:
            all_lines = log_file.readlines()
            tail_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            
        return {
            "logs": [line.rstrip() for line in tail_lines],
            "total_lines": len(all_lines),
            "showing": len(tail_lines)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to read frontend logs: {str(e)}"
        )