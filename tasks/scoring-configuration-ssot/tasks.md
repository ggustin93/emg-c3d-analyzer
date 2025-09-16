# Tasks: Scoring Configuration Single Source of Truth

## Overview
Implement database as the single source of truth for scoring configuration, eliminating redundancy between backend config.py, API endpoints, and frontend fallback weights. Ensure admin-only access during clinical trial.

## Prerequisites
- [x] Database has GHOSTLY-TRIAL-DEFAULT configuration (ID: a0000000-0000-0000-0000-000000000001)
- [x] RLS policies exist for admin-only write access
- [x] Backend FastAPI running on port 8080
- [x] Frontend React app with TypeScript
- [x] Supabase project: egihfsmxphqcsjotmhmm

## Task List

### Phase 1: Backend Core Changes

#### T001: Add PUT endpoint for default configuration
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/backend/api/routes/scoring_config.py`
**Dependencies**: None
**Description**: Add endpoint to update GHOSTLY-TRIAL-DEFAULT configuration
```python
@router.put("/configurations/default")
async def update_default_configuration(config: ScoringConfigurationRequest):
    """Update the GHOSTLY-TRIAL-DEFAULT configuration (admin only)."""
    # Update configuration with ID a0000000-0000-0000-0000-000000000001
    # Validate admin role from auth context
    # Return updated configuration
```

#### T002: Add backend startup validation
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/backend/main.py`
**Dependencies**: T001
**Description**: Ensure GHOSTLY-TRIAL-DEFAULT exists on startup
```python
async def ensure_default_configuration():
    """Ensure GHOSTLY-TRIAL-DEFAULT exists in database."""
    # Check if configuration exists
    # Create with defaults from config.py if missing
    # Log validation result
```

#### T003: Remove scoring_weights from config defaults endpoint
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/backend/api/routes/config_defaults.py`
**Dependencies**: None
**Description**: Remove redundant scoring_weights, keep only MVC/duration defaults
```python
# Remove scoring_weights from BackendDefaultsResponse
# Remove ScoringDefaults import
# Keep only MVC and duration configuration
```

### Phase 2: Frontend Core Changes

#### T004: Update useScoringConfiguration hook - Remove fallbacks [P]
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/hooks/useScoringConfiguration.ts`
**Dependencies**: T001
**Description**: Remove FALLBACK_WEIGHTS and simplify to database-only approach
- Remove FALLBACK_WEIGHTS constant
- Remove fallback logic in fetchConfiguration
- Always require database configuration
- Add proper error handling for missing config

#### T005: Fix saveGlobalWeights to use new endpoint [P]
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/hooks/useScoringConfiguration.ts`
**Dependencies**: T001, T004
**Description**: Update saveGlobalWeights to PUT to /configurations/default
```typescript
const saveGlobalWeights = async (weights: ScoringWeights) => {
  // PUT to /api/scoring/configurations/default
  // Use "GHOSTLY-TRIAL-DEFAULT" as configuration_name
  // Handle response and errors
}
```

#### T006: Update useBackendDefaults hook [P]
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/hooks/useBackendDefaults.ts`
**Dependencies**: T003
**Description**: Remove scoring_weights from expected response
- Update BackendDefaults interface
- Remove scoring_weights field
- Keep only MVC and duration fields

### Phase 3: Test Updates

#### T007: Update frontend test mocks [P]
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/hooks/useScoringConfiguration.test.ts`
**Dependencies**: T004, T005
**Description**: Fix tests to use correct configuration name and endpoints
- Replace "Global Default" with "GHOSTLY-TRIAL-DEFAULT"
- Mock PUT /configurations/default instead of POST /configurations/global
- Remove fallback weight tests
- Add tests for missing configuration handling

#### T008: Add backend endpoint tests [P]
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/backend/tests/api/test_scoring_config.py`
**Dependencies**: T001
**Description**: Add tests for new PUT /configurations/default endpoint
```python
def test_update_default_configuration_admin():
    """Test admin can update default configuration."""
    
def test_update_default_configuration_non_admin():
    """Test non-admin cannot update default configuration."""
```

### Phase 4: UI Access Control

#### T009: Add admin role check to UI components
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/components/ScoringConfigurationPanel.tsx`
**Dependencies**: T005
**Description**: Show/hide configuration options based on user role
```typescript
// Check user role from auth context
// Conditionally render save/edit buttons
// Show read-only view for non-admins
// Display admin-only message when appropriate
```

#### T010: Add role check to PerformanceTab component
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/components/tabs/PerformanceTab/PerformanceTab.tsx`
**Dependencies**: T009
**Description**: Integrate role-based UI restrictions in performance tab
- Import useAuth hook
- Check if user.role === 'admin'
- Conditionally show configuration controls
- Add tooltip for non-admins explaining restriction

### Phase 5: Integration Testing

#### T011: Test complete admin flow [P]
**Dependencies**: T001-T010
**Description**: End-to-end test for admin updating configuration
1. Login as admin user
2. Navigate to performance tab
3. Modify scoring weights
4. Save configuration
5. Verify database update
6. Verify UI reflects changes

#### T012: Test non-admin restrictions [P]
**Dependencies**: T001-T010
**Description**: Verify non-admin users cannot modify configuration
1. Login as therapist user
2. Navigate to performance tab
3. Verify configuration is read-only
4. Verify save buttons are hidden/disabled
5. Attempt direct API call (should fail)

#### T013: Test missing configuration handling [P]
**Dependencies**: T001-T010
**Description**: Verify graceful handling when configuration is missing
1. Temporarily rename GHOSTLY-TRIAL-DEFAULT in database
2. Load application
3. Verify startup validation creates default
4. Verify frontend handles gracefully
5. Restore original configuration

### Phase 6: Documentation & Cleanup

#### T014: Update API documentation [P]
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/docs/api/scoring-configuration.md`
**Dependencies**: T001-T013
**Description**: Document new endpoint and behavior
- Document PUT /configurations/default endpoint
- Update authentication requirements
- Add role-based access notes
- Include example requests/responses

#### T015: Update frontend documentation [P]
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/docs/frontend/scoring-configuration.md`
**Dependencies**: T001-T013
**Description**: Document frontend changes
- Document removal of fallback weights
- Explain single source of truth approach
- Add troubleshooting section
- Include admin setup instructions

#### T016: Run full test suite
**Dependencies**: T001-T015
**Description**: Verify all tests pass
```bash
# Backend tests
cd backend && python -m pytest tests/ -v

# Frontend tests
cd frontend && npm test -- --run

# E2E tests
npm run test:e2e
```

## Parallel Execution Strategy

### Batch 1 (Can run in parallel):
```bash
# Terminal 1
Task T001: Add PUT endpoint for default configuration

# Terminal 2
Task T003: Remove scoring_weights from config defaults

# Terminal 3
Task T006: Update useBackendDefaults hook
```

### Batch 2 (After T001 completes):
```bash
# Terminal 1
Task T002: Add backend startup validation

# Terminal 2
Task T004: Update useScoringConfiguration hook - Remove fallbacks

# Terminal 3
Task T008: Add backend endpoint tests
```

### Batch 3 (After T004 completes):
```bash
# Terminal 1
Task T005: Fix saveGlobalWeights to use new endpoint

# Terminal 2
Task T007: Update frontend test mocks

# Terminal 3
Task T009: Add admin role check to UI components
```

### Batch 4 (After T009 completes):
```bash
# Terminal 1
Task T010: Add role check to PerformanceTab

# Terminal 2
Task T011: Test complete admin flow

# Terminal 3
Task T012: Test non-admin restrictions
```

### Batch 5 (Final - can run all in parallel):
```bash
# Terminal 1
Task T013: Test missing configuration handling

# Terminal 2
Task T014: Update API documentation

# Terminal 3
Task T015: Update frontend documentation
```

### Sequential (Must run alone):
```bash
Task T016: Run full test suite
```

## Success Criteria

- [ ] No hardcoded scoring weights in backend config.py (only used for startup validation)
- [ ] Frontend always fetches from database (no fallback logic)
- [ ] Admin users can modify configuration via UI
- [ ] Non-admin users see read-only configuration
- [ ] All tests pass in CI/CD pipeline
- [ ] GHOSTLY-TRIAL-DEFAULT used consistently everywhere
- [ ] Single source of truth achieved (database only)

## Notes

- GHOSTLY-TRIAL-DEFAULT has fixed ID: a0000000-0000-0000-0000-000000000001
- RLS policies already enforce admin-only write access at database level
- Backend should validate but not duplicate RLS logic
- Frontend role checks are for UI/UX only, not security
- Keep error messages user-friendly but not revealing of system internals