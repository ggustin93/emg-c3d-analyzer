# Role-Based System Implementation Action Plan

## Executive Summary

This action plan outlines the systematic implementation of role-based access control (RBAC) for the GHOSTLY+ EMG C3D Analyzer, evolving from the current research-focused platform to a comprehensive clinical system supporting both Researchers and Therapists.

**Current Status**: Advanced clinical prototype with patient management, EMG analysis, and treatment tracking already implemented.

**Target**: Production-ready role-based system with secure data isolation and clinical workflows.

## Pre-Implementation: Critical Documentation (Week 0)

### 0.1 API Documentation Creation
**Priority**: CRITICAL | **Estimated**: 1 day | **Assignee**: Technical Writer + Backend Developer

#### Step 0.1.1: Create Comprehensive API Documentation
**Time**: 8 hours

1. **Create API documentation file** `docs/api.md`:

```markdown
# GHOSTLY+ EMG C3D Analyzer API Documentation

## Authentication & Authorization

### Authentication Flow
- **Method**: JWT Bearer Token via Supabase Authentication
- **Header**: `Authorization: Bearer <jwt_token>`
- **Token Expiry**: 1 hour (auto-refresh)
- **Role Field**: `role` claim in JWT payload

### User Roles & Permissions

| Role | Permissions | Data Access |
|------|-------------|-------------|
| `researcher` | Read, Analyze, Export | Global (anonymized) |
| `therapist` | Read, Analyze, Export, Patient Management | Assigned patients only |
| `admin` | Full access | All data |

## Current API Endpoints (Research Version)

### 1. Root Endpoint
```http
GET /
```
**Description**: API information and health check
**Authentication**: None required
**Response**:
```json
{
  "name": "GHOSTLY+ EMG Analysis API",
  "version": "1.0.0",
  "description": "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game",
  "endpoints": {
    "upload": "POST /upload - Upload and process a C3D file",
    "export": "POST /export - Export comprehensive analysis data as JSON"
  }
}
```

### 2. C3D File Upload & Analysis
```http
POST /upload
```
**Description**: Upload C3D file and get complete EMG analysis
**Authentication**: Required (All roles)
**Content-Type**: `multipart/form-data`

**Request Parameters**:
```typescript
interface UploadRequest {
  // File upload
  file: File; // C3D file (required)
  
  // Session identification
  user_id?: string;
  patient_id?: string; // Therapist role only
  session_id?: string;
  
  // Processing parameters
  threshold_factor?: number; // Default: 2.5
  min_duration_ms?: number; // Default: 1000
  smoothing_window?: number; // Default: 50
  
  // Game session parameters
  session_mvc_value?: number;
  session_mvc_threshold_percentage?: number; // Default: 75
  session_expected_contractions?: number;
  session_expected_contractions_ch1?: number;
  session_expected_contractions_ch2?: number;
}
```

**Response Model**:
```typescript
interface EMGAnalysisResult {
  file_id: string;
  timestamp: string;
  source_filename: string;
  metadata: GameMetadata;
  analytics: Record<string, ChannelAnalytics>;
  available_channels: string[];
  emg_signals: Record<string, EMGChannelSignalData>;
  user_id?: string;
  patient_id?: string;
  session_id?: string;
}

interface GameMetadata {
  duration?: number;
  score?: number;
  level?: number;
  difficulty?: string;
  session_parameters_used?: GameSessionParameters;
}

interface ChannelAnalytics {
  contraction_count: number;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  total_time_under_tension_ms: number;
  avg_amplitude: number;
  max_amplitude: number;
  rms: number;
  mav: number;
  mpf?: number;
  mdf?: number;
  fatigue_index_fi_nsm5?: number;
  contractions: Contraction[];
}

interface EMGChannelSignalData {
  sampling_rate: number;
  time_axis: number[];
  data: number[]; // Primary C3D signal
  rms_envelope?: number[];
  activated_data?: number[];
}
```

### 3. Data Export
```http
POST /export
```
**Description**: Export comprehensive analysis data
**Authentication**: Required (All roles)
**Content-Type**: `application/json`

**Request**:
```json
{
  "analysis_result": "EMGAnalysisResult object",
  "export_format": "json"
}
```

**Response**: Binary file download

## Planned API Endpoints (Role-Based Version)

### Patient Management (Therapist/Admin Only)

#### Get Patients
```http
GET /api/patients
```
**Roles**: `therapist`, `admin`  
**Description**: Get patients based on user role and permissions

**Response**:
```json
[
  {
    "id": "uuid",
    "patient_code": "PT001",
    "condition_type": "Knee Rehabilitation",
    "therapy_start_date": "2025-01-01",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

#### Get Specific Patient
```http
GET /api/patients/{patient_id}
```
**Roles**: `therapist` (assigned only), `admin`

#### Create Patient
```http
POST /api/patients
```
**Roles**: `therapist`, `admin`
**Body**:
```json
{
  "patient_code": "PT001",
  "date_of_birth": "1990-01-01",
  "gender": "male",
  "condition_type": "Knee Rehabilitation",
  "therapy_start_date": "2025-01-01"
}
```

#### Update Patient
```http
PUT /api/patients/{patient_id}
```
**Roles**: `therapist` (assigned only), `admin`

#### Deactivate Patient
```http
DELETE /api/patients/{patient_id}
```
**Roles**: `admin` only

### C3D Session Management

#### Get Sessions
```http
GET /api/c3d-sessions
```
**Roles**: All (filtered by role)
- `researcher`: Only research sessions (anonymized)
- `therapist`: Only assigned patient sessions
- `admin`: All sessions

**Query Parameters**:
- `patient_id`: Filter by patient (therapist/admin)
- `session_type`: Filter by type (therapy, assessment, research)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

#### Get Specific Session
```http
GET /api/c3d-sessions/{session_id}
```
**Access**: Role-based filtering applied

#### Create Session
```http
POST /api/c3d-sessions
```
**Roles**: `therapist`, `admin`
**Description**: Create C3D session with patient linking

#### Add Clinical Notes
```http
PATCH /api/c3d-sessions/{session_id}/notes
```
**Roles**: `therapist`, `admin`
**Body**:
```json
{
  "clinical_notes": "Patient showed improvement in mobility..."
}
```

### Dashboard Data

#### Get Dashboard Data
```http
GET /api/dashboard-data
```
**Description**: Role-specific dashboard content
**Roles**: All (different responses per role)

**Researcher Response**:
```json
{
  "total_sessions": 150,
  "analysis_types": ["research"],
  "recent_analyses": [...],
  "statistics": {
    "total_participants": 45,
    "avg_session_duration": 180
  }
}
```

**Therapist Response**:
```json
{
  "assigned_patients": 12,
  "recent_sessions": [...],
  "pending_analyses": 3,
  "patient_progress": [...]
}
```

## Error Handling

### Standard Error Response
```json
{
  "detail": "Error message",
  "error_code": "VALIDATION_ERROR",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

### Common Error Codes
- `401`: Authentication required
- `403`: Insufficient permissions
- `404`: Resource not found
- `400`: Validation error
- `429`: Rate limit exceeded
- `500`: Internal server error

### Role-Based Access Errors
```json
{
  "detail": "Access denied to this patient",
  "error_code": "FORBIDDEN_PATIENT_ACCESS",
  "allowed_roles": ["admin"],
  "user_role": "therapist"
}
```

## Rate Limiting
- **Researcher**: 100 requests/hour
- **Therapist**: 500 requests/hour  
- **Admin**: Unlimited

## Security Considerations
- All endpoints require HTTPS in production
- JWT tokens expire after 1 hour
- Row Level Security enforced at database level
- Patient data anonymized for researchers
- Audit logging for all data access
- IP-based rate limiting
- CORS configured for frontend domains only

## Development & Testing
- **Base URL (Dev)**: `http://localhost:8080`
- **Base URL (Prod)**: `https://your-api-domain.com`
- **OpenAPI Docs**: `/docs`
- **Health Check**: `/health`
```

### 0.2 Database Schema Documentation
**Priority**: CRITICAL | **Estimated**: 1 day | **Assignee**: Database Administrator + Backend Developer

#### Step 0.2.1: Create Database Schema Documentation using Supabase MCP
**Time**: 8 hours

2. **Create database schema documentation** `docs/db_schema.md`:

```markdown
# GHOSTLY+ EMG C3D Analyzer Database Schema

## Overview
This document describes the complete database schema for the role-based EMG C3D Analyzer system built on Supabase PostgreSQL.

## Authentication Tables (Supabase Built-in)

### auth.users
**Purpose**: Core user authentication (managed by Supabase)
```sql
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  encrypted_password VARCHAR(255),
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### researcher_profiles (Extended User Profiles)
**Purpose**: Extended user profile information with role-based permissions
```sql
CREATE TABLE researcher_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  institution VARCHAR(255),
  department VARCHAR(100),
  specialization VARCHAR(100),
  role VARCHAR(50) DEFAULT 'researcher' CHECK (role IN ('researcher', 'therapist', 'admin', 'clinical_specialist')),
  access_level VARCHAR(20) DEFAULT 'basic' CHECK (access_level IN ('basic', 'advanced', 'full')),
  patient_management_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_researcher_profiles_role ON researcher_profiles(role);
CREATE INDEX idx_researcher_profiles_active ON researcher_profiles(is_active) WHERE is_active = true;
```

## Patient Management Tables

### patients
**Purpose**: Patient information for clinical workflows
```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code VARCHAR(50) UNIQUE NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  condition_type TEXT,
  therapy_start_date DATE,
  therapy_end_date DATE,
  demographics JSONB DEFAULT '{}',
  medical_history JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_therapy_dates CHECK (therapy_end_date IS NULL OR therapy_end_date >= therapy_start_date),
  CONSTRAINT valid_birth_date CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE)
);

-- Indexes for performance
CREATE INDEX idx_patients_active ON patients(is_active) WHERE is_active = true;
CREATE INDEX idx_patients_code ON patients(patient_code);
CREATE INDEX idx_patients_condition ON patients(condition_type);
CREATE INDEX idx_patients_therapy_dates ON patients(therapy_start_date, therapy_end_date);
```

### therapist_patient_assignments
**Purpose**: Many-to-many relationship between therapists and patients
```sql
CREATE TABLE therapist_patient_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assigned_date DATE DEFAULT CURRENT_DATE,
  assignment_reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate assignments
  UNIQUE(therapist_id, patient_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_therapist_assignments_active ON therapist_patient_assignments(therapist_id, is_active) WHERE is_active = true;
CREATE INDEX idx_therapist_assignments_patient ON therapist_patient_assignments(patient_id, is_active) WHERE is_active = true;
CREATE INDEX idx_therapist_assignments_date ON therapist_patient_assignments(assigned_date);
```

## C3D Session Management

### c3d_sessions
**Purpose**: C3D file sessions with patient context and analysis results
```sql
CREATE TABLE c3d_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Business rules
  CONSTRAINT patient_therapist_required CHECK (
    (patient_id IS NULL AND session_type = 'research') OR
    (patient_id IS NOT NULL AND therapist_id IS NOT NULL)
  )
);

-- Performance indexes
CREATE INDEX idx_c3d_sessions_patient ON c3d_sessions(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_c3d_sessions_therapist ON c3d_sessions(therapist_id) WHERE therapist_id IS NOT NULL;
CREATE INDEX idx_c3d_sessions_date ON c3d_sessions(session_date);
CREATE INDEX idx_c3d_sessions_type ON c3d_sessions(session_type);
CREATE INDEX idx_c3d_sessions_status ON c3d_sessions(processing_status);
```

## Row Level Security (RLS) Policies

### Helper Functions
```sql
-- Get user role from JWT token
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::JSON ->> 'role',
    'researcher' -- Default role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is therapist assigned to patient
CREATE OR REPLACE FUNCTION auth.is_assigned_therapist(patient_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM therapist_patient_assignments tpa
    WHERE tpa.patient_id = patient_uuid 
    AND tpa.therapist_id = auth.uid()
    AND tpa.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Patient Table Policies
```sql
-- Enable RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Researchers can see all patients (data anonymized in application layer)
CREATE POLICY "researchers_see_all_patients" ON patients
  FOR SELECT USING (auth.get_user_role() = 'researcher');

-- Therapists can only see assigned patients
CREATE POLICY "therapists_see_assigned_patients" ON patients
  FOR SELECT USING (
    auth.get_user_role() = 'therapist' AND
    auth.is_assigned_therapist(patients.id)
  );

-- Therapists can modify assigned patients
CREATE POLICY "therapists_modify_assigned_patients" ON patients
  FOR ALL USING (
    auth.get_user_role() = 'therapist' AND
    auth.is_assigned_therapist(patients.id)
  );

-- Admins have full access
CREATE POLICY "admins_full_patient_access" ON patients
  FOR ALL USING (auth.get_user_role() = 'admin');
```

### Assignment Table Policies
```sql
ALTER TABLE therapist_patient_assignments ENABLE ROW LEVEL SECURITY;

-- Therapists see their own assignments
CREATE POLICY "therapists_see_own_assignments" ON therapist_patient_assignments
  FOR SELECT USING (
    auth.get_user_role() = 'therapist' AND
    therapist_id = auth.uid()
  );

-- Admins manage all assignments
CREATE POLICY "admins_manage_assignments" ON therapist_patient_assignments
  FOR ALL USING (auth.get_user_role() = 'admin');
```

### C3D Sessions Policies
```sql
ALTER TABLE c3d_sessions ENABLE ROW LEVEL SECURITY;

-- Researchers see research sessions only
CREATE POLICY "researchers_see_research_sessions" ON c3d_sessions
  FOR SELECT USING (
    auth.get_user_role() = 'researcher' AND
    session_type = 'research'
  );

-- Therapists see sessions for assigned patients
CREATE POLICY "therapists_see_patient_sessions" ON c3d_sessions
  FOR SELECT USING (
    auth.get_user_role() = 'therapist' AND
    therapist_id = auth.uid()
  );

-- Therapists manage sessions for their patients
CREATE POLICY "therapists_manage_patient_sessions" ON c3d_sessions
  FOR ALL USING (
    auth.get_user_role() = 'therapist' AND
    therapist_id = auth.uid() AND
    patient_id IN (
      SELECT tpa.patient_id FROM therapist_patient_assignments tpa
      WHERE tpa.therapist_id = auth.uid() AND tpa.is_active = true
    )
  );

-- Admins access all sessions
CREATE POLICY "admins_full_session_access" ON c3d_sessions
  FOR ALL USING (auth.get_user_role() = 'admin');
```

## Data Relationships

### Entity Relationship Diagram
```
auth.users (1) ←→ (1) researcher_profiles
     ↓
     ↓ (1:M)
     ↓
therapist_patient_assignments (M:M) ←→ patients
     ↓                                    ↓
     ↓ (1:M)                              ↓ (1:M)
     ↓                                    ↓
c3d_sessions ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

### Key Relationships
1. **User → Profile**: One-to-one relationship via foreign key
2. **Therapist → Patient**: Many-to-many via assignment table
3. **Patient → Sessions**: One-to-many relationship
4. **Therapist → Sessions**: One-to-many relationship
5. **Session → Analysis**: Embedded JSONB data

## Performance Optimizations

### Query Optimization
```sql
-- Common therapist query: Get assigned patients with recent sessions
EXPLAIN ANALYZE
SELECT p.*, 
       COUNT(cs.id) as session_count,
       MAX(cs.session_date) as last_session
FROM patients p
JOIN therapist_patient_assignments tpa ON p.id = tpa.patient_id
LEFT JOIN c3d_sessions cs ON p.id = cs.patient_id
WHERE tpa.therapist_id = $1 
  AND tpa.is_active = true 
  AND p.is_active = true
GROUP BY p.id
ORDER BY last_session DESC;
```

### Index Usage Analysis
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Data Retention & Archival

### Retention Policies
```sql
-- Archive old sessions (> 2 years)
CREATE TABLE c3d_sessions_archive (LIKE c3d_sessions INCLUDING ALL);

-- Function to archive old sessions
CREATE OR REPLACE FUNCTION archive_old_sessions()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  INSERT INTO c3d_sessions_archive
  SELECT * FROM c3d_sessions
  WHERE created_at < NOW() - INTERVAL '2 years';
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  DELETE FROM c3d_sessions
  WHERE created_at < NOW() - INTERVAL '2 years';
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly archival
SELECT cron.schedule('archive-sessions', '0 0 1 * *', 'SELECT archive_old_sessions();');
```

## Backup & Recovery

### Backup Strategy
- **Full Backup**: Daily at 2 AM UTC
- **Point-in-Time Recovery**: 30-day retention
- **Cross-Region Replication**: Enabled for disaster recovery

### Recovery Procedures
```sql
-- Restore from backup
pg_restore --host=db.supabase.co --port=5432 --username=postgres --dbname=postgres --clean --create backup_file.dump

-- Point-in-time recovery
SELECT pg_create_restore_point('before_migration');
```

## Compliance & Audit

### Audit Logging
```sql
-- Audit table for data access
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    user_id, action, table_name, record_id, 
    old_values, new_values, ip_address
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    inet_client_addr()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers
CREATE TRIGGER patients_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER c3d_sessions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON c3d_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

### GDPR Compliance
```sql
-- Right to erasure (patient data anonymization)
CREATE OR REPLACE FUNCTION anonymize_patient_data(patient_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Anonymize patient record
  UPDATE patients SET
    patient_code = 'ANON_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    date_of_birth = NULL,
    demographics = '{}',
    medical_history = '{}',
    updated_at = NOW()
  WHERE id = patient_uuid;
  
  -- Anonymize session data
  UPDATE c3d_sessions SET
    clinical_notes = '[ANONYMIZED]',
    metadata = jsonb_set(metadata, '{patient_data}', '"[ANONYMIZED]"'),
    updated_at = NOW()
  WHERE patient_id = patient_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Migration History

### Migration Tracking
```sql
-- Migration log table
CREATE TABLE schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by VARCHAR(255) DEFAULT current_user,
  checksum VARCHAR(255)
);

-- Record migrations
INSERT INTO schema_migrations (version, description, checksum) VALUES
  ('001', 'Create role-based tables', 'abc123'),
  ('002', 'Add RLS policies', 'def456'),
  ('003', 'Add audit logging', 'ghi789');
```

## Development & Testing

### Test Data Generation
```sql
-- Create test patients
INSERT INTO patients (patient_code, condition_type) VALUES
  ('TEST001', 'Unit Test Patient'),
  ('TEST002', 'Integration Test Patient');

-- Create test therapist assignment
INSERT INTO therapist_patient_assignments (therapist_id, patient_id, assignment_reason)
SELECT 
  (SELECT id FROM auth.users WHERE email = 'therapist@test.com'),
  id,
  'Test assignment'
FROM patients WHERE patient_code LIKE 'TEST%';
```

### Performance Testing Queries
```sql
-- Load test: Concurrent patient queries
SELECT COUNT(*) FROM patients p
JOIN therapist_patient_assignments tpa ON p.id = tpa.patient_id
WHERE tpa.therapist_id = $1 AND tpa.is_active = true;

-- Stress test: Large session queries
SELECT * FROM c3d_sessions cs
JOIN patients p ON cs.patient_id = p.id
WHERE cs.therapist_id = $1
ORDER BY cs.created_at DESC
LIMIT 100;
```
```

**Acceptance Criteria**:
- [ ] Complete API documentation with all current and planned endpoints
- [ ] Database schema documentation with RLS policies
- [ ] Performance optimization strategies documented
- [ ] Compliance and audit requirements covered
- [ ] Migration and rollback procedures documented
- [ ] Both documents reviewed and approved by technical team

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
**Priority**: HIGH | **Estimated**: 4 days | **Assignee**: Backend Developer

#### Step 1.2.1: Create Role-Based Middleware
**Time**: 6 hours

1. **Create middleware directory and base files**:
```bash
mkdir -p backend/middleware
touch backend/middleware/__init__.py
touch backend/middleware/role_based_access.py
touch backend/middleware/auth_utils.py
```

2. **Create authentication utilities** `backend/middleware/auth_utils.py`:
```python
"""
Authentication utilities for role-based access control
"""
import jwt
from typing import Optional, Dict, Any
from fastapi import HTTPException, Request
from supabase import create_client, Client
import os

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

async def extract_user_from_token(request: Request) -> Optional[Dict[str, Any]]:
    """Extract user information from JWT token in request headers"""
    try:
        # Get Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        # Extract token
        token = auth_header.split(" ")[1]
        
        # Decode token (Supabase handles JWT verification)
        decoded_token = jwt.decode(token, options={"verify_signature": False})
        
        return {
            'user_id': decoded_token.get('sub'),
            'email': decoded_token.get('email'),
            'role': decoded_token.get('role', 'researcher'),  # Default to researcher
            'aud': decoded_token.get('aud'),
            'exp': decoded_token.get('exp')
        }
    
    except Exception as e:
        print(f"Token extraction error: {e}")
        return None

async def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user profile from Supabase"""
    try:
        response = supabase.table('researcher_profiles').select('*').eq('id', user_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Profile fetch error: {e}")
        return None

async def get_therapist_patients(therapist_id: str) -> list[str]:
    """Get list of patient IDs assigned to therapist"""
    try:
        response = supabase.table('therapist_patient_assignments')\
            .select('patient_id')\
            .eq('therapist_id', therapist_id)\
            .eq('is_active', True)\
            .execute()
        
        return [assignment['patient_id'] for assignment in response.data]
    except Exception as e:
        print(f"Therapist patients fetch error: {e}")
        return []

def anonymize_patient_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Remove or anonymize patient identifying information for researchers"""
    if isinstance(data, dict):
        anonymized = data.copy()
        # Remove identifying fields
        fields_to_remove = ['patient_code', 'date_of_birth', 'demographics', 'medical_history']
        for field in fields_to_remove:
            anonymized.pop(field, None)
        
        # Replace with anonymized IDs
        if 'id' in anonymized:
            anonymized['anonymous_id'] = f"ANON_{hash(anonymized['id']) % 10000:04d}"
            anonymized.pop('id', None)
        
        return anonymized
    return data
```

3. **Create role-based access middleware** `backend/middleware/role_based_access.py`:
```python
"""
Role-based access control middleware for EMG C3D Analyzer
"""
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from .auth_utils import extract_user_from_token, get_user_profile, get_therapist_patients
import time

class RoleBasedAccessMiddleware:
    """Middleware to enforce role-based data access"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Create request object
        request = Request(scope, receive)
        
        # Skip middleware for non-API routes
        if not request.url.path.startswith("/api/"):
            await self.app(scope, receive, send)
            return
        
        # Skip middleware for public endpoints
        public_endpoints = ["/api/health", "/api/docs", "/api/openapi.json"]
        if request.url.path in public_endpoints:
            await self.app(scope, receive, send)
            return
        
        # Extract user information
        user_info = await extract_user_from_token(request)
        
        if not user_info:
            response = JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"}
            )
            await response(scope, receive, send)
            return
        
        # Get user profile
        profile = await get_user_profile(user_info['user_id'])
        if not profile:
            response = JSONResponse(
                status_code=403,
                content={"detail": "User profile not found"}
            )
            await response(scope, receive, send)
            return
        
        # Set user context in request state
        user_role = profile.get('role', 'researcher')
        request.state.user_id = user_info['user_id']
        request.state.user_email = user_info['email']
        request.state.user_role = user_role
        request.state.user_profile = profile
        
        # Apply role-based data filtering
        if user_role == 'therapist':
            patient_ids = await get_therapist_patients(user_info['user_id'])
            request.state.data_filter = {
                'patient_scope': patient_ids,
                'role': 'therapist',
                'can_create_patients': True,
                'can_assign_patients': False,  # Only admins assign patients
                'anonymize_data': False
            }
        elif user_role == 'researcher':
            request.state.data_filter = {
                'global_access': True,
                'role': 'researcher',
                'can_create_patients': False,
                'can_assign_patients': False,
                'anonymize_data': True  # Researchers get anonymized data
            }
        elif user_role == 'admin':
            request.state.data_filter = {
                'admin_access': True,
                'role': 'admin',
                'can_create_patients': True,
                'can_assign_patients': True,
                'anonymize_data': False
            }
        else:
            response = JSONResponse(
                status_code=403,
                content={"detail": f"Unknown role: {user_role}"}
            )
            await response(scope, receive, send)
            return
        
        # Continue to the next middleware/route
        await self.app(scope, receive, send)
```

#### Step 1.2.2: Create Patient Management Endpoints
**Time**: 8 hours

4. **Create patient management module** `backend/services/patient_service.py`:
```python
"""
Patient management service for therapist workflows
"""
from typing import List, Optional, Dict, Any
from datetime import date
from ..middleware.auth_utils import supabase, anonymize_patient_data
from ..models import Patient, PatientCreate, PatientUpdate
from fastapi import HTTPException

class PatientService:
    
    @staticmethod
    async def get_patients(user_role: str, patient_scope: List[str] = None, anonymize: bool = False) -> List[Dict[str, Any]]:
        """Get patients based on user role and scope"""
        try:
            query = supabase.table('patients').select('*')
            
            # Apply role-based filtering
            if user_role == 'therapist' and patient_scope:
                if not patient_scope:  # No assigned patients
                    return []
                query = query.in_('id', patient_scope)
            elif user_role == 'researcher':
                # Researchers see all patients but anonymized
                pass  # No additional filtering needed
            
            # Execute query
            response = query.eq('is_active', True).order('created_at', desc=True).execute()
            
            patients = response.data
            
            # Anonymize data for researchers
            if anonymize:
                patients = [anonymize_patient_data(patient) for patient in patients]
            
            return patients
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching patients: {str(e)}")
    
    @staticmethod
    async def get_patient_by_id(patient_id: str, user_role: str, patient_scope: List[str] = None, anonymize: bool = False) -> Optional[Dict[str, Any]]:
        """Get specific patient by ID with role-based access control"""
        try:
            # Check access permissions
            if user_role == 'therapist':
                if not patient_scope or patient_id not in patient_scope:
                    raise HTTPException(status_code=403, detail="Access denied to this patient")
            
            response = supabase.table('patients').select('*').eq('id', patient_id).eq('is_active', True).execute()
            
            if not response.data:
                return None
            
            patient = response.data[0]
            
            if anonymize:
                patient = anonymize_patient_data(patient)
            
            return patient
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching patient: {str(e)}")
    
    @staticmethod
    async def create_patient(patient_data: PatientCreate, therapist_id: str) -> Dict[str, Any]:
        """Create new patient (therapists only)"""
        try:
            # Create patient record
            insert_data = {
                'patient_code': patient_data.patient_code,
                'date_of_birth': patient_data.date_of_birth.isoformat() if patient_data.date_of_birth else None,
                'gender': patient_data.gender,
                'condition_type': patient_data.condition_type,
                'therapy_start_date': patient_data.therapy_start_date.isoformat() if patient_data.therapy_start_date else None,
                'therapy_end_date': patient_data.therapy_end_date.isoformat() if patient_data.therapy_end_date else None,
                'demographics': patient_data.demographics or {},
                'medical_history': patient_data.medical_history or {},
                'is_active': True
            }
            
            response = supabase.table('patients').insert(insert_data).execute()
            
            if not response.data:
                raise HTTPException(status_code=400, detail="Failed to create patient")
            
            patient = response.data[0]
            
            # Auto-assign patient to creating therapist
            assignment_data = {
                'therapist_id': therapist_id,
                'patient_id': patient['id'],
                'assignment_reason': 'Created by therapist',
                'is_active': True
            }
            
            supabase.table('therapist_patient_assignments').insert(assignment_data).execute()
            
            return patient
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating patient: {str(e)}")
    
    @staticmethod
    async def update_patient(patient_id: str, patient_data: PatientUpdate, user_role: str, patient_scope: List[str] = None) -> Dict[str, Any]:
        """Update patient information"""
        try:
            # Check access permissions
            if user_role == 'therapist':
                if not patient_scope or patient_id not in patient_scope:
                    raise HTTPException(status_code=403, detail="Access denied to this patient")
            
            # Build update data (only include non-None values)
            update_data = {}
            if patient_data.patient_code is not None:
                update_data['patient_code'] = patient_data.patient_code
            if patient_data.date_of_birth is not None:
                update_data['date_of_birth'] = patient_data.date_of_birth.isoformat()
            if patient_data.gender is not None:
                update_data['gender'] = patient_data.gender
            if patient_data.condition_type is not None:
                update_data['condition_type'] = patient_data.condition_type
            if patient_data.therapy_start_date is not None:
                update_data['therapy_start_date'] = patient_data.therapy_start_date.isoformat()
            if patient_data.therapy_end_date is not None:
                update_data['therapy_end_date'] = patient_data.therapy_end_date.isoformat()
            if patient_data.demographics is not None:
                update_data['demographics'] = patient_data.demographics
            if patient_data.medical_history is not None:
                update_data['medical_history'] = patient_data.medical_history
            
            if not update_data:
                raise HTTPException(status_code=400, detail="No valid update data provided")
            
            # Add updated_at timestamp
            update_data['updated_at'] = 'NOW()'
            
            response = supabase.table('patients').update(update_data).eq('id', patient_id).execute()
            
            if not response.data:
                raise HTTPException(status_code=404, detail="Patient not found")
            
            return response.data[0]
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error updating patient: {str(e)}")
    
    @staticmethod
    async def deactivate_patient(patient_id: str, user_role: str, patient_scope: List[str] = None) -> bool:
        """Deactivate patient (soft delete)"""
        try:
            # Check access permissions (only admins can deactivate)
            if user_role != 'admin':
                raise HTTPException(status_code=403, detail="Only administrators can deactivate patients")
            
            response = supabase.table('patients').update({
                'is_active': False,
                'updated_at': 'NOW()'
            }).eq('id', patient_id).execute()
            
            return len(response.data) > 0
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error deactivating patient: {str(e)}")
```

5. **Add patient data models** to `backend/models.py`:
```python
# Add these models to the existing models.py file

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import date

class PatientBase(BaseModel):
    patient_code: str = Field(..., min_length=1, max_length=50, description="Unique patient identifier")
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, regex="^(male|female|other|unknown)$")
    condition_type: Optional[str] = None
    therapy_start_date: Optional[date] = None
    therapy_end_date: Optional[date] = None
    demographics: Optional[Dict[str, Any]] = None
    medical_history: Optional[Dict[str, Any]] = None

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    patient_code: Optional[str] = Field(None, min_length=1, max_length=50)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, regex="^(male|female|other|unknown)$")
    condition_type: Optional[str] = None
    therapy_start_date: Optional[date] = None
    therapy_end_date: Optional[date] = None
    demographics: Optional[Dict[str, Any]] = None
    medical_history: Optional[Dict[str, Any]] = None

class Patient(PatientBase):
    id: str
    is_active: bool
    created_at: str
    updated_at: str

class TherapistAssignment(BaseModel):
    id: str
    therapist_id: str
    patient_id: str
    assigned_date: date
    assignment_reason: Optional[str] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: str
    updated_at: str

class TherapistAssignmentCreate(BaseModel):
    patient_id: str = Field(..., description="Patient ID to assign")
    assignment_reason: Optional[str] = None
    notes: Optional[str] = None
```

6. **Add patient endpoints** to `backend/api.py`:
```python
# Add these imports to the top of api.py
from .services.patient_service import PatientService
from .models import Patient, PatientCreate, PatientUpdate, TherapistAssignment

# Add these endpoints to the FastAPI app

@app.get("/api/patients", response_model=List[Patient])
async def get_patients(request: Request):
    """Get patients based on user role and permissions"""
    data_filter = request.state.data_filter
    
    patients = await PatientService.get_patients(
        user_role=data_filter['role'],
        patient_scope=data_filter.get('patient_scope'),
        anonymize=data_filter.get('anonymize_data', False)
    )
    
    return patients

@app.get("/api/patients/{patient_id}", response_model=Patient)
async def get_patient(patient_id: str, request: Request):
    """Get specific patient by ID"""
    data_filter = request.state.data_filter
    
    patient = await PatientService.get_patient_by_id(
        patient_id=patient_id,
        user_role=data_filter['role'],
        patient_scope=data_filter.get('patient_scope'),
        anonymize=data_filter.get('anonymize_data', False)
    )
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    return patient

@app.post("/api/patients", response_model=Patient)
async def create_patient(patient_data: PatientCreate, request: Request):
    """Create new patient (therapists and admins only)"""
    data_filter = request.state.data_filter
    
    if not data_filter.get('can_create_patients'):
        raise HTTPException(status_code=403, detail="Permission denied: Cannot create patients")
    
    patient = await PatientService.create_patient(
        patient_data=patient_data,
        therapist_id=request.state.user_id
    )
    
    return patient

@app.put("/api/patients/{patient_id}", response_model=Patient)
async def update_patient(patient_id: str, patient_data: PatientUpdate, request: Request):
    """Update patient information"""
    data_filter = request.state.data_filter
    
    patient = await PatientService.update_patient(
        patient_id=patient_id,
        patient_data=patient_data,
        user_role=data_filter['role'],
        patient_scope=data_filter.get('patient_scope')
    )
    
    return patient

@app.delete("/api/patients/{patient_id}")
async def deactivate_patient(patient_id: str, request: Request):
    """Deactivate patient (admin only)"""
    data_filter = request.state.data_filter
    
    success = await PatientService.deactivate_patient(
        patient_id=patient_id,
        user_role=data_filter['role'],
        patient_scope=data_filter.get('patient_scope')
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    return {"message": "Patient deactivated successfully"}
```

#### Step 1.2.3: Create Session Management Endpoints  
**Time**: 6 hours

7. **Create session management service** `backend/services/session_service.py`:
```python
"""
C3D Session management service with patient linking
"""
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from ..middleware.auth_utils import supabase, anonymize_patient_data
from ..models import C3DSession, C3DSessionCreate, C3DSessionUpdate
from fastapi import HTTPException, UploadFile
import json
import uuid

class SessionService:
    
    @staticmethod
    async def get_sessions(user_role: str, patient_scope: List[str] = None, patient_id: str = None, anonymize: bool = False) -> List[Dict[str, Any]]:
        """Get C3D sessions based on user role and scope"""
        try:
            query = supabase.table('c3d_sessions').select('''
                id, filename, original_filename, patient_id, therapist_id,
                session_date, session_type, file_size, metadata,
                clinical_notes, processing_status, created_at, updated_at,
                patients!inner(patient_code, condition_type, is_active)
            ''')
            
            # Apply role-based filtering
            if user_role == 'therapist':
                if not patient_scope:
                    return []
                query = query.in_('patient_id', patient_scope)
            elif user_role == 'researcher':
                # Researchers only see research sessions
                query = query.eq('session_type', 'research')
            
            # Filter by specific patient if requested
            if patient_id:
                query = query.eq('patient_id', patient_id)
            
            # Execute query
            response = query.order('created_at', desc=True).execute()
            
            sessions = response.data
            
            # Anonymize data for researchers
            if anonymize:
                for session in sessions:
                    if 'patients' in session:
                        session['patients'] = anonymize_patient_data(session['patients'])
                    # Remove therapist identification
                    session.pop('therapist_id', None)
            
            return sessions
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching sessions: {str(e)}")
    
    @staticmethod
    async def get_session_by_id(session_id: str, user_role: str, patient_scope: List[str] = None, anonymize: bool = False) -> Optional[Dict[str, Any]]:
        """Get specific session by ID with role-based access control"""
        try:
            response = supabase.table('c3d_sessions').select('''
                id, filename, original_filename, patient_id, therapist_id,
                session_date, session_type, file_path, file_size,
                analysis_results, metadata, clinical_notes,
                processing_status, created_at, updated_at,
                patients(patient_code, condition_type, demographics)
            ''').eq('id', session_id).execute()
            
            if not response.data:
                return None
            
            session = response.data[0]
            
            # Check access permissions
            if user_role == 'therapist':
                if not patient_scope or session['patient_id'] not in patient_scope:
                    raise HTTPException(status_code=403, detail="Access denied to this session")
            elif user_role == 'researcher':
                if session['session_type'] != 'research':
                    raise HTTPException(status_code=403, detail="Access denied to clinical sessions")
            
            if anonymize:
                if 'patients' in session:
                    session['patients'] = anonymize_patient_data(session['patients'])
                session.pop('therapist_id', None)
            
            return session
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching session: {str(e)}")
    
    @staticmethod
    async def create_session(session_data: C3DSessionCreate, file_info: Dict[str, Any], therapist_id: str) -> Dict[str, Any]:
        """Create new C3D session with patient linking"""
        try:
            # Generate unique ID for session
            session_id = str(uuid.uuid4())
            
            # Create session record
            insert_data = {
                'id': session_id,
                'filename': file_info['filename'],
                'original_filename': file_info['original_filename'],
                'patient_id': session_data.patient_id,
                'therapist_id': therapist_id,
                'session_date': session_data.session_date.isoformat() if session_data.session_date else date.today().isoformat(),
                'session_type': session_data.session_type or 'therapy',
                'file_path': file_info.get('file_path'),
                'file_size': file_info.get('file_size'),
                'analysis_results': session_data.analysis_results or {},
                'metadata': session_data.metadata or {},
                'clinical_notes': session_data.clinical_notes,
                'processing_status': 'pending'
            }
            
            response = supabase.table('c3d_sessions').insert(insert_data).execute()
            
            if not response.data:
                raise HTTPException(status_code=400, detail="Failed to create session")
            
            return response.data[0]
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating session: {str(e)}")
    
    @staticmethod
    async def update_session_analysis(session_id: str, analysis_results: Dict[str, Any], metadata: Dict[str, Any] = None) -> bool:
        """Update session with analysis results"""
        try:
            update_data = {
                'analysis_results': analysis_results,
                'processing_status': 'completed',
                'updated_at': 'NOW()'
            }
            
            if metadata:
                update_data['metadata'] = metadata
            
            response = supabase.table('c3d_sessions').update(update_data).eq('id', session_id).execute()
            
            return len(response.data) > 0
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error updating session analysis: {str(e)}")
    
    @staticmethod
    async def add_clinical_notes(session_id: str, notes: str, user_role: str, patient_scope: List[str] = None) -> bool:
        """Add clinical notes to session (therapists only)"""
        try:
            if user_role != 'therapist' and user_role != 'admin':
                raise HTTPException(status_code=403, detail="Only therapists can add clinical notes")
            
            # Check session access for therapists
            if user_role == 'therapist':
                session = await SessionService.get_session_by_id(session_id, user_role, patient_scope)
                if not session:
                    raise HTTPException(status_code=404, detail="Session not found or access denied")
            
            response = supabase.table('c3d_sessions').update({
                'clinical_notes': notes,
                'updated_at': 'NOW()'
            }).eq('id', session_id).execute()
            
            return len(response.data) > 0
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error adding clinical notes: {str(e)}")
```

**Acceptance Criteria**:
- [ ] Role-based middleware implemented and tested
- [ ] Patient management endpoints created with proper validation
- [ ] Session management with patient linking functional
- [ ] Data filtering works correctly for each role
- [ ] API documentation updated with new endpoints
- [ ] Unit tests written for all service methods
- [ ] Integration tests passing with different user roles
- [ ] Error handling implemented for all edge cases

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