# AdminDashboard Implementation Tasks

## Project Context
The GHOSTLY+ EMG C3D Analyzer needs a comprehensive admin interface to manage users, configure trial settings, and oversee the entire platform. This implementation follows KISS principles with minimal API endpoints and maximum use of direct Supabase client.

## Architecture Decisions
1. **Direct Supabase for 100% of operations** - Leverage RLS policies, NO API endpoints needed!
2. **Zero new backend endpoints** - Direct password setting via Supabase admin client
3. **Reuse existing components** - PatientManagement.tsx already handles patient operations
4. **Tab-based navigation** - Clean separation of admin functions
5. **Target defaults over system defaults** - More explicit naming for patient initialization

## Database Schema Updates

### Migration 1: Add BFR Target Fields to Patients
```sql
-- Add BFR target fields for Blood Flow Restriction therapy with CHECK constraints
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS bfr_target_lop_percentage_ch1 FLOAT8 DEFAULT 50.0
  CHECK (bfr_target_lop_percentage_ch1 >= 0 AND bfr_target_lop_percentage_ch1 <= 100),
ADD COLUMN IF NOT EXISTS bfr_target_lop_percentage_ch2 FLOAT8 DEFAULT 50.0
  CHECK (bfr_target_lop_percentage_ch2 >= 0 AND bfr_target_lop_percentage_ch2 <= 100);

-- Add comment for documentation
COMMENT ON COLUMN public.patients.bfr_target_lop_percentage_ch1 IS 'BFR target limb occlusion pressure percentage for channel 1';
COMMENT ON COLUMN public.patients.bfr_target_lop_percentage_ch2 IS 'BFR target limb occlusion pressure percentage for channel 2';
```

### Migration 2: Add Target Defaults to Scoring Configuration
```sql
-- Add target_defaults JSONB field for patient initialization defaults
ALTER TABLE public.scoring_configuration
ADD COLUMN IF NOT EXISTS target_defaults JSONB DEFAULT '{
  "mvc_threshold_percentage": 75,
  "target_duration_ch1_ms": 2000,
  "target_duration_ch2_ms": 2000,
  "target_contractions_ch1": 12,
  "target_contractions_ch2": 12,
  "bfr_target_lop_percentage_ch1": 50,
  "bfr_target_lop_percentage_ch2": 50
}'::JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.scoring_configuration.target_defaults IS 'Default target values used when initializing new patients';

-- Update GHOSTLY-TRIAL-DEFAULT with initial target defaults
UPDATE public.scoring_configuration
SET target_defaults = '{
  "mvc_threshold_percentage": 75,
  "target_duration_ch1_ms": 2000,
  "target_duration_ch2_ms": 2000,
  "target_contractions_ch1": 12,
  "target_contractions_ch2": 12,
  "bfr_target_lop_percentage_ch1": 50,
  "bfr_target_lop_percentage_ch2": 50
}'::JSONB
WHERE id = 'a0000000-0000-0000-0000-000000000001';
```

### Migration 3: Ensure Admin RLS Policies
```sql
-- Ensure admin role can manage all users
CREATE POLICY "Admins can view all users" ON auth.users
FOR SELECT USING (
  auth.jwt()->>'role' = 'admin'
);

-- Ensure admin can update scoring configuration
CREATE POLICY "Admins can update scoring configuration" ON public.scoring_configuration
FOR UPDATE USING (
  auth.jwt()->>'role' = 'admin'
);

-- Ensure admin can manage all patients
CREATE POLICY "Admins can manage all patients" ON public.patients
FOR ALL USING (
  auth.jwt()->>'role' = 'admin'
);
```

### Migration 4: Add Patient Status Synchronization Trigger
```sql
-- Create trigger for patient status synchronization
CREATE OR REPLACE FUNCTION sync_patient_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_status = 'dropped_out' THEN
    UPDATE patients SET active = false WHERE id = NEW.patient_id;
  ELSIF NEW.patient_status = 'active' AND OLD.patient_status = 'dropped_out' THEN
    UPDATE patients SET active = true WHERE id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_patient_status
AFTER UPDATE OF patient_status ON patient_medical_info
FOR EACH ROW EXECUTE FUNCTION sync_patient_status();
```

### Migration 5: Add Audit Log Table
```sql
-- Create audit log table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'user', 'patient', 'configuration'
  target_id UUID,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policy for audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log
FOR SELECT USING (
  auth.jwt()->>'role' = 'admin'
);

CREATE POLICY "System can insert audit logs" ON public.admin_audit_log
FOR INSERT WITH CHECK (true);
```

## Component Implementation Tasks

### Task 1: Update AdminDashboard.tsx with Tab Navigation
**File**: `/frontend/src/components/dashboards/admin/AdminDashboard.tsx`
**Priority**: High
**Dependencies**: None

```typescript
// Key implementation points:
- Import Tabs components from @radix-ui/react-tabs
- Create 4 tabs: Overview, User Management, Patient Management, Trial Configuration
- Use existing SessionSettings component temporarily in Trial Configuration
- Add role check to ensure only admins can access
- Include C3DFileBrowser, FAQ, and About access
```

### Task 2: Create Overview Tab Component
**File**: `/frontend/src/components/dashboards/admin/tabs/OverviewTab.tsx`
**Priority**: High
**Dependencies**: Task 1

```typescript
// Features to implement:
- Metrics cards showing:
  - Total users by role
  - Total patients
  - Active sessions today
  - Trial configuration status
- Quick action buttons:
  - Add new user
  - Configure trial settings
  - View audit logs
  - Access C3D File Browser
- Recent activity feed from audit log
```

### Task 3: Create User Management Tab ✅ COMPLETED (2025-09-23)
**File**: `/frontend/src/components/dashboards/admin/tabs/UserManagementTab.tsx`
**Priority**: High
**Dependencies**: Task 1
**Status**: ✅ Fully Implemented

```typescript
// ✅ IMPLEMENTED FEATURES:
- ✅ User table with comprehensive columns (Name, Email, Role, Institution, Department, Created Date, Active Status)
- ✅ RPC function get_users_with_emails() for safe auth.users access
- ✅ Full CRUD operations:
  - ✅ Create user via backend API with service key isolation
  - ✅ Edit all profile fields (role, institution, department, access level)
  - ✅ Soft delete via active flag toggle
  - ✅ Password reset via backend /admin/users/{id}/reset-password
- ✅ Create user dialog with form validation
- ✅ Edit user dialog with comprehensive fields
- ✅ Direct Supabase integration for profile operations
- ✅ Backend API for privileged operations (user creation, password reset)
- ✅ Audit logging for all admin actions

// Implementation approach used:
// - Backend API endpoint for password reset (service key isolated)
// - RPC function for fetching users with emails (SECURITY DEFINER)
// - Direct Supabase for profile CRUD operations
// - Soft delete pattern via active flag
```

### Task 4: Integrate Patient Management Tab
**File**: `/frontend/src/components/dashboards/admin/tabs/PatientManagementTab.tsx`
**Priority**: Medium
**Dependencies**: Task 1

```typescript
// Implementation approach:
- Import and reuse existing PatientManagement component
- Add admin-specific features:
  - Therapist reassignment capability
  - View all patients across all therapists
  - Patient data export functionality
  - Storage folder management
- Use direct Supabase for therapist reassignment
```

### Task 5: Create Trial Configuration Tab
**File**: `/frontend/src/components/dashboards/admin/tabs/TrialConfigurationTab.tsx`
**Priority**: High
**Dependencies**: Task 1

```typescript
// Features to implement:
- Load and edit GHOSTLY-TRIAL-DEFAULT configuration
- Target defaults editor with fields:
  - MVC threshold percentage
  - Target duration CH1 (ms)
  - Target duration CH2 (ms)
  - Target contractions CH1 (count)
  - Target contractions CH2 (count)
  - BFR target LOP percentage CH1
  - BFR target LOP percentage CH2
- Scoring weights configuration:
  - Weight compliance (0.400)
  - Weight symmetry (0.250)
  - Weight effort (0.200)
  - Weight game (0.150)
  - Weight completion (0.333)
  - Weight intensity (0.333)
  - Weight duration (0.334)
- Real-time validation (weights must sum to 1.0)
- Save with confirmation dialog
- Show session parameter hierarchy:
  1. C3D File Metadata (absolute priority)
  2. Patient database values (patient-specific)
  3. Target defaults (system-wide initialization)
```

### Task 6: Create Admin Audit Service
**File**: `/frontend/src/services/adminAuditService.ts`
**Priority**: Medium
**Dependencies**: Database migration for audit log

```typescript
// Service functions:
- logAdminAction(action, targetType, targetId, changes)
- getRecentAuditLogs(limit)
- getAuditLogsForTarget(targetType, targetId)
- exportAuditLogs(dateRange)
// All using direct Supabase client
```

### Task 7: Create Storage Automation Hook
**File**: `/frontend/src/hooks/usePatientStorage.ts`
**Priority**: Low
**Dependencies**: Patient Management Tab

```typescript
// Hook functionality:
- Auto-create storage folder when patient is created
- Folder structure: /patients/{patient_id}/
- Set appropriate RLS policies on folders
- Handle folder deletion on patient removal
```

## Testing Requirements

### Unit Tests
1. Audit service functions
2. Target defaults validation logic
3. Tab navigation component rendering
4. Direct password setting functionality

### Integration Tests
1. Admin role access control
2. Direct Supabase CRUD operations
3. Trial configuration updates affect new patients
4. Audit log recording for all admin actions

### E2E Tests
1. Complete admin workflow:
   - Login as admin
   - Create user
   - Configure trial settings
   - Assign patient to therapist
   - View audit logs
2. Direct password setting workflow
3. Trial configuration persistence

## Implementation Order

### Phase 1: Foundation (Day 1) ✅ COMPLETED
1. ✅ Create task documentation (this file)
2. ✅ Create database migrations (RPC function for emails added)
3. ✅ Set up basic tab navigation in AdminDashboard

### Phase 2: Core Features (Days 2-3) 🔄 IN PROGRESS
4. ⏳ Implement Overview Tab with metrics
5. ✅ Create User Management Tab (completed 2025-09-23)
6. ⏳ Integrate Patient Management Tab
7. ⏳ Implement Trial Configuration Tab

### Phase 3: Enhancement (Days 4-5)
8. Add audit logging service
9. Implement storage automation
10. Add data export functionality
11. Complete testing suite
12. UI/UX improvements and final testing

## Frontend Direct Supabase Implementation Examples

### User Management Operations
```typescript
// List all users with roles
const { data: users } = await supabase
  .from('user_profiles')
  .select('*, auth.users!inner(email, last_sign_in_at)')
  .order('created_at', { ascending: false });

// Create new user (requires admin client)
const { data: authUser, error } = await supabase.auth.admin.createUser({
  email: formData.email,
  email_confirm: true,
  user_metadata: {
    first_name: formData.firstName,
    last_name: formData.lastName
  }
});

// Update user profile
await supabase
  .from('user_profiles')
  .update({ 
    role: newRole,
    institution: formData.institution,
    updated_at: new Date().toISOString()
  })
  .eq('id', userId);

// Set temporary password (direct Supabase - no API needed!)
const tempPassword = `Temp-${Date.now()}-Xyz!`;
await supabase.auth.admin.updateUserById(userId, {
  password: tempPassword
});

// Display password to admin for manual sharing
toast.success(`Temporary password: ${tempPassword}`, {
  duration: 30000, // Keep visible for 30 seconds
  description: "Share this with the user via phone/WhatsApp"
});
```

### Patient Management Operations
```typescript
// Load target defaults for new patient initialization
const { data: config } = await supabase
  .from('scoring_configuration')
  .select('target_defaults')
  .eq('id', 'a0000000-0000-0000-0000-000000000001')
  .single();

// Create patient with target defaults
const { data: patient } = await supabase
  .from('patients')
  .insert({
    ...formData,
    ...config.target_defaults, // Initialize from defaults
    therapist_id: selectedTherapistId
  })
  .select()
  .single();

// Auto-create storage folder
await supabase.storage
  .from('c3d-files')
  .upload(`${patient.patient_code}/.keep`, new Blob(['']));

// Reassign therapist - Direct UPDATE
await supabase
  .from('patients')
  .update({ 
    therapist_id: newTherapistId,
    updated_at: new Date().toISOString()
  })
  .eq('id', patientId);
```

### Trial Configuration Operations
```typescript
// Load GHOSTLY-TRIAL-DEFAULT configuration
const { data: trialConfig } = await supabase
  .from('scoring_configuration')
  .select('*')
  .eq('id', 'a0000000-0000-0000-0000-000000000001')
  .single();

// Update scoring weights
await supabase
  .from('scoring_configuration')
  .update({
    weight_compliance: values.weightCompliance,
    weight_symmetry: values.weightSymmetry,
    weight_effort: values.weightEffort,
    weight_game: values.weightGame,
    updated_at: new Date().toISOString()
  })
  .eq('id', 'a0000000-0000-0000-0000-000000000001');

// Update target defaults
await supabase
  .from('scoring_configuration')
  .update({
    target_defaults: {
      mvc_threshold_percentage: values.mvcThreshold,
      target_duration_ch1_ms: values.durationCh1,
      target_duration_ch2_ms: values.durationCh2,
      target_contractions_ch1: values.contractionsCh1,
      target_contractions_ch2: values.contractionsCh2,
      bfr_target_lop_percentage_ch1: values.bfrCh1,
      bfr_target_lop_percentage_ch2: values.bfrCh2
    },
    updated_at: new Date().toISOString()
  })
  .eq('id', 'a0000000-0000-0000-0000-000000000001');
```

### Audit Logging
```typescript
// Log admin action
await supabase
  .from('admin_audit_log')
  .insert({
    admin_id: currentUser.id,
    action: 'user_role_updated',
    target_type: 'user',
    target_id: userId,
    changes: {
      old_role: oldRole,
      new_role: newRole
    }
  });

// Get recent audit logs
const { data: auditLogs } = await supabase
  .from('admin_audit_log')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);
```

## Success Metrics
- 🔄 All 4 tabs functional and accessible (1/4 complete)
- ✅ Admin can manage users (User Management Tab complete)
- ⏳ Trial configuration changes persist and affect new patients
- ✅ Audit log captures admin actions (integrated in user operations)
- ⏳ 100% test coverage for critical paths
- ✅ Sub-200ms response time for user operations
- ⏳ Accessibility: WCAG 2.1 AA compliance

## Notes and Considerations

### Security
- All operations validated by RLS policies at database level
- Admin role check on frontend is for UX, not security
- Password reset links expire after 1 hour
- Audit logs cannot be deleted, only viewed

### Performance
- Use React.lazy() for tab components
- Implement pagination for user and patient lists
- Cache trial configuration locally with SWR
- Debounce configuration saves

### UX Patterns
- Follow existing TherapistOverview.tsx patterns
- Use @radix-ui/react-icons consistently
- Maintain gradient backgrounds and card styles
- Show loading states during async operations

### Future Enhancements (Out of Scope)
- Email integration for password resets
- Role-based feature flags
- Advanced audit log analytics
- Batch import/export functionality
- System monitoring dashboard (separate tech admin role)

## References
- Original requirements discussion: See conversation history
- Existing components: `/frontend/src/components/dashboards/therapist/`
- Database schema: `/supabase/migrations/production_snapshot_2025_09_11.sql`
- Backend patterns: `/backend/CLAUDE.md`
- Frontend patterns: `/frontend/CLAUDE.md`