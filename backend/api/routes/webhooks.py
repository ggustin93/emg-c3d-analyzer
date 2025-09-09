"""Webhook System - STATEFUL Database Processing.
====================================================

PURPOSE: Process C3D files from Supabase Storage events WITH full database persistence.

KEY BEHAVIORS:
- ✅ STORES: Complete analysis results in database
- ✅ CREATES: therapy_sessions, emg_statistics records
- ❌ DOES NOT: Return EMG signals (background processing)

USE CASE: Production workflow where C3D files are uploaded to Supabase Storage
and need complete database persistence with background processing.

DIFFERENCE FROM UPLOAD:
- Webhook Route: Stateful processing → Full DB storage → No signal return
- Upload Route: Stateless processing → No DB storage → Returns signals

SOLID PRINCIPLES: 
- Single Responsibility: Webhook event handling and DB persistence
- Open/Closed: Extensible for new webhook types
- DRY: Reuses TherapySessionProcessor for consistency

Author: EMG C3D Analyzer Team
Date: 2025-08-14
"""

import json
import logging
from datetime import datetime

from config import WEBHOOK_SECRET
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field

from database.supabase_client import get_supabase_client
from services.clinical.repositories.patient_repository import PatientRepository
from services.clinical.therapy_session_processor import TherapySessionProcessor
from services.infrastructure.webhook_security import WebhookSecurity

# Import dependencies for TherapySessionProcessor
from services.clinical.repositories.emg_data_repository import EMGDataRepository  
from services.clinical.repositories.therapy_session_repository import TherapySessionRepository
from services.cache.cache_service import CacheService
from services.clinical.performance_scoring_service import PerformanceScoringService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Initialize core services
webhook_security = WebhookSecurity()


def get_therapy_session_processor():
    """Factory function to create TherapySessionProcessor with all dependencies."""
    supabase_client = get_supabase_client(use_service_key=True)
    
    # Initialize all dependencies (c3d_processor will be created per-file)
    emg_data_repo = EMGDataRepository(supabase_client)
    session_repo = TherapySessionRepository(supabase_client)
    cache_service = CacheService()
    performance_service = PerformanceScoringService(supabase_client)
    
    return TherapySessionProcessor(
        c3d_processor=None,  # Will be created per-file with file_path
        emg_data_repo=emg_data_repo,
        session_repo=session_repo,
        cache_service=cache_service,
        performance_service=performance_service,
        supabase_client=supabase_client
    )


# === REQUEST/RESPONSE MODELS ===


class SupabaseStorageEvent(BaseModel):
    """Supabase Storage webhook event payload."""

    type: str
    table: str
    record: dict
    schema_: str = Field(alias="schema")
    old_record: dict | None = None

    @property
    def object_name(self) -> str:
        """Extract object name from record."""
        return self.record.get("name", "")

    @property
    def bucket_id(self) -> str:
        """Extract bucket ID from record."""
        return self.record.get("bucket_id", "")

    @property
    def patient_code(self) -> str | None:
        """Extract patient code from object name path.
        
        Format: PATIENT_CODE/C3D_FILENAME.c3d
        Example: P001/Ghostly_test.c3d -> P001
        """
        parts = self.object_name.split("/")
        
        # Patient code is the first part of the path
        if len(parts) >= 2 and parts[0].startswith("P") and len(parts[0]) >= 4 and parts[0][1:4].isdigit():
            return parts[0]
        
        return None

    @property
    def is_c3d_upload(self) -> bool:
        """Check if this is a C3D file upload event."""
        return (
            self.type == "INSERT"
            and self.table == "objects"
            and self.object_name.lower().endswith(".c3d")
            and self.bucket_id == "c3d-examples"
        )


class WebhookResponse(BaseModel):
    """Standard webhook response."""

    success: bool
    message: str
    session_code: str | None = None
    session_id: str | None = None
    processing_time_ms: float | None = None


# === WEBHOOK ENDPOINTS ===


@router.post("/storage/c3d-upload", response_model=WebhookResponse)
async def handle_c3d_upload(request: Request, background_tasks: BackgroundTasks) -> WebhookResponse:
    """🎯 Handle C3D file upload from Supabase Storage.

    Clean, efficient processing:
    1. Validate webhook signature and payload
    2. Create therapy_session record immediately
    3. Process C3D file in background
    4. Populate all related tables (emg_statistics, processing_parameters, etc.)

    Returns:
        Fast webhook response with session_code for tracking
    """
    start_time = datetime.now()

    try:
        # Parse and validate payload
        body = await request.body()
        payload_data = json.loads(body)

        # Validate webhook signature (only if secret is configured)
        if WEBHOOK_SECRET and WEBHOOK_SECRET.strip():
            signature = request.headers.get("x-supabase-signature", "")
            if not webhook_security.verify_signature(body, signature, WEBHOOK_SECRET):
                logger.warning("Invalid webhook signature")
                raise HTTPException(status_code=401, detail="Invalid signature")
        else:
            logger.debug("Webhook signature verification disabled (no secret configured)")

        # Parse Supabase event
        event = SupabaseStorageEvent(**payload_data)

        # Filter: only process C3D uploads
        if not event.is_c3d_upload:
            return WebhookResponse(
                success=True, message=f"Ignored: {event.type} {event.table} {event.object_name}"
            )

        logger.info(f"📁 Processing C3D upload: {event.object_name}")

        # Extract patient_code and lookup patient UUID + therapist_id
        patient_uuid = None
        therapist_uuid = None
        if event.patient_code:
            try:
                patient_repo = PatientRepository(get_supabase_client(use_service_key=True))
                patient = patient_repo.get_patient_by_code(event.patient_code)
                if patient:
                    patient_uuid = patient.get("id")
                    therapist_uuid = patient.get("therapist_id")
                    logger.info(f"👤 Found patient {event.patient_code} -> UUID: {patient_uuid}, Therapist: {therapist_uuid}")
                else:
                    logger.warning(f"⚠️ Patient not found for code: {event.patient_code}")
            except Exception as e:
                logger.exception(f"Failed to lookup patient {event.patient_code}: {e!s}")

        # Create therapy session record (immediate response)
        try:
            # Initialize processor with dependencies
            session_processor = get_therapy_session_processor()
            
            session_code = await session_processor.create_session(
                file_path=f"{event.bucket_id}/{event.object_name}",
                file_metadata=event.record.get("metadata", {}),
                patient_id=patient_uuid,
                therapist_id=therapist_uuid,
            )
            
            # Get the UUID that was created (for FK references)
            # The processor stores it after creation
            session_id = getattr(session_processor, '_last_session_uuid', None)
            
            # Fallback: query by session_code if UUID not available
            if not session_id:
                session_details = await session_processor.get_session_status(session_code)
                session_id = session_details["id"] if session_details else None
            
        except Exception as e:
            logger.error(f"Failed to create session for {event.object_name}: {e!s}", exc_info=True)
            # Return success with error message rather than HTTP 500
            return WebhookResponse(
                success=False,
                message=f"Session creation failed: {e!s}",
                session_code=None,
                session_id=None,
                processing_time_ms=(datetime.now() - start_time).total_seconds() * 1000,
            )

        # Process C3D file in background
        background_tasks.add_task(
            _process_c3d_background,
            session_code=session_code,
            bucket=event.bucket_id,
            object_path=event.object_name,
        )

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        logger.info(f"✅ Session created: {session_code} ({processing_time:.1f}ms)")

        return WebhookResponse(
            success=True,
            message="C3D processing initiated",
            session_code=session_code,
            session_id=session_id,
            processing_time_ms=processing_time,
        )

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except HTTPException:
        # Re-raise HTTPExceptions (like 401 auth errors) without modification
        raise
    except Exception as e:
        logger.error(f"Webhook processing error: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing error: {e!s}")


@router.get("/storage/status/{session_code}")
async def get_processing_status(session_code: str) -> dict:
    """Get processing status for a therapy session.

    Args:
        session_code: Therapy session code (format: P###S###)

    Returns:
        Session status and analysis results if available
    """
    try:
        # Initialize processor with dependencies
        session_processor = get_therapy_session_processor()
        status = await session_processor.get_session_status(session_code)

        if not status:
            raise HTTPException(status_code=404, detail="Session not found")

        return {
            "session_code": session_code,
            "status": status["processing_status"],
            "file_path": status["file_path"],
            "created_at": status["created_at"],
            "processed_at": status.get("processed_at"),
            "error_message": status.get("processing_error_message"),
            "has_analysis": bool(status.get("analytics_cache")),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Status check error: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Status error: {e!s}")


# === BACKGROUND PROCESSING ===


async def _process_c3d_background(session_code: str, bucket: str, object_path: str) -> None:
    """Background task: Complete C3D file processing.

    Populates all database tables:
    - therapy_sessions (update with results and game_metadata)
    - emg_statistics (per channel)
    - performance_scores
    - processing_parameters

    Args:
        session_code: Therapy session code (format: P###S###)
        bucket: Storage bucket name
        object_path: Path to C3D file
    """
    try:
        logger.info(f"🔄 Background processing started: {session_code}")

        # Initialize processor with dependencies
        session_processor = get_therapy_session_processor()
        
        # Update status to processing
        await session_processor.update_session_status(session_code, "processing")

        # Process C3D file completely
        result = await session_processor.process_c3d_file(
            session_code=session_code, bucket=bucket, object_path=object_path
        )

        if result["success"]:
            # Update status to completed
            await session_processor.update_session_status(session_code, "completed")

            logger.info(f"✅ Background processing completed: {session_code}")
            logger.info(f"📊 EMG channels analyzed: {result.get('channels_analyzed', 0)}")
            logger.info(f"⭐ Overall score: {result.get('overall_score', 'N/A')}")
        else:
            raise Exception(result.get("error", "Processing failed"))

    except Exception as e:
        logger.error(f"❌ Background processing failed: {e!s}", exc_info=True)

        # Initialize processor with dependencies (for error handling)
        session_processor = get_therapy_session_processor()
        
        # Update status to failed
        await session_processor.update_session_status(session_code, "failed", error_message=str(e))


# === HEALTH CHECK ===


@router.get("/health")
async def webhook_health() -> dict:
    """Webhook service health check."""
    return {
        "service": "C3D Webhook Processing",
        "status": "healthy",
        "database_tables": [
            "therapy_sessions",
            "emg_statistics", 
            "performance_scores",
            "processing_parameters",
        ],
        "features": ["background_processing", "signature_verification", "status_tracking"],
    }
