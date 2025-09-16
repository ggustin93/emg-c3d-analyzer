# Patient Code Export Enhancement - Execution Guide

## Task Dependency Validation ✅

### Phase Dependencies Verified
1. **Setup (T001-T003)** → No internal dependencies, can run in parallel
2. **Tests (T004-T008)** → Depend on setup completion, can run in parallel among themselves
3. **Core Implementation (T009-T015)** → Depend on failing tests, specific internal dependencies mapped
4. **Integration (T016-T020)** → Depend on core utilities, specific dependencies mapped
5. **Polish (T021-T025)** → Depend on complete implementation, can run in parallel

### Critical Path Analysis
```
T001-T003 (Setup) 
    ↓
T004-T008 (Tests - ALL must fail)
    ↓
T009-T010 (Core Utilities) → T011-T013 (Component Enhancement) → T016-T017 (UI Integration)
                           → T012 (Hooks) → T019 (DB Integration) → T020 (File Naming)
                           → T014 (Backend) [parallel track]
                                  ↓
T015 (API Enhancement)
    ↓
T021-T025 (Polish & Validation)
```

## Parallel Execution Opportunities

### Wave 1: Setup (All Parallel)
```bash
# Can run simultaneously - different files
Task: "Create patient code extraction utility structure in frontend/src/components/tabs/ExportTab/utils.ts"
Task: "Configure test environment in frontend/src/components/tabs/ExportTab/__tests__/patient-code-extraction.test.ts" 
Task: "Set up TypeScript interfaces in frontend/src/components/tabs/ExportTab/types.ts"
```

### Wave 2: TDD Tests (All Parallel)
```bash
# Can run simultaneously - different test files
Task: "Patient code extraction from patient_id test"
Task: "Patient code extraction from filename pattern test" 
Task: "CSV export with patient code integration test"
Task: "Export hooks patient code integration test"
Task: "Export actions patient code display test"
```

### Wave 3: Core Utilities (Parallel Foundation)
```bash
# Can run simultaneously - different utility functions
Task: "Implement extractPatientCodeFromPatientId utility function"
Task: "Implement extractPatientCodeFromFilename utility function"
```

### Wave 4: Component Enhancement (Parallel Implementation)
```bash
# Can run simultaneously - different component files
Task: "Add patient code to CSV metadata and headers in csvGenerator.ts"
Task: "Integrate patient code in export data generation in hooks.tsx"
Task: "Update ExportData interface with patient code fields in types.ts"
Task: "Enhance backend export service with patient code lookup in export_service.py"
```

### Wave 5: UI Integration (Parallel)
```bash
# Can run simultaneously - different UI aspects
Task: "Update ExportActions component with patient code display"
Task: "Implement patient code in file naming for downloads"
Task: "Add patient code error handling and fallbacks"
```

### Wave 6: Polish & Validation (All Parallel)
```bash
# Can run simultaneously - different test and documentation files
Task: "End-to-end export functionality test with patient codes"
Task: "Patient code validation and edge case handling"
Task: "Update export documentation with patient code features"
Task: "Performance test for patient code extraction (<50ms)"
Task: "Backward compatibility validation for existing exports"
```

## File Modification Matrix

| Phase | File | Tasks | Parallel Safe |
|-------|------|-------|---------------|
| Setup | `utils.ts` | T001 | ✅ (structure only) |
| Setup | `types.ts` | T003 | ✅ (interface setup) |
| Tests | `__tests__/*` | T004-T008 | ✅ (different test files) |
| Core | `utils.ts` | T009, T010 | ❌ (same file - sequential) |
| Core | `csvGenerator.ts` | T011 | ✅ (different file) |
| Core | `hooks.tsx` | T012 | ✅ (different file) |
| Core | `types.ts` | T013 | ✅ (different file) |
| Core | `export_service.py` | T014 | ✅ (different file) |
| Integration | `ExportActions.tsx` | T016, T017 | ❌ (same file - sequential) |
| Integration | `utils.ts` | T018 | ❌ (conflicts with T009-T010) |
| Integration | `hooks.tsx` | T019 | ❌ (conflicts with T012) |
| Integration | `csvGenerator.ts` | T020 | ❌ (conflicts with T011) |

## Risk Mitigation

### Same-File Conflicts Identified
- **`utils.ts`**: T001 → T009,T010 → T018 (must be sequential)
- **`hooks.tsx`**: T012 → T019 (must be sequential)  
- **`csvGenerator.ts`**: T011 → T020 (must be sequential)
- **`ExportActions.tsx`**: T016 → T017 (must be sequential)

### Dependency Management
- All tests (T004-T008) **MUST fail** before any implementation
- Core utilities (T009-T010) **MUST complete** before dependent tasks
- Backend task (T014) can run **fully parallel** with frontend tasks
- UI tasks (T016-T017) depend on hooks completion (T012)

### Performance Targets
- Patient code extraction: **<50ms** (T024 validation)
- Database lookup fallback: **<200ms**
- CSV generation with patient code: **<2s additional overhead**
- UI responsiveness maintained: **<100ms for display updates**

## Success Criteria
- [ ] All 25 tasks executable with clear dependencies
- [ ] Maximum parallelization achieved (14 parallel opportunities)
- [ ] No file conflicts in parallel tasks
- [ ] TDD approach maintained throughout
- [ ] Backward compatibility preserved
- [ ] Patient codes included in 100% of export pathways