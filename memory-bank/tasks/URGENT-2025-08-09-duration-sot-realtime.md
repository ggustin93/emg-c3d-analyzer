# URGENT — Duration SoT & Real-Time Recalc Data Flow

Date: 2025-08-09
Priority: URGENT

## Problem
Duration threshold Single Source of Truth is split across:
- Global ms: `sessionParams.contraction_duration_threshold` (frontend store)
- Per-muscle sec: `session_duration_thresholds_per_muscle` (frontend) → ms (backend)
- Backend actuals: `analytics[chan].duration_threshold_actual_value` (ms, set by upload/recalc)

Real-time UI should update chart highlights and StatsPanel acceptance when thresholds change. Interactions (auto and manual recalc) sometimes feel laggy or inconsistent.

## Current State
Backend
- POST `/recalc` recomputes per-contraction `meets_mvc`, `meets_duration`, `is_good` and counts.
- Sets `duration_threshold_actual_value` per channel.

Frontend
- `useLiveAnalytics` triggers `/recalc` when `sessionParams` change and updates analytics.
- `useContractionAnalysis` prefers `duration_threshold_actual_value` → then per-muscle (s) → then global (ms); green only when both criteria defined and met.
- `acceptanceRates.ts` uses backend flags/counts; denominators require thresholds present.
- Settings has a “Recalculate Analytics” button.

## Gaps / Risks
- No debounce on `/recalc`: multiple rapid slider changes fire overlapping requests.
- No UI pending state for recalc; user cannot tell when highlights/rates will update.
- StatsPanel relies on `displayAllChannelsData` merge; ensure it always reflects `useLiveAnalytics` result (single + comparison).
- In single mode, acceptance calculation should derive from live analytics of the selected channel; verify re-render.
- Per-muscle thresholds UI (seconds) not exposed in Settings yet; can’t validate full priority chain.
- Tests missing for “change threshold → highlights and gauges update within X ms”.

## Plan
1) Debounce & Cancel
   - Add 250–400 ms debounce and AbortController cancelation in `useLiveAnalytics` before calling `/recalc`.
   - Show lightweight loading spinner near chart legend and StatsPanel while awaiting.

2) Single SoT Helper
   - Create `getEffectiveDurationThreshold(channel, sessionParams, channelAnalytics)` util; use in hook and Stats.

3) StatsPanel alignment
   - Ensure single-mode path uses the updated live analytics for the selected channel and rerenders gauges immediately after `/recalc`.
   - Add memo keys to force re-render on `duration_threshold_actual_value` change.

4) Settings UX
   - Add per-muscle duration threshold sliders (seconds) behind Debug toggle; persist to `session_duration_thresholds_per_muscle`.

5) Instrumentation
   - Log when `/recalc` returns and capture deltas of counts/flags per channel for debugging.

6) Tests
   - Unit: threshold change recalculates `expectedColor` and counts in `useContractionAnalysis`.
   - Integration: slider change → `/recalc` mocked → EMGChart ReferenceAreas recolor and StatsPanel donuts update.

## Acceptance Criteria
Changing global or per-muscle threshold updates:
- Chart areas/dots colors within 500 ms (after debounce), and
- StatsPanel Good/MVC/Duration gauges and subtexts.

`duration_threshold_actual_value` visible in tooltips matches applied logic.

## Follow-ups
- Persist per-muscle thresholds in export.
- Add telemetry for recalc latency.


