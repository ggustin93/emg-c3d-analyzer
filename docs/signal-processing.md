### Signal Processing (EMG) — Pipeline and Parameters

- Pipeline: High‑pass 20 Hz (order 4) → Full‑wave rectification → Low‑pass 10 Hz (order 4) → Moving average smoothing (50 ms)
- Defaults (ProcessingParameters):
  - rectification_enabled: true
  - highpass_cutoff_hz: 20.0
  - lowpass_cutoff_hz: 10.0
  - filter_order: 4
  - smoothing_window_ms: 50.0
  - min_signal_variation: 1e-10
  - min_samples_required: 1000

Contraction duration threshold default: 2000 ms, adjustable from frontend and echoed back as `metadata.session_parameters_used`.

Export JSON includes pipeline metadata when available, and per-channel parameters used for envelope processing.
# Signal Processing Pipeline (EMG)

Concise reference for how EMG signals are processed end-to-end.

## Pipeline
- High‑pass filter: 20 Hz, 4th order Butterworth (remove DC offset and baseline/motion artifacts)
- Full‑wave rectification
- Low‑pass filter (envelope): 10 Hz, 4th order Butterworth (smooth linear/RMS envelope)
- RMS/linear envelope smoothing: 50 ms window

Clinical sources commonly recommend band-limiting ~20–450 Hz and using ~50 ms envelopes for sEMG amplitude analysis. The above steps are implemented in code and documented in processing metadata.

## Parameters (current defaults)
- rectification_enabled: true
- highpass_cutoff_hz: 20.0 (order 4)
- lowpass_cutoff_hz (envelope): 10.0 (order 4)
- smoothing_window_ms (RMS window): 50.0

## Duration threshold
- Global default: 2000 ms (2.0 s)
- Frontend sends `contraction_duration_threshold` (ms) and optional per‑muscle overrides (seconds → converted to ms on backend)
- Backend echoes the exact parameters used under `metadata.session_parameters_used`

## Export JSON
- A top-level `signal_processing_pipeline` block is included (versioned) describing parameters and clinical justifications
- Per‑channel processed entries include `processing_metadata` where available


