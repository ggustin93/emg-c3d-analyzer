# Patient Data Consistency Implementation

**Domain**: Frontend Data Architecture & Database Schema  
**Status**: Ready for Implementation  
**Priority**: High  
**Date**: 2025-01-17  
**Personas**: Frontend Engineer (lead), Backend Engineer, Database Architect, QA Engineer

## Problem Statement

Patient data is inconsistently accessed between PatientProfile.tsx and PatientManagement.tsx components following a database schema migration on 2025-09-15. The migration moved `treatment_start_date` and `total_sessions_planned` fields from `patient_medical_info` to `patients` table, but PatientProfile still references the old locations and doesn't use the centralized adherence service.

**Key Issues**:
1. PatientProfile fetches `total_sessions_planned` from wrong table (patient_medical_info instead of patients)
2. PatientProfile calculates adherence manually instead of using the centralized adherence service
3. Duplicate `total_sessions_planned` field exists in patient_medical_info table (should be removed)
4. Inconsistent data access patterns violate DRY principle

**User Request**: *"Make sure to re-use consistent data from patients table and patient_medical_info table"*

## Success Criteria

✅ **Consistent data sources** across all patient components  
✅ **Single source of truth** for each data field (no duplicates)  
✅ **Centralized adherence service** used by all components  
✅ **Zero data loss** during migration  
✅ **All tests passing** with updated data access patterns  
✅ **No breaking changes** for existing functionality  

## Implementation Tasks

### Phase 1: Database Schema Cleanup [SEQUENTIAL]

#### Task T001: Create Migration to Remove Duplicate Field
**File**: New migration file  
**Persona**: Database Architect  
**Type**: Database Migration  
**Sequential**: Must be first to establish clean schema

**Current Issue**: 
- `patient_medical_info.total_sessions_planned` is duplicate of `patients.total_sessions_planned`
- Field was moved in migration 20250915 but original not removed

**Implementation**:
```sql
-- Create new migration file: 20250117_remove_duplicate_total_sessions_planned.sql

-- Remove duplicate field from patient_medical_info
ALTER TABLE public.patient_medical_info 
DROP COLUMN IF EXISTS total_sessions_planned;

-- Add comment explaining the field location
COMMENT ON TABLE public.patient_medical_info IS 
'Medical information for patients. Note: total_sessions_planned moved to patients table on 2025-09-15';
```

**Validation**:
- Verify no data loss (field already duplicated in patients table)
- Check all RLS policies still work
- Ensure no backend services reference old field

**Impact**: Removes schema ambiguity and enforces single source of truth
**Dependencies**: None
**Estimated Time**: 15 minutes

#### Task T002: Update Backend Services for Schema Change
**File**: `/backend/services/patient_service.py` (if exists)  
**Persona**: Backend Engineer  
**Type**: Code Update  
**Sequential**: After T001

**Implementation**:
- Search for any references to `patient_medical_info.total_sessions_planned`
- Update to use `patients.total_sessions_planned`
- Update any SQL queries or ORM mappings

**Validation**:
- Run backend tests
- Verify API endpoints return correct data
- Check no 500 errors on patient endpoints

**Impact**: Ensures backend consistency with new schema
**Dependencies**: T001
**Estimated Time**: 20 minutes

### Phase 2: Frontend Component Updates [PARALLEL EXECUTION]

#### Task T003: Fix PatientProfile Data Fetching [P]
**File**: `/frontend/src/components/dashboards/therapist/PatientProfile.tsx`  
**Persona**: Frontend Engineer  
**Type**: Bug Fix  
**Parallel**: [P] Can run with T004

**Current Issue** (Line 177):
```typescript
// WRONG - fetching from old location
total_sessions_planned: patientData.patient_medical_info?.total_sessions_planned || 30
```

**Implementation**:
```typescript
// Line 177: Fix data fetching to use correct table
total_sessions_planned: patientData.total_sessions_planned || 30

// Also update the Supabase query (around line 80-90)
const { data: patientData } = await supabase
  .from('patients')
  .select(`
    *,
    patient_medical_info!inner(*),
    // Remove total_sessions_planned from patient_medical_info selection
  `)
  .eq('patient_code', patientCode)
  .single();
```

**Additional Updates**:
- Remove any references to `patient_medical_info.total_sessions_planned`
- Ensure `treatment_start_date` is fetched from `patients` table
- Update TypeScript interfaces if needed

**Validation**:
- Component renders without errors
- Correct data displayed in UI
- TypeScript compilation passes

**Impact**: Fixes incorrect data source references
**Dependencies**: None (can run parallel)
**Estimated Time**: 25 minutes

#### Task T004: Integrate Adherence Service in PatientProfile [P]
**File**: `/frontend/src/components/dashboards/therapist/PatientProfile.tsx`  
**Persona**: Frontend Engineer  
**Type**: Feature Integration  
**Parallel**: [P] Can run with T003

**Current Issue**: 
- Manual adherence calculation instead of using centralized service
- Inconsistent with PatientManagement implementation

**Implementation**:
```typescript
// Add import at top of file
import { useAdherence } from '@/hooks/useAdherence';

// Inside component, replace manual calculation with:
const { 
  adherenceData, 
  loading: adherenceLoading, 
  error: adherenceError 
} = useAdherence([patientCode], true);

// Use adherenceData instead of manual calculation
const patientAdherence = adherenceData[0];
const adherenceScore = patientAdherence?.adherence_score || 0;
const clinicalThreshold = patientAdherence?.clinical_threshold || 'Unknown';

// Remove manual calculation logic (lines where adherence is calculated)
```

**Benefits**:
- Consistent adherence scoring across application
- Follows DRY principle
- Easier to maintain and update

**Validation**:
- Adherence score displays correctly
- Matches values shown in PatientManagement
- Loading and error states handled properly

**Impact**: Ensures consistent adherence calculation
**Dependencies**: None (can run parallel)
**Estimated Time**: 30 minutes

#### Task T005: Update TypeScript Interfaces [P]
**File**: `/frontend/src/types/patient.types.ts` (or similar)  
**Persona**: Frontend Engineer  
**Type**: Type Definition Update  
**Parallel**: [P] Can run with T003 and T004

**Implementation**:
```typescript
// Update patient interface to reflect current schema
interface Patient {
  patient_code: string;
  first_name: string;
  last_name: string;
  treatment_start_date: string; // Now in patients table
  total_sessions_planned: number; // Now in patients table
  active: boolean;
  // ... other fields
}

interface PatientMedicalInfo {
  patient_id: string;
  diagnosis: string;
  affected_limb: string;
  patient_status: string; // Keep this - different from patients.active
  // Remove: total_sessions_planned (moved to patients table)
  // ... other fields
}
```

**Validation**:
- TypeScript compilation passes
- No type errors in components
- IntelliSense shows correct fields

**Impact**: Ensures type safety with updated schema
**Dependencies**: None
**Estimated Time**: 15 minutes

### Phase 3: Testing & Validation [SEQUENTIAL]

#### Task T006: Create Component Consistency Tests
**File**: `/frontend/src/components/__tests__/PatientDataConsistency.test.tsx`  
**Persona**: QA Engineer  
**Type**: Test Development  
**Sequential**: After T003, T004

**Test Scenarios**:
```typescript
describe('Patient Data Consistency', () => {
  it('should fetch total_sessions_planned from patients table', async () => {
    // Mock Supabase response
    // Verify correct table is queried
  });
  
  it('should use adherence service for scoring', async () => {
    // Verify useAdherence hook is called
    // Check adherence data is used, not calculated
  });
  
  it('should display consistent data between components', async () => {
    // Render both PatientProfile and PatientManagement
    // Verify same data is displayed for same patient
  });
});
```

**Impact**: Validates data consistency implementation
**Dependencies**: T003, T004
**Estimated Time**: 40 minutes

#### Task T007: Integration Testing
**File**: Manual testing or E2E tests  
**Persona**: QA Engineer  
**Type**: Integration Testing  
**Sequential**: After all other tasks

**Test Scenarios**:
1. Load PatientProfile page - verify correct data displays
2. Load PatientManagement page - verify matching data
3. Check adherence scores are identical between components
4. Verify no console errors or warnings
5. Test with multiple patients to ensure consistency
6. Verify database queries are optimized (no N+1 queries)

**Validation Checklist**:
- [ ] PatientProfile loads without errors
- [ ] PatientManagement loads without errors
- [ ] Data matches between components
- [ ] Adherence scores are consistent
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Performance acceptable (< 2s load time)

**Impact**: Ensures end-to-end functionality
**Dependencies**: All previous tasks
**Estimated Time**: 30 minutes

### Phase 4: Documentation & Cleanup [PARALLEL EXECUTION]

#### Task T008: Update Component Documentation [P]
**File**: `/frontend/src/components/dashboards/therapist/README.md`  
**Persona**: Frontend Engineer  
**Type**: Documentation  
**Parallel**: [P] Can run independently

**Documentation Updates**:
```markdown
## Data Sources

### PatientProfile Component
- **Patients Table**: Core patient data, treatment dates, session planning
- **Patient Medical Info**: Diagnosis, affected limb, patient status
- **Adherence Service**: Centralized adherence scoring via useAdherence hook

### PatientManagement Component
- Uses same data sources as PatientProfile for consistency
- Batch fetches adherence data for multiple patients

## Schema Notes
As of 2025-09-15, `treatment_start_date` and `total_sessions_planned` 
have been moved from patient_medical_info to patients table.
```

**Impact**: Maintains clear documentation for future developers
**Dependencies**: None
**Estimated Time**: 15 minutes

#### Task T009: Remove Deprecated Code [P]
**File**: Multiple files  
**Persona**: Frontend Engineer  
**Type**: Code Cleanup  
**Parallel**: [P] Can run independently

**Cleanup Tasks**:
- Remove commented-out code referencing old schema
- Delete any utility functions for manual adherence calculation
- Remove unused imports
- Clean up any migration helper code

**Impact**: Reduces technical debt
**Dependencies**: None
**Estimated Time**: 20 minutes

## Parallel Execution Strategy

### Wave 1: Database Migration [Sequential]
```bash
Task T001: Remove duplicate field migration
Task T002: Update backend services
Estimated Time: 35 minutes total
```

### Wave 2: Frontend Updates [P]
```bash
# Can run simultaneously
Task T003: Fix PatientProfile data fetching
Task T004: Integrate adherence service
Task T005: Update TypeScript interfaces
Estimated Time: 30 minutes total (longest task)
```

### Wave 3: Testing [Sequential]
```bash
# Must run after Wave 2
Task T006: Create consistency tests
Task T007: Integration testing
Estimated Time: 70 minutes total
```

### Wave 4: Documentation [P]
```bash
# Can run simultaneously
Task T008: Update documentation
Task T009: Remove deprecated code
Estimated Time: 20 minutes total (longest task)
```

**Total Estimated Time**: 2 hours 35 minutes (with parallel execution)
**Sequential Time Would Be**: 3 hours 15 minutes

## Success Validation

### Before Implementation
- ❌ PatientProfile fetches from wrong table
- ❌ Manual adherence calculation in PatientProfile
- ❌ Duplicate fields in database schema
- ❌ Inconsistent data between components
- ❌ Type definitions don't match actual schema

### After Implementation
- ✅ Single source of truth for all data fields
- ✅ Centralized adherence service used everywhere
- ✅ Clean database schema without duplicates
- ✅ Consistent data across all components
- ✅ TypeScript interfaces match database schema
- ✅ All tests passing
- ✅ Documentation updated

## Risk Assessment

**Low Risk**:
- TypeScript interface updates (T005) - compile-time validation
- Documentation updates (T008) - no runtime impact
- Test creation (T006) - no production impact

**Medium Risk**:
- Frontend component updates (T003, T004) - could affect UI if done incorrectly
- Code cleanup (T009) - might accidentally remove needed code

**High Risk**:
- Database migration (T001) - affects schema directly
- Backend service updates (T002) - could break API endpoints

**Mitigation Strategy**:
1. Run migration in development first
2. Backup database before production migration
3. Use feature flags for gradual rollout
4. Monitor error rates during deployment
5. Have rollback plan ready

## Dependencies

**Technical Dependencies**:
- Supabase migration tools ✅
- useAdherence hook ✅ (already exists)
- Adherence service ✅ (already implemented)
- TypeScript compiler ✅

**External Dependencies**:
- Database backup before migration
- Testing environment availability
- No active users during migration window

## Implementation Commands

### Start Implementation
```bash
# Wave 1: Database work
Task T001: Create and run migration
Task T002: Update backend services

# Wave 2: Frontend updates (parallel)
Task T003 & T004 & T005: Frontend fixes

# Wave 3: Testing
Task T006 & T007: Comprehensive testing

# Wave 4: Cleanup (parallel)
Task T008 & T009: Documentation and cleanup
```

### Validation Commands
```bash
# Test frontend components
npm test PatientDataConsistency.test.tsx

# Test backend
cd backend && pytest tests/

# Build validation
npm run build

# Type checking
npm run type-check
```

---

**Last Updated**: 2025-01-17  
**Next Review**: After T003 and T004 completion  
**Assigned Personas**: Frontend Engineer (lead), Backend Engineer, Database Architect, QA Engineer  
**Estimated Completion**: 2 hours 35 minutes with parallel execution

**Direct User Impact**: Ensures data consistency across patient management interfaces, reduces maintenance burden, and prevents data discrepancies that could affect clinical decision-making.