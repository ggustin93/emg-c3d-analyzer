# Session Identifier Schema Documentation

## Overview
The EMG C3D Analyzer uses two distinct session identifiers with different purposes:

## 1. session_code (Human-Readable Identifier)
- **Type**: `text`
- **Format**: `P###S###` (e.g., `P039S001` for Patient 039, Session 001)
- **Purpose**: Human-readable session identifier for clinical tracking
- **Location**: `therapy_sessions.session_code` column
- **Usage**: 
  - API endpoints (webhook handlers, status queries)
  - Clinical reports and user interfaces
  - Session lookup and retrieval

## 2. session_id (Database Foreign Key)
- **Type**: `uuid`
- **Format**: Standard UUID (e.g., `b101a1a9-5c28-4c76-a6ce-06075d52998f`)
- **Purpose**: Database foreign key for relational integrity
- **Location**: Foreign key in related tables pointing to `therapy_sessions.id`
- **Tables with session_id foreign keys**:
  - `emg_statistics.session_id` → `therapy_sessions.id`
  - `performance_scores.session_id` → `therapy_sessions.id`
  - `processing_parameters.session_id` → `therapy_sessions.id`
  - `session_settings.session_id` → `therapy_sessions.id`
  - `bfr_monitoring.session_id` → `therapy_sessions.id`

## Important Distinctions

### DO NOT CHANGE
- Foreign key columns named `session_id` in related tables
- These maintain database referential integrity
- They reference the UUID primary key `therapy_sessions.id`

### ALREADY CHANGED
- The deprecated `therapy_sessions.session_id` text column (removed via migration)
- API parameter names from `session_id` to `session_code`
- Service method signatures to use `session_code` for lookups

## Code Examples

### Correct Usage
```python
# Creating a session with session_code
session_code = "P039S001"
session = therapy_session_repository.create_therapy_session({
    "session_code": session_code,
    "patient_id": patient_uuid,
    # ... other fields
})

# The returned session has both:
# - session["id"]: UUID for database relations
# - session["session_code"]: P###S### for human reference

# Creating related records using the UUID
emg_stats = emg_repository.create_emg_statistics({
    "session_id": session["id"],  # Uses UUID, not session_code!
    "channel_name": "CH1",
    # ... other fields
})
```

### API Usage
```python
# API endpoints use session_code for human interaction
@router.get("/storage/status/{session_code}")
async def get_processing_status(session_code: str):
    # Internally converts session_code to UUID for database queries
    status = await session_processor.get_session_status(session_code)
```

## Migration History
1. **20250902000001**: Added `session_code` column with P###S### format
2. **20250902000002**: Removed deprecated `session_id` text column from therapy_sessions

## Summary
- **session_code**: Human-readable identifier (P###S###) for API and clinical use
- **session_id**: UUID foreign key for database relationships - DO NOT RENAME OR REMOVE