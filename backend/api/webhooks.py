"""
Webhook endpoints for automated C3D processing
Handles Supabase Storage events for real-time file processing
"""
import hashlib
import hmac
import json
from datetime import datetime
from typing import Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import logging

from services.webhook_service import WebhookService
from services.enhanced_webhook_service import EnhancedWebhookService
from services.metadata_service import MetadataService
from services.cache_service import CacheService
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class StorageWebhookPayload(BaseModel):
    """Supabase Storage webhook event payload (legacy format)"""
    event_type: str = Field(alias="eventType")
    bucket: str
    object_name: str = Field(alias="objectName")
    object_size: int = Field(alias="objectSize")
    content_type: str = Field(alias="contentType")
    timestamp: datetime
    metadata: Optional[Dict] = None


class SupabaseRecord(BaseModel):
    """Supabase record data from database trigger"""
    id: str
    name: str
    bucket_id: str
    metadata: Dict
    created_at: datetime
    updated_at: datetime
    

class SupabaseWebhookPayload(BaseModel):
    """Real Supabase webhook payload format"""
    type: str
    table: str
    record: SupabaseRecord
    schema_name: str = Field(alias="schema")
    old_record: Optional[Dict] = None


class WebhookResponse(BaseModel):
    """Standard webhook response"""
    success: bool
    message: str
    processing_id: Optional[str] = None


def verify_webhook_signature(
    request: Request,
    payload: bytes,
    signature: str,
    secret: str
) -> bool:
    """
    Verify webhook signature using HMAC-SHA256
    
    Args:
        request: FastAPI request object
        payload: Raw request body
        signature: Signature from webhook header
        secret: Webhook secret for verification
        
    Returns:
        bool: True if signature is valid
    """
    expected_signature = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_signature, signature)


@router.post("/storage/c3d-upload", response_model=WebhookResponse)
async def handle_c3d_upload(
    request: Request,
    background_tasks: BackgroundTasks
) -> WebhookResponse:
    """
    Handle C3D file upload events from Supabase Storage
    
    This endpoint supports both legacy and real Supabase webhook formats:
    1. Parses webhook payload (legacy or database trigger format)
    2. Verifies webhook signature (optional)
    3. Validates the event and file type
    4. Extracts metadata from the C3D file
    5. Checks cache for existing analysis
    6. Triggers processing if needed
    7. Returns immediate response
    """
    
    # Parse the request body first
    body = await request.body()
    
    try:
        raw_payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    # Determine payload format and extract data
    if "type" in raw_payload and "table" in raw_payload:
        # Real Supabase database trigger format
        try:
            supabase_payload = SupabaseWebhookPayload(**raw_payload)
            
            # Convert to our expected format
            object_name = supabase_payload.record.name
            bucket = supabase_payload.record.bucket_id
            object_size = supabase_payload.record.metadata.get("size", 0)
            content_type = supabase_payload.record.metadata.get("mimetype", "application/octet-stream")
            timestamp = supabase_payload.record.created_at
            event_type = f"{supabase_payload.type}_storage.objects"
            
        except Exception as e:
            logger.error(f"Failed to parse Supabase webhook payload: {str(e)}")
            raise HTTPException(status_code=422, detail=f"Invalid Supabase payload: {str(e)}")
            
    else:
        # Legacy format (for manual testing)
        try:
            legacy_payload = StorageWebhookPayload(**raw_payload)
            object_name = legacy_payload.object_name
            bucket = legacy_payload.bucket
            object_size = legacy_payload.object_size
            content_type = legacy_payload.content_type
            timestamp = legacy_payload.timestamp
            event_type = legacy_payload.event_type
            
        except Exception as e:
            logger.error(f"Failed to parse legacy webhook payload: {str(e)}")
            raise HTTPException(status_code=422, detail=f"Invalid legacy payload: {str(e)}")
    
    # Verify webhook signature if secret is configured
    if settings.WEBHOOK_SECRET:
        signature = request.headers.get("X-Webhook-Signature", "")
        
        if not verify_webhook_signature(request, body, signature, settings.WEBHOOK_SECRET):
            logger.warning(f"Invalid webhook signature for file: {object_name}")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    
    # Validate event type - support Supabase Storage events
    valid_events = ["ObjectCreated:Post", "storage-object-uploaded", "storage-object-created", "INSERT_storage.objects"]
    if event_type not in valid_events:
        return WebhookResponse(
            success=True,
            message=f"Ignoring event type: {event_type}"
        )
    
    # Validate file type
    if not object_name.lower().endswith(".c3d"):
        return WebhookResponse(
            success=True,
            message=f"Ignoring non-C3D file: {object_name}"
        )
    
    # Validate bucket (matching frontend bucket name)
    if bucket != "c3d-examples":
        return WebhookResponse(
            success=False,
            message=f"Invalid bucket: {bucket}"
        )
    
    try:
        # Initialize services
        webhook_service = WebhookService()
        enhanced_webhook_service = EnhancedWebhookService()
        metadata_service = MetadataService()
        cache_service = CacheService()
        
        # Extract patient and session info from file path
        # Expected format: {patient_id}/{session_id}/filename.c3d or just filename.c3d
        path_parts = object_name.split("/")
        patient_id = path_parts[0] if len(path_parts) > 1 else None  # Only if nested structure
        session_id = path_parts[1] if len(path_parts) > 2 else None  # Only if deeply nested
        
        # Calculate file hash for deduplication
        logger.info(f"📁 Processing upload: '{object_name}' ({object_size} bytes)")
        file_hash = await webhook_service.calculate_file_hash(
            bucket=bucket,
            object_path=object_name
        )
        logger.info(f"🔍 File hash calculated: {file_hash[:16]}... (checking for duplicates)")
        
        # Check if file has already been processed (duplicate detection)
        existing_metadata = await metadata_service.get_by_file_hash(file_hash)
        
        if existing_metadata:
            logger.info(f"🔄 DUPLICATE FILE DETECTED: '{object_name}' matches existing file '{existing_metadata.get('file_path', 'unknown')}' (hash: {file_hash[:16]}...)")
            logger.info(f"📊 Original file processed at: {existing_metadata.get('processed_at', 'unknown')}")
            
            # Check cache for analysis results
            cached_results = await cache_service.get_cached_analysis(
                file_hash=file_hash,
                processing_version=settings.PROCESSING_VERSION
            )
            
            if cached_results:
                # Update cache hit count
                await cache_service.increment_cache_hits(cached_results["id"])
                logger.info(f"✅ CACHE HIT: Returning existing analysis results for duplicate file (cache hits: {cached_results.get('cache_hits', 0) + 1})")
                return WebhookResponse(
                    success=True,
                    message=f"Duplicate file detected - analysis results retrieved from cache (original: {existing_metadata.get('file_path', 'unknown')})",
                    processing_id=str(existing_metadata["id"])
                )
            else:
                logger.warning(f"⚠️ DUPLICATE WITHOUT CACHE: File hash exists but no cached analysis found for version {settings.PROCESSING_VERSION}")
                # Continue to reprocess if no cache available
        
        # New file processing
        if not existing_metadata:
            logger.info(f"🆕 NEW FILE: '{object_name}' - starting fresh analysis")
        
        # Create metadata entry
        metadata_id = await metadata_service.create_metadata_entry(
            file_path=object_name,
            file_hash=file_hash,
            file_size_bytes=object_size,
            patient_id=patient_id,
            session_id=session_id,
            metadata=raw_payload.get("metadata", {})
        )
        
        # Trigger enhanced background processing
        background_tasks.add_task(
            process_c3d_file_enhanced,
            metadata_id=metadata_id,
            bucket=bucket,
            object_path=object_name,
            file_hash=file_hash,
            session_id=session_id
        )
        
        logger.info(f"🚀 PROCESSING STARTED: Background task initiated for '{object_name}' (processing_id: {metadata_id})")
        
        return WebhookResponse(
            success=True,
            message="C3D file processing initiated",
            processing_id=str(metadata_id)
        )
        
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


async def process_c3d_file(
    metadata_id: UUID,
    bucket: str,
    object_path: str,
    file_hash: str
) -> None:
    """
    Background task to process C3D file
    
    Args:
        metadata_id: Database ID for metadata entry
        bucket: Storage bucket name
        object_path: Path to file in bucket
        file_hash: SHA-256 hash of file content
    """
    try:
        webhook_service = WebhookService()
        metadata_service = MetadataService()
        cache_service = CacheService()
        
        # Update status to processing
        await metadata_service.update_processing_status(
            metadata_id=metadata_id,
            status="processing"
        )
        
        # Download and process the C3D file
        processing_result = await webhook_service.process_c3d_from_storage(
            bucket=bucket,
            object_path=object_path
        )
        
        # Extract metadata from C3D file
        c3d_metadata = await metadata_service.extract_c3d_metadata(
            file_data=processing_result["file_data"]
        )
        
        # Update metadata with extracted information
        await metadata_service.update_metadata(
            metadata_id=metadata_id,
            channel_names=c3d_metadata["channel_names"],
            channel_count=c3d_metadata["channel_count"],
            sampling_rate=c3d_metadata["sampling_rate"],
            duration_seconds=c3d_metadata["duration_seconds"],
            frame_count=c3d_metadata["frame_count"]
        )
        
        # Cache the analysis results
        # Note: processing_result has keys "analytics", not "analysis"
        await cache_service.cache_analysis_results(
            c3d_metadata_id=metadata_id,
            file_hash=file_hash,
            analysis_result=processing_result.get("analytics", {}),
            processing_params=processing_result.get("params", {}),
            processing_time_ms=processing_result.get("processing_time_ms", 0)
        )
        
        # Update status to completed
        await metadata_service.update_processing_status(
            metadata_id=metadata_id,
            status="completed"
        )
        
        logger.info(f"Successfully processed C3D file: {object_path}")
        
    except Exception as e:
        logger.error(f"Error in background processing: {str(e)}", exc_info=True)
        
        # Update status to failed
        await metadata_service.update_processing_status(
            metadata_id=metadata_id,
            status="failed",
            error_message=str(e)
        )


async def process_c3d_file_enhanced(
    metadata_id: UUID,
    bucket: str,
    object_path: str,
    file_hash: str,
    session_id: Optional[str] = None
) -> None:
    """
    Enhanced background task to process C3D file with complete database population
    
    Uses the enhanced webhook service to populate:
    - processing_parameters table
    - Enhanced schema fields for performance scoring
    - Future C3D data extraction (RPE, BFR, game data)
    
    Args:
        metadata_id: Database ID for metadata entry
        bucket: Storage bucket name
        object_path: Path to file in bucket
        file_hash: SHA-256 hash of file content
        session_id: Optional session ID for therapy session
    """
    try:
        # Initialize enhanced services
        enhanced_webhook_service = EnhancedWebhookService()
        metadata_service = MetadataService()
        cache_service = CacheService()
        
        logger.info(f"🎯 Enhanced C3D processing started: {object_path}")
        
        # Update status to processing
        await metadata_service.update_processing_status(
            metadata_id=metadata_id,
            status="processing"
        )
        
        # Process with enhanced webhook service (populates all database tables)
        enhanced_result = await enhanced_webhook_service.process_c3d_upload_event(
            bucket=bucket,
            object_path=object_path,
            session_id=session_id
        )
        
        if "error" in enhanced_result:
            raise Exception(f"Enhanced processing failed: {enhanced_result['error']}")
        
        # Extract results
        processing_result = enhanced_result["processing_result"]
        database_ids = enhanced_result["database_ids"]
        scoring_result = enhanced_result["scoring_result"]
        
        # Extract C3D metadata for legacy compatibility
        c3d_metadata = await metadata_service.extract_c3d_metadata(
            file_data=processing_result["file_data"]
        )
        
        # Update metadata service with extracted information (legacy compatibility)
        await metadata_service.update_metadata(
            metadata_id=metadata_id,
            channel_names=c3d_metadata["channel_names"],
            channel_count=c3d_metadata["channel_count"],
            sampling_rate=c3d_metadata["sampling_rate"],
            duration_seconds=c3d_metadata["duration_seconds"],
            frame_count=c3d_metadata["frame_count"]
        )
        
        # Cache the enhanced analysis results
        await cache_service.cache_analysis_results(
            c3d_metadata_id=metadata_id,
            file_hash=file_hash,
            analysis_result=processing_result.get("analytics", {}),
            processing_params=processing_result.get("params", {}),
            processing_time_ms=processing_result.get("processing_time_ms", 0)
        )
        
        # Update status to completed with enhanced data
        await metadata_service.update_processing_status(
            metadata_id=metadata_id,
            status="completed",
            enhanced_session_id=database_ids.get("session_id")
        )
        
        logger.info(f"✅ Enhanced C3D processing completed successfully: {object_path}")
        logger.info(f"📊 Database populated - Session: {database_ids['session_id']}")
        logger.info(f"⭐ Performance scores calculated - Overall: {scoring_result.get('overall_score', 'pending RPE/game data')}%")
        
    except Exception as e:
        logger.error(f"❌ Error in enhanced background processing: {str(e)}", exc_info=True)
        
        # Update status to failed
        await metadata_service.update_processing_status(
            metadata_id=metadata_id,
            status="failed",
            error_message=f"Enhanced processing failed: {str(e)}"
        )


@router.post("/session/{session_id}/update-future-data")
async def update_future_data(
    session_id: str,
    rpe: Optional[int] = None,
    bfr_pressure_aop: Optional[float] = None,
    game_points_achieved: Optional[int] = None,
    game_points_max: Optional[int] = None
) -> JSONResponse:
    """
    Update session with future C3D data (RPE, BFR measurements, game scores)
    
    This endpoint allows manual updates of data that will be extracted from
    future enhanced C3D files or provided by therapists/patients.
    
    Args:
        session_id: Therapy session UUID
        rpe: Rating of Perceived Exertion (0-10 Borg CR10 scale)
        bfr_pressure_aop: BFR pressure as percentage of AOP (45-55% safe range)
        game_points_achieved: Points achieved in GHOSTLY game
        game_points_max: Maximum possible points for game session
    """
    try:
        enhanced_webhook_service = EnhancedWebhookService()
        
        # Prepare data dictionaries
        bfr_data = {"pressure_aop": bfr_pressure_aop} if bfr_pressure_aop is not None else None
        game_data = {
            "points_achieved": game_points_achieved,
            "points_max": game_points_max
        } if game_points_achieved is not None or game_points_max is not None else None
        
        # Update future data and recalculate scores
        result = await enhanced_webhook_service.update_future_data(
            session_id=session_id,
            rpe=rpe,
            bfr_data=bfr_data,
            game_data=game_data
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Future data updated and scores recalculated",
                "session_id": session_id,
                "updated_fields": result["updated_fields"],
                "new_scores": result["scoring_result"]
            }
        )
        
    except Exception as e:
        logger.error(f"Error updating future data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")


@router.get("/storage/status/{processing_id}")
async def get_processing_status(processing_id: str) -> Dict:
    """
    Get the processing status for a C3D file
    
    Args:
        processing_id: UUID of the metadata entry
        
    Returns:
        Processing status and results if available
    """
    try:
        # Validate UUID format first
        try:
            processing_uuid = UUID(processing_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid processing ID format")
        
        metadata_service = MetadataService()
        cache_service = CacheService()
        
        # Get metadata
        metadata = await metadata_service.get_by_id(processing_uuid)
        
        if not metadata:
            raise HTTPException(status_code=404, detail="Processing ID not found")
        
        response = {
            "processing_id": processing_id,
            "status": metadata["processing_status"],
            "file_path": metadata["file_path"],
            "created_at": metadata["created_at"],
            "processed_at": metadata["processed_at"]
        }
        
        # If completed, include analysis results
        if metadata["processing_status"] == "completed":
            cached_results = await cache_service.get_cached_analysis(
                file_hash=metadata["file_hash"],
                processing_version=settings.PROCESSING_VERSION
            )
            
            if cached_results:
                response["analysis_results"] = cached_results["analytics_data"]
                response["compliance_scores"] = cached_results["compliance_scores"]
        
        elif metadata["processing_status"] == "failed":
            response["error_message"] = metadata["error_message"]
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error getting processing status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")