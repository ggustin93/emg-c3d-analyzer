---
sidebar_position: 1
title: Backend Overview
---

# Backend Architecture

The EMG C3D Analyzer backend implements Domain-Driven Design (DDD) principles with a synchronous architecture for reliable EMG processing and clinical data management.

## Architecture Principles

### Domain-Driven Design (DDD)

The backend organizes services around business domains rather than technical layers:

```
backend/services/
├── analysis/       # EMG analysis algorithms and metrics
├── c3d/           # C3D file processing and metadata extraction  
├── cache/         # Redis caching and performance optimization
├── clinical/      # Healthcare workflows and therapy sessions
├── data/          # Export services and metadata management
├── infrastructure/ # Cross-cutting concerns (logging, monitoring)
├── patient/       # Patient management and profile data
├── shared/        # Common utilities and base classes
└── user/          # User management and authentication
```

**Domain Responsibilities**:
- **Analysis Domain**: EMG signal processing, statistical calculations, contraction detection
- **Clinical Domain**: Therapy session lifecycle, patient-therapist relationships, clinical workflows  
- **C3D Domain**: File parsing, metadata extraction, channel mapping, format conversion
- **Data Domain**: CSV export, report generation, metadata aggregation
- **User Domain**: Authentication, authorization, profile management, role-based access

### Repository Pattern

Clean separation between business logic and data access:

```python
# Abstract repository interfaces define data operations
class TherapySessionRepositoryInterface(ABC):
    @abstractmethod
    def create_session(self, session_data: dict) -> str:
        pass
    
    @abstractmethod  
    def get_session_by_id(self, session_id: str) -> dict:
        pass

# Concrete implementations handle Supabase client operations
class SupabaseTherapySessionRepository(TherapySessionRepositoryInterface):
    def __init__(self, client: Client):
        self.client = client
        
    def create_session(self, session_data: dict) -> str:
        response = self.client.table('therapy_sessions').insert(session_data).execute()
        return response.data[0]['id']
```

**Benefits**:
- Services depend on repository interfaces, not concrete implementations
- Enables easy testing with mock repositories
- Maintains clean boundaries between business logic and data access
- Supports multiple database implementations

### Synchronous Architecture

**Critical Design Decision**: The backend uses **synchronous** operations throughout:

```python
# ✅ Correct: Synchronous Supabase client
from supabase import Client, create_client

# Create synchronous client
supabase: Client = create_client(url, key)

# All operations are synchronous
response = supabase.table('sessions').select('*').execute()
data = response.data
```

**Rationale**:
- **Simplicity**: Eliminates async/await complexity where not needed
- **Reliability**: Fewer concurrency-related bugs and easier debugging
- **Testing**: Simpler test patterns with standard mocking (never AsyncMock)
- **Performance**: Adequate for EMG processing workloads with connection pooling

**When Async is Used**:
- FastAPI endpoint handlers (framework requirement)
- Background tasks for webhook processing
- File I/O operations for large C3D files

### Dependency Injection

FastAPI's `Depends` system enables clean service composition:

```python
# Dependency injection setup
def get_therapy_session_repository() -> TherapySessionRepositoryInterface:
    client = get_supabase_client()
    return SupabaseTherapySessionRepository(client)

def get_therapy_session_service(
    repository: TherapySessionRepositoryInterface = Depends(get_therapy_session_repository)
) -> TherapySessionService:
    return TherapySessionService(repository)

# Usage in API routes
@router.post("/sessions")
async def create_session(
    session_data: SessionCreateRequest,
    service: TherapySessionService = Depends(get_therapy_session_service)
):
    session_id = service.create_session(session_data.dict())
    return {"session_id": session_id}
```

## Core Components

### 1. EMG Processing Engine (`processor.py` - 1,341 lines)

**Single Source of Truth** for all EMG analysis:

```python
class GHOSTLYC3DProcessor:
    """
    Authoritative EMG analysis engine implementing clinical algorithms
    for rehabilitation research workflows.
    """
    
    def process_c3d_file(
        self, 
        c3d_path: str, 
        include_signals: bool = False
    ) -> ProcessedC3DData:
        """
        Process C3D file with configurable output modes:
        - include_signals=True: Full signal data (stateless mode) 
        - include_signals=False: Analytics only (stateful mode)
        """
```

**Processing Pipeline**:
1. **C3D Parsing**: ezc3d integration with GHOSTLY-specific channel detection
2. **Signal Processing**: Butterworth filtering, envelope calculation, statistical analysis
3. **Contraction Detection**: MVC-based amplitude and duration thresholds  
4. **Clinical Metrics**: RMS, MAV, MPF, MDF, fatigue indices calculation
5. **Performance Scoring**: Therapeutic compliance and symmetry assessment

### 2. Therapy Session Orchestrator (`therapy_session_processor.py` - 1,669 lines)

**Workflow Management** for session lifecycle:

```python
class TherapySessionProcessor:
    """
    Orchestrates complete therapy session workflows from creation
    to EMG analysis to database population.
    """
    
    async def process_c3d_file(
        self, 
        session_id: str, 
        file_path: str
    ) -> SessionProcessingResult:
        """
        Complete processing workflow:
        1. Download C3D file from Supabase Storage
        2. Process EMG data using GHOSTLYC3DProcessor
        3. Populate all database tables with results
        4. Update session status and metadata
        """
```

**Key Responsibilities**:
- Session creation and state tracking
- File coordination with Supabase Storage
- EMG processing orchestration  
- Database population across multiple tables
- Error recovery and status management

### 3. Dual Processing Modes

The system supports two distinct processing patterns:

#### Stateless Mode (`upload.py` - 194 lines)
- **Purpose**: Immediate EMG analysis without database persistence
- **Use Cases**: Testing, preview, temporary analysis workflows
- **Features**: Returns complete EMG signals and analytics in HTTP response
- **Integration**: Direct calls to `GHOSTLYC3DProcessor.process_c3d_file(include_signals=True)`

#### Stateful Mode (`webhooks.py` - 349 lines)  
- **Purpose**: Production workflow with full database persistence
- **Use Cases**: Patient-therapist relationships, longitudinal tracking
- **Features**: Background processing, session lifecycle management
- **Integration**: Supabase Storage webhooks trigger complete workflow

## Performance Architecture

### Caching Strategy (Redis 7.2)

Structured caching for computed EMG results:

```python
# Session-based cache keys
cache_key = f"session:{session_id}:emg_analysis"
cache_key = f"session:{session_id}:performance_scores"
cache_key = f"patient:{patient_id}:mvc_values"

# Cache configuration
CACHE_TTL = 3600  # 1 hour for analysis results
MVC_CACHE_TTL = 86400  # 24 hours for MVC values
```

**Performance Benefits**:
- **Hit Rate**: 70%+ for repeated analysis requests
- **Latency**: 90% reduction in processing time for cached results
- **Memory**: Efficient with automatic expiration and cleanup

### Connection Management

Optimized database connections:

```python
# Connection pooling configuration
SUPABASE_POOL_SIZE = 10
SUPABASE_MAX_OVERFLOW = 20
SUPABASE_POOL_TIMEOUT = 30

# Prepared statement caching
QUERY_CACHE_SIZE = 100
QUERY_CACHE_TTL = 300
```

## Error Handling Patterns

### Graceful Degradation

```python
class EMGProcessingError(Exception):
    """Base exception for EMG processing failures"""
    pass

class C3DParsingError(EMGProcessingError):
    """C3D file parsing failures"""
    pass

class MVCDetectionError(EMGProcessingError):
    """MVC threshold detection failures"""
    pass

# Error recovery patterns
try:
    mvc_values = extract_mvc_from_metadata(c3d_file)
except MVCDetectionError:
    # Fallback to session-based calculation
    mvc_values = calculate_mvc_from_signals(emg_data)
```

### Comprehensive Logging

```python
import structlog

logger = structlog.get_logger(__name__)

# Structured logging for analysis workflows
logger.info(
    "emg_analysis_started",
    session_id=session_id,
    file_size=file_stats.size,
    duration=duration_seconds,
    channels=channel_count
)

logger.info(
    "emg_analysis_completed", 
    session_id=session_id,
    processing_time=processing_duration,
    contractions_detected=contraction_count,
    mvc_source=mvc_determination_source
)
```

## Testing Architecture

The backend maintains a **135-test suite** with comprehensive coverage:

- **Unit Tests** (11 tests): Core EMG algorithms and utilities
- **API Tests** (19 tests): Endpoint validation and error handling
- **Integration Tests** (3 tests): Service integration and workflow testing
- **E2E Tests** (3 tests): Complete workflow with real C3D files

**Key Testing Principles**:
- **Synchronous Mocking**: Always use `MagicMock`, never `AsyncMock` for Supabase client
- **Real Data Testing**: E2E tests use actual C3D files with known expected results
- **Error Scenario Coverage**: Comprehensive testing of failure modes and recovery

## Security Model

### Authentication Architecture

**Principle**: **Validation Only** - Backend validates JWTs but delegates authorization to RLS:

```python
# JWT validation dependency
async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    Validates JWT token and extracts user ID.
    Authorization handled by Row Level Security policies.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(401, "Token validation failed")
```

**Security Flow**:
1. **Frontend**: Supabase Auth SDK manages authentication
2. **API Layer**: FastAPI validates JWT tokens only  
3. **Database**: RLS policies enforce all authorization rules
4. **Result**: Defense in depth with minimal backend security logic

## Configuration Management

Centralized configuration with environment-based overrides:

```python
# config.py - 383 lines of EMG parameters and defaults
class Settings:
    # Clinical Protocol Parameters
    MVC_THRESHOLD_PERCENTAGE: float = 0.75
    CONTRACTION_MIN_DURATION: float = 2.0
    BFR_PRESSURE_MIN: float = 0.45
    BFR_PRESSURE_MAX: float = 0.55
    
    # Signal Processing Parameters  
    HIGH_PASS_CUTOFF: float = 20.0
    LOW_PASS_CUTOFF: float = 10.0
    RMS_WINDOW_SIZE: float = 0.05
    
    # Performance Scoring Weights
    COMPLIANCE_WEIGHT: float = 0.5
    SYMMETRY_WEIGHT: float = 0.25
    EFFORT_WEIGHT: float = 0.25
    GAME_WEIGHT: float = 0.0

settings = Settings()
```

## Next Steps

- [API Design](./api-design) - FastAPI patterns and endpoint design
- [Database Integration](./database-integration) - Supabase client and RLS patterns
- [Testing Strategy](./testing-strategy) - Comprehensive testing approaches
- [EMG Analysis](../clinical/metrics-definitions) - Clinical algorithms and formulas