# Role-Based System Implementation Action Plan

## Executive Summary

This action plan outlines the systematic implementation of role-based access control (RBAC) for the GHOSTLY+ EMG C3D Analyzer, evolving from the current research-focused platform to a comprehensive clinical system supporting both Researchers and Therapists.

**Current Status**: Advanced clinical prototype with patient management, EMG analysis, and treatment tracking already implemented.

**Target**: Production-ready role-based system with secure data isolation and clinical workflows.

## Phase 1: Foundation & Authentication (Weeks 1-2)

### Backend Infrastructure Setup

#### 1.1 Database Schema Extension
**Priority**: HIGH | **Estimated**: 3 days | **Assignee**: Backend Developer

#### Step 1.1.1: Create Migration Files
**Time**: 2 hours

1. **Create migration directory structure**:
```bash
mkdir -p supabase_config/migrations
cd supabase_config/migrations
```

2. **Create migration file** `001_role_based_tables.sql`:
```sql
-- Migration: 001_role_based_tables.sql
-- Purpose: Add role-based access control tables for therapist/researcher separation
-- Author: [Your Name]
-- Date: [Current Date]

BEGIN;

-- Step 1: Extend existing researcher_profiles table
ALTER TABLE researcher_profiles 
ADD COLUMN IF NOT EXISTS patient_management_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS specialization VARCHAR(100);

-- Step 2: Create patients table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code VARCHAR(50) UNIQUE NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  condition_type TEXT,
  therapy_start_date DATE,
  therapy_end_date DATE,
  demographics JSONB DEFAULT '{}',
  medical_history JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_therapy_dates CHECK (therapy_end_date IS NULL OR therapy_end_date >= therapy_start_date),
  CONSTRAINT valid_birth_date CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE)
);

-- Step 3: Create therapist-patient assignments table
CREATE TABLE IF NOT EXISTS therapist_patient_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assigned_date DATE DEFAULT CURRENT_DATE,
  assignment_reason TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate assignments
  UNIQUE(therapist_id, patient_id)
);

-- Step 4: Create C3D sessions table
CREATE TABLE IF NOT EXISTS c3d_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL, -- Store original filename
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL, -- NULL for research data
  therapist_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for research data
  session_date DATE DEFAULT CURRENT_DATE,
  session_type VARCHAR(50) DEFAULT 'therapy' CHECK (session_type IN ('therapy', 'assessment', 'research', 'baseline')),
  file_path TEXT, -- Supabase storage path
  file_size BIGINT, -- File size in bytes
  analysis_results JSONB DEFAULT '{}', -- Cached EMG analysis
  metadata JSONB DEFAULT '{}', -- Game metadata, session parameters
  clinical_notes TEXT,
  processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure patient sessions have therapist assigned
  CONSTRAINT patient_therapist_required CHECK (
    (patient_id IS NULL AND session_type = 'research') OR
    (patient_id IS NOT NULL AND therapist_id IS NOT NULL)
  )
);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_patients_code ON patients(patient_code);
CREATE INDEX IF NOT EXISTS idx_therapist_assignments_active ON therapist_patient_assignments(therapist_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_therapist_assignments_patient ON therapist_patient_assignments(patient_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_c3d_sessions_patient ON c3d_sessions(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_c3d_sessions_therapist ON c3d_sessions(therapist_id) WHERE therapist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_c3d_sessions_date ON c3d_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_c3d_sessions_type ON c3d_sessions(session_type);

COMMIT;
```

#### Step 1.1.2: Create Row Level Security Policies
**Time**: 3 hours

3. **Create RLS policies file** `002_row_level_security.sql`:
```sql
-- Migration: 002_row_level_security.sql  
-- Purpose: Implement row-level security for role-based data access
-- Author: [Your Name]
-- Date: [Current Date]

BEGIN;

-- Enable RLS on all tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_patient_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE c3d_sessions ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role from JWT
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::JSON ->> 'role',
    'researcher' -- Default role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PATIENTS TABLE POLICIES
-- Policy 1: Researchers can see all patients (but data will be anonymized in application layer)
CREATE POLICY "researchers_see_all_patients" ON patients
  FOR SELECT USING (auth.get_user_role() = 'researcher');

-- Policy 2: Therapists can only see assigned patients
CREATE POLICY "therapists_see_assigned_patients" ON patients
  FOR SELECT USING (
    auth.get_user_role() = 'therapist' AND
    EXISTS (
      SELECT 1 FROM therapist_patient_assignments tpa
      WHERE tpa.patient_id = patients.id 
      AND tpa.therapist_id = auth.uid()
      AND tpa.is_active = true
    )
  );

-- Policy 3: Therapists can only modify assigned patients
CREATE POLICY "therapists_modify_assigned_patients" ON patients
  FOR ALL USING (
    auth.get_user_role() = 'therapist' AND
    EXISTS (
      SELECT 1 FROM therapist_patient_assignments tpa
      WHERE tpa.patient_id = patients.id 
      AND tpa.therapist_id = auth.uid()
      AND tpa.is_active = true
    )
  );

-- Policy 4: Admins can do everything with patients
CREATE POLICY "admins_full_patient_access" ON patients
  FOR ALL USING (auth.get_user_role() = 'admin');

-- THERAPIST ASSIGNMENTS TABLE POLICIES
-- Policy 1: Therapists can see their own assignments
CREATE POLICY "therapists_see_own_assignments" ON therapist_patient_assignments
  FOR SELECT USING (
    auth.get_user_role() = 'therapist' AND
    therapist_id = auth.uid()
  );

-- Policy 2: Admins can manage all assignments
CREATE POLICY "admins_manage_assignments" ON therapist_patient_assignments
  FOR ALL USING (auth.get_user_role() = 'admin');

-- C3D SESSIONS TABLE POLICIES  
-- Policy 1: Researchers can see research sessions (anonymized)
CREATE POLICY "researchers_see_research_sessions" ON c3d_sessions
  FOR SELECT USING (
    auth.get_user_role() = 'researcher' AND
    session_type = 'research'
  );

-- Policy 2: Therapists can see sessions for their assigned patients
CREATE POLICY "therapists_see_patient_sessions" ON c3d_sessions
  FOR SELECT USING (
    auth.get_user_role() = 'therapist' AND
    therapist_id = auth.uid()
  );

-- Policy 3: Therapists can create/modify sessions for their patients
CREATE POLICY "therapists_manage_patient_sessions" ON c3d_sessions
  FOR ALL USING (
    auth.get_user_role() = 'therapist' AND
    (
      -- Creating new session
      (therapist_id = auth.uid()) OR
      -- Modifying existing session they own
      (therapist_id = auth.uid() AND patient_id IN (
        SELECT tpa.patient_id FROM therapist_patient_assignments tpa
        WHERE tpa.therapist_id = auth.uid() AND tpa.is_active = true
      ))
    )
  );

-- Policy 4: Admins can access all sessions
CREATE POLICY "admins_full_session_access" ON c3d_sessions
  FOR ALL USING (auth.get_user_role() = 'admin');

COMMIT;
```

#### Step 1.1.3: Create Test Data and Validation
**Time**: 2 hours

4. **Create test data file** `003_test_data.sql`:
```sql
-- Migration: 003_test_data.sql
-- Purpose: Create test data for role-based system validation
-- Author: [Your Name] 
-- Date: [Current Date]

BEGIN;

-- Insert test patients
INSERT INTO patients (patient_code, condition_type, therapy_start_date, is_active) VALUES
  ('PT001', 'Knee Rehabilitation', CURRENT_DATE - INTERVAL '30 days', true),
  ('PT002', 'Shoulder Recovery', CURRENT_DATE - INTERVAL '20 days', true),
  ('PT003', 'Hip Replacement Recovery', CURRENT_DATE - INTERVAL '45 days', true),
  ('PT004', 'ACL Reconstruction', CURRENT_DATE - INTERVAL '60 days', false)
ON CONFLICT (patient_code) DO NOTHING;

-- Note: Therapist assignments and sessions will be created through the application
-- after user authentication is properly set up

COMMIT;
```

#### Step 1.1.4: Create Rollback Script
**Time**: 1 hour

5. **Create rollback file** `rollback_role_based_tables.sql`:
```sql
-- Rollback script for role-based tables migration
-- Run this if you need to undo the migration

BEGIN;

-- Drop policies first
DROP POLICY IF EXISTS "researchers_see_all_patients" ON patients;
DROP POLICY IF EXISTS "therapists_see_assigned_patients" ON patients;
DROP POLICY IF EXISTS "therapists_modify_assigned_patients" ON patients;
DROP POLICY IF EXISTS "admins_full_patient_access" ON patients;
DROP POLICY IF EXISTS "therapists_see_own_assignments" ON therapist_patient_assignments;
DROP POLICY IF EXISTS "admins_manage_assignments" ON therapist_patient_assignments;
DROP POLICY IF EXISTS "researchers_see_research_sessions" ON c3d_sessions;
DROP POLICY IF EXISTS "therapists_see_patient_sessions" ON c3d_sessions;
DROP POLICY IF EXISTS "therapists_manage_patient_sessions" ON c3d_sessions;
DROP POLICY IF EXISTS "admins_full_session_access" ON c3d_sessions;

-- Drop helper function
DROP FUNCTION IF EXISTS auth.get_user_role();

-- Drop indexes
DROP INDEX IF EXISTS idx_patients_active;
DROP INDEX IF EXISTS idx_patients_code;
DROP INDEX IF EXISTS idx_therapist_assignments_active;
DROP INDEX IF EXISTS idx_therapist_assignments_patient;
DROP INDEX IF EXISTS idx_c3d_sessions_patient;
DROP INDEX IF EXISTS idx_c3d_sessions_therapist;
DROP INDEX IF EXISTS idx_c3d_sessions_date;
DROP INDEX IF EXISTS idx_c3d_sessions_type;

-- Drop tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS c3d_sessions;
DROP TABLE IF EXISTS therapist_patient_assignments;
DROP TABLE IF EXISTS patients;

-- Rollback researcher_profiles changes
ALTER TABLE researcher_profiles 
DROP COLUMN IF EXISTS patient_management_enabled,
DROP COLUMN IF EXISTS department,
DROP COLUMN IF EXISTS specialization;

COMMIT;
```

#### Step 1.1.5: Run Migrations and Test
**Time**: 3 hours

6. **Execute migration commands**:
```bash
# Navigate to project root
cd /path/to/emg-c3d-analyzer

# Connect to Supabase (replace with your project details)
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
npx supabase db push

# Alternative: Manual execution via Supabase Dashboard
# 1. Go to Supabase Dashboard > SQL Editor
# 2. Copy and paste each migration file content
# 3. Execute in order: 001, 002, 003
```

7. **Validation queries** to run after migration:
```sql
-- Test 1: Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('patients', 'therapist_patient_assignments', 'c3d_sessions');

-- Test 2: Verify policies exist
SELECT policyname, tablename FROM pg_policies 
WHERE tablename IN ('patients', 'therapist_patient_assignments', 'c3d_sessions');

-- Test 3: Check test data
SELECT patient_code, condition_type FROM patients;

-- Test 4: Verify foreign key constraints
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('therapist_patient_assignments', 'c3d_sessions');
```

**Acceptance Criteria**:
- [ ] All migration files created and documented
- [ ] Tables created with proper constraints and indexes
- [ ] Row Level Security policies implemented and tested  
- [ ] Foreign key relationships working correctly
- [ ] Test data inserted successfully
- [ ] Rollback script tested and confirmed working
- [ ] All validation queries return expected results
- [ ] Documentation updated with schema changes

**Common Issues to Watch For**:
- UUID generation not working → Check if `gen_random_uuid()` extension is enabled
- RLS policies blocking legitimate access → Test with different user roles
- Foreign key constraint violations → Ensure proper order of operations
- Index creation failures → Check for naming conflicts with existing indexes

#### 1.2 Backend API Enhancement
**Priority**: HIGH | **Estimated**: 4 days

**File**: `backend/middleware/role_based_access.py`
```python
class RoleBasedAccessMiddleware:
    """Middleware to enforce role-based data access"""
    
    async def __call__(self, request: Request, call_next):
        # Extract user role from JWT token
        user_role = await self.extract_user_role(request)
        user_id = await self.extract_user_id(request)
        
        # Apply data filtering based on role
        if user_role == 'therapist':
            request.state.data_filter = {
                'patient_scope': await self.get_therapist_patients(user_id),
                'role': 'therapist'
            }
        elif user_role == 'researcher':
            request.state.data_filter = {
                'global_access': True,
                'anonymize': True,
                'role': 'researcher'
            }
        elif user_role == 'admin':
            request.state.data_filter = {
                'admin_access': True,
                'role': 'admin'
            }
        
        return await call_next(request)
```

**New API Endpoints**:
```python
# Patient Management
@app.get="/api/patients"
@app.post="/api/patients" 
@app.put="/api/patients/{patient_id}"
@app.delete="/api/patients/{patient_id}"

# Patient Assignments
@app.get="/api/therapist-assignments"
@app.post="/api/therapist-assignments"
@app.delete="/api/therapist-assignments/{assignment_id}"

# Enhanced C3D Sessions
@app.get="/api/c3d-sessions" # Role-filtered
@app.post="/api/c3d-sessions" # With patient linking
@app.get="/api/c3d-sessions/{session_id}/analysis"

# Dashboard Data
@app.get="/api/dashboard-data" # Role-specific content
```

**Acceptance Criteria**:
- [ ] Role-based middleware implemented and tested
- [ ] All new endpoints created with proper validation
- [ ] Data filtering works correctly for each role
- [ ] API documentation updated
- [ ] Integration tests passing

### Frontend Authentication Enhancement

#### 1.3 Role-Based Routing System
**Priority**: HIGH | **Estimated**: 3 days

**File**: `frontend/src/components/auth/RoleBasedRoute.tsx`
```typescript
interface RoleBasedRouteProps {
  children: React.ReactNode;
  requiredRole: 'researcher' | 'therapist' | 'admin';
  fallback?: React.ReactNode;
}

const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({ 
  children, 
  requiredRole, 
  fallback 
}) => {
  const { authState } = useAuth();
  
  if (!authState.profile?.role) {
    return <UnauthorizedAccess />;
  }
  
  const hasAccess = checkRolePermissions(authState.profile.role, requiredRole);
  
  if (!hasAccess) {
    return fallback || <InsufficientPermissions requiredRole={requiredRole} />;
  }
  
  return <>{children}</>;
};
```

**File**: `frontend/src/App.tsx` (Enhanced)
```typescript
function App() {
  const { authState } = useAuth();
  
  return (
    <Router>
      <Routes>
        {/* Research Dashboard - Current interface */}
        <Route path="/research/*" element={
          <RoleBasedRoute requiredRole="researcher">
            <ResearchDashboard />
          </RoleBasedRoute>
        } />
        
        {/* Clinical Dashboard - New therapist interface */}
        <Route path="/clinical/*" element={
          <RoleBasedRoute requiredRole="therapist">
            <TherapistDashboard />
          </RoleBasedRoute>
        } />
        
        {/* Admin Dashboard */}
        <Route path="/admin/*" element={
          <RoleBasedRoute requiredRole="admin">
            <AdminDashboard />
          </RoleBasedRoute>
        } />
        
        {/* Role-based redirect */}
        <Route path="/" element={<RoleBasedRedirect />} />
      </Routes>
    </Router>
  );
}
```

**Acceptance Criteria**:
- [ ] Role-based routing implemented
- [ ] Unauthorized access properly blocked
- [ ] Redirect logic works for all roles
- [ ] Fallback components render correctly

#### 1.4 Enhanced AuthGuard Integration
**Priority**: MEDIUM | **Estimated**: 2 days

**Enhancement to existing**: `frontend/src/components/auth/AuthGuard.tsx`
```typescript
// Extend existing AuthGuard to include role detection
const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const { isAuthenticated, isLoading, authState } = useAuth();
  
  // Existing loading and error handling...
  
  // Add role-based redirect logic
  if (isAuthenticated && authState.profile?.role) {
    const currentPath = window.location.pathname;
    const userRole = authState.profile.role;
    
    // Redirect to appropriate dashboard if on root
    if (currentPath === '/') {
      if (userRole === 'researcher') window.location.href = '/research';
      else if (userRole === 'therapist') window.location.href = '/clinical';
      else if (userRole === 'admin') window.location.href = '/admin';
    }
  }
  
  return <>{children}</>;
};
```

## Phase 2: Therapist Dashboard Development (Weeks 3-4)

### 2.1 Patient Management Interface
**Priority**: HIGH | **Estimated**: 5 days

**Leverage existing components**: Build on current `patient-list.tsx`, `patient-profile.tsx`

**File**: `frontend/src/pages/clinical/PatientManagement.tsx`
```typescript
const PatientManagement: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  
  // Use existing patient management hooks and components
  // Enhance with therapist-specific filtering
  
  return (
    <div className="patient-management">
      <PatientSearchAndActions />
      <PatientTable 
        patients={patients}
        onSelectPatient={setSelectedPatient}
        isTherapistView={true}
      />
      {showAddPatient && <AddPatientModal />}
    </div>
  );
};
```

**Enhanced Components**:
- Extend existing `PatientList` for therapist scope
- Add patient assignment management
- Integrate with existing treatment timeline components

**Acceptance Criteria**:
- [ ] Therapist can view only assigned patients
- [ ] Patient CRUD operations work correctly
- [ ] Assignment management functional
- [ ] Integration with existing components seamless

### 2.2 Session Management with Patient Context
**Priority**: HIGH | **Estimated**: 4 days

**File**: `frontend/src/pages/clinical/SessionManagement.tsx`
```typescript
const SessionManagement: React.FC<{
  selectedPatient: Patient | null;
}> = ({ selectedPatient }) => {
  const [sessions, setSessions] = useState<C3DSession[]>([]);
  
  // Leverage existing session components
  // Add patient context and filtering
  
  return (
    <div className="session-management">
      <PatientHeader patient={selectedPatient} />
      <SessionUploadWithPatientLink />
      <SessionTimeline 
        sessions={sessions}
        patientContext={selectedPatient}
      />
    </div>
  );
};
```

**Integration Points**:
- Enhance existing `c3d-upload.tsx` with patient selection
- Extend `sessions-list.tsx` with patient filtering
- Integrate with current EMG analysis interface

**Acceptance Criteria**:
- [ ] C3D upload links to specific patients
- [ ] Session history filtered by patient
- [ ] EMG analysis retains patient context
- [ ] Progress comparison tools functional

### 2.3 Clinical Dashboard Layout
**Priority**: MEDIUM | **Estimated**: 3 days

**File**: `frontend/src/layouts/TherapistDashboard.tsx`
```typescript
const TherapistDashboard: React.FC = () => {
  return (
    <div className="therapist-dashboard">
      <Header role="therapist" />
      <Sidebar>
        <NavItem to="/clinical/overview">Overview</NavItem>
        <NavItem to="/clinical/patients">My Patients</NavItem>
        <NavItem to="/clinical/sessions">Recent Sessions</NavItem>
        <NavItem to="/clinical/reports">Progress Reports</NavItem>
      </Sidebar>
      <MainContent>
        <Routes>
          <Route path="overview" element={<TherapistOverview />} />
          <Route path="patients" element={<PatientManagement />} />
          <Route path="sessions" element={<SessionManagement />} />
          <Route path="reports" element={<ProgressReports />} />
        </Routes>
      </MainContent>
    </div>
  );
};
```

## Phase 3: Integration & Enhancement (Weeks 5-6)

### 3.1 Data Integration & Migration
**Priority**: HIGH | **Estimated**: 3 days

**Tasks**:
- Migrate existing patient data to new schema
- Link historical C3D sessions to patients where possible
- Ensure data integrity and relationships
- Create data seeding scripts for testing

**Scripts**:
```sql
-- Data migration script
-- Link existing sessions to demo patients for testing
INSERT INTO patients (patient_code, condition_type) 
VALUES ('DEMO001', 'Knee Rehabilitation'), ('DEMO002', 'Shoulder Recovery');

-- Create demo therapist assignments
INSERT INTO therapist_patient_assignments (therapist_id, patient_id)
SELECT u.id, p.id 
FROM auth.users u, patients p 
WHERE u.email = 'therapist@demo.com' AND p.patient_code IN ('DEMO001', 'DEMO002');
```

### 3.2 Security & Compliance Implementation
**Priority**: HIGH | **Estimated**: 4 days

**Tasks**:
- Implement audit logging for all data access
- Add data retention policies
- Create compliance reporting tools
- Security testing and penetration testing

**File**: `backend/middleware/audit_logging.py`
```python
class AuditLoggingMiddleware:
    """Log all data access for compliance"""
    
    async def log_access(self, user_id: str, action: str, resource: str, patient_id: str = None):
        # Log to secure audit table
        pass
```

### 3.3 Clinical Reporting & Analytics
**Priority**: MEDIUM | **Estimated**: 3 days

**Components**:
- Progress comparison tools
- Clinical report generation
- Treatment outcome analytics
- Export functionality for clinical documentation

## Testing & Quality Assurance

### Unit Testing
**Estimated**: 2 days throughout implementation

**Coverage Requirements**:
- [ ] Backend API endpoints: >90% coverage
- [ ] Role-based access control: 100% coverage
- [ ] Frontend components: >80% coverage
- [ ] Database operations: 100% coverage

### Integration Testing
**Estimated**: 3 days

**Test Scenarios**:
- [ ] End-to-end role-based workflows
- [ ] Data isolation between roles
- [ ] Patient assignment and access control
- [ ] C3D upload and analysis with patient context

### Security Testing
**Estimated**: 2 days

**Test Areas**:
- [ ] Role-based access enforcement
- [ ] Data leakage prevention
- [ ] SQL injection protection
- [ ] Authentication bypass attempts

## Deployment Strategy

### Environment Setup
**Development**: Feature branches with role-based testing
**Staging**: Full integration testing with production-like data
**Production**: Gradual rollout with monitoring

### Rollback Plan
- Database migration rollback scripts
- Feature flag system for gradual enablement
- Data backup and recovery procedures

## Success Metrics & Monitoring

### Technical Metrics
- [ ] API response time <2s for all endpoints
- [ ] Zero unauthorized data access incidents
- [ ] 99.9% uptime for clinical workflows

### User Adoption Metrics
- [ ] >80% therapist adoption within 30 days
- [ ] >90% of therapy sessions recorded in system
- [ ] <5 support tickets per week after initial rollout

### Clinical Impact Metrics
- [ ] 50% reduction in manual progress tracking time
- [ ] >95% patient data accuracy
- [ ] Positive user satisfaction scores >4.0/5.0

## Risk Mitigation

### Technical Risks
**Risk**: Role-based access complexity
**Mitigation**: Comprehensive testing, gradual rollout, expert code review

**Risk**: Data migration issues
**Mitigation**: Staged migration, extensive backup procedures, rollback scripts

### Clinical Risks
**Risk**: Workflow disruption for therapists
**Mitigation**: Training programs, parallel system operation, user feedback integration

**Risk**: Patient data privacy concerns
**Mitigation**: HIPAA compliance audit, encryption at rest and in transit, access monitoring

## Conclusion

This action plan provides a systematic approach to implementing role-based access control in the GHOSTLY+ EMG C3D Analyzer. By building on the existing comprehensive prototype, the implementation focuses on adding the missing role-based infrastructure while preserving and enhancing current capabilities.

The phased approach ensures minimal disruption to current users while systematically adding the clinical workflow features needed for therapist users. The monorepo structure maintains tight integration between components while enabling role-specific functionality.

Success depends on careful attention to security, thorough testing, and close collaboration with clinical users throughout the implementation process.