---
sidebar_position: 3
title: Database Integration
---

# Database Integration Patterns

The backend implements comprehensive Supabase integration with Row Level Security (RLS) as the primary authorization model and repository patterns for clean data access.

## Architecture Overview

### Single Source of Truth

**Principle**: Database-driven authorization with backend validation only

```python
# Backend responsibility: JWT validation ONLY
async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    Validates JWT token and extracts user ID.
    Authorization is handled by Row Level Security policies.
    """
    payload = jwt.decode(token, settings.JWT_SECRET)
    return payload.get("sub")

# Database responsibility: ALL authorization via RLS
-- RLS policies enforce role-based access control
CREATE POLICY "Users can view their own therapy sessions"
ON therapy_sessions FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR therapist_id = auth.uid());
```

### Repository Pattern Implementation

Clean separation between business logic and data access:

```python
# Abstract interface defines data operations
class TherapySessionRepositoryInterface(ABC):
    @abstractmethod
    def create_session(self, session_data: dict) -> str:
        """Create new therapy session"""
        pass
    
    @abstractmethod
    def get_sessions_by_patient(self, patient_code: str) -> List[dict]:
        """Retrieve sessions for patient"""
        pass

# Concrete Supabase implementation
class SupabaseTherapySessionRepository(TherapySessionRepositoryInterface):
    def __init__(self, client: Client):
        self.client = client
        self.table = "therapy_sessions"
    
    def create_session(self, session_data: dict) -> str:
        response = (
            self.client
            .table(self.table)
            .insert(session_data)
            .execute()
        )
        return response.data[0]["id"]
    
    def get_sessions_by_patient(self, patient_code: str) -> List[dict]:
        response = (
            self.client
            .table(self.table)
            .select("*")
            .eq("patient_code", patient_code)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data
```

## Synchronous Client Architecture

**Critical Design Decision**: The backend uses **synchronous** Supabase client operations

### Client Configuration

```python
# config.py
from supabase import Client, create_client

def get_supabase_client() -> Client:
    """Create synchronous Supabase client"""
    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_SERVICE_KEY
    )

# NOT async - we use synchronous client
# ❌ Wrong: from supabase import acreate_client
# ✅ Correct: from supabase import create_client
```

**Rationale for Synchronous Architecture**:
- **Simplicity**: No async/await complexity in data layer
- **Reliability**: Easier debugging and error handling
- **Testing**: Standard mocking patterns (never AsyncMock)
- **Performance**: Adequate with connection pooling

### Repository Dependency Injection

```python
# dependencies.py
def get_supabase_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

def get_therapy_session_repository(
    client: Client = Depends(get_supabase_client)
) -> TherapySessionRepositoryInterface:
    return SupabaseTherapySessionRepository(client)

def get_patient_repository(
    client: Client = Depends(get_supabase_client)
) -> PatientRepositoryInterface:
    return SupabasePatientRepository(client)

# Service composition
def get_therapy_session_service(
    session_repo: TherapySessionRepositoryInterface = Depends(get_therapy_session_repository),
    patient_repo: PatientRepositoryInterface = Depends(get_patient_repository)
) -> TherapySessionService:
    return TherapySessionService(session_repo, patient_repo)
```

## Row Level Security (RLS) Architecture

### Authorization Strategy

**Principle**: Backend validates authentication, database enforces authorization

```sql
-- Enable RLS on all tables
ALTER TABLE therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE emg_contractions ENABLE ROW LEVEL SECURITY;

-- User role-based access policies
CREATE POLICY "Users access own data" ON therapy_sessions
FOR ALL TO authenticated
USING (
  user_id = auth.uid() OR 
  therapist_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM patients p 
    WHERE p.patient_code = therapy_sessions.patient_code 
    AND p.user_id = auth.uid()
  )
);

-- Admin role comprehensive access
CREATE POLICY "Admins access all data" ON therapy_sessions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  )
);
```

### Role Management

```sql
-- User roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('patient', 'therapist', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Role assignment policies
CREATE POLICY "Users can view their own roles" ON user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON user_roles
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);
```

## Database Schema Architecture

### Core Clinical Tables

```sql
-- Therapy sessions (main entity)
CREATE TABLE therapy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code TEXT NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('baseline', 'therapy', 'assessment')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  user_id UUID REFERENCES auth.users(id),
  therapist_id UUID REFERENCES auth.users(id),
  c3d_file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMG analysis results
CREATE TABLE emg_contractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES therapy_sessions(id) ON DELETE CASCADE,
  muscle_channel INTEGER NOT NULL,
  contraction_number INTEGER NOT NULL,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  duration FLOAT NOT NULL,
  amplitude FLOAT NOT NULL,
  mvc_percentage FLOAT,
  meets_duration_threshold BOOLEAN DEFAULT FALSE,
  meets_amplitude_threshold BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance metrics
CREATE TABLE performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES therapy_sessions(id) ON DELETE CASCADE,
  compliance_score FLOAT,
  symmetry_score FLOAT,
  effort_score FLOAT,
  game_score FLOAT,
  overall_score FLOAT,
  bfr_compliance BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexing Strategy

```sql
-- Performance-critical indexes
CREATE INDEX idx_therapy_sessions_patient_code ON therapy_sessions(patient_code);
CREATE INDEX idx_therapy_sessions_status ON therapy_sessions(status);
CREATE INDEX idx_therapy_sessions_created_at ON therapy_sessions(created_at DESC);

CREATE INDEX idx_emg_contractions_session_id ON emg_contractions(session_id);
CREATE INDEX idx_emg_contractions_muscle_channel ON emg_contractions(muscle_channel);

CREATE INDEX idx_performance_scores_session_id ON performance_scores(session_id);

-- Composite indexes for common queries
CREATE INDEX idx_therapy_sessions_user_status ON therapy_sessions(user_id, status);
CREATE INDEX idx_emg_contractions_session_muscle ON emg_contractions(session_id, muscle_channel);
```

## Data Access Patterns

### Repository Implementation Examples

```python
class SupabaseTherapySessionRepository(TherapySessionRepositoryInterface):
    
    def create_session(self, session_data: dict) -> str:
        """Create session with automatic timestamp handling"""
        session_data["created_at"] = datetime.utcnow().isoformat()
        session_data["updated_at"] = datetime.utcnow().isoformat()
        
        response = (
            self.client
            .table("therapy_sessions")
            .insert(session_data)
            .execute()
        )
        
        if not response.data:
            raise DatabaseError("Failed to create therapy session")
        
        return response.data[0]["id"]
    
    def update_session_status(self, session_id: str, status: str) -> bool:
        """Update session status with timestamp"""
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = (
            self.client
            .table("therapy_sessions")
            .update(update_data)
            .eq("id", session_id)
            .execute()
        )
        
        return len(response.data) > 0
    
    def get_sessions_by_patient_with_pagination(
        self, 
        patient_code: str, 
        limit: int = 20, 
        offset: int = 0
    ) -> List[dict]:
        """Paginated session retrieval"""
        response = (
            self.client
            .table("therapy_sessions")
            .select("*")
            .eq("patient_code", patient_code)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        
        return response.data
```

### Bulk Operations

```python
class SupabaseEMGContractionRepository(EMGContractionRepositoryInterface):
    
    def create_contractions_bulk(
        self, 
        session_id: str, 
        contractions: List[dict]
    ) -> List[str]:
        """Efficient bulk insertion for EMG data"""
        
        # Prepare data with session reference
        contraction_data = [
            {
                **contraction,
                "session_id": session_id,
                "created_at": datetime.utcnow().isoformat()
            }
            for contraction in contractions
        ]
        
        # Batch insert with chunking for large datasets
        chunk_size = 100
        created_ids = []
        
        for i in range(0, len(contraction_data), chunk_size):
            chunk = contraction_data[i:i + chunk_size]
            
            response = (
                self.client
                .table("emg_contractions")
                .insert(chunk)
                .execute()
            )
            
            created_ids.extend([row["id"] for row in response.data])
        
        return created_ids
```

## Error Handling and Resilience

### Database Exception Handling

```python
from supabase.exceptions import APIError

class DatabaseError(Exception):
    """Custom database operation exception"""
    pass

class SupabaseBaseRepository:
    """Base repository with common error handling"""
    
    def _handle_supabase_response(self, response, operation: str):
        """Standard response validation"""
        if hasattr(response, 'error') and response.error:
            logger.error(
                "supabase_operation_failed",
                operation=operation,
                error=response.error,
                status_code=getattr(response, 'status_code', None)
            )
            raise DatabaseError(f"Database operation failed: {operation}")
        
        return response.data
    
    def _execute_with_retry(self, operation_func, max_retries: int = 3):
        """Retry logic for transient failures"""
        for attempt in range(max_retries):
            try:
                return operation_func()
            except APIError as e:
                if attempt == max_retries - 1:
                    raise DatabaseError(f"Operation failed after {max_retries} attempts")
                
                # Exponential backoff
                time.sleep(2 ** attempt)
                continue
```

### Connection Management

```python
# Connection pooling configuration
class SupabaseSettings:
    # Connection limits
    MAX_CONNECTIONS: int = 20
    CONNECTION_TIMEOUT: int = 30
    
    # Retry configuration
    MAX_RETRIES: int = 3
    RETRY_DELAY: float = 1.0
    
    # Query optimization
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

# Client factory with connection management
def create_optimized_supabase_client() -> Client:
    """Create Supabase client with optimized settings"""
    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_SERVICE_KEY,
        options=ClientOptions(
            timeout=settings.CONNECTION_TIMEOUT,
            retry_attempts=settings.MAX_RETRIES
        )
    )
```

## Testing Patterns

### Repository Testing Strategy

```python
class TestSupabaseTherapySessionRepository:
    """Test repository implementation with mocking"""
    
    def test_create_session_success(self):
        # IMPORTANT: Use MagicMock, never AsyncMock for Supabase
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [{"id": "test-session-id"}]
        
        mock_client.table.return_value.insert.return_value.execute.return_value = mock_response
        
        repository = SupabaseTherapySessionRepository(mock_client)
        session_id = repository.create_session({"patient_code": "TEST001"})
        
        assert session_id == "test-session-id"
        mock_client.table.assert_called_with("therapy_sessions")
    
    def test_create_session_failure(self):
        """Test error handling for failed insertions"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.data = []  # Empty response indicates failure
        
        mock_client.table.return_value.insert.return_value.execute.return_value = mock_response
        
        repository = SupabaseTherapySessionRepository(mock_client)
        
        with pytest.raises(DatabaseError):
            repository.create_session({"patient_code": "TEST001"})
```

## Next Steps

- [Testing Strategy](./testing-strategy) - Comprehensive testing approaches for repository pattern
- [Caching with Redis](./caching-redis) - Performance optimization with structured caching
- [Webhooks Processing](./webhooks-processing) - Background processing for file uploads
- [Deployment Patterns](./deployment) - Production deployment and monitoring