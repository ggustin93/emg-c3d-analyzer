Proposed changes (no code yet; this is the plan to implement once approved)
1) Backend parameter consolidation and defaults
Make a single source of truth for RMS envelope parameters:
Use RMS envelope (true RMS) consistently for the envelope everywhere.
Replace moving-average smoothing in signal_processing.preprocess_emg_signal() with RMS using the same window as envelope.
Remove config.RMS_ENVELOPE_WINDOW_MS and compute window from signal_processing.ProcessingParameters.SMOOTHING_WINDOW_MS.
Set the canonical RMS window to 50 ms (clinical standard) consistently.
Duration threshold default to 2000 ms:
Change GameSessionParameters.contraction_duration_threshold default from 250 → 2000 ms.
Update api.py for both /upload and /export Form defaults to 2000.
Preserve per-muscle thresholds and conversions.
Keep contraction detection smoothing at 100 ms (research-optimized) distinct from RMS envelope window, but label it clearly as “detection smoothing” in UI.
Ensure processor.calculate_analytics stores:
channel_analytics.signal_processing.parameters_used reflecting RMS/rectification/filter parameters used.
duration_threshold_actual_value correctly set from session params (global or per-muscle) in ms.
Files to edit:
backend/signal_processing.py (switch to RMS envelope; keep rectification + low-pass optional; set window=50 ms)
backend/processor.py (stop using config.RMS_ENVELOPE_WINDOW_MS; use processing params from signal_processing; ensure consistency)
backend/config.py (remove RMS_ENVELOPE_WINDOW_MS)
backend/models.py (duration threshold default to 2000)
backend/api.py (/upload and /export Form defaults to 2000)
2) Backend export: include complete processing metadata
Add global signal processing metadata from get_processing_metadata() into the export payload.
Keep per-channel signal_processing.parameters_used as-is; ensure it flows to frontend.
Files to edit:
backend/export_utils.py:
Add a signal_processing_pipeline block (version, parameters, clinical justifications)
Add an “rms_envelope” section under “processing_parameters” which includes window_ms, rectification, lowpass_cutoff_hz, filter_order.
3) Frontend: ensure SettingsTab displays RMS envelope parameters and shows the exact duration threshold (2000 ms default)
Pass analysisResult down to ContractionDetectionSettings (add prop in SettingsTab/SettingsTab.tsx).
In ContractionDetectionSettings.tsx, add a “Signal Processing (RMS Envelope)” read-only section, pulling parameters from:
First available channel’s analytics[baseName].signal_processing.parameters_used (when available), else fallback to the canonical defaults (50 ms, rectification: true, lowpass 500 Hz, order 4).
Ensure “Duration” displayed uses sessionParams.contraction_duration_threshold (ms), defaulting to 2000 if unset.
Files to edit:
frontend/src/components/tabs/SettingsTab/SettingsTab.tsx (pass analysisResult)
frontend/src/components/tabs/SettingsTab/components/ContractionDetectionSettings.tsx (render RMS section + use actual session duration)
Optionally small copy changes to clarify “Detection smoothing (100 ms)” vs “RMS envelope window (50 ms)”.
4) Frontend: ensure exported JSON contains the RMS parameters
ExportTab already includes per-channel processing metadata when selecting processed RMS; with backend adding global processing metadata via export_utils, no further change is strictly required.
If needed, in useExportData.generateExportData add exportData.processing block referencing analysisResult.metadata?.session_parameters_used and top-level processing_parameters (if exposed) for clarity.
Files to edit (only if required after backend change):
frontend/src/components/tabs/ExportTab/hooks.tsx (attach backend-provided global processing metadata when present)
5) Frontend: bidirectional sync of Duration threshold with 2000 ms default
Update store default to 2000 ms:
frontend/src/store/sessionStore.ts: contraction_duration_threshold: 2000
Ensure this value is sent to backend for both upload paths:
App.tsx handleQuickSelect: already sends all sessionParams keys (good)
components/c3d/FileUpload.tsx: explicitly append contraction_duration_threshold (and JSON for per-muscle thresholds if present)
Ensure all components consistently use sessionParams.contraction_duration_threshold:
Replace any remaining ?? 250 / ?? 2000 fallbacks with a single consistent fallback to 2000 only in display (should not matter once store and backend default are 2000).
Files to edit:
frontend/src/store/sessionStore.ts (default to 2000)
frontend/src/components/c3d/FileUpload.tsx (append duration to FormData)
Sweep and align remaining fallbacks where found by grep (keep display fallback 2000 only where needed).
6) Backend housekeeping towards best practices (minimal movement, clear structure)
Clarify responsibilities:
signal_processing.py: low-level preprocessing (RMS envelope, rectification, low-pass), expose get_processing_metadata()
processor.py: orchestration, analytics, deriving per-channel analysis and plugging in preprocessing
config.py: remove duplicated RMS constant; keep only global, non-signal constants
export_utils.py: a single place to structure comprehensive export including global processing metadata
Add/confirm type hints, guard clauses, and consistent logging (no functional change beyond the above).
7) Verification
Local run: process sample C3D and confirm:
Frontend Settings shows RMS: 50 ms; Duration shows 2.0 s
Export JSON contains processing metadata (global + per-channel) including RMS envelope parameters
Contractions quality uses same duration threshold as shown in UI
Adjust tests if present and run lint.
Risks and considerations
Changing defaults (250 → 2000 ms) will alter results/flags; this is requested and clinically sound per your note.
We’ll label detection smoothing vs RMS window clearly to avoid confusion.
We’ll avoid heavy file reorganization to keep the diff focused and safe.
Files to be edited
Backend: backend/signal_processing.py, backend/processor.py, backend/config.py, backend/models.py, backend/api.py, backend/export_utils.py
Frontend: frontend/src/store/sessionStore.ts, frontend/src/components/c3d/FileUpload.tsx, frontend/src/components/tabs/SettingsTab/SettingsTab.tsx, frontend/src/components/tabs/SettingsTab/components/ContractionDetectionSettings.tsx, (possibly) frontend/src/components/tabs/ExportTab/hooks.tsx
Acceptance criteria
RMS envelope parameters are consistent and visible:
Single canonical RMS window (50 ms), rectification on, low-pass 500 Hz, order 4
Displayed read-only in SettingsTab
Present in exported JSON (global + per-channel)
Duration threshold is 2000 ms by default:
Used in backend analytics (and included in analytics’ duration_threshold_actual_value)
Displayed consistently in frontend UI
Passed in requests and persisted via round-trip
No remaining 250 ms fallbacks for duration except as a defensive display fallback.
Backend structure cleaned (no duplicate RMS constants); types/logging sane.
If you approve, type ACT and I’ll implement these edits, run the app, and verify end-to-end.
I’ve read the memory bank and CLAUDE.md for this repo and aligned the plan with the project’s patterns.
I will update memory-bank notes about the duration default change to 2000 ms after implementation.