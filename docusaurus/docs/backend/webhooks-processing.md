---
sidebar_position: 6
title: Webhooks Processing
---

# Background Webhooks Processing

The backend implements comprehensive webhook processing for Supabase Storage events, enabling automated C3D file processing with complete session lifecycle management.

## Webhook Architecture Overview

### Event-Driven Processing Flow

```
Supabase Storage Event → Webhook Validation → Background Processing → Database Updates
        ↓                      ↓                        ↓                    ↓
   C3D File Upload    →   HMAC Signature    →    EMG Analysis     →   Session Complete
   Patient Upload     →   Event Extraction   →    File Processing  →   Results Stored
   Bulk Operations    →   Security Check     →    Status Updates   →   Cache Updated
```

**Key Components**:
- **Webhook Receiver**: FastAPI endpoint for Supabase Storage events
- **Background Processor**: Async task queue for C3D file processing
- **Session Orchestrator**: Complete workflow management
- **Security Layer**: HMAC signature validation and event verification

### Dual Processing Architecture Integration

The webhooks system integrates with both processing modes:

- **Stateless Mode** (`/upload`): Direct HTTP response with full analysis
- **Stateful Mode** (`/webhooks`): Background processing with database persistence

## Webhook Endpoint Implementation

### Security-First Webhook Receiver

```python
# api/routes/webhooks.py
import hmac
import hashlib
from fastapi import Request, HTTPException, BackgroundTasks

@router.post("/webhooks/storage/c3d-upload")
async def handle_c3d_upload_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Webhook handler for Supabase Storage C3D file upload events.
    
    Security: HMAC signature validation
    Processing: Background task queue
    Workflow: Complete session lifecycle management
    """
    
    # 1. Security: Verify HMAC signature
    signature = request.headers.get("webhook-signature")
    if not signature:
        logger.warning("webhook_missing_signature")
        raise HTTPException(401, "Missing webhook signature")
    
    request_body = await request.body()
    
    if not verify_webhook_signature(signature, request_body):
        logger.warning(
            "webhook_invalid_signature",
            signature_provided=bool(signature),
            body_length=len(request_body)
        )
        raise HTTPException(401, "Invalid webhook signature")
    
    # 2. Parse event data
    try:
        event_data = await request.json()
        
        # Extract S3-style event structure
        records = event_data.get("Records", [])
        if not records:
            logger.warning("webhook_no_records", event_data=event_data)
            return {"status": "ignored", "reason": "no_records"}
        
        record = records[0]  # Process first record
        s3_data = record.get("s3", {})
        
        file_path = s3_data.get("object", {}).get("key")
        bucket_name = s3_data.get("bucket", {}).get("name")
        event_name = record.get("eventName")
        
        if not file_path:
            logger.warning("webhook_no_file_path", record=record)
            return {"status": "ignored", "reason": "no_file_path"}
            
    except Exception as e:
        logger.error(
            "webhook_parse_error",
            error=str(e),
            body_preview=request_body[:200]
        )
        raise HTTPException(400, "Invalid webhook payload")
    
    # 3. Extract patient code from filename
    patient_code = extract_patient_code_from_filename(file_path)
    if not patient_code:
        logger.info(
            "webhook_no_patient_code",
            file_path=file_path,
            event_name=event_name
        )
        return {"status": "ignored", "reason": "no_patient_code"}
    
    # 4. Queue background processing
    background_tasks.add_task(
        process_c3d_file_background_workflow,
        file_path=file_path,
        bucket_name=bucket_name,
        patient_code=patient_code,
        event_name=event_name
    )
    
    logger.info(
        "webhook_processing_queued",
        file_path=file_path,
        patient_code=patient_code,
        bucket_name=bucket_name
    )
    
    return {
        "status": "processing",
        "file_path": file_path,
        "patient_code": patient_code
    }
```

### HMAC Signature Validation

```python
def verify_webhook_signature(signature: str, payload: bytes) -> bool:
    """
    Verify Supabase webhook HMAC signature for security.
    
    Supabase webhook signatures use HMAC-SHA256 with base64 encoding.
    """
    try:
        # Extract signature from header (format: "sha256=<signature>")
        if not signature.startswith("sha256="):
            return False
        
        provided_signature = signature[7:]  # Remove "sha256=" prefix
        
        # Calculate expected signature
        expected_signature = hmac.new(
            settings.SUPABASE_WEBHOOK_SECRET.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # Secure comparison to prevent timing attacks
        return hmac.compare_digest(provided_signature, expected_signature)
        
    except Exception as e:
        logger.error(
            "webhook_signature_verification_error",
            error=str(e),
            signature_format=signature[:20] if signature else None
        )
        return False

def extract_patient_code_from_filename(file_path: str) -> Optional[str]:
    """
    Extract patient code from C3D filename using convention patterns.
    
    Expected patterns:
    - GHOST001_session_01.c3d → GHOST001
    - patient_GHOST002_baseline.c3d → GHOST002
    - GHOST003.c3d → GHOST003
    """
    filename = file_path.split("/")[-1]  # Get filename from path
    
    # Pattern 1: Patient code at start
    match = re.match(r'^([A-Z]+\d+)_.*\.c3d$', filename, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    
    # Pattern 2: Patient code after "patient_"
    match = re.search(r'patient_([A-Z]+\d+)_.*\.c3d$', filename, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    
    # Pattern 3: Patient code as entire filename
    match = re.match(r'^([A-Z]+\d+)\.c3d$', filename, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    
    logger.warning(
        "patient_code_extraction_failed",
        filename=filename,
        file_path=file_path
    )
    return None
```

## Background Processing Workflow

### Complete Session Lifecycle Management

```python
async def process_c3d_file_background_workflow(
    file_path: str,
    bucket_name: str,
    patient_code: str,
    event_name: str = "ObjectCreated"
):
    """
    Complete background workflow for C3D file processing.
    
    Workflow Steps:
    1. Create therapy session record
    2. Download C3D file from Supabase Storage
    3. Process EMG data using GHOSTLYC3DProcessor
    4. Populate database tables with results
    5. Update session status and cache
    """
    
    session_id = None
    temp_file_path = None
    
    try:
        # Step 1: Create therapy session record
        logger.info(
            "background_workflow_started",
            file_path=file_path,
            patient_code=patient_code,
            bucket_name=bucket_name
        )
        
        session_service = get_therapy_session_service()
        
        session_data = {
            "patient_code": patient_code,
            "session_type": determine_session_type_from_filename(file_path),
            "status": "processing",
            "c3d_file_path": file_path,
            "created_at": datetime.utcnow().isoformat()
        }
        
        session_id = session_service.create_session(session_data)
        
        logger.info(
            "session_created",
            session_id=session_id,
            patient_code=patient_code
        )
        
        # Step 2: Download C3D file from Supabase Storage
        storage_service = get_supabase_storage_service()
        temp_file_path = await download_c3d_file_from_storage(
            storage_service,
            bucket_name,
            file_path
        )
        
        # Step 3: Process EMG data
        processor = GHOSTLYC3DProcessor()
        processing_start = datetime.utcnow()
        
        processing_result = processor.process_c3d_file(
            temp_file_path,
            include_signals=False  # Don't store raw signals in database
        )
        
        processing_duration = (datetime.utcnow() - processing_start).total_seconds()
        
        logger.info(
            "emg_processing_completed",
            session_id=session_id,
            processing_duration=processing_duration,
            contractions_detected=len(processing_result.contractions),
            mvc_source=processing_result.metadata.mvc_source
        )
        
        # Step 4: Populate database with results
        await populate_session_analysis_results(
            session_id,
            processing_result,
            session_service
        )
        
        # Step 5: Update session status to completed
        session_service.update_session_status(session_id, "completed")
        
        # Step 6: Update cache with results
        cache_service = get_emg_cache_service()
        cache_service.cache_session_analysis(
            session_id,
            processing_result.to_dict()
        )
        
        logger.info(
            "background_workflow_completed",
            session_id=session_id,
            patient_code=patient_code,
            total_duration=processing_duration
        )
        
    except Exception as e:
        logger.error(
            "background_workflow_failed",
            session_id=session_id,
            patient_code=patient_code,
            file_path=file_path,
            error=str(e),
            error_type=type(e).__name__
        )
        
        # Update session status to failed
        if session_id:
            try:
                session_service.update_session_status(session_id, "failed")
                session_service.update_session_error(session_id, str(e))
            except Exception as update_error:
                logger.error(
                    "session_status_update_failed",
                    session_id=session_id,
                    update_error=str(update_error)
                )
        
        # Don't re-raise - this is background processing
        
    finally:
        # Cleanup temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.debug(
                    "temp_file_cleaned",
                    temp_file_path=temp_file_path
                )
            except Exception as cleanup_error:
                logger.warning(
                    "temp_file_cleanup_failed",
                    temp_file_path=temp_file_path,
                    cleanup_error=str(cleanup_error)
                )
```

### Database Population Strategy

```python
async def populate_session_analysis_results(
    session_id: str,
    processing_result: ProcessedC3DData,
    session_service: TherapySessionService
):
    """
    Populate database tables with EMG analysis results.
    
    Tables Updated:
    - emg_contractions: Individual contraction data
    - performance_scores: Clinical performance metrics
    - session_metadata: Processing parameters and MVC values
    """
    
    try:
        # Populate EMG contractions (bulk insert)
        contraction_service = get_emg_contraction_service()
        
        contraction_data = [
            {
                "session_id": session_id,
                "muscle_channel": contraction.muscle_channel,
                "contraction_number": contraction.contraction_number,
                "start_time": contraction.start_time,
                "end_time": contraction.end_time,
                "duration": contraction.duration,
                "amplitude": contraction.amplitude,
                "mvc_percentage": contraction.mvc_percentage,
                "meets_duration_threshold": contraction.meets_duration_threshold,
                "meets_amplitude_threshold": contraction.meets_amplitude_threshold
            }
            for contraction in processing_result.contractions
        ]
        
        contraction_ids = contraction_service.create_contractions_bulk(contraction_data)
        
        logger.info(
            "contractions_stored",
            session_id=session_id,
            contraction_count=len(contraction_ids)
        )
        
        # Populate performance scores
        performance_service = get_performance_score_service()
        
        performance_data = {
            "session_id": session_id,
            "compliance_score": processing_result.performance_scores.compliance_score,
            "symmetry_score": processing_result.performance_scores.symmetry_score,
            "effort_score": processing_result.performance_scores.effort_score,
            "game_score": processing_result.performance_scores.game_score,
            "overall_score": processing_result.performance_scores.overall_score,
            "bfr_compliance": processing_result.performance_scores.bfr_compliance
        }
        
        performance_id = performance_service.create_performance_score(performance_data)
        
        logger.info(
            "performance_scores_stored",
            session_id=session_id,
            performance_id=performance_id,
            overall_score=performance_data["overall_score"]
        )
        
        # Update session metadata
        metadata_updates = {
            "session_duration": processing_result.metadata.session_duration,
            "channel_count": processing_result.metadata.channel_count,
            "mvc_ch1": processing_result.metadata.mvc_ch1,
            "mvc_ch2": processing_result.metadata.mvc_ch2,
            "mvc_source": processing_result.metadata.mvc_source,
            "processing_parameters": processing_result.processing_parameters.to_dict()
        }
        
        session_service.update_session_metadata(session_id, metadata_updates)
        
        logger.info(
            "session_metadata_updated",
            session_id=session_id,
            mvc_source=metadata_updates["mvc_source"]
        )
        
    except Exception as e:
        logger.error(
            "database_population_failed",
            session_id=session_id,
            error=str(e)
        )
        raise  # Re-raise to trigger workflow failure handling
```

## File Management and Storage

### Supabase Storage Integration

```python
class SupabaseStorageService:
    """Service for Supabase Storage operations"""
    
    def __init__(self, supabase_client: Client):
        self.client = supabase_client
        self.bucket_name = "c3d-examples"
    
    def download_file(self, file_path: str) -> bytes:
        """Download file from Supabase Storage"""
        try:
            response = self.client.storage.from_(self.bucket_name).download(file_path)
            
            if not response:
                raise StorageError(f"File not found: {file_path}")
            
            logger.info(
                "file_downloaded",
                file_path=file_path,
                file_size=len(response)
            )
            
            return response
            
        except Exception as e:
            logger.error(
                "file_download_failed",
                file_path=file_path,
                bucket=self.bucket_name,
                error=str(e)
            )
            raise StorageError(f"Download failed: {str(e)}")
    
    def upload_file(self, file_path: str, file_data: bytes) -> str:
        """Upload file to Supabase Storage"""
        try:
            response = self.client.storage.from_(self.bucket_name).upload(
                file_path,
                file_data,
                file_options={
                    "content_type": "application/octet-stream",
                    "upsert": True
                }
            )
            
            if response.get("error"):
                raise StorageError(f"Upload error: {response['error']}")
            
            logger.info(
                "file_uploaded",
                file_path=file_path,
                file_size=len(file_data)
            )
            
            return response.get("Key", file_path)
            
        except Exception as e:
            logger.error(
                "file_upload_failed",
                file_path=file_path,
                bucket=self.bucket_name,
                error=str(e)
            )
            raise StorageError(f"Upload failed: {str(e)}")

async def download_c3d_file_from_storage(
    storage_service: SupabaseStorageService,
    bucket_name: str,
    file_path: str
) -> str:
    """Download C3D file to temporary location"""
    
    # Create temporary file
    temp_fd, temp_file_path = tempfile.mkstemp(suffix=".c3d", prefix="emg_processing_")
    
    try:
        # Download file data
        file_data = storage_service.download_file(file_path)
        
        # Write to temporary file
        with os.fdopen(temp_fd, 'wb') as temp_file:
            temp_file.write(file_data)
        
        logger.info(
            "temp_file_created",
            temp_path=temp_file_path,
            original_path=file_path,
            file_size=len(file_data)
        )
        
        return temp_file_path
        
    except Exception as e:
        # Cleanup on failure
        try:
            os.close(temp_fd)
            os.unlink(temp_file_path)
        except:
            pass
        
        logger.error(
            "temp_file_creation_failed",
            file_path=file_path,
            error=str(e)
        )
        raise
```

## Error Handling and Recovery

### Comprehensive Error Management

```python
class WebhookProcessingError(Exception):
    """Base exception for webhook processing errors"""
    pass

class StorageError(WebhookProcessingError):
    """Storage operation errors"""
    pass

class ProcessingError(WebhookProcessingError):
    """EMG processing errors"""
    pass

class DatabaseError(WebhookProcessingError):
    """Database operation errors"""
    pass

def handle_webhook_processing_error(
    error: Exception,
    session_id: Optional[str],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Centralized error handling for webhook processing.
    
    Error Recovery Strategies:
    - Temporary failures → Retry with exponential backoff
    - Invalid data → Log and skip processing
    - Storage errors → Mark session as failed, notify admin
    - Processing errors → Save partial results, mark as failed
    """
    
    error_info = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "session_id": session_id,
        "context": context,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Determine error category and recovery strategy
    if isinstance(error, StorageError):
        # Storage errors - file access issues
        recovery_strategy = "retry_with_delay"
        error_info["category"] = "storage"
        error_info["retry_recommended"] = True
        
    elif isinstance(error, ProcessingError):
        # EMG processing errors - data quality issues
        recovery_strategy = "mark_failed_continue"
        error_info["category"] = "processing"
        error_info["retry_recommended"] = False
        
    elif isinstance(error, DatabaseError):
        # Database errors - connection or constraint issues
        recovery_strategy = "retry_with_exponential_backoff"
        error_info["category"] = "database"
        error_info["retry_recommended"] = True
        
    else:
        # Unknown errors
        recovery_strategy = "log_and_continue"
        error_info["category"] = "unknown"
        error_info["retry_recommended"] = False
    
    # Log error with structured data
    logger.error(
        "webhook_processing_error",
        **error_info,
        recovery_strategy=recovery_strategy
    )
    
    # Execute recovery strategy
    if recovery_strategy == "retry_with_delay" and session_id:
        # Schedule retry for temporary failures
        schedule_webhook_retry(session_id, context, delay_seconds=60)
    
    elif recovery_strategy == "mark_failed_continue" and session_id:
        # Mark session as failed but don't retry
        try:
            session_service = get_therapy_session_service()
            session_service.update_session_status(session_id, "failed")
            session_service.update_session_error(session_id, str(error))
        except Exception as update_error:
            logger.error(
                "session_error_update_failed",
                session_id=session_id,
                update_error=str(update_error)
            )
    
    return error_info
```

### Retry Mechanisms

```python
import asyncio
from typing import Callable, Any

async def retry_with_exponential_backoff(
    operation: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    *args,
    **kwargs
) -> Any:
    """
    Retry operation with exponential backoff.
    
    Retry Strategy:
    - Attempt 1: Immediate
    - Attempt 2: 1 second delay
    - Attempt 3: 2 second delay
    - Attempt 4: 4 second delay (up to max_delay)
    """
    
    for attempt in range(max_retries + 1):
        try:
            if asyncio.iscoroutinefunction(operation):
                result = await operation(*args, **kwargs)
            else:
                result = operation(*args, **kwargs)
            
            if attempt > 0:
                logger.info(
                    "retry_succeeded",
                    operation=operation.__name__,
                    attempt=attempt,
                    total_attempts=attempt + 1
                )
            
            return result
            
        except Exception as e:
            if attempt == max_retries:
                logger.error(
                    "retry_exhausted",
                    operation=operation.__name__,
                    total_attempts=attempt + 1,
                    final_error=str(e)
                )
                raise
            
            # Calculate delay with exponential backoff
            delay = min(base_delay * (2 ** attempt), max_delay)
            
            logger.warning(
                "retry_attempt_failed",
                operation=operation.__name__,
                attempt=attempt + 1,
                error=str(e),
                next_delay=delay
            )
            
            await asyncio.sleep(delay)

def schedule_webhook_retry(
    session_id: str, 
    context: Dict[str, Any], 
    delay_seconds: int = 60
):
    """Schedule webhook processing retry"""
    # In production, this would use a proper task queue like Celery or RQ
    # For now, we'll use a simple in-memory scheduler
    
    retry_data = {
        "session_id": session_id,
        "context": context,
        "scheduled_at": datetime.utcnow().isoformat(),
        "retry_count": context.get("retry_count", 0) + 1
    }
    
    logger.info(
        "webhook_retry_scheduled",
        session_id=session_id,
        delay_seconds=delay_seconds,
        retry_count=retry_data["retry_count"]
    )
    
    # Store retry information for manual processing if needed
    # In production, this would be handled by the task queue
```

## Testing Webhook Processing

### Webhook Testing Strategies

```python
class TestWebhookProcessing:
    """Comprehensive webhook processing tests"""
    
    @pytest.fixture
    def mock_webhook_payload(self):
        """Mock Supabase Storage webhook payload"""
        return {
            "Records": [
                {
                    "eventName": "ObjectCreated:Put",
                    "s3": {
                        "bucket": {"name": "c3d-examples"},
                        "object": {"key": "uploads/GHOST001_session_01.c3d"}
                    }
                }
            ]
        }
    
    @pytest.fixture
    def valid_hmac_signature(self, mock_webhook_payload):
        """Generate valid HMAC signature for testing"""
        payload_bytes = json.dumps(mock_webhook_payload).encode('utf-8')
        signature = hmac.new(
            "test-webhook-secret".encode('utf-8'),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"
    
    def test_webhook_security_valid_signature(
        self, 
        client, 
        mock_webhook_payload, 
        valid_hmac_signature
    ):
        """Test webhook with valid HMAC signature"""
        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=mock_webhook_payload,
            headers={"webhook-signature": valid_hmac_signature}
        )
        
        assert response.status_code == 200
        assert response.json()["status"] == "processing"
    
    def test_webhook_security_invalid_signature(self, client, mock_webhook_payload):
        """Test webhook with invalid HMAC signature"""
        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=mock_webhook_payload,
            headers={"webhook-signature": "sha256=invalid_signature"}
        )
        
        assert response.status_code == 401
        assert "Invalid webhook signature" in response.json()["detail"]
    
    def test_webhook_missing_signature(self, client, mock_webhook_payload):
        """Test webhook without signature header"""
        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=mock_webhook_payload
        )
        
        assert response.status_code == 401
        assert "Missing webhook signature" in response.json()["detail"]
    
    @patch('api.routes.webhooks.process_c3d_file_background_workflow')
    def test_background_processing_queued(
        self, 
        mock_background_task,
        client, 
        mock_webhook_payload, 
        valid_hmac_signature
    ):
        """Test that background processing is queued"""
        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=mock_webhook_payload,
            headers={"webhook-signature": valid_hmac_signature}
        )
        
        assert response.status_code == 200
        mock_background_task.assert_called_once()
        
        # Verify call arguments
        call_args = mock_background_task.call_args
        assert call_args.kwargs["file_path"] == "uploads/GHOST001_session_01.c3d"
        assert call_args.kwargs["patient_code"] == "GHOST001"
```

## Production Deployment Considerations

### Webhook Configuration in Supabase

```sql
-- Create webhook configuration in Supabase
-- This is configured in the Supabase Dashboard under Storage > Settings > Webhooks

Webhook URL: https://your-domain.com/webhooks/storage/c3d-upload
Events: storage.objects.create, storage.objects.update
Filters: 
  - Bucket: c3d-examples
  - Path pattern: *.c3d

HMAC Secret: [Your secure webhook secret]
HTTP Headers:
  - Content-Type: application/json
  - webhook-signature: [Auto-generated HMAC signature]
```

### Monitoring and Observability

```python
class WebhookMetricsService:
    """Monitor webhook processing performance"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
    
    def record_webhook_event(
        self, 
        event_type: str, 
        status: str, 
        processing_duration: Optional[float] = None
    ):
        """Record webhook processing metrics"""
        timestamp = datetime.utcnow()
        
        # Increment counters
        daily_key = f"webhook_events:{timestamp.strftime('%Y-%m-%d')}"
        hourly_key = f"webhook_events:{timestamp.strftime('%Y-%m-%d:%H')}"
        
        pipeline = self.redis.pipeline()
        pipeline.hincrby(daily_key, f"{event_type}:{status}", 1)
        pipeline.hincrby(hourly_key, f"{event_type}:{status}", 1)
        pipeline.expire(daily_key, 86400 * 7)  # Keep for 7 days
        pipeline.expire(hourly_key, 86400)     # Keep for 1 day
        
        # Record processing time if provided
        if processing_duration is not None:
            duration_key = f"webhook_duration:{timestamp.strftime('%Y-%m-%d')}"
            pipeline.lpush(duration_key, processing_duration)
            pipeline.ltrim(duration_key, 0, 999)  # Keep last 1000 durations
            pipeline.expire(duration_key, 86400)
        
        pipeline.execute()
    
    def get_webhook_statistics(self, date: Optional[str] = None) -> Dict[str, Any]:
        """Get webhook processing statistics"""
        if date is None:
            date = datetime.utcnow().strftime('%Y-%m-%d')
        
        daily_key = f"webhook_events:{date}"
        duration_key = f"webhook_duration:{date}"
        
        events = self.redis.hgetall(daily_key)
        durations = [float(d) for d in self.redis.lrange(duration_key, 0, -1)]
        
        return {
            "date": date,
            "events": events,
            "processing_times": {
                "count": len(durations),
                "average": sum(durations) / len(durations) if durations else 0,
                "min": min(durations) if durations else 0,
                "max": max(durations) if durations else 0
            }
        }
```

## Next Steps

- [Deployment Patterns](./deployment) - Production deployment with webhook monitoring
- [Caching with Redis](./caching-redis) - Cache integration with background processing
- [Testing Strategy](./testing-strategy) - Webhook testing patterns and E2E validation
- [API Design](./api-design) - Integration with stateless processing modes