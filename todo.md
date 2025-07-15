**Your Mission:** Refactor the GHOSTLY+ EMG Analyzer for clarity, performance, and clinical relevance, preparing it for a stellar portfolio presentation!

**Guiding Principles:**

*   **No Breaking UI Changes (for now):** Users should still see the app work as it does, but internals will be better.
*   **Focus on "Stateless" Backend:** Assume the backend processes data on-demand and doesn't rely on saving many files between requests (ideal for Render free tier).
*   **Clarity is King:** Make the code easy to understand.

---

## **Phase 1: Backend Streamlining & Core Data Flow** ✅ **COMPLETED**

**Goal:** Make the backend simpler, faster for active use, and ensure it sends all necessary data to the frontend in one go.

*   [x] **Task 1.1: Slim Down Backend - Remove Server-Side Plotting Relics**
    *   **File:** `backend/api.py`
        *   **Action:** Delete the entire function definitions for `generate_plot(...)` and `generate_report(...)`. These are the endpoints that started with `@app.get("/plot/{result_id}/{channel}")` and `@app.get("/report/{result_id}")`.
        *   **Why:** We're doing all charting on the frontend. These server-side image generation endpoints are no longer needed.
    *   **File:** `backend/processor.py`
        *   **Action:** Delete the method definitions for `plot_ghostly_report(self, ...)` and `plot_emg_with_contractions(self, ...)`.
        *   **Why:** These methods were likely calling the (now missing) `plotting.py` to create images on the server.
    *   **File:** `backend/models.py`
        *   **Action:** In the `EMGAnalysisResult` Pydantic model, remove the line `plots: Dict[str, str] = {}`.
        *   **Why:** Since we're not generating plots on the server, this field is unused.
    *   **File (if it exists):** `backend/plotting.py`
        *   **Action:** If you find this file, and it contains Matplotlib/Seaborn code to create PNGs, you can delete the file entirely.
        *   **Why:** All plotting will be client-side with Recharts.
    *   **File:** `backend/config.py` (or `backend/api.py` if config not yet centralized)
        *   **Action:** Remove any definition or usage of `PLOTS_DIR`.
        *   **Why:** No server-side plots means no directory needed to store them.
    *   **Test:** `backend/tests/test_api.py`
        *   **Action:** Remove any test steps that were calling the `/plot` or `/report` endpoints (likely steps 6 and 7 in your existing test).
        *   **Why:** Keep tests relevant to existing functionality.

*   [x] **Task 1.2: Modify `/upload` to Return All EMG Signal Data (Backend)**
    *   **File:** `backend/models.py`
        *   **Action 1:** Create a new Pydantic model called `EMGChannelSignalData`:
            ```python
            from pydantic import BaseModel
            from typing import List, Optional

            class EMGChannelSignalData(BaseModel):
                sampling_rate: float
                time_axis: List[float]
                data: List[float] # This will hold the primary C3D signal (e.g., "CH1 Raw")
                rms_envelope: Optional[List[float]] = None # For the calculated RMS envelope
                activated_data: Optional[List[float]] = None # If you have a separate "activated" signal processing step
            ```
        *   **Action 2:** Modify the `EMGAnalysisResult` model:
            *   Add a new field: `emg_signals: Dict[str, EMGChannelSignalData]`
            *   The keys of this dictionary will be the actual channel names from the C3D file (e.g., "CH1 Raw", "EMG_Left_Quad").
            *   **Why:** This makes the `/upload` response self-contained with all data the frontend needs for plotting.
    *   **File:** `backend/processor.py`
        *   **Action 1 (Inside `_calculate_all_channel_analytics` or where `self.emg_data` is finalized):**
            *   For each channel processed from the C3D file (e.g., "CH1 Raw", "EMG_Left_Quad"):
                *   Calculate its RMS envelope using `emg_analysis.moving_rms()`.
                    *   Get the `signal_array` and `sampling_rate` from `self.emg_data[channel_name]`.
                    *   Choose a window for the RMS envelope (e.g., 100ms). Convert this to samples: `rms_env_window_samples = int((100 / 1000) * sampling_rate)`.
                    *   `calculated_rms_envelope = moving_rms(signal_array, rms_env_window_samples).tolist()`.
                *   The `self.emg_data` dictionary (which holds the signals read from C3D) should now store not just the raw `data` and `time_axis`, but also this `calculated_rms_envelope`.
                    *   Modify the structure of `self.emg_data[channel_name]` to match `EMGChannelSignalData`:
                        ```python
                        # Example: when populating self.emg_data
                        self.emg_data[c3d_channel_name] = {
                            "sampling_rate": sampling_rate_from_c3d,
                            "time_axis": time_axis_from_c3d.tolist(),
                            "data": raw_signal_from_c3d.tolist(),
                            "rms_envelope": calculated_rms_envelope, # Newly added
                            "activated_data": (processed_activated_signal.tolist()
                                              if processed_activated_signal is not None else None) # If you generate this
                        }
                        ```
        *   **Why:** The processor is responsible for preparing all signal variations.
    *   **File:** `backend/api.py`
        *   **Action 1 (Inside `/upload` endpoint):**
            *   After `result_data_dict = await run_in_threadpool(processor.process_file, ...)`:
            *   The `processor.emg_data` attribute will now contain the raw signals and their RMS envelopes (and potentially "activated_data").
            *   When constructing the `EMGAnalysisResult` Pydantic model to return, populate its new `emg_signals` field with `processor.emg_data`.
                ```python
                # Conceptual:
                response_model = EMGAnalysisResult(
                    file_id=str(uuid.uuid4()), # Generate a new UUID for this stateless request
                    # ... other fields from result_data_dict['metadata'], result_data_dict['analytics'] ...
                    available_channels=result_data_dict['available_channels'], # Should be keys of processor.emg_data
                    emg_signals=processor.emg_data # Directly assign if structure matches EMGChannelSignalData
                )
                return response_model
                ```
            *   Remove any code that saves `_result.json` or `_raw_emg.json` to disk.
            *   Remove any code related to `CACHE_DIR` or cache marker files. The endpoint is now stateless regarding file storage.
        *   **Action 2:** Delete the entire `/raw-data/{result_id}/{channel}` endpoint function.
        *   **Why:** This is the core of the "stateless" approach. The frontend gets everything in one shot.

*   [x] **Task 1.3: Adapt Frontend to Use Bundled Signal Data**
    *   **File:** `frontend/src/types/emg.ts`
        *   **Action:** Add the `EMGChannelSignalData` interface and update `EMGAnalysisResult` to include `emg_signals: { [channelName: string]: EMGChannelSignalData };` (matching the backend).
    *   **File:** `frontend/src/App.tsx` (or relevant hooks like `useEmgDataFetching.ts` if you adapt it)
        *   **Action 1 (In `handleSuccess` for file upload):** The `data: EMGAnalysisResult` parameter will now contain `data.emg_signals`.
        *   **Action 2 (Data for Plotting):**
            *   When `plotChannel1Name` (or `plotChannel2Name`) is selected, the data for the chart (raw signal, RMS envelope) will come from `analysisResult.emg_signals[plotChannel1Name].data` and `analysisResult.emg_signals[plotChannel1Name].rms_envelope` respectively.
            *   The `useEmgDataFetching.ts` hook is no longer needed to *fetch* data via `/raw-data`. Its responsibilities for *downsampling* are still valid. You might:
                *   Rename/refactor `useEmgDataFetching` to something like `usePlotDataProcessor` which takes the full `analysisResult.emg_signals` and selected channel names, and returns downsampled data for the chart.
                *   Or, move the downsampling logic directly into `App.tsx` or `GameSessionTabs.tsx` where `mainCombinedChartData` is prepared.
        *   **Action 3 (Data for Stats):** When `selectedChannelForStats` changes, the `currentStats` (min, max, avg) will be calculated from `analysisResult.emg_signals[selectedChannelForStats].data` (or its "Raw" equivalent if you maintain that distinction).
    *   **File:** `frontend/src/hooks/useEmgDataFetching.ts`
        *   **Action:** Since `/raw-data` is gone, remove the `axios.get` call.
        *   This hook might now become a utility that primarily takes the full `emg_signals` object and selected channel names, and returns the processed (e.g., downsampled) data for plotting. Or its downsampling logic could be moved.
        *   If it's greatly simplified, consider merging its logic into `App.tsx` or another hook.
    *   **Why:** The frontend now works with the data it receives immediately, improving perceived performance.

---

## **Phase 2: Backend Logic & Resilient Channel Handling** ✅ **COMPLETED**

**Goal:** Make the core EMG processing in `processor.py` robust to different C3D channel names and integrate the new clinically relevant `emg_analysis.py`.

*   [x] **Task 2.1: Integrate New `emg_analysis.py` and Update Backend Models**
    *   **File:** `backend/emg_analysis.py`
        *   **Action:** Replace the entire content of your old `backend/emg_analysis.py` with the new "Advanced EMG Analysis Module" code you provided.
    *   **File:** `backend/models.py`
        *   **Action 1:** Create a new Pydantic model `TemporalAnalysisStats`:
            ```python
            class TemporalAnalysisStats(BaseModel):
                mean_value: Optional[float] = None
                std_value: Optional[float] = None
                min_value: Optional[float] = None
                max_value: Optional[float] = None
                valid_windows: Optional[int] = None
                coefficient_of_variation: Optional[float] = None
                # Optional: percent_change_within_session: Optional[float] = None (if from fatigue)
            ```
        *   **Action 2:** Modify the `ChannelAnalytics` model:
            *   Keep existing `rms: Optional[float]`, `mav: Optional[float]`, `fatigue_index_fi_nsm5: Optional[float]`. These will store the primary single/mean value for UI backward compatibility.
            *   Add new fields:
                *   `rms_temporal_stats: Optional[TemporalAnalysisStats] = None`
                *   `mav_temporal_stats: Optional[TemporalAnalysisStats] = None`
                *   `fatigue_index_temporal_stats: Optional[TemporalAnalysisStats] = None`
            *   `mpf` and `mdf` remain `Optional[float]`.
    *   **Why:** Backend now uses the advanced analysis and can represent its richer output.

*   [x] **Task 2.2: Refactor `processor.py` to Use New Analysis and Handle Channels Flexibly**
    *   **File:** `backend/processor.py` (Mainly in `_calculate_all_channel_analytics`)
        *   **Action 1 (Iterate C3D Channels):**
            *   The main loop should iterate `for c3d_channel_name in self.emg_data.keys():`.
            *   `signal_array = np.array(self.emg_data[c3d_channel_name]['data'])`
            *   `sampling_rate = self.emg_data[c3d_channel_name]['sampling_rate']`
        *   **Action 2 (Call New Analysis Functions):**
            *   For each `c3d_channel_name`:
                *   Call `new_emg_analysis.calculate_rms(signal_array, sampling_rate)`. The result will be a dict like `{"rms": single_val, "temporal_analysis": {...}}`.
                *   Populate `channel_analytics_for_this_name["rms"]` with `result.get("rms")`.
                *   Populate `channel_analytics_for_this_name["rms_temporal_stats"]` by creating a `TemporalAnalysisStats` object from `result.get("temporal_analysis")` (map `mean_rms` to `mean_value`, etc.).
                *   Do similarly for `calculate_mav` and `calculate_fatigue_index_fi_nsm5`.
                *   `calculate_mpf` and `calculate_mdf` still return simple dicts; update `channel_analytics_for_this_name` directly.
        *   **Action 3 (Signal for Contraction Analysis):**
            *   Inside the loop for `c3d_channel_name`:
                *   `signal_for_contraction_analysis = signal_array` (default to the current C3D channel).
                *   `sr_for_contraction = sampling_rate`.
                *   **Attempt to find an "activated" version:** If `c3d_channel_name` doesn't already end with " activated":
                    *   Construct a `potential_activated_name` (e.g., if `c3d_channel_name` is "EMG L QUAD", look for "EMG L QUAD activated").
                    *   If `potential_activated_name` exists as a key in `self.emg_data`:
                        *   `signal_for_contraction_analysis = np.array(self.emg_data[potential_activated_name]['data'])`
                        *   `sr_for_contraction = self.emg_data[potential_activated_name]['sampling_rate']`
                        *   Log that the activated signal was used.
                *   Call `new_emg_analysis.analyze_contractions(signal_for_contraction_analysis, sr_for_contraction, ...)`
        *   **Action 4 (MVC Threshold Logic):**
            *   The `_determine_effective_mvc_threshold(self, logical_muscle_name: str, session_params: GameSessionParameters)` helper is still useful.
            *   When calling it for `analyze_contractions`, you need the `logical_muscle_name`. Get this by `logical_muscle_name = session_params.channel_muscle_mapping.get(c3d_channel_name, c3d_channel_name)`.
        *   **Action 5 (Analytics Dictionary Keys):** The main keys for `all_analytics` (and thus `EMGAnalysisResult.analytics`) must be the `c3d_channel_name`.
    *   **Why:** The backend now uses the superior analysis methods and handles various C3D channel names gracefully. It prepares data for the current UI and future UI enhancements.

*   [x] **Task 2.3: Frontend Type Updates for New Analytics**
    *   **File:** `frontend/src/types/emg.ts`
        *   **Action:** Add `TemporalAnalysisStats` interface and update `ChannelAnalyticsData` to include `rms_temporal_stats`, `mav_temporal_stats`, `fatigue_index_temporal_stats` (as done in backend models).
    *   **Why:** Frontend types match the new, richer data from the backend. Existing UI parts reading `rms`, `mav` will still work.

---

## **Phase 4: Final Clean-up & Documentation** ✅ **COMPLETED**

*   [x] **Task 4.1: Centralize Backend Configuration**
    *   **File:** `backend/config.py`
        *   **Action:** ✅ Configuration file already exists with comprehensive settings for EMG processing parameters, API configuration, CORS settings, and server configuration.
        *   All constants properly centralized and imported by other modules.
    *   **Why:** Good practice for organization.

*   [x] **Task 4.2: Review and Refine Frontend Channel Logic**
    *   **Files:** `frontend/src/hooks/useChannelManagement.ts`, `frontend/src/components/app/ChannelSelection.tsx`, `ChannelFilter.tsx`, `SettingsPanel.tsx` (Muscle Naming).
    *   **Action:** ✅ Verified that:
        *   The list of channels available for selection originates from raw C3D channel names (`Object.keys(analysisResult.analytics)`).
        *   The `sessionParams.channel_muscle_mapping` is used only for display purposes in `MuscleNameDisplay` component and dropdown labels.
        *   Internal state correctly stores/uses underlying raw C3D channel names for data access.
        *   The "Muscle Naming" tab in `SettingsPanel` lists raw C3D channel names and allows mapping to friendly muscle names.
    *   **Why:** Critical for the resilient channel naming strategy to work seamlessly.

*   [x] **Task 4.3: Code Comments and Documentation Updates**
    *   **Action:** ✅ Added comprehensive comments and updated documentation:
        *   **Backend Comments:** Added detailed comments in `processor.py` explaining resilient channel handling, signal selection strategy, and stateless architecture.
        *   **Frontend Comments:** Added comments in `App.tsx` explaining the bundled data pattern and client-side processing.
        *   **README Updates:** Updated main, backend, and frontend README files to reflect stateless architecture, advanced analysis capabilities, and resilient channel handling.
    *   **Why:** Makes the project understandable and showcases design decisions.

This list prioritizes backend stability and efficiency first (stateless, bundled response), then integrates the advanced analysis, makes channel handling robust, and finally enhances the frontend charts to display the new relevant data. This sequence should provide significant improvements with a clear progression. Good luck!

---

## **Future Enhancement: Clinically Sound EMG Statistical Analysis**

**🩺 Clinical Assessment**: Current values show potential issues requiring PhD-level biomedical validation:

### Current Value Analysis
- **RMS/MAV**: Extremely low (10^-5 mV) - likely needs amplitude scaling verification
- **Fatigue Index**: 6.66e-14 is clinically meaningless - calculation error probable
- **MPF/MDF**: Reasonable (96-112 Hz) but need population statistics

### Implementation Requirements

**Time Estimate**: 2-3 days for clinically sound implementation

**Core Components**:
1. **Statistical Windows** (6-8 hours)
   - 250ms sliding windows with 50% overlap
   - Per-channel and aggregate statistics
   - Temporal trend analysis

2. **Clinical Validation** (8-10 hours)
   - Amplitude scaling verification (µV vs mV)
   - Reference range comparison
   - Outlier detection and handling

3. **Advanced Statistics** (4-6 hours)
   - Population moments (mean, std, skew, kurtosis)
   - Confidence intervals
   - Statistical significance testing

### Biomedical Considerations

**Critical Issues**:
- **Amplitude Units**: Verify µV scaling (typical EMG: 50-2000 µV)
- **Fatigue Index**: Implement proper slope analysis (-0.1 to -0.5 Hz/s typical)
- **Clinical Ranges**: MPF 20-250 Hz, MDF 50-150 Hz for surface EMG

**Recommended Metrics**:
```
RMS: 50-500 µV (muscle-dependent)
MAV: 30-300 µV (typically 60-80% of RMS)
MPF: 80-150 Hz (healthy muscle)
MDF: 60-120 Hz (fatigue → decrease)
Fatigue Index: -0.1 to -0.5 Hz/s (spectral slope)
```

**Implementation Priority**: High - current values suggest measurement/calculation errors affecting clinical utility.