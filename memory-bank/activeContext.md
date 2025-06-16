# Active Context

## Current Implementation Status

### Core Features
✅ Implemented:
- C3D file upload and processing (Backend)
- EMG data extraction and intelligent analysis (Backend)
- Complete analytics suite (RMS, MAV, MPF, MDF, FI_nsm5) (Backend)
- **Robust Frontend Component Architecture**:
    - Replaced `lucide-react` with `@radix-ui/react-icons` to resolve dependency conflicts.
    - Repaired `GameSessionTabs` component after a series of cascading type errors.
    - Implemented a full suite of `shadcn/ui` components, with a clear CLI-based workflow for adding more.
- **Advanced Plotting Features**:
    - Added an "easy switch" to toggle plots between "Raw" and "Activated" signal data.
    - The `useChannelManagement` hook now dynamically manages channel selection based on the plot mode.
- **Enhanced UI/UX**:
    - Default view after upload is now the "Signal Plots" tab.
    - The uploaded filename is now displayed.
    - The "Overview" tab has been renamed to "Game Stats" and reordered.
    - The `StatsPanel` has been refined to only show clinically relevant metrics, removing "Min/Max Value" to avoid confusion with "Min/Max Amplitude".
    - Corrected scientific notation formatting for very small numbers.
- **Performance Overhaul**:
    - Implemented robust backend caching for the `/upload` endpoint, using a hash of file content and processing parameters.
    - Pre-serialized all raw and activated EMG data to a separate JSON file during initial processing, making the `/raw-data` endpoint near-instantaneous.
    - Wrapped blocking backend operations in `run_in_threadpool` to prevent event loop blocking.
    - Implemented a simple in-memory cache on the frontend to avoid redundant data fetching for plots.

🚧 In Progress:
- End-to-end testing of the full analysis and visualization pipeline, especially the new caching layers.

### Recent Changes
*   **Performance & Caching**: The application has undergone a significant performance refactor.
    *   **Backend Caching**: The `/upload` endpoint now uses a `sha256` hash of the file content and all processing parameters as a cache key. On a cache hit, the previously generated result is returned immediately. On a miss, the result is generated and then a marker file containing the path to the result is stored in `data/cache`.
    *   **Data Pre-Serialization**: On a cache miss, the `/upload` endpoint now saves not only the main analysis JSON but also a `_raw_emg.json` file containing all extracted signal data (raw, activated, time axis, etc.).
    *   **Optimized Raw Data Endpoint**: The `/raw-data/{result_id}/{channel}` endpoint has been completely rewritten to read from the pre-serialized `_raw_emg.json` file, eliminating the need to re-open and re-process the original C3D file. This makes fetching data for plots significantly faster.
    *   **Asynchronous Operations**: CPU-bound and I/O-bound operations in the backend (file processing, plotting) are now wrapped in `FastAPI.concurrency.run_in_threadpool` to keep the API responsive.
    *   **Frontend Caching**: The `useEmgDataFetching` hook now uses a simple in-memory `Map` to cache downsampled plot data, preventing repeat API calls when switching between recently viewed channels.
*   **Updated Data Models**: The backend and frontend data models (`EMGRawData`, `ChannelAnalyticsData`) have been updated to include `activated_data` and `contractions` fields to support the new data flow.
*   **Optimized `start_dev.sh`**: The development startup script now performs a conditional `npm install` based on whether `node_modules` exists or if `package.json`/`package-lock.json` have been updated, speeding up the development server launch. A `--clean` flag was also added to force a fresh install.

## Active Development Focus

### Priority Areas
1.  **Stability and Testing**:
    *   Thoroughly test the new caching mechanisms on both the frontend and backend to ensure correctness and handle edge cases (e.g., stale cache markers).
    *   Validate the end-to-end data flow now that the performance optimizations are in place.
2.  **Code Cleanup**:
    *   Review the changes in `api.py` for clarity and maintainability.
3.  **Documentation**:
    *   Ensure all memory bank files are up-to-date with the new architecture.

## Current Decisions and Discoveries

### Architecture
- **Caching is King**: The performance issues have been addressed with a multi-layered caching strategy (backend request hashing, data pre-serialization, frontend in-memory cache). This is the new standard for the application.
- **Process Once, Read Many**: The new backend pattern is to perform all heavy processing a single time during the initial `/upload` call and save all necessary artifacts (results, raw data). Subsequent requests should be lightweight read operations against these artifacts.
- **Robust Cache Key**: The backend cache key is a hash of file content AND processing parameters. This is the most reliable way to ensure cache correctness. Filename-based caching is not robust enough.

### Troubleshooting
- **File System as Database**: The application is now using the file system more like a database, with a cache directory and separate files for different data types (results, raw EMG). This is a fast and simple approach but requires careful management of paths and potential stale files.

## Next Steps

### Immediate Tasks
1.  Perform a full user-flow test: upload a file, verify cache hit on re-upload, switch between plot modes, and review all analytics tabs to confirm stability and speed.
2.  Test the `--clean` flag and the conditional install logic in `start_dev.sh`.
3.  Update the rest of the memory bank to reflect the new architecture.

### Future Considerations
1.  A more robust cache-clearing mechanism or TTL (Time To Live) policy.
2.  Database integration remains a valid future step for more complex querying and data management.
3.  CI/CD pipeline for automated testing and deployment.

## Current Focus
- Optimize backend performance with caching and async operations.
- Resolve Python import errors with standardized import strategy.

## Recent Changes
- Updated `start_dev.sh` for improved dependency handling and server startup. 