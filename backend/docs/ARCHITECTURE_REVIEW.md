# Architecture Review - DRY/SOLID Refactoring

## Summary of Changes

### 1. **Repository Pattern Implementation (SOLID - Single Responsibility)**

**Problem**: Session creation logic was mixed between processor and direct database calls.

**Solution**: 
- Created `generate_next_session_code()` in repository for chronological code generation
- Created `create_session_with_code()` to encapsulate all session creation logic
- Processor now delegates to repository (proper separation of concerns)

### 2. **Chronological Session Codes (Business Logic)**

**Problem**: Random session codes using `random.randint()`

**Solution**:
- Query database for highest existing session number per patient
- Increment to get next sequential number
- Format as P###S### with zero-padding
- Patient code fallback: P000 (as per user request)

### 3. **Upload vs Webhook Routes Clarification**

**Upload Route** (`/upload`):
- **Purpose**: Stateless EMG processing
- **Returns**: Full EMG signals and analysis
- **Does NOT**: Store in database
- **Use Case**: Testing, preview, temporary analysis

**Webhook Route** (`/webhooks/storage/c3d-upload`):
- **Purpose**: Stateful database processing
- **Stores**: Complete analysis in database
- **Does NOT**: Return EMG signals
- **Use Case**: Production workflow with persistence

## Database Schema Issue

**Current Schema Problem**:
- Database has `session_id` (TEXT) - generic identifier from C3D
- Our code uses `session_code` (P###S###) - which doesn't exist
- No proper constraint for P###S### format

**Recommended Migration**:
```sql
-- Add session_code column with proper format
ALTER TABLE therapy_sessions 
ADD COLUMN session_code TEXT UNIQUE,
ADD CONSTRAINT session_code_format_check 
  CHECK (session_code ~ '^P[0-9]{3}S[0-9]{3}$');

-- Create index for efficient lookups
CREATE INDEX idx_therapy_sessions_session_code 
ON therapy_sessions(session_code);

-- Update existing records (if any)
UPDATE therapy_sessions 
SET session_code = 'P000S' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0')
WHERE session_code IS NULL;

-- Make it NOT NULL after migration
ALTER TABLE therapy_sessions 
ALTER COLUMN session_code SET NOT NULL;
```

## Temporary Workaround

Until migration is applied, use `session_id` field to store our P###S### codes:

```python
# Repository stores session_code in session_id field temporarily
session_data = {
    "session_id": session_code,  # P###S### stored here temporarily
    # ... other fields
}
```

## DRY/SOLID Compliance

✅ **Single Responsibility**: Each component has one clear purpose
- Repository: Database operations
- Processor: Workflow coordination
- Routes: HTTP handling

✅ **DRY**: No code duplication
- Session creation logic in one place
- Patient code extraction reused
- File hash generation centralized

✅ **Open/Closed**: Easy to extend
- New session types can be added
- Repository pattern allows different implementations
- Processor remains unchanged when storage changes

✅ **Dependency Inversion**: Depends on abstractions
- Processor depends on repository interface
- Routes depend on processor abstraction
- Database details hidden in repository