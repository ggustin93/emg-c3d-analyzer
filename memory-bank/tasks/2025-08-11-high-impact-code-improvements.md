Peu# High-Impact Code Quality Improvements

**Date**: August 11, 2025  
**Priority**: High Impact, Low Effort  
**Estimated Time**: 4-6 hours  
**Status**: Planned

## Overview

Implement four key code quality improvements that will significantly enhance maintainability, type safety, and testing coverage without breaking any existing functionality. These improvements build on the Single Source of Truth pattern recently implemented.

## Task Breakdown

### 1. Backend Flag Utilities 🛠️
**Estimated Time**: 45 minutes  
**Files**: `/src/lib/analyticsUtils.ts` (new)

**Objective**: Abstract the repetitive null/undefined checking pattern used across multiple hooks.

**Current Problem**:
```typescript
// Repeated in usePerformanceMetrics, useContractionAnalysis, etc.
const hasBackendMvc = c.meets_mvc !== null && c.meets_mvc !== undefined;
const hasBackendDuration = c.meets_duration !== null && c.meets_duration !== undefined;
const hasBackendGood = c.is_good !== null && c.is_good !== undefined;
```

**Implementation Tasks**:
- [ ] Create `/src/lib/analyticsUtils.ts`
- [ ] Implement `hasBackendFlag(flag: unknown): flag is boolean`
- [ ] Implement `getBackendFlagOrFallback<T>(backendValue, fallbackValue): boolean | T`
- [ ] Add JSDoc documentation with usage examples
- [ ] Export utilities from main lib index

**Success Criteria**:
```typescript
// Clean, reusable pattern
const meetsMvc = getBackendFlagOrFallback(
  c.meets_mvc, 
  mvcThreshold !== null && c.max_amplitude >= mvcThreshold
);
```

**Files to Update**:
- `usePerformanceMetrics.ts` - Replace manual checks (lines 146, 147, 152, 153)
- `useContractionAnalysis.ts` - Replace manual checks (lines 121, 122, 239, 240)

---

### 2. Type Guards & Runtime Validation 🛡️
**Estimated Time**: 90 minutes  
**Files**: `/src/lib/validators.ts` (new), `/src/types/emg.ts` (update)

**Objective**: Add runtime validation for critical analytics data to catch backend/frontend schema mismatches early.

**Implementation Tasks**:
- [ ] Create `/src/lib/validators.ts`
- [ ] Implement `isValidContraction(data: unknown): data is Contraction`
- [ ] Implement `isValidChannelAnalytics(data: unknown): data is ChannelAnalyticsData`
- [ ] Implement `validateAnalyticsData(data: unknown): ValidationResult`
- [ ] Add validation error types with descriptive messages
- [ ] Integrate validation into `useLiveAnalytics` hook

**Success Criteria**:
```typescript
// Catch invalid data early with helpful error messages
const validationResult = validateAnalyticsData(analyticsFromBackend);
if (!validationResult.isValid) {
  logger.error('Invalid analytics data', validationResult.errors);
  // Graceful fallback or user notification
}
```

**Integration Points**:
- `useLiveAnalytics.ts` - Add validation after backend response
- `GameSessionTabs.tsx` - Add validation on initial data load
- Error handling for malformed backend responses

---

### 3. Score Calculation Service 📊
**Estimated Time**: 2 hours  
**Files**: `/src/services/scoreCalculator.ts` (new)

**Objective**: Centralize weighted average calculations and score computation logic used across multiple components.

**Current Problem**:
- Weighted average logic duplicated in `usePerformanceMetrics` and `MusclePerformanceCard` tooltip
- Score calculation patterns scattered across different hooks
- Inconsistent weight normalization approaches

**Implementation Tasks**:
- [ ] Create `/src/services/scoreCalculator.ts`
- [ ] Implement `ScoreCalculator.calculateWeightedAverage(scores, weights)`
- [ ] Implement `ScoreCalculator.calculateComplianceScore(completion, intensity, duration, weights)`
- [ ] Implement `ScoreCalculator.normalizeWeights(weights): number[]`
- [ ] Add comprehensive unit tests for all calculation methods
- [ ] Export service with proper TypeScript interfaces

**Service Interface**:
```typescript
interface ComponentScore {
  value: number | null;
  weight: number;
}

interface ScoreCalculationResult {
  totalScore: number;
  normalizedWeights: number[];
  contributingScores: number[];
  formula: string; // For tooltip display
}

class ScoreCalculator {
  static calculateWeightedAverage(
    scores: ComponentScore[]
  ): ScoreCalculationResult;
  
  static formatCalculationForDisplay(result: ScoreCalculationResult): string;
}
```

**Files to Update**:
- `usePerformanceMetrics.ts` - Replace `calculateTotalScore` with service
- `MusclePerformanceCard.tsx` - Use service for tooltip calculation
- `useEnhancedPerformanceMetrics.ts` - Use service for muscle score calculations

---

### 4. Enhanced Unit Tests 🧪
**Estimated Time**: 2.5 hours  
**Files**: Multiple test files

**Objective**: Comprehensive test coverage for Single Source of Truth pattern and new utility functions.

**Implementation Tasks**:

#### 4.1 Analytics Utils Tests (30 min)
- [ ] Create `/src/lib/__tests__/analyticsUtils.test.ts`
- [ ] Test `hasBackendFlag` with various input types
- [ ] Test `getBackendFlagOrFallback` fallback behavior
- [ ] Edge cases: null, undefined, false, 0, empty string

#### 4.2 Validators Tests (45 min)
- [ ] Create `/src/lib/__tests__/validators.test.ts`
- [ ] Test valid/invalid contraction data structures  
- [ ] Test malformed backend responses
- [ ] Test validation error message clarity
- [ ] Performance benchmarks for validation functions

#### 4.3 Score Calculator Tests (60 min)
- [ ] Create `/src/services/__tests__/scoreCalculator.test.ts`
- [ ] Test weighted average calculations with various weight combinations
- [ ] Test edge cases: all weights zero, negative weights, null scores
- [ ] Test calculation consistency with current implementation
- [ ] Performance benchmarks for score calculations

#### 4.4 SoT Pattern Integration Tests (45 min)
- [ ] Update `/src/hooks/__tests__/usePerformanceMetrics.test.ts`
- [ ] Test backend flag priority over calculations
- [ ] Test fallback behavior when backend flags missing
- [ ] Test mixed scenarios (some flags present, others missing)
- [ ] Test consistency between hooks using same data

**Test Coverage Goals**:
- Analytics utilities: 100% coverage
- Validators: 95% coverage  
- Score calculator: 100% coverage
- SoT pattern: 90% coverage across all implementing hooks

---

## Implementation Strategy

### Phase 1: Foundation (Day 1 Morning)
1. Create analytics utilities
2. Implement basic type guards
3. Create score calculator service
4. Write core unit tests

### Phase 2: Integration (Day 1 Afternoon)  
1. Update existing hooks to use new utilities
2. Add validation to data flow entry points
3. Replace duplicated calculation logic
4. Run comprehensive test suite

### Phase 3: Validation (Day 1 Evening)
1. Build and test application thoroughly
2. Verify no breaking changes
3. Performance benchmarking
4. Update documentation

## Success Metrics

- [ ] **Code Duplication**: Reduce repetitive null checks by 80%
- [ ] **Type Safety**: Runtime validation catches invalid data early
- [ ] **Test Coverage**: Achieve 95%+ coverage for calculation logic  
- [ ] **Build Performance**: No regression in build times
- [ ] **Bundle Size**: No increase in production bundle
- [ ] **Runtime Performance**: No regression in calculation performance

## Risk Mitigation

**Low Risk Assessment**: These changes are purely additive/refactoring without changing external APIs or business logic.

**Rollback Plan**: 
- Each utility is independent and can be rolled back separately
- Original code remains intact until integration is verified
- Comprehensive test suite ensures behavior consistency

**Testing Strategy**:
- Run existing test suite after each change
- Manual testing of performance score calculations
- Cross-browser testing of updated components

## Dependencies

- No external dependencies required
- Existing TypeScript/testing infrastructure sufficient
- All changes use current project patterns and conventions

## Documentation Updates

- [ ] Update `/memory-bank/systemPatterns.md` with new utility patterns
- [ ] Add JSDoc documentation for all new functions
- [ ] Update Single Source of Truth pattern document with utility examples
- [ ] Create developer guide for using new score calculation service

## Notes

- Maintain backward compatibility throughout
- Follow existing code style and patterns
- Use current logging system for any new debug information
- Coordinate with any ongoing parallel development