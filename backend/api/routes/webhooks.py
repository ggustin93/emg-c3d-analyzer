"""Clean Webhook System for C3D File Processing.
===========================================

SOLID, DRY, KISS implementation for Supabase Storage webhooks.
Works with actual database schema (therapy_sessions, emg_statistics, etc.)

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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Initialize core services
session_processor = TherapySessionProcessor()
webhook_security = WebhookSecurity()


# === REQUEST/RESPONSE MODELS ===


class SupabaseStorageEvent(BaseModel):
    """Supabase Storage webhook event payload."""

    type: str
    table: str
    record: dict
    schema: str = Field(alias="schema")
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
        """Extract patient code from object name path (e.g., P039/file.c3d -> P039)."""
        parts = self.object_name.split("/")
        if len(parts) >= 2 and parts[0].startswith("P"):
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
        Fast webhook response with session_id for tracking
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
            session_id = await session_processor.create_session(
                file_path=f"{event.bucket_id}/{event.object_name}",
                file_metadata=event.record.get("metadata", {}),
                patient_id=patient_uuid,
                therapist_id=therapist_uuid,
            )
        except Exception as e:
            logger.error(f"Failed to create session for {event.object_name}: {e!s}", exc_info=True)
            # Return success with error message rather than HTTP 500
            return WebhookResponse(
                success=False,
                message=f"Session creation failed: {e!s}",
                session_id=None,
                processing_time_ms=(datetime.now() - start_time).total_seconds() * 1000,
            )

        # Process C3D file in background
        background_tasks.add_task(
            _process_c3d_background,
            session_id=session_id,
            bucket=event.bucket_id,
            object_path=event.object_name,
        )

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        logger.info(f"✅ Session created: {session_id} ({processing_time:.1f}ms)")

        return WebhookResponse(
            success=True,
            message="C3D processing initiated",
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


@router.get("/storage/status/{session_id}")
async def get_processing_status(session_id: str) -> dict:
    """Get processing status for a therapy session.

    Args:
        session_id: Therapy session UUID

    Returns:
        Session status and analysis results if available
    """
    try:
        status = await session_processor.get_session_status(session_id)

        if not status:
            raise HTTPException(status_code=404, detail="Session not found")

        return {
            "session_id": session_id,
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


async def _process_c3d_background(session_id: str, bucket: str, object_path: str) -> None:
    """Background task: Complete C3D file processing.

    Populates all database tables:
    - therapy_sessions (update with results and game_metadata)
    - emg_statistics (per channel)
    - performance_scores
    - processing_parameters

    Args:
        session_id: Therapy session UUID
        bucket: Storage bucket name
        object_path: Path to C3D file
    """
    try:
        logger.info(f"🔄 Background processing started: {session_id}")

        # Update status to processing
        await session_processor.update_session_status(session_id, "processing")

        # Process C3D file completely
        result = await session_processor.process_c3d_file(
            session_id=session_id, bucket=bucket, object_path=object_path
        )

        if result["success"]:
            # Update status to completed
            await session_processor.update_session_status(session_id, "completed")

            logger.info(f"✅ Background processing completed: {session_id}")
            logger.info(f"📊 EMG channels analyzed: {result.get('channels_analyzed', 0)}")
            logger.info(f"⭐ Overall score: {result.get('overall_score', 'N/A')}")
        else:
            raise Exception(result.get("error", "Processing failed"))

    except Exception as e:
        logger.error(f"❌ Background processing failed: {e!s}", exc_info=True)

        # Update status to failed
        await session_processor.update_session_status(session_id, "failed", error_message=str(e))


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
