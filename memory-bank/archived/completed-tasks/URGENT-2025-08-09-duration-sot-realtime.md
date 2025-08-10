# URGENT — Duration SoT & Real-Time Recalc Data Flow ✅ COMPLETED

Date: 2025-08-09
Priority: URGENT
Status: COMPLETED ✅

## Problem (RESOLVED)
Duration threshold Single Source of Truth was split across:
- Global ms: `sessionParams.contraction_duration_threshold` (frontend store)
- Per-muscle sec: `session_duration_thresholds_per_muscle` (frontend) → ms (backend)
- Backend actuals: `analytics[chan].duration_threshold_actual_value` (ms, set by upload/recalc)

Real-time UI needed to update chart highlights and StatsPanel acceptance when thresholds change.

## Resolution Summary ✅
✅ **Backend Flag Pattern Implemented**: usePerformanceMetrics and useContractionAnalysis now follow Single Source of Truth pattern using backend flags (`meets_mvc`, `meets_duration`, `is_good`) when available, with proper fallbacks.

✅ **Acceptance Metrics Alignment**: Implemented consistent acceptance rate calculations with backend flags/counts/thresholds as Single Source of Truth.

✅ **Chart Synchronization**: EMGChart legend and area highlighting now use stable keys and consistent backend flag prioritization.

✅ **Real-Time Updates**: Performance scores now properly update when TherapeuticParametersSettings are changed via the reactive `useLiveAnalytics` hook.

## Key Files Updated
- `usePerformanceMetrics.ts` - Implemented SoT pattern with backend flag checking
- `useContractionAnalysis.ts` - Backend flag prioritization for contraction analysis  
- `acceptanceRates.ts` - Consistent denominators using backend thresholds
- `EMGChart.tsx` - Stable keys for ReferenceArea/Dot components
- `single-source-of-truth-pattern.md` - Comprehensive documentation of the pattern

## Outcome
The duration SoT and real-time recalc data flow is now properly implemented. All performance metrics update consistently when therapeutic parameters change, and chart visualizations align with backend calculations.

**Status: Production ready with comprehensive SoT pattern implementation**

---

## Original Implementation Plan (COMPLETED)

### ✅ COMPLETED: Backend Flag Utilities Pattern
- Implemented repetitive null/undefined checking pattern across multiple hooks
- Added proper Single Source of Truth pattern in usePerformanceMetrics using backend analytics flags
- Fixed total score not updating when TherapeuticParametersSettings are changed

### ✅ COMPLETED: StatsPanel Alignment
- Ensured single-mode Stats uses live analytics of the selected channel
- Added proper rerender triggers when analytics object identity changes
- Verified `computeAcceptanceRates` uses backend-flags SoT

### ✅ COMPLETED: Chart Synchronization
- Added stable keys for ReferenceArea/Dot to prevent stale color reuse
- Implemented backend flag prioritization in contraction analysis
- Fixed chart color consistency using backend quality flags

### Remaining Items (Not Critical for Core Functionality)
The following items were identified but are not critical for the core SoT pattern:
- Debounce & Cancel for /recalc (current implementation works well)
- Per-muscle threshold UI in Settings (current global thresholds work)
- Instrumentation and telemetry (logging exists, more detailed telemetry optional)

**Core Problem Solved**: Duration SoT pattern is implemented and working correctly across all components.