---
sidebar_position: 2
title: API Design
---

# API Design Patterns

The FastAPI backend implements clean API design patterns with dependency injection, dual processing modes, and comprehensive error handling.

## Architecture Overview

> To Do : ADD REST INTERFACE OF SUPABASE CLIENT !

### API Layer Responsibilities

The API layer focuses on HTTP concerns and delegates business logic to services:

```python
# API Layer (Thin)
@router.post("/sessions")
async def create_session(
    session_data: SessionCreateRequest,
    user_id: str = Depends(get_current_user),
    service: TherapySessionService = Depends(get_therapy_session_service)
):
    """HTTP request/response handling only"""
    try:
        session_id = service.create_session(session_data.dict(), user_id)
        return SessionCreateResponse(session_id=session_id)
    except ValidationError as e:
        raise HTTPException(400, str(e))
    except ServiceError as e:
        raise HTTPException(500, str(e))

# Service Layer (Business Logic)
class TherapySessionService:
    def create_session(self, session_data: dict, user_id: str) -> str:
        """Business logic and validation"""
        # Validate patient access
        # Create session record
        # Initialize processing state
        return session_id
```

### Dual Processing Architecture

The system supports two distinct processing patterns based on use case:

## Stateless Processing Route

**File**: `api/routes/upload.py` (194 lines)

**Purpose**: Immediate EMG analysis without database persistence

```python
@router.post("/upload")
async def upload_c3d_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user)
):
    """
    Stateless C3D processing for testing and preview workflows.
    Returns complete EMG signals and analytics in HTTP response.
    """
    
    # 1. Validate file format and size
    if not file.filename.endswith('.c3d'):
        raise HTTPException(400, "Invalid file format")
    
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")
    
    # 2. Save to temporary location
    temp_path = f"/tmp/{uuid4()}.c3d"
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    try:
        # 3. Process with full signal data
        processor = GHOSTLYC3DProcessor()
        result = processor.process_c3d_file(
            temp_path, 
            include_signals=True  # Full data for immediate return
        )
        
        # 4. Return comprehensive analysis
        return UploadResponse(
            session_metadata=result.metadata,
            emg_signals=result.signals,
            contractions=result.contractions,
            performance_metrics=result.performance_scores,
            processing_parameters=result.processing_params
        )
        
    finally:
        # 5. Cleanup temporary file
        os.unlink(temp_path)
```

**Use Cases**:
- Testing and validation workflows
- Preview analysis before committing to patient record
- Research analysis without patient data persistence
- API testing and development

## Stateful Processing Route

**File**: `api/routes/webhooks.py` (349 lines)

**Purpose**: Production workflow with complete database persistence

```python
@router.post("/webhooks/storage/c3d-upload")
async def handle_c3d_upload(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Webhook handler for Supabase Storage events.
    Processes C3D files with full session lifecycle management.
    """
    
    # 1. Verify HMAC signature
    signature = request.headers.get("webhook-signature")
    if not verify_webhook_signature(signature, await request.body()):
        raise HTTPException(401, "Invalid webhook signature")
    
    # 2. Extract event data
    event_data = await request.json()
    file_path = event_data["Record"]["s3"]["object"]["key"]
    bucket_name = event_data["Record"]["s3"]["bucket"]["name"]
    
    # 3. Extract patient code from filename
    patient_code = extract_patient_code(file_path)
    if not patient_code:
        logger.warning("No patient code found", file_path=file_path)
        return {"status": "ignored"}
    
    # 4. Process in background
    background_tasks.add_task(
        process_c3d_file_workflow,
        file_path=file_path,
        bucket_name=bucket_name,
        patient_code=patient_code
    )
    
    return {"status": "processing", "file_path": file_path}
```

## Dependency Injection Patterns

### Service Composition

Clean dependency injection enables testable and modular services:

```python
# Repository dependencies
def get_supabase_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_therapy_session_repository(
    client: Client = Depends(get_supabase_client)
) -> TherapySessionRepositoryInterface:
    return SupabaseTherapySessionRepository(client)

# Service dependencies
def get_therapy_session_service(
    session_repo: TherapySessionRepositoryInterface = Depends(get_therapy_session_repository),
    patient_repo: PatientRepositoryInterface = Depends(get_patient_repository)
) -> TherapySessionService:
    return TherapySessionService(session_repo, patient_repo)
```

### Authentication Dependencies

Simplified JWT validation that delegates authorization to RLS:

```python
async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    Validates JWT token and extracts user ID.
    
    Note: This function ONLY validates tokens. All authorization
    is handled by Row Level Security policies in the database.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token: missing user ID")
        return user_id
    except JWTError as e:
        logger.warning("jwt_validation_failed", error=str(e))
        raise HTTPException(401, "Token validation failed")
```

## Request/Response Patterns

### Pydantic Models

Comprehensive data validation and serialization:

```python
# Request models
class SessionCreateRequest(BaseModel):
    patient_code: str = Field(..., min_length=1, max_length=50)
    session_type: str = Field(..., regex="^(baseline|therapy|assessment)$")
    notes: Optional[str] = Field(None, max_length=1000)
    
    @validator('patient_code')
    def validate_patient_code(cls, v):
        if not re.match(r'^[A-Z0-9]{3,10}$', v):
            raise ValueError('Invalid patient code format')
        return v

# Response models  
class EMGAnalysisResponse(BaseModel):
    session_metadata: SessionMetadata
    performance_metrics: PerformanceMetrics
    contractions: List[ContractionData]
    processing_parameters: ProcessingParameters
    
    # Optional full signal data (stateless mode only)
    emg_signals: Optional[Dict[str, List[float]]] = None
```

### Error Response Standards

Consistent error handling across all endpoints:

```python
class APIError(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime
    request_id: str

@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content=APIError(
            error_code="VALIDATION_ERROR",
            message="Request validation failed",
            details={"validation_errors": exc.errors()},
            timestamp=datetime.utcnow(),
            request_id=str(uuid4())
        ).dict()
    )
```

## Performance Patterns

### Background Processing

```python
@router.post("/sessions/{session_id}/reprocess")
async def reprocess_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    options: ReprocessingOptions = ReprocessingOptions()
):
    """Trigger background reprocessing with updated parameters"""
    
    # Validate session exists and user has access
    session = get_session_or_404(session_id)
    
    # Queue background processing
    background_tasks.add_task(
        reprocess_session_workflow,
        session_id=session_id,
        processing_options=options.dict()
    )
    
    return {"status": "queued", "session_id": session_id}
```

## Next Steps

- [Database Integration](./database-integration) - Supabase client patterns and RLS
- [Testing Strategy](./testing-strategy) - Comprehensive testing approaches
- [Webhooks Processing](./webhooks-processing) - Background processing patterns
- [Performance Optimization](./caching-redis) - Redis caching and optimization