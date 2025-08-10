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
1) Debounce & Cancel (Frontend)
   - Implement 300 ms debounce and proper AbortController cancellation in `frontend/src/hooks/useLiveAnalytics.ts` before calling `/recalc`.
   - Update `frontend/src/services/mvcService.ts` to accept and pass `AbortSignal` to `fetch`.
   - Add a lightweight recalc pending indicator: expose `useRecalcPending()` via a tiny Zustand slice or return tuple `[liveAnalytics, isRecalcPending]`. Prefer non-breaking: create `frontend/src/hooks/useRecalcStatus.ts` that reads a global `recalcPending` from a small store `recalcStore`.
   - Surface pending state in `GameSessionTabs` and forward to legend/stats as needed.

2) Single SoT Helper (Shared util)
   - Create `frontend/src/lib/durationThreshold.ts` with `getEffectiveDurationThreshold(channelName, sessionParams, channelAnalytics)` returning ms.
     Priority: `channelAnalytics.duration_threshold_actual_value` (backend) → per-muscle seconds `sessionParams.session_duration_thresholds_per_muscle[channel] * 1000` → global `sessionParams.contraction_duration_threshold` → default from `EMG_CHART_CONFIG.DEFAULT_DURATION_THRESHOLD_MS`.
   - Refactor `frontend/src/hooks/useContractionAnalysis.ts` to use this helper for both legend summary and area coloring logic.

3) StatsPanel alignment (Rerender correctness)
   - Ensure single-mode Stats uses live analytics of the selected channel: already wired via `channelAnalytics` in `GameSessionTabs`.
   - Add rerender keys where memoization may hide updates: pass a `versionKey` derived from `duration_threshold_actual_value` hash to `EMGChartLegend` and Stats donuts.
   - Verify `computeAcceptanceRates` remains backend-flags SoT and re-computes when analytics object identity changes.

4) Settings UX (Per-muscle thresholds, seconds)
   - Add `frontend/src/components/tabs/SettingsTab/components/PerMuscleDurationThresholds.tsx` with sliders in seconds (0–10s, step 0.5s) behind Debug toggle.
   - Persist values into `session_duration_thresholds_per_muscle` in `useSessionStore`. Ensure null clears override and returns to backend/global.
   - Show current effective threshold per muscle (ms) using the helper.

5) Pending UI placements
   - Legend: add subtle spinner/text "Recalculating…" via `EMGChartLegend` props.
   - StatsPanel: show a small inline spinner in the header area while recalc pending.

6) Instrumentation
   - On `/recalc` completion in `useLiveAnalytics`, compute and log deltas per channel for: `good_contraction_count`, `mvc_contraction_count`, `duration_contraction_count`, and `duration_threshold_actual_value`.
   - Add timing logs: start when debounce scheduled, end after response applied.

7) Tests
   - Unit (hooks):
     - `useContractionAnalysis` uses `getEffectiveDurationThreshold` and updates `visualIsGood` categories when thresholds change.
     - `getEffectiveDurationThreshold` priority order correctness.
   - Integration (SignalPlotsTab):
     - Mock `/recalc` and verify debounce (rapid param changes → single network call) and cancelation (older aborted).
     - Verify ReferenceArea colors and StatsPanel gauges update within 500 ms after debounce window.

8) Types & Store
   - Extend `GameSessionParameters` if needed to ensure `session_duration_thresholds_per_muscle?: Record<string, number | null>` is present (already exists).
   - Add `frontend/src/store/recalcStore.ts` for `recalcPending` boolean and optional `lastRecalcTs`.

## Acceptance Criteria
Changing global or per-muscle threshold updates:
- Chart areas/dots colors within 500 ms (after debounce), and
- StatsPanel Good/MVC/Duration gauges and subtexts.

`duration_threshold_actual_value` visible in tooltips matches applied logic.

Additional AC for this plan iteration:
- Debounce verified: 3 rapid changes fire 1 network call; earlier requests aborted (no state applied from aborted).
- Pending UI visible during in-flight `/recalc` and hidden immediately on completion or abort.
- Per-muscle sliders in Settings update `session_duration_thresholds_per_muscle` and trigger real-time recolor and gauge updates.

## File Change List
- frontend/src/hooks/useLiveAnalytics.ts
- frontend/src/services/mvcService.ts
- frontend/src/hooks/useContractionAnalysis.ts
- frontend/src/lib/durationThreshold.ts (new)
- frontend/src/components/tabs/SignalPlotsTab/EMGChartLegend.tsx (pending UI prop consumption)
- frontend/src/components/tabs/shared/GameSessionTabs.tsx (wire pending UI)
- frontend/src/components/tabs/GameStatsTab/StatsPanel.tsx (rerender key + pending UI)
- frontend/src/components/tabs/SettingsTab/components/PerMuscleDurationThresholds.tsx (new)
- frontend/src/components/tabs/SettingsTab/SettingsTab.tsx (include component behind Debug toggle)
- frontend/src/store/recalcStore.ts (new)
- frontend/src/components/tabs/SignalPlotsTab/__tests__/ (new tests for debounce/coloring)

## Follow-ups
- Persist per-muscle thresholds in export.
- Add telemetry for recalc latency.


