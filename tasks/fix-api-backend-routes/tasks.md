# Fix API Backend Routes - Vercel Production Issues

**Domain**: API Architecture & Routing  
**Status**: In Progress  
**Priority**: Critical  
**Date**: 2025-01-17  
**Personas**: Backend Architect (lead), DevOps Engineer, QA Engineer, Frontend Engineer

## Problem Statement

Vercel production deployment has inconsistent API routing patterns causing 404 errors for specific features (FAQ content, About page, scoring configurations) while other features (upload, authentication) work correctly.

## Root Cause Analysis

### Pattern Analysis
Through comprehensive codebase analysis, identified **3 distinct API calling patterns**:

1. ✅ **Consistent API_CONFIG Usage (7 files)** - Working in production
   - Uses `API_CONFIG.baseUrl` environment-based URLs
   - Examples: `therapistService.ts`, `mvcService.ts`, `AppContent.tsx`

2. ❌ **Hardcoded `/api` Prefix (3 files)** - Broken in production  
   - Relies on Vite development proxy (unavailable in production)
   - **Critical files**: `useScoringConfiguration.ts` (6 calls), `logger.ts` (1 call), `adherenceService.ts` (1 call)

3. 🔧 **Mixed Patterns** - Semi-working with fallbacks

### Why User Observed Partial Functionality
- **Upload working**: Uses `API_CONFIG.baseUrl` (Pattern 1) ✅
- **FAQ content missing**: Uses `/api` hardcoded calls (Pattern 2) ❌  
- **About page broken**: Missing route + `/api` dependencies (Pattern 2) ❌

## Implementation Tasks

### Phase 1: Critical API Route Fixes 🚨

#### Task 1.1: Fix useScoringConfiguration.ts (CRITICAL)
**File**: `src/hooks/useScoringConfiguration.ts`  
**Persona**: Backend Architect + API Specialist  
**Changes Required**: 6 hardcoded `/api` calls → `API_CONFIG.baseUrl`

```typescript
// Lines to fix:
// Line 74: `/api/scoring/configurations/custom?therapist_id=${therapistId}&patient_id=${patientId}`
// Line 79: `/api/scoring/configurations/custom?therapist_id=${therapistId}`  
// Line 86: `/api/scoring/configurations/custom?therapist_id=${therapistId}`
// Line 94: `/api/scoring/configurations/active`
// Line 199: `/api/scoring/configurations/custom`
// Line 246: `/api/scoring/configurations/default`

// Replace with: `${API_CONFIG.baseUrl}/scoring/configurations/...`
```

**Impact**: Fixes scoring configuration loading in production (affects therapist workflows)

#### Task 1.2: Fix logger.ts  
**File**: `src/services/logger.ts`  
**Persona**: Backend Architect  
**Changes Required**: Line 65 hardcoded `/api/logs/frontend` → `${API_CONFIG.baseUrl}/logs/frontend`

**Impact**: Fixes frontend logging in production environment

#### Task 1.3: Fix adherenceService.ts  
**File**: `src/services/adherenceService.ts`  
**Persona**: Backend Architect  
**Changes Required**: Line 26 `http://localhost:8080` → `API_CONFIG.baseUrl`

**Impact**: Fixes adherence data fetching with proper environment awareness

### Phase 2: Environment Configuration  

#### Task 2.1: Update API Config for Production
**File**: `src/config/apiConfig.ts`  
**Persona**: DevOps + System Architect  
**Changes Required**: 
```typescript
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_URL || '/api'  // Support both patterns
}
```

#### Task 2.2: Vercel Environment Configuration
**Platform**: Vercel Dashboard  
**Persona**: DevOps  
**Changes Required**: Set environment variable `VITE_API_URL=https://your-backend.herokuapp.com`

### Phase 3: Test Suite Updates  

#### Task 3.1: Update Test Expectations  
**Files**: 
- `src/hooks/__tests__/useScoringConfiguration.test.ts` (10 hardcoded `/api` expectations)
- `src/hooks/useScoringConfiguration.test.ts` (3 hardcoded `/api` expectations)

**Persona**: QA Engineer  
**Changes Required**: Update test expectations to use `API_CONFIG.baseUrl` pattern

### Phase 4: Validation & Documentation  

#### Task 4.1: Cross-Environment Testing  
**Persona**: QA Engineer + DevOps  
**Validation Matrix**:
- Development: Vite proxy + direct calls
- Production: Environment-based URLs  
- Features: Upload, FAQ, About, Scoring, Logging, Adherence

#### Task 4.2: Architecture Documentation  
**Persona**: Technical Writer + System Architect  
**Deliverables**: 
- API calling patterns documentation
- Environment configuration guide  
- Troubleshooting guide for future deployments

## Expected Outcomes

### Before Fix
- ✅ Upload functionality (Pattern 1)
- ❌ FAQ content loading (Pattern 2) 
- ❌ About page (Pattern 2 + missing route)
- ❌ Scoring configurations (Pattern 2)

### After Fix  
- ✅ All API calls work in development via Vite proxy or direct URL
- ✅ All API calls work in production via environment-based backend URL  
- ✅ FAQ/About content loads properly in both environments
- ✅ Single consistent API calling pattern across codebase

## Risk Assessment

**Low Risk Changes**: 
- Environment variable configuration
- API_CONFIG usage pattern standardization

**Medium Risk Changes**:
- useScoringConfiguration.ts (critical business logic)
- Test suite updates (extensive test modifications)

**Mitigation Strategy**: 
- Incremental deployment with rollback plan
- Comprehensive testing before production push
- Feature flags for gradual rollout

## Success Metrics

1. **Functional**: All pages load content in production (FAQ, About)
2. **Technical**: Zero 404 API errors in browser network tab  
3. **User Experience**: Consistent functionality across development/production
4. **Code Quality**: Single API calling pattern across entire codebase

## Dependencies

- Backend deployment must be accessible from configured `VITE_API_URL`
- Vercel build process must include environment variable
- CORS configuration on backend must allow frontend domain

---

**Last Updated**: 2025-01-17  
**Next Review**: After Phase 1 implementation  
**Assigned Personas**: Backend Architect (lead), DevOps, QA Engineer, System Architect