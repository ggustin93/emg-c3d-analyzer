---
sidebar_position: 9
title: Architecture Decisions
---

# Architecture Decisions

Key architectural choices and patterns that shape the GHOSTLY+ backend design.

## When to Use Direct Supabase vs FastAPI

Our architecture follows the **KISS principle** - use the simplest tool that solves the problem.

```
Decision Tree
─────────────
                    
Is it computational?  ──Yes──► FastAPI
        │                     (EMG, C3D, NumPy)
        No
        ▼
Is it simple CRUD?   ──Yes──► Direct Supabase
        │                     (Notes, profiles)
        No
        ▼
    FastAPI
```

### Use Supabase Directly

**When**: Simple database operations, authentication, real-time features

**Examples**:
- User authentication and session management
- Simple CRUD operations (notes, profiles, settings)
- Real-time subscriptions for live updates
- File uploads to storage buckets
- Direct queries with RLS protection

**Benefits**:
- Eliminates API round-trip latency
- Built-in real-time capabilities
- Automatic RLS enforcement
- Simpler architecture

### Use FastAPI

**When**: Heavy computation, complex business logic, external integrations

**Examples**:
- EMG signal processing (NumPy, SciPy algorithms)
- C3D binary file parsing and analysis
- Complex scoring calculations (GHOSTLY+ metrics)
- Webhook processing with background tasks
- External API integrations
- Batch operations requiring transactions

**Benefits**:
- Full control over processing logic
- Access to scientific Python libraries
- Background task processing
- Custom caching strategies

## Synchronous vs Asynchronous Supabase Client

**Decision**: Use **synchronous** Supabase client

```python
# ✅ We use synchronous client
from supabase import create_client, Client
client = create_client(url, key)
result = client.table('users').select('*').execute()

# ❌ We don't use async client
from supabase._async.client import create_client
client = await create_client(url, key)
result = await client.table('users').select('*').execute()
```

**Rationale**:
- **KISS principle** - Simpler implementation and testing
- **Testing simplicity** - Use `MagicMock`, never `AsyncMock`
- **No performance penalty** - FastAPI handles async at route level
- **Cleaner code** - Avoid async/await complexity where unnecessary

## Repository Pattern

**Decision**: Implement repository pattern for data access

```python
# Clean separation of concerns
class TherapySessionRepository:
    def __init__(self, client: Client):
        self.client = client
    
    def get_by_patient(self, patient_id: str):
        return self.client.table('therapy_sessions')\
            .select('*')\
            .eq('patient_id', patient_id)\
            .execute()
```

**Benefits**:
- **Testability** - Easy to mock repositories
- **Abstraction** - Services don't know about database details
- **Flexibility** - Can switch data sources without changing services
- **Domain organization** - Repositories grouped by business domain

## RLS as Single Source of Truth

**Decision**: Database RLS policies handle ALL authorization

```python
# Backend only validates JWT, no authorization logic
async def get_current_user(token: str):
    # Validate JWT signature
    user = validate_jwt(token)
    return user  # RLS handles what they can access

# Database automatically filters
sessions = supabase.table('sessions').select('*').execute()
# Only returns sessions user has permission to see
```

**Benefits**:
- **Security** - Authorization at lowest level
- **Consistency** - One place for all permissions
- **Performance** - Database-level filtering
- **Simplicity** - No duplicate authorization logic

## Domain-Driven Design

**Decision**: Organize code by business domains

```
services/
├── clinical/       # Clinical domain
│   ├── repositories/
│   ├── services/
│   └── models/
├── user/          # User management domain
└── c3d/           # C3D processing domain
```

**Benefits**:
- **Clarity** - Easy to find related code
- **Scalability** - Domains can evolve independently
- **Team ownership** - Clear boundaries for team responsibilities
- **Modularity** - Domains can become microservices if needed

## Processing Modes

**Decision**: Support both stateless and stateful processing

### Stateless Processing
```python
@router.post("/upload")
async def upload(file: UploadFile):
    # Process and return immediately
    results = processor.process(file)
    return results  # No database storage
```

### Stateful Processing
```python
@router.post("/webhooks/storage/c3d-upload")
async def webhook(request: Request):
    # Process and store in database
    session = processor.create_session(file)
    repository.save(session)
    return {"status": "processing"}
```

**Benefits**:
- **Flexibility** - Different use cases supported
- **Performance** - Stateless for quick testing
- **Persistence** - Stateful for clinical records
- **Scalability** - Can handle both patterns

## Single Source of Truth for Processing

**Decision**: `processor.py` is the ONLY place for EMG processing logic

```python
# All EMG processing goes through one class
class GHOSTLYC3DProcessor:
    """Single source of truth for all EMG processing"""
    
    def process_c3d(self, file_path: str):
        # All processing logic here
        # 1,341 lines of concentrated logic
```

**Benefits**:
- **Consistency** - Same processing everywhere
- **Maintainability** - One place to update algorithms
- **Testing** - Single component to test thoroughly
- **Documentation** - One place to document processing

## Error Handling Strategy

**Decision**: Fail fast with descriptive errors

```python
# Validate early
if not file.endswith('.c3d'):
    raise ValueError(f"Invalid file type: {file}")

# Provide context
try:
    process_emg(data)
except Exception as e:
    logger.error(f"EMG processing failed for session {session_id}: {e}")
    raise ProcessingError(f"Failed to process EMG data: {e}")
```

**Benefits**:
- **Debugging** - Clear error messages
- **Monitoring** - Easy to track issues
- **User experience** - Helpful error feedback
- **Recovery** - Can retry or handle gracefully

## Caching Strategy

**Decision**: Redis for expensive calculations only

```python
# Cache expensive EMG analysis results
cache_key = f"emg:{session_id}:{file_hash}"
cached = redis.get(cache_key)
if cached:
    return cached

# Process and cache
result = expensive_emg_analysis(data)
redis.set(cache_key, result, expire=3600)
```

**What to cache**:
- EMG analysis results (expensive NumPy operations)
- MVC thresholds (used across sessions)
- Performance scores (complex calculations)

**What NOT to cache**:
- Simple database queries (RLS handles efficiently)
- User profiles (changes frequently)
- Real-time data (defeats purpose)

## API Routing Architecture (Sep 2025)

**Decision**: Frontend uses `/api/*` prefix, backend serves without prefix

```javascript
// Frontend always uses /api
fetch(`${API_CONFIG.baseUrl}/clinical-notes`)

// Vite proxy strips /api
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    rewrite: (path) => path.replace(/^\/api/, '')
  }
}

// Backend serves without /api
@router.get("/clinical-notes")
```

**Benefits**:
- **Consistency** - Single pattern across frontend
- **Simplicity** - Backend routes are clean
- **Flexibility** - Easy to change proxy target
- **KISS principle** - Minimal configuration