# Single Source of Truth (SoT) Pattern

## Overview

The Single Source of Truth pattern ensures consistency across all frontend components by prioritizing backend analytics flags over frontend calculations. This pattern prevents discrepancies between different parts of the UI and ensures that therapeutic compliance calculations are consistent with the clinical backend logic.

## Core Principle

**Backend analytics flags are ALWAYS trusted when available. Frontend calculations are ONLY used as fallbacks when backend flags are missing.**

## Implementation Pattern

### Standard Backend Flag Check
```typescript
// ✅ Correct Pattern
const hasBackendMvc = c.meets_mvc !== null && c.meets_mvc !== undefined;
const hasBackendDuration = c.meets_duration !== null && c.meets_duration !== undefined;
const hasBackendGood = c.is_good !== null && c.is_good !== undefined;

const meetsMvc = hasBackendMvc 
  ? c.meets_mvc                    // Trust backend flag
  : (mvcThreshold !== null && c.max_amplitude >= mvcThreshold); // Fallback

const meetsDuration = hasBackendDuration 
  ? c.meets_duration              // Trust backend flag  
  : (c.duration_ms >= durationThreshold); // Fallback

const isGood = hasBackendGood
  ? c.is_good                     // Trust backend flag
  : (meetsMvc && meetsDuration);  // Fallback
```

### Anti-Pattern (Do Not Use)
```typescript
// ❌ Incorrect - Always calculates manually
const isGood = c.max_amplitude >= mvcThreshold && c.duration_ms >= durationThreshold;

// ❌ Incorrect - Doesn't check for null/undefined properly  
const meetsMvc = c.meets_mvc ?? (c.max_amplitude >= mvcThreshold);
```

## Components Following SoT Pattern

### ✅ Compliant Hooks

#### `useContractionAnalysis.ts`
- **Lines 120-133**: Proper backend flag checking with fallbacks
- **Lines 238-251**: Consistent pattern in contraction areas calculation
- **Purpose**: Chart visualization and quality summary calculations

#### `usePerformanceMetrics.ts` 
- **Lines 145-154**: Recently updated to follow SoT pattern
- **Purpose**: Performance score calculations for MusclePerformanceCard

### 🔍 Hooks to Verify

#### `useMVCCalculations.ts`
- **Status**: Need to verify SoT compliance
- **Purpose**: MVC threshold calculations for chart display

## Backend Analytics Structure

### Key Backend Flags
```typescript
interface Contraction {
  // Backend calculated flags (SoT)
  meets_mvc?: boolean | null;
  meets_duration?: boolean | null;
  is_good?: boolean | null;
  
  // Raw data (for fallback calculations)
  max_amplitude: number;
  duration_ms: number;
  start_time_ms: number;
  end_time_ms: number;
}

interface ChannelAnalyticsData {
  contractions: Contraction[];
  mvc_threshold_actual_value?: number | null;
  duration_threshold_actual_value?: number | null;
  good_contraction_count?: number;
  contraction_count?: number;
}
```

## Data Flow Architecture

```
TherapeuticParametersSettings
    ↓ (sessionParams changes)
useSessionStore
    ↓ (triggers recalc)
useLiveAnalytics 
    ↓ (backend /recalc with new params)
Updated Analytics with Backend Flags
    ↓ (SoT pattern)
usePerformanceMetrics / useContractionAnalysis
    ↓ (consistent calculations)
MusclePerformanceCard / EMGChart Components
```

## Benefits of SoT Pattern

1. **Consistency**: All UI components show the same therapeutic compliance results
2. **Clinical Accuracy**: Backend calculations use clinical domain knowledge
3. **Performance**: Frontend doesn't duplicate complex threshold calculations  
4. **Maintainability**: Single place to update clinical logic (backend)
5. **Debugging**: Clear separation between backend flags and frontend fallbacks

## Migration Checklist

When updating a hook to follow SoT pattern:

- [ ] Check for backend flags before calculating manually
- [ ] Use explicit null/undefined checks (not nullish coalescing `??`)
- [ ] Provide meaningful fallbacks when backend flags missing
- [ ] Log warnings when frontend fallbacks are used
- [ ] Test with both backend flags present and missing
- [ ] Update component documentation

## Testing Strategy

### Unit Tests Should Cover
1. **Backend flags present**: Hook uses backend values
2. **Backend flags missing**: Hook falls back to manual calculation  
3. **Mixed scenarios**: Some flags present, others missing
4. **Edge cases**: null vs undefined handling

### Example Test Structure
```typescript
describe('Single Source of Truth pattern', () => {
  it('should use backend meets_mvc flag when available', () => {
    const contraction = { meets_mvc: true, max_amplitude: 0.001 };
    const result = processContraction(contraction, { mvcThreshold: 0.002 });
    expect(result.meetsMvc).toBe(true); // Uses backend flag, not calculation
  });
  
  it('should fallback to calculation when backend flag missing', () => {
    const contraction = { meets_mvc: null, max_amplitude: 0.003 };
    const result = processContraction(contraction, { mvcThreshold: 0.002 });
    expect(result.meetsMvc).toBe(true); // Uses calculation fallback
  });
});
```

## Future Improvements

1. **Utility Functions**: Abstract the repetitive flag checking logic
2. **Type Guards**: Runtime validation for backend flag structure
3. **Monitoring**: Track how often fallbacks are used
4. **Documentation**: JSDoc comments explaining SoT reasoning