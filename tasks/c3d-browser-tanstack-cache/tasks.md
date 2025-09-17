# C3D Browser TanStack Query Caching Implementation

**Domain**: Frontend Performance & Caching  
**Status**: Planned  
**Priority**: High  
**Date**: 2025-01-17  
**Personas**: Frontend Architect (lead), Performance Engineer, QA Engineer

## Problem Statement

The C3D File Browser component currently uses custom SimpleCache and manual state management, causing loading spinners on every page refresh. Users need instant data display from cache, similar to the successful therapist dashboard TanStack Query implementation.

## Success Criteria

✅ **No loading spinners on refresh** (PRIMARY GOAL)  
✅ **Instant cached data display** from TanStack Query cache  
✅ **Smooth upload → analysis workflow** with optimistic updates  
✅ **Maintained existing UI/UX patterns** and performance optimizations  
✅ **Background data refresh** without blocking UI  

## Implementation Tasks

### Phase 1: Query Infrastructure Setup [PARALLEL EXECUTION]

#### Task T001: Extend Query Keys Configuration
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/lib/queryClient.ts`  
**Persona**: Frontend Architect  
**Type**: Infrastructure Setup  
**Parallel**: [P] Can run with T002

**Implementation**:
```typescript
// Add to existing queryKeys object
c3dBrowser: {
  all: ['c3d-browser'] as const,
  files: () => ['c3d-browser', 'files'] as const,
  sessions: (filePaths: string[]) => ['c3d-browser', 'sessions', ...filePaths] as const,
  therapists: (patientCodes: string[]) => ['c3d-browser', 'therapists', ...patientCodes] as const,
  patients: (patientCodes: string[]) => ['c3d-browser', 'patients', ...patientCodes] as const,
  medicalInfo: (patientCodes: string[]) => ['c3d-browser', 'medical-info', ...patientCodes] as const,
},

upload: {
  all: ['upload'] as const,
  status: (uploadId: string) => ['upload', 'status', uploadId] as const,
  analysis: (filename: string) => ['upload', 'analysis', filename] as const,
}
```

**Impact**: Provides structured query key factory for consistent caching
**Dependencies**: None

#### Task T002: Create Upload Workflow Query Keys
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/lib/queryClient.ts`  
**Persona**: Frontend Architect  
**Type**: Infrastructure Setup  
**Parallel**: [P] Can run with T001

**Implementation**: Extend queryKeys with upload and analysis caching patterns
**Impact**: Enables upload workflow caching and analysis result caching
**Dependencies**: None

### Phase 2: Core Query Hooks Development [PARALLEL EXECUTION]

#### Task T003: Create C3D Browser Query Hook
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/hooks/useC3DFileBrowserQuery.ts`  
**Persona**: Frontend Architect + Performance Engineer  
**Type**: Core Hook Development  
**Parallel**: [P] Can run with T004, T005

**Implementation**:
```typescript
export function useC3DFileBrowserQuery(): C3DFileBrowserData {
  // Query 1: C3D files list
  const filesQuery = useQuery({
    queryKey: queryKeys.c3dBrowser.files(),
    queryFn: fetchC3DFiles,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Query 2: Session data (dependent)
  const filePaths = filesQuery.data?.map(f => `c3d-examples/${f.name}`) || []
  const sessionQuery = useQuery({
    queryKey: queryKeys.c3dBrowser.sessions(filePaths),
    queryFn: () => fetchSessionData(filePaths),
    enabled: filePaths.length > 0,
  })

  // Additional dependent queries for therapists, patients
  // Smart loading states logic
  // Error handling and cache coordination
}
```

**Key Features**:
- Extract existing logic from C3DFileBrowser.tsx
- Convert SimpleCache patterns to TanStack Query
- Implement stale-while-revalidate for instant UI updates
- Preserve parallel loading performance

**Impact**: Core caching functionality for file browser
**Dependencies**: T001, T002

#### Task T004: Create Upload Mutation Hook  
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/hooks/useC3DUploadMutation.ts`  
**Persona**: Frontend Architect  
**Type**: Mutation Hook Development  
**Parallel**: [P] Can run with T003, T005

**Implementation**:
```typescript
export function useC3DUploadMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: uploadFiles,
    onSuccess: () => {
      // Smart cache invalidation
      queryClient.invalidateQueries({ queryKey: queryKeys.c3dBrowser.files() })
      queryClient.invalidateQueries({ queryKey: queryKeys.c3dBrowser.all })
    },
    onError: (error) => {
      // Error handling and retry logic
    }
  })
}
```

**Impact**: Handles upload workflow with automatic cache refresh
**Dependencies**: T001, T002

#### Task T005: Create Analysis Result Caching
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/hooks/useAnalysisQuery.ts`  
**Persona**: Performance Engineer  
**Type**: Analysis Caching Hook  
**Parallel**: [P] Can run with T003, T004

**Implementation**:
```typescript
export function useAnalysisQuery(filename: string, sessionParams: any) {
  return useQuery({
    queryKey: queryKeys.upload.analysis(filename),
    queryFn: () => fetchEMGAnalysis(filename, sessionParams),
    enabled: !!filename,
    staleTime: 10 * 60 * 1000, // 10 minutes for analysis results
    gcTime: 30 * 60 * 1000, // Keep analysis results longer
  })
}
```

**Impact**: Caches expensive analysis computations
**Dependencies**: T001, T002

### Phase 3: Component Integration [SEQUENTIAL EXECUTION]

#### Task T006: Replace C3DFileBrowser State Management
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/components/c3d/C3DFileBrowser.tsx`  
**Persona**: Frontend Architect  
**Type**: Component Refactor  
**Sequential**: Must be done in order with T007-T009

**Implementation**:
```typescript
// Before: Manual state management
const [files, setFiles] = useState<C3DFile[]>([])
const [isLoadingFiles, setIsLoadingFiles] = useState(true)
const [sessionData, setSessionData] = useState<Record<string, TherapySession>>({})

// After: TanStack Query
const { files, sessions, therapists, patients, loading, error } = useC3DFileBrowserQuery()
```

**Key Changes**:
- Replace useState hooks with query hook
- Update loading states to use query loading states
- Maintain existing UI/UX patterns
- Preserve granular loading indicators
- Keep error handling patterns

**Impact**: Core component now uses intelligent caching
**Dependencies**: T003

#### Task T007: Remove Custom SimpleCache Class
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/components/c3d/C3DFileBrowser.tsx`  
**Persona**: Frontend Architect  
**Type**: Code Cleanup  
**Sequential**: After T006

**Implementation**:
- Remove SimpleCache class (lines 64-100)
- Remove dataCache singleton (line 100)
- Remove manual cache.set() and cache.get() calls
- Remove cache.clear() in refresh functions

**Impact**: Eliminates duplicate caching logic
**Dependencies**: T006

#### Task T008: Update C3DFileUpload with Mutation
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/components/c3d/C3DFileUpload.tsx`  
**Persona**: Frontend Architect  
**Type**: Component Enhancement  
**Sequential**: After T007

**Implementation**:
```typescript
// Replace manual upload handling
const uploadMutation = useC3DUploadMutation()

const confirmUpload = async () => {
  try {
    await uploadMutation.mutateAsync(pendingFiles)
    // Optimistic updates and error handling
  } catch (error) {
    // Enhanced error handling
  }
}
```

**Impact**: Upload workflow gets automatic cache invalidation
**Dependencies**: T004, T007

#### Task T009: Enhance AppContent Analysis Caching
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/AppContent.tsx`  
**Persona**: Performance Engineer  
**Type**: Analysis Flow Enhancement  
**Sequential**: After T008

**Implementation**: 
- Integrate useAnalysisQuery for EMG analysis results
- Cache analysis results for re-access
- Maintain existing loading overlay UI
- Preserve error handling patterns

**Impact**: Analysis results cached for instant re-access
**Dependencies**: T005, T008

### Phase 4: Testing & Validation [PARALLEL EXECUTION]

#### Task T010: Create Comprehensive Test Suite [P]
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/hooks/__tests__/useC3DFileBrowserQuery.test.tsx`  
**Persona**: QA Engineer  
**Type**: Test Development  
**Parallel**: [P] Can run with T011, T012

**Test Coverage**:
```typescript
describe('useC3DFileBrowserQuery', () => {
  it('should show cached data immediately on subsequent calls (PRIMARY GOAL)')
  it('should handle disabled queries when not authenticated')
  it('should invalidate cache after upload mutation')
  it('should maintain data consistency across components')
  it('should handle loading states correctly')
  it('should demonstrate cache performance improvements')
})
```

**Impact**: Validates core caching functionality
**Dependencies**: T003

#### Task T011: Performance Validation Testing [P]
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/components/c3d/__tests__/C3DFileBrowser.performance.test.tsx`  
**Persona**: Performance Engineer  
**Type**: Performance Testing  
**Parallel**: [P] Can run with T010, T012

**Test Scenarios**:
- Load time comparison: Before vs After caching
- Cache hit rate validation
- Memory usage verification  
- Background refresh behavior
- Upload workflow performance

**Impact**: Validates performance improvements
**Dependencies**: T006

#### Task T012: Upload Workflow Integration Testing [P]
**File**: `/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/frontend/src/components/c3d/__tests__/C3DFileUpload.integration.test.tsx`  
**Persona**: QA Engineer  
**Type**: Integration Testing  
**Parallel**: [P] Can run with T010, T011

**Test Scenarios**:
- Upload → cache invalidation → fresh data display
- Error handling during upload with cache state
- Optimistic updates behavior
- Analysis workflow caching integration

**Impact**: Validates end-to-end upload workflow
**Dependencies**: T008

## Parallel Execution Strategy

### Wave 1: Infrastructure [P]
```bash
# Can run simultaneously
Task T001 & T002: Query key configuration
Estimated Time: 30 minutes total
```

### Wave 2: Core Development [P]  
```bash  
# Can run simultaneously
Task T003: useC3DFileBrowserQuery
Task T004: useC3DUploadMutation  
Task T005: useAnalysisQuery
Estimated Time: 2 hours total
```

### Wave 3: Integration [Sequential]
```bash
# Must run in sequence (same files)
Task T006 → T007 → T008 → T009
Estimated Time: 1.5 hours total
```

### Wave 4: Validation [P]
```bash
# Can run simultaneously  
Task T010 & T011 & T012: Test suite development
Estimated Time: 1 hour total
```

**Total Estimated Time**: 5 hours (with parallel execution)
**Sequential Time Would Be**: 8+ hours

## Risk Assessment

**Low Risk**:
- Query key configuration (T001, T002)
- New hook development (T003-T005)
- Test suite development (T010-T012)

**Medium Risk**:
- Component integration (T006-T009) - modifies existing working components
- SimpleCache removal (T007) - ensure no functionality loss

**Mitigation Strategy**:
- Incremental implementation with feature flags
- Comprehensive testing before production
- Rollback plan to revert to SimpleCache if issues arise
- Performance monitoring during deployment

## Success Validation

### Before Implementation
- ❌ Loading spinners on every refresh
- ❌ Manual cache management with SimpleCache
- ❌ No background data refresh
- ❌ Inconsistent caching patterns across app

### After Implementation  
- ✅ Instant data display from TanStack Query cache
- ✅ No loading spinners on refresh (PRIMARY GOAL)
- ✅ Automatic cache invalidation after uploads
- ✅ Background data refresh without UI blocking
- ✅ Consistent caching patterns with therapist dashboard
- ✅ Maintained existing performance optimizations

## Dependencies

**Technical Dependencies**:
- TanStack Query infrastructure already implemented ✅
- Existing API patterns and services ✅
- Current component architecture ✅

**External Dependencies**:
- Supabase Storage Service availability
- Backend API endpoint stability  
- Browser cache storage limits

---

**Last Updated**: 2025-01-17  
**Next Review**: After Phase 2 completion  
**Assigned Personas**: Frontend Architect (lead), Performance Engineer, QA Engineer  
**Estimated Completion**: 5 hours with parallel execution