# Table of contents
*To be completed*
- RLS functions and repositories
  -> check docs/DATABASE_FUNCTIONS_AND_RLS.md

- RLS rules (Supabase Cloud)

## Authentication Architecture Decision

**Decision**: Use Supabase client directly for most operations, FastAPI for complex logic only.

**Rationale**:
- Reduces complexity and latency by avoiding unnecessary API layers
- Leverages Supabase RLS as single source of truth for authorization
- FastAPI only needed for EMG processing and complex business logic
- Follows KISS principle - simplest solution that works

**Implementation**:
- **Frontend**: Direct Supabase client for auth, CRUD operations, and storage
- **Backend**: Thin JWT validation layer, complex processing only (EMG analysis)
- **Database**: RLS policies handle all authorization decisions

**When to Use Direct Supabase**:
- Simple CRUD operations (e.g., clinical_notes)
- Real-time subscriptions
- File storage operations  
- Auth state management

**When to Use FastAPI**:
- Complex business logic (EMG signal processing)
- Multi-step transactions requiring atomicity
- External API integrations
- Heavy computational tasks
- Custom validation beyond database constraints

----


  Policy 1: SELECT (Download/View)

  Policy Name: Therapists can only view their patients files
Operation: SELECT
  Target Roles: authenticated

  Policy Definition:
  ```sql
  public.user_owns_patient(split_part(name, '/', 1))
  ```

  Policy 2: INSERT (Upload)

  Policy Name: Therapists can only upload to their patients folders
  Operation: INSERT
  Target Roles: authenticated

  Policy Definition:
  ```sql
  public.user_owns_patient(split_part(name, '/', 1))
  ```
  Policy 3: UPDATE (Replace files)

  Policy Name: Therapists can only update their patients files
  Operation: UPDATE
  Target Roles: authenticated

  USING clause:

  ```sql
  public.user_owns_patient(split_part(name, '/', 1))
  WITH CHECK clause:
  public.user_owns_patient(split_part(name, '/', 1))
  ```

  Policy 4: DELETE (Remove files)

  Policy Name: Therapists can only delete their patients files
  Operation: DELETE
  Target Roles: authenticated

  Policy Definition:
  ```sql
  public.user_owns_patient(split_part(name, '/', 1))
  ```

----

## Architecture Decision: FastAPI vs Direct Supabase Client

### When to use Direct Supabase Client
- **Simple CRUD operations** without business logic
- **User profiles**, preferences, settings
- **Real-time subscriptions** for live updates
- **File uploads** to Supabase Storage
- **Authentication** flows (login, logout, session)

Example: Clinical notes could technically work with direct Supabase:
```javascript
// Direct from frontend
const { data } = await supabase
  .from('clinical_notes')
  .select('*, patients(patient_code)')
  .eq('author_id', user.id)
```

### When FastAPI is Required
- **Complex computations** (EMG signal processing, statistical analysis)
- **Binary file processing** (C3D files with ezc3d library)
- **Heavy algorithms** requiring NumPy, SciPy, specialized libraries
- **Webhook endpoints** for Supabase Storage events
- **Data transformations** beyond simple queries
- **Proprietary logic** that shouldn't be exposed in frontend

### Current Implementation
- **Clinical Notes**: Uses FastAPI for consistency, though direct Supabase would work
- **EMG Processing**: Absolutely requires FastAPI (signal processing, C3D parsing)
- **Therapy Sessions**: Requires FastAPI (complex calculations, scoring algorithms)

### Decision Principle
Follow KISS: Use the simplest tool that solves the problem. Don't add layers just for consistency.
