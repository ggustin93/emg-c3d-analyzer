
***

# **Enhanced** Database Schema Optimization Plan
*Date: August 12, 2025*
*Status: **Approved for Implementation** (PM Review)*

## 1. Current Analysis & Business Impact

The current schema presents technical challenges that directly translate to user-facing problems and business risks.

*   **1. Monolithic Design**:
    *   **Problem**: `c3d_metadata` and `analysis_results` are large, inflexible tables.
    *   **Business Impact**: This results in slow query performance, making the **Performance Dashboard** and **Clinical Reports** feel sluggish to our users (therapists, researchers), undermining the product's value. It also increases development time for new features.

*   **2. Export Service Disconnect**:
    *   **Problem**: The export service is underutilized and doesn't expose the rich clinical data available.
    *   **Business Impact**: Our research users cannot easily access the full depth of our analysis, limiting the platform's utility for clinical trials and academic studies.

*   **3. JSONB Overuse**:
    *   **Problem**: Key clinical metrics are stored in unstructured JSONB fields.
    *   **Business Impact**: We cannot perform fast, aggregated queries across multiple sessions, which is a critical requirement for tracking patient progress over time. This is a major blocker for developing future longitudinal analysis features.

*   **4. Missing Performance Framework**:
    *   **Problem**: The `Overall Performance` score is not formally structured in the database.
    *   **Business Impact**: This core clinical metric cannot be reliably and quickly queried, which is the primary value proposition of the Performance Dashboard.

*   **5. Signal Storage Overhead**:
    *   **Problem**: Storing large raw signal arrays in the database is inefficient.
    *   **Business Impact**: This leads to significantly higher database storage costs and slower backup/restore times, increasing our operational expenses and risk.

## 2. Architectural Decision: Statistics-First (The "Speed & Scale" Strategy)

Our architectural decision is to refactor to a **Statistics-First** model with **Just-in-Time (JIT) Signal Processing**.

### Core Product Philosophy
*   **Deliver a Blazing-Fast UX for Core Tasks**: We will pre-calculate and store all the statistics and metrics that power our main dashboards and reports. This ensures the 90% use case (viewing performance) is instantaneous.
*   **Provide Full Data Fidelity On-Demand**: We will process the original C3D files in real-time when a user explicitly requests a deep-dive analysis (like viewing raw signals). This handles the 10% use case without compromising the performance of the core experience.
*   **Maintain C3D as the Source of Truth**: The original C3D files are immutable and the ultimate source of all data. This guarantees data integrity and allows us to re-process sessions if our analysis algorithms improve in the future.

## 3. Proposed Statistics-First Schema Design

This new schema is designed for performance, clarity, and scalability.

---
### **Table 1: `therapy_sessions` (The Central Registry)**
**Product Impact**: Replaces the bloated `c3d_metadata` table. This becomes the lightweight, central hub for every session, making it fast and easy to find and manage sessions.
```sql
-- Main session registry (replaces c3d_metadata)
CREATE TABLE therapy_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- File identification (C3D source of truth)
  file_path TEXT NOT NULL UNIQUE,
  file_hash TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  
  -- Clinical identifiers
  patient_id TEXT, -- Links to patients table
  therapist_id TEXT, -- Links to therapists table  
  session_id TEXT,
  session_date TIMESTAMP WITH TIME ZONE,
  session_type TEXT CHECK (session_type IN ('baseline', 'training', 'assessment')),
  protocol_day INTEGER, -- Day in 14-day protocol
  
  -- Technical metadata (from C3D header)
  original_sampling_rate FLOAT NOT NULL,
  original_duration_seconds FLOAT NOT NULL,
  original_sample_count INTEGER NOT NULL,
  channel_names JSONB NOT NULL, -- ["Left_Quad", "Right_Quad"]
  channel_count INTEGER NOT NULL,
  
  -- Processing metadata
  processing_version TEXT NOT NULL,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);
```

---
### **Table 2: `emg_statistics` (The Dashboard Engine)**
**Product Impact**: This is the core of our performance strategy. By pre-calculating and storing all per-channel metrics here, we ensure that dashboards and reports load instantly. This table directly solves the "sluggish UI" problem.
```sql
-- Pre-calculated EMG statistics per channel (no raw signals stored)
CREATE TABLE emg_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES therapy_sessions(id),
  channel_name TEXT NOT NULL,
  
  -- === MVC CALCULATIONS (Clinical Core) ===
  mvc_peak_value FLOAT NOT NULL,
  mvc_rms_value FLOAT NOT NULL,
  mvc_confidence_score FLOAT NOT NULL CHECK (mvc_confidence_score >= 0 AND mvc_confidence_score <= 1),
  mvc_calculation_method TEXT NOT NULL CHECK (mvc_calculation_method IN ('backend_95percentile', 'user_defined')),
  
  -- === CONTRACTION ANALYSIS (Performance Metrics) ===
  total_contractions INTEGER NOT NULL,
  good_contractions_intensity INTEGER NOT NULL, -- >= 75% MVC threshold
  good_contractions_duration INTEGER NOT NULL,  -- >= duration threshold
  good_contractions_both INTEGER NOT NULL,      -- Both intensity AND duration criteria
  
  -- === COMPLIANCE RATES (Direct from metricsDefinitions.md) ===
  completion_rate FLOAT NOT NULL CHECK (completion_rate >= 0 AND completion_rate <= 1), 
    -- contractions_completed / target_contractions (typically 12)
  intensity_rate FLOAT NOT NULL CHECK (intensity_rate >= 0 AND intensity_rate <= 1),   
    -- good_contractions_intensity / contractions_completed
  duration_rate FLOAT NOT NULL CHECK (duration_rate >= 0 AND duration_rate <= 1),     
    -- good_contractions_duration / contractions_completed
  muscle_compliance_score FLOAT NOT NULL CHECK (muscle_compliance_score >= 0 AND muscle_compliance_score <= 1), 
    -- Weighted average: w_comp * completion_rate + w_int * intensity_rate + w_dur * duration_rate
  
  -- === SIGNAL QUALITY METRICS ===
  signal_quality_score FLOAT NOT NULL CHECK (signal_quality_score >= 0 AND signal_quality_score <= 1),
  noise_level_db FLOAT,
  artifacts_detected INTEGER DEFAULT 0,
  processing_confidence FLOAT NOT NULL CHECK (processing_confidence >= 0 AND processing_confidence <= 1),
  
  -- === PROCESSING METADATA ===
  processing_pipeline TEXT NOT NULL DEFAULT '20Hz->Rectify->10Hz->RMS',
  processing_version TEXT NOT NULL,
  processing_time_ms INTEGER,
  
  -- === THRESHOLDS USED (For cache validation) ===
  mvc_threshold_percentage FLOAT NOT NULL DEFAULT 0.75,
  duration_threshold_seconds FLOAT NOT NULL DEFAULT 2.0,
  
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(session_id, channel_name)
);
```

---
### **Table 3: `performance_scores` (The Clinical Scorecard)**
**Product Impact**: This table directly implements the core clinical logic from `metricsDefinitions.md`. It provides a clean, fast, and reliable source for the `Overall Performance Score`, which is a key value proposition for therapists.
```sql
-- Implementation of P_overall formula from metricsDefinitions.md
CREATE TABLE performance_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES therapy_sessions(id),
  
  -- === P_OVERALL FORMULA COMPONENTS ===
  -- P_overall = w_c * S_compliance + w_s * S_symmetry + w_e * S_effort + w_g * S_game
  
  overall_performance_score FLOAT NOT NULL CHECK (overall_performance_score >= 0 AND overall_performance_score <= 100),
  
  -- Core performance components (0-100 scale)
  compliance_score FLOAT NOT NULL CHECK (compliance_score >= 0 AND compliance_score <= 100),   
    -- S_compliance: (Left + Right muscle compliance) / 2 * BFR_gate
  symmetry_score FLOAT NOT NULL CHECK (symmetry_score >= 0 AND symmetry_score <= 100),        
    -- S_symmetry: (1 - |left-right|/(left+right)) * 100
  effort_score FLOAT NOT NULL CHECK (effort_score >= 0 AND effort_score <= 100),              
    -- S_effort: Based on RPE scale (4-6 = 100%, 3,7 = 80%, etc.)
  game_score FLOAT NOT NULL CHECK (game_score >= 0 AND game_score <= 100),                    
    -- S_game: (points_achieved / max_points_current_difficulty) * 100
  
  -- === PERFORMANCE WEIGHTS (Configurable) ===
  performance_weights JSONB NOT NULL DEFAULT 
    '{"compliance": 0.40, "symmetry": 0.25, "effort": 0.20, "game": 0.15}',
  
  -- === BFR SAFETY GATE ===
  bfr_pressure_aop FLOAT,                           -- Actual pressure % of AOP
  bfr_compliance_gate FLOAT NOT NULL DEFAULT 1.0    -- 1.0 if [45%, 55%] AOP, 0.0 otherwise
    CHECK (bfr_compliance_gate IN (0.0, 1.0)),
  
  -- === SUPPORTING METRICS ===
  rpe_post_session INTEGER CHECK (rpe_post_session >= 0 AND rpe_post_session <= 10), -- 0-10 RPE scale
  game_points_achieved INTEGER NOT NULL DEFAULT 0,
  game_points_maximum INTEGER NOT NULL DEFAULT 1000,
  session_duration_minutes FLOAT,
  
  -- === DETAILED BREAKDOWN ===
  -- Left and right muscle compliance components for transparency
  left_muscle_completion_rate FLOAT CHECK (left_muscle_completion_rate >= 0 AND left_muscle_completion_rate <= 1),
  left_muscle_intensity_rate FLOAT CHECK (left_muscle_intensity_rate >= 0 AND left_muscle_intensity_rate <= 1),
  left_muscle_duration_rate FLOAT CHECK (left_muscle_duration_rate >= 0 AND left_muscle_duration_rate <= 1),
  
  right_muscle_completion_rate FLOAT CHECK (right_muscle_completion_rate >= 0 AND right_muscle_completion_rate <= 1),
  right_muscle_intensity_rate FLOAT CHECK (right_muscle_intensity_rate >= 0 AND right_muscle_intensity_rate <= 1),
  right_muscle_duration_rate FLOAT CHECK (right_muscle_duration_rate >= 0 AND right_muscle_duration_rate <= 1),
  
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---
### **Table 4: `bfr_monitoring` (The Safety & Compliance Hub)**
**Product Impact**: Isolates critical Blood Flow Restriction data. This is essential for clinical trial compliance and provides a dedicated, auditable record of safety-critical information.
```sql
-- Blood Flow Restriction monitoring and safety data
CREATE TABLE bfr_monitoring (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES therapy_sessions(id),
  
  -- === BFR CONFIGURATION ===
  target_pressure_aop FLOAT NOT NULL CHECK (target_pressure_aop >= 0 AND target_pressure_aop <= 100), -- Target % of AOP
  actual_pressure_aop FLOAT NOT NULL CHECK (actual_pressure_aop >= 0 AND actual_pressure_aop <= 100), -- Measured % of AOP
  pressure_stability_coefficient FLOAT, -- Coefficient of variation during session
  
  -- === SAFETY MONITORING (Critical for Clinical Trial) ===
  safety_gate_status BOOLEAN NOT NULL,           -- Overall safety validation (45-55% AOP range)
  safety_violations_count INTEGER DEFAULT 0,     -- Number of times pressure went outside safe range
  safety_violations_duration_seconds FLOAT,      -- Total time outside safe range
  max_pressure_deviation_aop FLOAT,              -- Maximum deviation from target pressure
  
  -- === CLINICAL BASELINE DATA ===
  patient_aop_baseline_mmhg FLOAT,               -- Patient's baseline AOP (mmHg)
  patient_limb_circumference_cm FLOAT,           -- Limb circumference for pressure calculation
  cuff_size TEXT,                                -- Cuff size used
  cuff_position TEXT,                            -- Cuff placement (proximal thigh, etc.)
  
  -- === MONITORING EQUIPMENT ===
  monitoring_device TEXT,
  device_calibration_date DATE,
  device_serial_number TEXT,
  
  -- === SESSION METADATA ===
  bfr_session_duration_minutes FLOAT,
  monitoring_frequency_hz FLOAT DEFAULT 1.0,     -- Pressure sampling frequency
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---
### **Table 5: `session_settings` (The Configuration Center)**
**Product Impact**: This table provides the flexibility for therapists to tailor sessions to individual patient needs without complicating the core data tables. It's the engine for our adaptive therapy features.
```sql
-- Session-specific configuration and adaptive thresholds
CREATE TABLE session_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES therapy_sessions(id),
  
  -- === MVC THRESHOLD SYSTEM (Priority-based from metricsDefinitions.md) ===
  mvc_calculation_method TEXT NOT NULL CHECK (mvc_calculation_method IN ('backend_calculated', 'user_defined')),
  mvc_threshold_percentage FLOAT NOT NULL DEFAULT 0.75 CHECK (mvc_threshold_percentage > 0 AND mvc_threshold_percentage <= 1),
  
  -- User-defined MVC values (fallback when backend calculation unavailable)
  mvc_user_left_quad FLOAT,   -- Manual MVC for left quadriceps
  mvc_user_right_quad FLOAT,  -- Manual MVC for right quadriceps
  
  -- === PERFORMANCE WEIGHTS (Configurable P_overall formula) ===
  performance_weights JSONB NOT NULL DEFAULT 
    '{"compliance": 0.40, "symmetry": 0.25, "effort": 0.20, "game": 0.15}',
  
  -- === ADAPTIVE THRESHOLDS ===
  duration_threshold_seconds FLOAT NOT NULL DEFAULT 2.0 CHECK (duration_threshold_seconds > 0),
  duration_threshold_left_quad FLOAT,   -- Per-muscle duration override (seconds)
  duration_threshold_right_quad FLOAT,  -- Per-muscle duration override (seconds)
  
  -- === CLINICAL PROTOCOL SETTINGS ===
  target_contractions_per_muscle INTEGER NOT NULL DEFAULT 12 CHECK (target_contractions_per_muscle > 0),
  rest_period_between_contractions_seconds INTEGER DEFAULT 5,
  rest_period_between_sets_seconds INTEGER DEFAULT 120,
  
  -- === BFR SETTINGS ===
  bfr_enabled BOOLEAN DEFAULT true,
  bfr_target_pressure_aop FLOAT DEFAULT 50.0 CHECK (bfr_target_pressure_aop >= 0 AND bfr_target_pressure_aop <= 100),
  
  -- === GAME/UI CONFIGURATION ===
  game_difficulty_level INTEGER DEFAULT 1 CHECK (game_difficulty_level >= 1 AND game_difficulty_level <= 10),
  visual_feedback_enabled BOOLEAN DEFAULT true,
  audio_feedback_enabled BOOLEAN DEFAULT true,
  real_time_mvc_display BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---
### **Table 6: `export_history` (The Audit Trail)**
**Product Impact**: Solves the "Export Service Disconnect" issue by creating a robust, auditable trail of all data exports. This is a critical feature for our research and clinical trial users who require data provenance.
```sql
-- Enhanced export tracking for research compliance
CREATE TABLE export_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES therapy_sessions(id),
  
  -- === EXPORT SPECIFICATION ===
  export_type TEXT NOT NULL CHECK (export_type IN (
    'statistics_only',          -- Pre-calculated statistics (fast)
    'performance_report',       -- Clinical performance metrics
    'signals_visualization',    -- Downsampled signals for charts (JIT processed)
    'signals_research_full',    -- Full raw signals for research (JIT processed)
    'clinical_summary',         -- Combined statistics + performance for clinical trial
    'bfr_safety_report'        -- BFR monitoring and safety data
  )),
  
  channels_exported JSONB,                                    -- ["Left_Quad", "Right_Quad"] or null for all
  data_format TEXT NOT NULL CHECK (data_format IN ('json', 'csv', 'excel', 'matlab')),
  export_options JSONB,                                      -- Downsampling, filters, etc.
  
  -- === PROCESSING METADATA ===
  processing_method TEXT NOT NULL CHECK (processing_method IN ('database_query', 'jit_c3d_processing')),
  processing_time_ms INTEGER,                                 -- Time taken to generate export
  data_source TEXT,                                          -- 'cached_statistics', 'c3d_file_processed'
  
  -- === EXPORT METADATA ===
  exported_by UUID REFERENCES researcher_profiles(id),
  export_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_size_bytes BIGINT,
  export_hash TEXT,                                          -- SHA-256 hash for data integrity
  
  -- === VALIDATION & QUALITY ===
  export_status TEXT DEFAULT 'success' CHECK (export_status IN ('success', 'partial', 'failed')),
  validation_checks JSONB,                                   -- Data quality validation results
  error_message TEXT,                                        -- Error details if failed
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---
### **Table 7: `signal_processing_cache` (The Performance Booster)**
**Product Impact**: This is a purely technical, user-facing performance enhancement. It ensures that if a user repeatedly views the same raw signal plot, it loads instantly after the first time, making the application feel much more responsive during deep-dive analysis sessions.
```sql
-- Minimal cache for JIT signal processing optimization
CREATE TABLE signal_processing_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES therapy_sessions(id),
  
  -- === CACHE KEY ===
  processing_request_hash TEXT NOT NULL,  -- Hash of processing parameters (filters, downsample, etc.)
  processing_version TEXT NOT NULL,       -- Backend processing pipeline version
  
  -- === CACHE METADATA ===
  cache_type TEXT NOT NULL CHECK (cache_type IN ('visualization_1k', 'export_full', 'envelope_rms')),
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- === CACHE EXPIRATION ===
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  cache_valid BOOLEAN DEFAULT true,
  
  -- === CACHE INVALIDATION TRIGGERS ===
  invalidated_reason TEXT,  -- 'session_reprocessed', 'expired', 'manual'
  invalidated_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(session_id, processing_request_hash)
);
```
---
### **8. Legacy Tables Integration Strategy**
**Product Impact**: This section details our commitment to a non-disruptive migration. By preserving and linking to existing user tables, we lay the groundwork for future features like role-based access control (RBAC) without breaking the current system.
```sql
-- NOTA BENE: Keep existing patients and therapists tables for future role-based access

-- patients table (existing, preserved)
-- - Contains patient demographics and medical data
-- - Links to therapy_sessions via patient_id
-- - Will be extended for role-based data access (therapist sees only their patients)

-- therapists table (existing, preserved) 
-- - Contains therapist credentials and access permissions
-- - Links to patients table via therapist_id
-- - Links to therapy_sessions for session ownership
-- - Future: Role-based access to specific Patient IDs (PID) subsets

-- researcher_profiles table (existing, preserved)
-- - Research staff with broader data access
-- - Links to export_history for audit trail
-- - Different access level than therapists (full vs. subset)

-- Add foreign key relationships to preserve referential integrity
ALTER TABLE therapy_sessions 
  ADD CONSTRAINT fk_therapy_sessions_patient 
  FOREIGN KEY (patient_id) REFERENCES patients(patient_code);

ALTER TABLE therapy_sessions 
  ADD CONSTRAINT fk_therapy_sessions_therapist 
  FOREIGN KEY (therapist_id) REFERENCES therapists(id);
```

## 4. Value-Driven Implementation Strategy

This is not just a technical task list; it's a phased rollout designed to deliver value and mitigate risk at every step.

*   **Phase 1: Foundation Laying (No User Impact)**
    *   **Action**: Implement the new 8-table schema and add foreign key relationships.
    *   **Value**: Sets the stage for all future improvements without affecting the live application.

*   **Phase 2: Data Migration & Backward Compatibility (No User Impact)**
    *   **Action**: Develop migration scripts and create the backward-compatibility views.
    *   **Value**: The most critical, risk-heavy work is performed behind the scenes. We ensure all existing data is preserved and that the application can continue to run flawlessly on the old code against the new data structure.

*   **Phase 3: Building the New Engine (Backend Refactor)**
    *   **Action**: Implement the `JITSignalService` and refactor the backend services (`GHOSTLYC3DProcessor`, `ExportService`) and API endpoints.
    *   **Value**: The backend becomes more efficient, scalable, and ready to deliver the new, faster experience to the frontend.

*   **Phase 4: Delivering the User Experience Payoff (Frontend Integration)**
    *   **Action**: Refactor the frontend tabs (`PerformanceTab`, `SignalPlotsTab`, `ExportTab`) to use the new API endpoints.
    *   **Value**: **This is where the user sees the benefit.** Dashboards become lightning-fast, and the export functionality becomes more powerful and intuitive.

*   **Phase 5: Optimization & Cleanup (No User Impact)**
    *   **Action**: Add performance-tuning indexes, monitor JIT service, and finally decommission the old tables.
    *   **Value**: We ensure the new system is robust for the long term and we clean up technical debt.

This improved plan is now ready to be used as the definitive guide for this enhancement. I have already incorporated this thinking into the epic I created.

--


## **Developer To-Do List: Statistics-First Architecture Migration**

**Guiding Principle:** At every step, the application must remain functional. Use the backward-compatibility views as a safety net.

### **Story 1: DB Schema Setup**
*Goal: Create the foundational database structure without impacting the live application.*

*   [ ] **Task 1.1: Create Migration File:** Create a new SQL migration file (e.g., `migrations/006_create_statistics_schema.sql`).
*   [ ] **Task 1.2: Implement `therapy_sessions` Table:** Write and test the `CREATE TABLE` statement for `therapy_sessions`, including all constraints and foreign key references to `patients` and `therapists`.
*   [ ] **Task 1.3: Implement `emg_statistics` Table:** Write and test the `CREATE TABLE` statement for `emg_statistics`.
*   [ ] **Task 1.4: Implement `performance_scores` Table:** Write and test the `CREATE TABLE` statement for `performance_scores`.
*   [ ] **Task 1.5: Implement `bfr_monitoring` Table:** Write and test the `CREATE TABLE` statement for `bfr_monitoring`.
*   [ ] **Task 1.6: Implement `session_settings` Table:** Write and test the `CREATE TABLE` statement for `session_settings`.
*   [ ] **Task 1.7: Implement `export_history` Table:** Write and test the `CREATE TABLE` statement for `export_history`.
*   [ ] **Task 1.8: Implement `signal_processing_cache` Table:** Write and test the `CREATE TABLE` statement for `signal_processing_cache`.
*   [ ] **Task 1.9: Apply and Verify Migration:** Apply the migration to your local development database and verify that all tables and relationships are created correctly.

### **Story 2: Data Migration Script**
*Goal: Safely and accurately transfer all historical data from the old schema to the new schema.*

*   [ ] **Task 2.1: Create Migration Script:** Create a new Python script (e.g., `backend/scripts/migrate_to_stats_schema.py`).
*   [ ] **Task 2.2: Implement `c3d_metadata` Migration Logic:** Write the Python/SQL logic to read from `c3d_metadata` and insert the corresponding data into the new `therapy_sessions` table. Handle data type transformations as needed.
*   [ ] **Task 2.3: Implement `analysis_results` Migration Logic:** Write the logic to read from `analysis_results`, parse the JSONB data, and insert the structured statistics into `emg_statistics`, `performance_scores`, and `bfr_monitoring`.
*   [ ] **Task 2.4: Implement Idempotency:** Ensure the script can be run multiple times without creating duplicate data (e.g., by checking `file_hash` before inserting).
*   [ ] **Task 2.5: Add Validation and Logging:** Add detailed logging to the script to report on its progress and a final validation step to compare record counts between the old and new tables to ensure no data was lost.
*   [ ] **Task 2.6: Test Script:** Test the script thoroughly on a staging or development database.

### **Story 3: Backward-Compatibility Views**
*Goal: Create the critical "safety net" that allows the old frontend to function with the new database structure.*

*   [ ] **Task 3.1: Create New Migration File:** Create a new SQL migration file (e.g., `migrations/007_create_backward_compatibility_views.sql`).
*   [ ] **Task 3.2: Implement `c3d_metadata_view`:** Write the `CREATE VIEW` statement that reconstructs the exact schema of the old `c3d_metadata` table by joining and selecting data from the new tables.
*   [ ] **Task 3.3: Implement `analysis_results_view`:** Write the `CREATE VIEW` statement that reconstructs the old `analysis_results` table, likely involving more complex joins and potentially creating JSONB objects on the fly to match the old structure.
*   [ ] **Task 3.4: Test Views:** After applying the migration, run queries against the views to ensure they return data in the exact same format as the original tables.

### **Story 4: Backend Refactor (Write Path)**
*Goal: Update the backend to save all new data in the new schema.*

*   [ ] **Task 4.1: Refactor `GHOSTLYC3DProcessor`:** In `backend/services/c3d_processor.py`, change the final step of the `process_file` method. Instead of returning a single large object, it should now make multiple database calls to insert the calculated data into `therapy_sessions`, `emg_statistics`, etc.
*   [ ] **Task 4.2: Update `webhook_service.py`:** Modify the webhook processing logic to call the refactored `GHOSTLYC3DProcessor`.
*   [ ] **Task 4.3: Update `/upload` Endpoint:** In `backend/api/api.py`, ensure the `/upload` endpoint correctly triggers the new write path.
*   [ ] **Task 4.4: Write Integration Tests:** Create new tests to verify that uploading a new C3D file correctly populates all the new tables with the right data.

### **Story 5: JIT Service Implementation**
*Goal: Build the new service for on-demand signal processing.*

*   [ ] **Task 5.1: Create `jit_signal_service.py`:** Create the new file at `backend/services/jit_signal_service.py`.
*   [ ] **Task 5.2: Implement Core Logic:** Implement the methods for reading a C3D file from storage and running the signal processing pipeline.
*   [ ] **Task 5.3: Add Caching:** Integrate with the `signal_processing_cache` table. The service should check for a cached result before processing a file and save the result to the cache after processing.
*   [ ] **Task 5.4: Create New API Endpoint:** In `backend/api/api.py`, create the new `/api/signals/jit/{session_id}` endpoint that calls this service.
*   [ ] **Task 5.5: Write Unit and Integration Tests:** Test the service logic and the new API endpoint thoroughly.

### **Stories 6-9: Frontend & Read Path Refactor**
*Goal: Incrementally update the application to leverage the new, performant architecture.*

*   [ ] **Task 6.1: Refactor `export_service.py`:** Modify the service to handle the two export types (fast stats vs. slow full signal).
*   [ ] **Task 7.1: Update Performance Dashboard Data Hooks:** In the frontend, identify the hooks (`usePerformanceMetrics.ts`, etc.) that fetch data for the dashboard.
*   [ ] **Task 7.2: Create New API Calls:** Point these hooks to new, fast API endpoints that query the `performance_scores` and `emg_statistics` tables.
*   [ ] **Task 8.1: Update SignalPlotsTab Component:** Modify the React component in `frontend/src/components/tabs/SignalPlotsTab/` to call the new `/api/signals/jit/{session_id}` endpoint when a user needs to view a signal. Implement a loading state to handle the ~500ms latency.
*   [ ] **Task 9.1: Update ExportTab Component:** Redesign the UI in `frontend/src/components/tabs/ExportTab/` to allow users to choose their desired export type and provide feedback (e.g., a progress indicator) for the slower, full-signal export.

### **Story 10: Decommission & Cleanup**
*Goal: The final step. Clean up technical debt once the migration is complete and verified.*

*   [ ] **Task 10.1: Verify Full Migration:** Confirm with the team that all parts of the application are now using the new schema and services directly.
*   [ ] **Task 10.2: Create Cleanup Migration File:** Create a new SQL migration file (e.g., `migrations/008_decommission_legacy_tables.sql`).
*   [ ] **Task 10.3: Drop Views:** Write the `DROP VIEW` statements for the backward-compatibility views.
*   [ ] **Task 10.4: Archive Old Tables:** Instead of dropping, rename the old tables (e.g., `c3d_metadata_ARCHIVED`, `analysis_results_ARCHIVED`).
*   [ ] **Task 10.5: Final Test:** Run a full regression test of the application to ensure everything still works after the cleanup.

---

This detailed list should provide a clear path forward for the development team. The next logical step would be for the Product Owner (`po`) to take the first story, "DB Schema Setup," and write the detailed acceptance criteria for it.