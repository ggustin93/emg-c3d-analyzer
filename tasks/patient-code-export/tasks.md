# Tasks: Patient Code Export Enhancement

**Input**: Patient code inclusion analysis and implementation plan
**Prerequisites**: Export functionality analysis completed, patient code requirements identified

## Execution Flow (main)
```
1. Analyzed existing export functionality across:
   → Backend: export_service.py, export.py (patient_id captured but not patient code)
   → Frontend: ExportTab components (missing patient code extraction and display)
   → Identified gaps: patient code derivation, CSV integration, UI enhancement
2. Implementation plan:
   → Patient code extraction utilities (P### from patient_id or filename)
   → CSV export enhancement with patient code metadata
   → Export hooks patient code integration
   → UI components patient code display
3. Generate tasks by category:
   → Setup: test environment, utilities structure
   → Tests: patient code extraction tests, export integration tests
   → Core: utilities, CSV generator, export hooks, backend enhancement
   → Integration: UI components, file naming, error handling
   → Polish: end-to-end testing, documentation, validation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Focus on export functionality enhancement with patient code inclusion
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app structure**: `backend/src/`, `frontend/src/`
- **Backend services**: `backend/services/`, `backend/api/routes/`
- **Frontend components**: `frontend/src/components/tabs/ExportTab/`
- **Tests**: `frontend/src/components/tabs/ExportTab/__tests__/`

## Phase 3.1: Setup
- [ ] T001 Create patient code extraction utility structure in frontend/src/components/tabs/ExportTab/utils.ts
- [ ] T002 [P] Configure test environment for patient code extraction in frontend/src/components/tabs/ExportTab/__tests__/patient-code-extraction.test.ts
- [ ] T003 [P] Set up TypeScript interfaces for patient code types in frontend/src/components/tabs/ExportTab/types.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] Patient code extraction from patient_id test in frontend/src/components/tabs/ExportTab/__tests__/patient-code-extraction.test.ts
- [ ] T005 [P] Patient code extraction from filename pattern test in frontend/src/components/tabs/ExportTab/__tests__/patient-code-extraction.test.ts
- [ ] T006 [P] CSV export with patient code integration test in frontend/src/components/tabs/ExportTab/__tests__/csv-patient-code.test.ts
- [ ] T007 [P] Export hooks patient code integration test in frontend/src/components/tabs/ExportTab/__tests__/export-hooks-patient-code.test.ts
- [ ] T008 [P] Export actions patient code display test in frontend/src/components/tabs/ExportTab/__tests__/export-actions-patient-code.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T009 [P] Implement extractPatientCodeFromPatientId utility function in frontend/src/components/tabs/ExportTab/utils.ts
- [ ] T010 [P] Implement extractPatientCodeFromFilename utility function in frontend/src/components/tabs/ExportTab/utils.ts
- [ ] T011 [P] Add patient code to CSV metadata and headers in frontend/src/components/tabs/ExportTab/csvGenerator.ts
- [ ] T012 [P] Integrate patient code in export data generation in frontend/src/components/tabs/ExportTab/hooks.tsx
- [ ] T013 [P] Update ExportData interface with patient code fields in frontend/src/components/tabs/ExportTab/types.ts
- [ ] T014 [P] Enhance backend export service with patient code lookup in backend/services/data/export_service.py
- [ ] T015 Add patient code to export API response metadata in backend/api/routes/export.py

## Phase 3.4: Integration
- [ ] T016 [P] Update ExportActions component with patient code display in frontend/src/components/tabs/ExportTab/ExportActions.tsx
- [ ] T017 [P] Implement patient code in file naming for downloads in frontend/src/components/tabs/ExportTab/ExportActions.tsx
- [ ] T018 [P] Add patient code error handling and fallbacks in frontend/src/components/tabs/ExportTab/utils.ts
- [ ] T019 Connect patient code extraction to database patient lookup in frontend/src/components/tabs/ExportTab/hooks.tsx
- [ ] T020 Update CSV filename generation with patient code prefix in frontend/src/components/tabs/ExportTab/csvGenerator.ts

## Phase 3.5: Polish
- [ ] T021 [P] End-to-end export functionality test with patient codes in frontend/src/components/tabs/ExportTab/__tests__/export-e2e-patient-code.test.ts
- [ ] T022 [P] Patient code validation and edge case handling in frontend/src/components/tabs/ExportTab/utils.ts
- [ ] T023 [P] Update export documentation with patient code features in docs/export-functionality.md
- [ ] T024 Performance test for patient code extraction (<50ms) in frontend/src/components/tabs/ExportTab/__tests__/patient-code-performance.test.ts
- [ ] T025 Backward compatibility validation for existing exports in frontend/src/components/tabs/ExportTab/__tests__/backward-compatibility.test.ts

## Dependencies
- Setup (T001-T003) before tests (T004-T008)
- Tests (T004-T008) before implementation (T009-T015)
- Core utilities (T009-T010) before integration (T016-T020)
- T011 (CSV) depends on T009-T010 (utilities)
- T012 (hooks) depends on T009-T010 (utilities)
- T014 (backend) can run parallel with frontend T009-T013
- T016-T017 (UI components) depend on T012 (hooks)
- Implementation before polish (T021-T025)

## Parallel Example
```
# Launch T004-T008 together (different test files):
Task: "Patient code extraction from patient_id test in frontend/src/components/tabs/ExportTab/__tests__/patient-code-extraction.test.ts"
Task: "CSV export with patient code integration test in frontend/src/components/tabs/ExportTab/__tests__/csv-patient-code.test.ts"
Task: "Export hooks patient code integration test in frontend/src/components/tabs/ExportTab/__tests__/export-hooks-patient-code.test.ts"
Task: "Export actions patient code display test in frontend/src/components/tabs/ExportTab/__tests__/export-actions-patient-code.test.ts"

# Launch T009-T014 together (different files):
Task: "Implement extractPatientCodeFromPatientId utility function in frontend/src/components/tabs/ExportTab/utils.ts"
Task: "Add patient code to CSV metadata and headers in frontend/src/components/tabs/ExportTab/csvGenerator.ts"
Task: "Integrate patient code in export data generation in frontend/src/components/tabs/ExportTab/hooks.tsx"
Task: "Update ExportData interface with patient code fields in frontend/src/components/tabs/ExportTab/types.ts"
Task: "Enhance backend export service with patient code lookup in backend/services/data/export_service.py"
```

## Implementation Details

### Patient Code Extraction Logic
```typescript
// Extract patient code from patient_id (database lookup)
function extractPatientCodeFromPatientId(patientId: string): Promise<string | null>

// Extract patient code from source filename pattern (P###/Ghostly_Emg_*)
function extractPatientCodeFromFilename(filename: string): string | null

// Unified patient code extraction with fallback chain
function getPatientCode(analysisResult: EMGAnalysisResult): Promise<string | null>
```

### Enhanced File Naming
```
Current: "Ghostly_Emg_20230321_17-23-09-0409_analysis_report.csv"
Enhanced: "P012_Ghostly_Emg_20230321_17-23-09-0409_analysis_report.csv"

Current: "Ghostly_Emg_20230321_17-23-09-0409_export.json"  
Enhanced: "P012_Ghostly_Emg_20230321_17-23-09-0409_export.json"
```

### CSV Export Enhancement
- Patient code in file metadata section: `"Patient Code","P012"`
- Report header: `# Patient: P012 - EMG Analysis Export Report`
- Enhanced filename with patient code prefix

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task completion
- Maintain backward compatibility for exports without patient codes
- Handle edge cases: missing patient_id, malformed filenames, database lookup failures
- Ensure type safety throughout TypeScript interfaces

## Task Generation Rules Applied

1. **From Analysis Requirements**:
   - Patient code extraction → utility function tasks [P]
   - CSV integration → CSV generator enhancement task
   - Export hooks → export data integration task
   - UI components → display and naming tasks [P]
   
2. **From Existing Structure**:
   - Each component file → specific enhancement task [P]
   - Backend services → patient code lookup task
   - Frontend utilities → extraction function tasks [P]
   
3. **From User Experience**:
   - File naming → download enhancement tasks
   - Display → UI component tasks [P]
   - Error handling → validation and fallback tasks

4. **Ordering Applied**:
   - Setup → Tests → Utilities → Integration → UI → Polish
   - Dependencies managed to prevent blocking

## Validation Checklist
- [x] All export components have corresponding enhancement tasks
- [x] All utilities have test tasks before implementation
- [x] All tests come before implementation (TDD)
- [x] Parallel tasks target different files
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Patient code extraction covers all data sources
- [x] Backward compatibility maintained throughout