# Supabase Stored Procedures

Export of all stored procedures from the production database (2025-09-11).

## Directory Structure

```
stored_procedures/
├── functions/          # Regular functions (16 files)
├── triggers/          # Trigger functions (16 files)
└── ALL_FUNCTIONS_LIST.md  # Complete reference
```

## Key Functions

### Authentication & Security
- `get_user_role()` - Returns current user role
- `user_owns_patient(code)` - Checks patient ownership
- `get_current_therapist_id()` - Gets therapist UUID

### Clinical Operations
- `get_session_scoring_config()` - Retrieves scoring configuration
- `update_patient_current_values()` - Updates patient baselines
- `set_session_therapeutic_targets()` - Sets therapy goals

### Data Integrity
- `calculate_bmi_on_change()` - Auto-calculates BMI
- `validate_performance_weights()` - Ensures weights sum to 1.0
- Multiple timestamp update triggers

## Usage

Functions are called via:
- **Backend**: `supabase.rpc('function_name', params)`
- **RLS Policies**: Direct usage in security rules
- **Triggers**: Automatic execution on data changes

## Room for Improvements

### Potential Redundancies
1. **Multiple timestamp triggers** - Could be consolidated into a single generic trigger:
   - `update_updated_at_column()`
   - `update_clinical_notes_updated_at()`
   - `update_c3d_metadata_updated_at()`
   - `update_scoring_config_timestamp()`
   - `update_patient_medical_info_updated_at()`

2. **Overlapping patient assignment checks**:
   - `is_assigned_to_patient()` (2 overloads)
   - `is_therapist_for_patient()`
   - `user_owns_patient()`
   - Consider consolidating into one flexible function

3. **Similar access timestamp updates**:
   - `update_therapy_sessions_last_accessed()`
   - `update_analysis_results_last_accessed()`
   - `update_analytics_cache_last_accessed()`
   - Could use a single parameterized function

### Suggested Optimizations
- Create a single `update_timestamp()` trigger for all tables
- Merge patient ownership functions into one with multiple signatures
- Standardize naming conventions (some use underscores, others don't)
- Add missing documentation/comments to functions
- Consider moving some business logic from triggers to application layer

## Maintenance

Changes should be made through migration files in `/supabase/migrations/`, not by editing these exports directly.