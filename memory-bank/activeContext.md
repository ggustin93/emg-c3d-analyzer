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
    - **Enhanced UI Components**:
        - Created a centralized color system in `colorMappings.ts` for consistent styling across the application.
        - Implemented a reusable `ViewSelector` component for switching between single and comparison views.
        - Fixed tooltip rendering issues by properly structuring `TooltipProvider` components.
        - Improved muscle naming with structured dropdowns in `SettingsPanel`.
- **Advanced Plotting Features**:
    - Added an "easy switch" to toggle plots between "Raw" and "Activated" signal data.
    - The `useChannelManagement` hook now dynamically manages channel selection based on the plot mode.
    - **Implemented zoom/pan functionality for EMG charts** using Recharts Brush component for better data exploration.
    - **Enhanced EMGChart component** to support both single and comparison views with consistent colors.
    - **Improved MVC threshold visualization** with channel-specific colors for better visual correlation.
- **Enhanced UI/UX**:
    - Default view after upload is now the "Signal Plots" tab.
    - The uploaded filename is now displayed.
    - The "Overview" tab has been renamed to "Game Stats" and reordered.
    - The `StatsPanel` has been refined to only show clinically relevant metrics, removing "Min/Max Value" to avoid confusion with "Min/Max Amplitude".
    - Corrected scientific notation formatting for very small numbers.
    - **Improved muscle selection** with a more intuitive interface that respects the view mode.
    - **Refined Comparison View**: Fixed loading issues, added tooltips, and removed unnecessary UI wrappers for a cleaner and more stable comparison table.
- **Performance Overhaul**:
    - Implemented robust backend caching for the `/upload` endpoint, using a hash of file content and processing parameters.
    - Pre-serialized all raw and activated EMG data to a separate JSON file during initial processing, making the `/raw-data` endpoint near-instantaneous.
    - Wrapped blocking backend operations in `run_in_threadpool` to prevent event loop blocking.
    - Implemented a simple in-memory cache on the frontend to avoid redundant data fetching for plots.
- **Frontend Logic Refactoring & Optimization**:
    - **Optimized `EMGChart`**: Added a loading state with a spinner and memoized expensive calculations using `useMemo` and `useCallback` to prevent unnecessary re-renders.
    - **Encapsulated Performance Logic**: Created a new `usePerformanceMetrics` hook to centralize all complex score calculations, removing them from the rendering components.
    - **Simplified `PerformanceCard`**: Refactored the component to be a clean, simple consumer of the `usePerformanceMetrics` hook, focusing solely on presentation.
- **Game-Specific Analysis Features**:
    - **Implemented muscle-specific MVC values** to account for anatomical differences between muscles.
    - **Always use per-muscle MVC thresholds** for more accurate clinical assessment.
    - Added visual MVC threshold lines on EMG charts with matching channel colors for clear reference.
    - Flagging of "good" contractions based on muscle-specific MVC thresholds for performance tracking.
    - Created SessionConfigPanel component focused on per-muscle configuration.

🚧 In Progress:
- End-to-end testing of the full analysis and visualization pipeline, especially the new caching layers.

### Recent Changes
*   **Frontend Refactoring**:
    *   **Optimized `EMGChart`**: To improve user experience during data loads, an `isLoading` prop was added to display a spinner. To enhance performance, `useMemo` and `useCallback` were implemented to prevent costly re-renders and calculations.
    *   **Centralized Performance Metrics**: Created a new `usePerformanceMetrics` hook to encapsulate all business logic related to calculating performance scores (overall, muscle-specific, symmetry, etc.). This makes the logic reusable, testable, and separate from the UI.
    *   **Simplified UI Components**: Refactored the `PerformanceCard` component to be a "dumb" presentational component that gets all its data directly from the new `usePerformanceMetrics` hook.
*   **Per-Muscle MVC Implementation**:
    *   **Removed Global MVC Option**: Modified the system to always use muscle-specific MVC values for more accurate clinical assessment.
    *   **Enhanced UI**: Updated the SessionConfigPanel to focus solely on per-muscle configuration.
    *   **Improved Visualization**: Updated EMGChart to use matching colors for each channel's data line and MVC threshold line.
    *   **Backend Updates**: Modified processor.py to initialize per-muscle MVC values if they don't exist.
*   **Comparison View Overhaul**:
    *   **Fixed Infinite Loading**: Refactored `useEffect` hooks in `game-session-tabs.tsx` to correctly pre-load all channel data, eliminating an infinite loading loop in comparison mode.
    *   **Stabilized Data Handling**: Improved data merging logic in `StatsPanel.tsx` to correctly handle analytics data for both single and comparison views.
    *   **UI Cleanup**: Removed redundant wrapper `div`s from the comparison view for a cleaner layout and added tooltips for consistency with the single-channel view.
*   **UI Improvements**:
    *   **Centralized Color System**: Created a shared color mapping system in `colorMappings.ts` to ensure consistent styling across all components.
    *   **View Mode Selector**: Implemented a reusable `ViewSelector` component for switching between single and comparison views.
    *   **Enhanced Muscle Selection**: Updated `MuscleSelector` to work with the view mode system and use consistent colors.
    *   **Fixed Tooltip Issues**: Resolved runtime errors by properly structuring `TooltipProvider` components to avoid nesting.
    *   **Improved Muscle Naming**: Enhanced `SettingsPanel` with structured dropdowns for muscle groups and sides.
*   **Game Session Analysis Enhancement**:
    *   **MVC Threshold Analysis**: Added ability to set MVC value and threshold percentage for evaluating contraction quality.
    *   **Performance Tracking**: Implemented expected contractions count and good contractions tracking.
    *   **Visual Reference**: Added MVC threshold line on EMG charts for clear visual feedback.
    *   **Configuration UI**: Created SessionConfigPanel for easy parameter input.
*   **Interactive Chart Improvements**:
    *   **Zoom/Pan Functionality**: Added Brush component to EMG charts for better data exploration.
    *   **Visual Threshold Line**: Added ReferenceLine for MVC threshold visualization.
    *   **Enhanced EMGChart**: Updated to support both single and comparison views with consistent colors.
*   **Performance & Caching**: The application has undergone a significant performance refactor.
    *   **Backend Caching**: The `/upload` endpoint now uses a `sha256` hash of the file content and all processing parameters as a cache key. On a cache hit, the previously generated result is returned immediately. On a miss, the result is generated and then a marker file containing the path to the result is stored in `data/cache`.
    *   **Data Pre-Serialization**: On a cache miss, the `/upload` endpoint now saves not only the main analysis JSON but also a `_raw_emg.json` file containing all extracted signal data (raw, activated, time axis, etc.).
    *   **Optimized Raw Data Endpoint**: The `/raw-data/{result_id}/{channel}` endpoint has been completely rewritten to read from the pre-serialized `_raw_emg.json` file, eliminating the need to re-open and re-process the original C3D file. This makes fetching data for plots significantly faster.
    *   **Asynchronous Operations**: CPU-bound and I/O-bound operations in the backend (file processing, plotting) are now wrapped in `FastAPI.concurrency.run_in_threadpool` to keep the API responsive.
    *   **Frontend Caching**: The `useEmgDataFetching` hook now uses a simple in-memory `Map` to cache downsampled plot data, preventing repeat API calls when switching between recently viewed channels.
*   **Updated Data Models**: The backend and frontend data models (`EMGRawData`, `ChannelAnalyticsData`, `SessionConfig`) have been updated to include `activated_data`, `contractions`, and game session parameters to support the new data flow.
*   **Bug Fixes**: 
    *   Fixed TypeScript error in `useGameSessionData.ts` where `metadata.duration` could be null but was expected to be a number.
    *   Fixed runtime errors related to tooltip rendering by properly structuring `TooltipProvider` components.

## Active Development Focus

### Priority Areas
1.  **Stability and Testing**:
    *   Thoroughly test the new caching mechanisms on both the frontend and backend to ensure correctness and handle edge cases (e.g., stale cache markers).
    *   Validate the end-to-end data flow now that the performance optimizations are in place.
    *   Test the new game-specific features with real-world usage scenarios.
    *   Test the UI improvements with different datasets and view modes.
2.  **Code Cleanup**:
    *   Review the changes in `api.py` for clarity and maintainability.
3.  **Documentation**:
    *   Ensure all memory bank files are up-to-date with the new architecture and features.

## Current Decisions and Discoveries

### Architecture
- **Caching is King**: The performance issues have been addressed with a multi-layered caching strategy (backend request hashing, data pre-serialization, frontend in-memory cache). This is the new standard for the application.
- **Process Once, Read Many**: The new backend pattern is to perform all heavy processing a single time during the initial `/upload` call and save all necessary artifacts (results, raw data). Subsequent requests should be lightweight read operations against these artifacts.
- **Robust Cache Key**: The backend cache key is a hash of file content AND processing parameters. This is the most reliable way to ensure cache correctness. Filename-based caching is not robust enough.
- **Per-Muscle MVC Values**: From a clinical perspective, each muscle should have its own MVC value due to anatomical differences in size, fiber composition, and electrode placement. This provides more accurate assessment for rehabilitation purposes.
- **Game-Specific Analysis**: The application now supports game-specific analysis parameters, allowing for more targeted evaluation of EMG data in the context of rehabilitation games.
- **Consistent UI Components**: The application now uses a centralized color system and reusable components for a more consistent and intuitive user experience.

### Troubleshooting
- **File System as Database**: The application is now using the file system more like a database, with a cache directory and separate files for different data types (results, raw EMG). This is a fast and simple approach but requires careful management of paths and potential stale files.
- **TypeScript Null Safety**: Careful attention to nullable types is required, especially when dealing with optional parameters like `metadata.duration`.
- **Tooltip Component Structure**: Radix UI tooltips require careful structuring to avoid runtime errors. The `TooltipProvider` should be used at the root level to avoid nesting issues.

## Next Steps

### Immediate Tasks
1.  Perform a full user-flow test: upload a file, verify cache hit on re-upload, switch between plot modes, and review all analytics tabs to confirm stability and speed.
2.  Test the new game session parameters and MVC threshold analysis with real rehabilitation scenarios.
3.  Test the zoom/pan functionality with different datasets to ensure it works well with varying data densities.
4.  Test the new UI components with different view modes and muscle selections.
5.  Update the rest of the memory bank to reflect the new architecture and features.

### Future Considerations
1.  A more robust cache-clearing mechanism or TTL (Time To Live) policy.
2.  Database integration remains a valid future step for more complex querying and data management.
3.  CI/CD pipeline for automated testing and deployment.
4.  Additional game-specific analysis features based on user feedback.

## Current Focus
- Optimize backend performance with caching and async operations.
- Enhance user experience with interactive charts and game-specific analysis tools.
- Improve UI consistency and intuitiveness with reusable components and a centralized color system.

## Recent Changes
- Updated `start_dev.sh` for improved dependency handling and server startup.
- Implemented UI improvements for better consistency and user experience.
- Fixed tooltip rendering issues to resolve runtime errors. 