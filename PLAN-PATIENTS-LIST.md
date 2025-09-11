# Patient Data Architecture Implementation Plan

## Core Strategy: Secure Medical Data with User-Friendly Display

**Key Insight**: Store PII (names, birthdate) in `patient_medical_info` table with therapist-only access, but JOIN for display in patient lists. Researchers see patient codes only, therapists see full names.

---

## Phase 1: Database Implementation (Foundation)

### 1.1 Create Complete Medical Table
- [ ] Create `patient_medical_info` table with key fields:
  - [ ] Personal info (first_name, last_name, date_of_birth, gender)
  - [ ] Clinical info (room_number, admission_date, primary_diagnosis)
  - [ ] Status tracking (mobility_status, cognitive_status, bmi_value, bmi_status)
  - [ ] Treatment tracking (total_sessions_planned, patient_status)
  - [ ] Audit fields (created_at, updated_at, created_by, updated_by)

- [ ] Implement Row Level Security (RLS):
  - [ ] Enable RLS on patient_medical_info table
  - [ ] Create policy: therapists can only access their patients' medical data
  - [ ] Create policy: admin full access to medical data
  - [ ] Verify researchers have NO access to medical table

### 1.2 Create Calculated Views
- [ ] Create `patient_profile_view` that:
  - [ ] Joins patients table with patient_medical_info
  - [ ] Calculates age from date_of_birth
  - [ ] Aggregates session statistics (count, last session date)
  - [ ] Calculates compliance scores from performance_scores
  - [ ] Determines adherence levels (Low/Moderate/High)
  - [ ] Includes patient status for UI badges

---

## Phase 2: Frontend PatientManagement Update

### 2.1 Update Types Interface
- [ ] Update `Patient` interface in types.ts:
  - [ ] Add first_name, last_name (nullable for graceful fallback)
  - [ ] Add age field
  - [ ] Add patient_status for status badges
  - [ ] Add compliance_score and adherence_level

### 2.2 Update Database Query
- [ ] Modify `fetchTherapistPatients()` function:
  - [ ] Query from `patient_profile_view` instead of patients table
  - [ ] Select first_name, last_name, age, and calculated fields
  - [ ] Handle null values for patients without medical records
  - [ ] Update sorting logic to use names when available, fallback to patient_code

### 2.3 Update UI Components
- [ ] Update `PatientRow` component:
  - [ ] Display full name when available (Arthur Lewis)
  - [ ] Fallback to patient_code when medical data unavailable
  - [ ] Generate avatar initials from names or patient_code
  - [ ] Add patient status badges (Dropped Out, etc.)
  - [ ] Show age information when available

### 2.4 Restore Table Headers
- [ ] Add back "Name" column to table header
- [ ] Update column widths and responsive behavior
- [ ] Add "Status" column for patient status indicators
- [ ] Update "Adherence" column to show calculated adherence levels

---

## Phase 3: Security Verification

### 3.1 Test Researcher Access
- [ ] Verify researchers see only patient_code in lists
- [ ] Confirm first_name, last_name are NULL for researchers (RLS blocking)
- [ ] Test UI gracefully falls back to patient_code display
- [ ] Verify no access to medical endpoints

### 3.2 Test Therapist Access
- [ ] Verify therapists see full names in patient lists
- [ ] Confirm therapists can only see their own patients
- [ ] Test cannot access other therapists' patient medical data
- [ ] Verify all calculated fields display correctly

### 3.3 Test Admin Access
- [ ] Verify admin can access all patient medical data
- [ ] Test admin can view all therapists' patients
- [ ] Confirm audit logging works for all access levels

---

## Phase 4: Patient Profile Page (From Screenshot)

### 4.1 Create Individual Patient Profile Route
- [ ] Create new route: `/patients/:patientId`
- [ ] Use `patient_profile_view` for single patient data
- [ ] Implement breadcrumb navigation (All Patients > Arthur Lewis)

### 4.2 Implement Three-Card Layout
- [ ] **Demographics Card**: Age, Gender, Room, Admission Date
- [ ] **Medical Info Card**: Diagnosis, Mobility, BMI, Cognitive Status
- [ ] **Treatment Summary Card**: Sessions (3/10), Compliance, Adherence
- [ ] Add edit icons for each card (therapist only)
- [ ] Implement responsive design for mobile

### 4.3 Add Status Indicators
- [ ] Color-coded badges (green=good, red=alert/low, yellow=warning)
- [ ] Patient status header badge (Dropped Out, Active, etc.)
- [ ] BMI status indicators with tooltip info icons
- [ ] Cognitive status with alert capabilities

---

## Phase 5: Backend API Support

### 5.1 Medical Data Endpoints
- [ ] Create GET `/api/patients/{id}/medical` endpoint
- [ ] Create PUT `/api/patients/{id}/medical` endpoint
- [ ] Implement proper authentication middleware
- [ ] Add validation for medical data updates

### 5.2 Calculated Metrics API
- [ ] Endpoint for compliance score calculation
- [ ] Endpoint for adherence level determination
- [ ] Session progress tracking API
- [ ] BMI status calculation logic

---

## Phase 6: Data Migration & Testing

### 6.1 Data Migration
- [ ] Create migration script for existing patients
- [ ] Populate medical table with placeholder data
- [ ] Update existing patient records to link medical info
- [ ] Verify data integrity after migration

### 6.2 Comprehensive Testing
- [ ] Unit tests for RLS policies
- [ ] Integration tests for therapist/researcher access
- [ ] UI tests for patient list display
- [ ] End-to-end tests for patient profile workflow

---

## Expected Outcomes

**For Therapists:**
- ✅ Patient lists show "Arthur Lewis" + "P008" 
- ✅ Full access to all patient medical data
- ✅ Rich patient profiles with clinical information
- ✅ Status indicators and progress tracking

**For Researchers:**  
- ✅ Patient lists show only "P008" (names blocked by RLS)
- ✅ No access to medical/personal information
- ✅ Can still analyze therapy session data by patient_code

**Security & Compliance:**
- ✅ HIPAA compliant - PII secured in medical table
- ✅ RLS enforces access control at database level
- ✅ Graceful degradation when medical data unavailable
- ✅ Complete audit trail for all medical data access

**User Experience:**
- ✅ Therapists get rich, user-friendly patient interface
- ✅ Intuitive patient profile matching healthcare standards
- ✅ Color-coded status indicators for quick assessment
- ✅ Mobile-responsive design for clinical workflows