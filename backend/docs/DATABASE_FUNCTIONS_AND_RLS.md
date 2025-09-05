# Database Functions & RLS Policies Documentation

## Overview
This document serves as the single source of truth for all database functions, RLS policies, and triggers in the EMG C3D Analyzer system.

## 📚 Table of Contents
1. [Database Functions](#database-functions)
2. [RLS Policies](#rls-policies)
3. [Triggers](#triggers)
4. [Repository Pattern](#repository-pattern)

---

## Database Functions

### 1. `get_session_scoring_config()`
**Purpose**: Get appropriate scoring configuration for a therapy session  
**Location**: `migrations/20250106000000_add_get_session_scoring_config_function.sql`  
**Repository Method**: `ScoringConfigurationRepository.get_session_scoring_config()`

```sql
-- Function signature
get_session_scoring_config(
    p_session_id uuid DEFAULT NULL,
    p_patient_id uuid DEFAULT NULL
) RETURNS uuid
```

**Priority Hierarchy**:
1. Session's immutable `scoring_config_id` (preserves historical accuracy)
2. Patient's `current_scoring_config_id` (for new sessions)
3. Global `GHOSTLY-TRIAL-DEFAULT` configuration
4. Any active configuration as last resort

**Usage in Code**:
```python
from services.clinical.repositories.scoring_configuration_repository import ScoringConfigurationRepository

repo = ScoringConfigurationRepository()
config_id = repo.get_session_scoring_config(session_id, patient_id)
```

### 2. `generate_user_code()` (Trigger Function)
**Purpose**: Auto-generate user codes (T001, R001, A001) based on role  
**Location**: `migrations/20250105000000_add_user_code_to_user_profiles.sql`  
**Trigger**: `BEFORE INSERT ON user_profiles`

```sql
-- Automatically generates:
-- Therapists: T001, T002, T003...
-- Researchers: R001, R002, R003...
-- Admins: A001, A002, A003...
```

---

## RLS Policies

### Core Security Model
RLS (Row Level Security) is our **primary authorization layer**. Even if there's a bug in the API, the database will never return data that violates these policies.

### 1. Therapy Sessions Policies

#### `Therapists can view their patients' sessions`
```sql
CREATE POLICY "Therapists can view their patients sessions"
ON public.therapy_sessions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = therapy_sessions.patient_id
        AND p.therapist_id = auth.uid()
    )
);
```

#### `Patients can view their own sessions`
```sql
CREATE POLICY "Patients can view their own sessions"
ON public.therapy_sessions FOR SELECT
USING (patient_id = auth.uid());
```

### 2. EMG Statistics Policies

#### `Therapists can view EMG data for their patients`
```sql
CREATE POLICY "Therapists can view EMG statistics"
ON public.emg_statistics FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.therapy_sessions ts
        JOIN public.patients p ON p.id = ts.patient_id
        WHERE ts.id = emg_statistics.session_id
        AND p.therapist_id = auth.uid()
    )
);
```

### 3. Performance Scores Policies

#### `Same as therapy sessions - inherited permissions`
```sql
CREATE POLICY "Therapists can view performance scores"
ON public.performance_scores FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.therapy_sessions ts
        JOIN public.patients p ON p.id = ts.patient_id
        WHERE ts.id = performance_scores.session_id
        AND p.therapist_id = auth.uid()
    )
);
```

### 4. Scoring Configuration Policies

#### `All authenticated users can view active configurations`
```sql
CREATE POLICY "View active scoring configurations"
ON public.scoring_configuration FOR SELECT
USING (active = true);
```

#### `Only admins can modify configurations`
```sql
CREATE POLICY "Admins can manage scoring configurations"
ON public.scoring_configuration FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);
```

---

## Triggers

### 1. `user_code_generation_trigger`
**Table**: `user_profiles`  
**Event**: `BEFORE INSERT`  
**Function**: `generate_user_code()`  
**Purpose**: Auto-generate user codes based on role

### 2. `update_updated_at` (Common Pattern)
**Tables**: Multiple tables  
**Event**: `BEFORE UPDATE`  
**Purpose**: Auto-update `updated_at` timestamp

```sql
CREATE TRIGGER update_therapy_sessions_updated_at
BEFORE UPDATE ON therapy_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Repository Pattern

### Why Use Repositories?

1. **Clean Separation**: Business logic doesn't need to know about RPC calls or SQL
2. **Testability**: Easy to mock repository methods in tests
3. **Documentation**: Each repository method documents its database interaction
4. **Type Safety**: Python type hints for all database operations
5. **Error Handling**: Centralized error handling and logging

### Repository Structure

```
services/
├── clinical/
│   └── repositories/
│       ├── therapy_session_repository.py
│       ├── patient_repository.py
│       ├── emg_data_repository.py
│       └── scoring_configuration_repository.py  # NEW
└── user/
    └── repositories/
        └── user_repository.py
```

### Example Repository Usage

```python
# In service layer (business logic)
class PerformanceScoringService:
    def __init__(self):
        self.scoring_repo = ScoringConfigurationRepository()
    
    def get_session_config(self, session_id, patient_id):
        # Clean business logic - no database details
        config_id = self.scoring_repo.get_session_scoring_config(
            session_id, patient_id
        )
        if not config_id:
            # Handle fallback logic
            return self.create_default_config()
        return config_id
```

---

## Quick Reference Checklist

When adding new database functionality:

- [ ] Create migration file in `supabase/migrations/`
- [ ] Add RLS policies for security
- [ ] Create/update repository method
- [ ] Document in this file
- [ ] Add Python type hints
- [ ] Write unit tests for repository
- [ ] Update relevant services to use repository

---

## Testing Database Functions

### Direct SQL Testing
```sql
-- Test get_session_scoring_config
SELECT get_session_scoring_config(
    'session-uuid-here'::uuid,
    'patient-uuid-here'::uuid
);
```

### Repository Testing
```python
# In tests/
def test_get_session_scoring_config(mock_supabase):
    repo = ScoringConfigurationRepository(mock_supabase)
    config_id = repo.get_session_scoring_config("session-id", "patient-id")
    assert config_id is not None
```

---

## Common Patterns

### 1. Hierarchical Permission Check
```sql
-- Pattern: Check permission through relationship chain
CREATE POLICY "policy_name"
ON table_name FOR operation
USING (
    EXISTS (
        SELECT 1 FROM parent_table pt
        JOIN grandparent_table gpt ON gpt.id = pt.parent_id
        WHERE pt.id = table_name.parent_id
        AND gpt.owner_id = auth.uid()
    )
);
```

### 2. Role-Based Access
```sql
-- Pattern: Check user role from user_profiles
CREATE POLICY "policy_name"
ON table_name FOR operation
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'therapist')
    )
);
```

### 3. Owner-Only Access
```sql
-- Pattern: Simple ownership check
CREATE POLICY "policy_name"
ON table_name FOR operation
USING (user_id = auth.uid());
```

---

## Migration Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql

Examples:
20250105000000_add_user_code_to_user_profiles.sql
20250106000000_add_get_session_scoring_config_function.sql
```

---

## Notes & Best Practices

1. **Always use service role** for backend operations that need to bypass RLS
2. **Test RLS policies** thoroughly - they're your last line of defense
3. **Document complex functions** with comments in SQL
4. **Use repositories** for all database interactions
5. **Version control everything** - migrations are code!