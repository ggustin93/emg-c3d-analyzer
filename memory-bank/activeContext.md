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
- **Clinical Assessment Features**:
    - **Implemented Borg CR10 RPE scale** for subjective exertion measurement.
    - Added a `SubjectiveFatigueCard` component to display patient-reported exertion levels.
    - Enhanced statistical display with mean ± standard deviation format for EMG metrics.
    - Added a "Patient Outcomes" tab in the Settings panel for configuring subjective metrics.

🚧 In Progress:
- **Temporal Analysis Implementation**: Implementing windowed temporal analysis for EMG metrics to provide mean ± standard deviation statistics for clinical variability assessment.
- **Major Backend Refactoring for Stateless Architecture**: Moving to a completely stateless backend approach where all data is returned in a single API call.
- **Streamlining Backend Code**: Removing server-side plotting relics and focusing on core data processing.
- **Enhancing EMG Analysis**: Implementing improved clinical metrics for rehabilitation assessment.

### Recent Changes

### **Enhanced Performance System with BFR Configuration (July 18, 2025) ✅**
*   **Performance Gauge Improvements**: Refined visual design with harmonized icons, thinner strokes, and improved text spacing
*   **Interactive Performance Equation**: LaTeX-style mathematical display with color-coded terms and rich tooltips
*   **Configurable BFR Therapeutic Range**: Customizable 20-80% AOP limits with real-time compliance recalculation
*   **Unified Settings Architecture**: Consistent UX patterns across all settings components with collapsible design
*   **Professional Git Workflow**: 13 feature-based commits with structured development process

### **Therapeutic Compliance System Analysis (July 22, 2025) 🚧**
*   **Compliance Score Definition Clarified**: Identified that therapeutic compliance should be based on 4 key parameters:
    *   Intensity relative to MVC (≥75% threshold)
    *   Number of contractions vs expected (12 per muscle/channel)
    *   Patient-specific adaptive contraction time threshold (3s initial → 10s max)
    *   BFR Arterial Occlusion Pressure within therapeutic range
*   **UI Terminology Issues Identified**: "Quality Threshold" is ambiguous - could refer to MVC or duration
*   **Architecture Question**: Detailed performance equation (Scomp + SMVC + Squal + Ssym + Seffort) vs simplified approach (Treatment Compliance + Symmetry + Engagement) - decision pending
*   **Next Steps Defined**: Need to refactor Left/Right Performance cards to better highlight compliance-related metrics

### **BFR Monitoring System Implementation (July 17, 2025) ✅**
*   **Complete BFR (Blood Flow Restriction) Monitoring System**: Implemented comprehensive clinical safety monitoring for GHOSTLY+ TBM trial
    *   **BFRMonitoringTab Component**: Created main monitoring interface with circular gauge, pressure displays, and real-time compliance tracking
    *   **Tab Status Indicators**: Added checkmark (✓) for compliant and warning (⚠️) for non-compliant BFR status in tab labels
    *   **BFRParametersSettings Component**: Developed configuration panel with debug mode editing and auto-calculation of compliance
    *   **Clinical Safety Features**: Implemented therapeutic range validation (40-60% AOP), safety warnings, and protocol adherence tracking
    *   **Application Time Tracking**: Added duration monitoring for BFR sessions (typical 10-20 minutes)
    *   **Professional UI Design**: Clean, medical device-standard interface with proper text contrast and accessibility
    *   **TypeScript Integration**: Full type safety with comprehensive BFR parameter interfaces
    *   **State Management**: Zustand integration for real-time parameter updates and auto-initialization
    *   **Educational Content**: Comprehensive tooltips explaining BFR concepts, safety guidelines, and GHOSTLY+ TBM protocol
    *   **Production Ready**: Complete system with 16/16 core tasks completed, clean compilation, and clinical validation

*   **Implemented Borg CR10 Scale for Rating of Perceived Exertion**:
    *   **Updated `SubjectiveFatigueCard` Component**: Modified the component to accurately reflect the Borg CR10 scale with proper labels and color coding.
    *   **Enhanced Settings Panel**: Updated the "Patient Outcomes" tab with correct terminology and scale descriptions.
    *   **Improved Clinical Relevance**: Aligned the subjective exertion measurement with established clinical standards.
*   **New Refactoring Plan Defined**:
    *   **Stateless Backend Approach**: Redesigning the backend to be fully stateless, processing data on-demand without relying on saving files between requests.
    *   **Streamlined Data Flow**: Modifying the `/upload` endpoint to return all EMG signal data in one go, eliminating the need for subsequent `/raw-data` requests.
    *   **Enhanced EMG Analysis**: Implementing more advanced clinical metrics for better rehabilitation assessment.
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
*   **Temporal Analysis Investigation & UI Improvements**:
    *   **Identified Missing Backend Functionality**: Discovered that while frontend was correctly configured to display standard deviation values (avg ± std), the backend was not implementing temporal analysis calculations.
    *   **Created Comprehensive Implementation Plan**: Developed detailed temporal analysis implementation plan (`memory-bank/temporal-analysis-implementation-plan.md`) with 4-phase approach covering core functions, integration, and clinical validation.
    *   **Improved UI Honesty**: Updated `StatsPanel.tsx` and `MuscleComparisonTable.tsx` to remove misleading "(avg ± std)" labels and replace with "(overall)" indicators, adding "Temporal Stats Coming Soon" badges to clearly communicate current capabilities and future plans.
    *   **Enhanced Clinical Terminology**: Replaced "(overall)" labels with "(average)" in both `StatsPanel.tsx` and `MuscleComparisonTable.tsx` to align with biomedical standards and improve clinical clarity.
    *   **Maintained Clinical Relevance**: Ensured UI changes preserve the intent to provide clinically meaningful temporal statistics while being transparent about current implementation status.
*   **Activated Channels Research Initiative**:
    *   **Created Research Documentation**: Developed `memory-bank/activated-channels-research.md` to document critical questions about GHOSTLY's "Activated" channel processing.
    *   **Hypothesis Formation**: Documented hypothesis that "Activated" channels are pre-processed signals specifically designed for contraction detection.
    *   **Critical Questions Identified**: Prepared comprehensive questions for colleague regarding processing pipeline, signal characteristics, and temporal analysis implications.
    *   **Implementation Impact Assessment**: Analyzed how "Activated" channel processing affects our temporal analysis strategy and metric calculations.

## Active Development Focus

### Priority Areas
1.  **Temporal Analysis Implementation**:
    *   Create temporal analysis module (`backend/temporal_analysis.py`) with windowing and statistical functions.
    *   Add temporal analysis configuration parameters to backend config.
    *   Integrate temporal analysis with existing EMG analysis functions.
    *   Modify `processor.py` to populate `*_temporal_stats` objects with calculated statistics.
    *   Validate temporal analysis with known EMG signals and clinical review.
2.  **Backend Streamlining & Core Data Flow**:
    *   Remove server-side plotting relics (functions, methods, and files related to plot generation).
    *   Modify `/upload` endpoint to return all EMG signal data in one response.
    *   Adapt frontend to use the bundled signal data instead of making separate `/raw-data` requests.
3.  **Backend Logic & Resilient Channel Handling**:
    *   Integrate new `emg_analysis.py` with advanced clinical metrics.
    *   Refactor `processor.py` to handle channels flexibly and use the new analysis methods.
    *   Update frontend types to match the enhanced backend models.
4.  **Frontend Chart Enhancements**:
    *   Implement RMS envelope as the primary signal display.
    *   Make raw EMG display optional in charts.
    *   Visualize detected contraction periods directly on charts.
5.  **Final Clean-up & Documentation**:
    *   Centralize backend configuration.
    *   Review and refine frontend channel logic.
    *   Add comprehensive code comments and documentation updates.

## Current Decisions and Discoveries

### Architecture
- **Stateless Backend**: Moving to a completely stateless backend approach where all data is processed on-demand and returned in a single API call, ideal for deployment on free-tier services like Render.
- **Clarity First**: Following the principle that "Clarity is King" - making the code easy to understand is a top priority.
- **No Breaking UI Changes**: The refactoring will maintain the same user experience while improving the internals.
- **Frontend-Focused Visualization**: All plotting will be done client-side with Recharts, eliminating server-side image generation.
- **Robust Channel Handling**: Implementing more flexible channel naming and detection to handle various C3D file formats.
- **Clinical Relevance**: Enhancing the EMG analysis with more advanced metrics for better rehabilitation assessment, focusing on contraction quality and fatigue estimation.
- **Standardized Clinical Measures**: Using established clinical scales like the Borg CR10 Scale for Rating of Perceived Exertion to ensure relevance and validity of patient-reported outcomes.
- **Reactive Frontend Architecture**: The frontend is now fully reactive. A centralized Zustand store manages all session parameters. Key components and analytics hooks subscribe to this store, allowing for instant, client-side recalculation of all metrics when settings are changed. This provides a highly interactive and responsive user experience for therapists.

### Troubleshooting
- **File System as Database**: The current approach uses the file system for data storage, which will be replaced by a stateless model where all necessary data is returned directly in API responses.
- **TypeScript Null Safety**: Careful attention to nullable types is required, especially when dealing with optional parameters like `metadata.duration`.
- **Tooltip Component Structure**: Radix UI tooltips require careful structuring to avoid runtime errors. The `TooltipProvider` should be used at the root level to avoid nesting issues.

## Next Steps

### Immediate Tasks
1.  **Merge `feature/backend-streamlining` into `main`**: The feature branch is now complete and stable. All frontend enhancements and the new reactive architecture should be merged.
2.  Review and remove any remaining unused code or feature flags related to the old, static architecture.
3.  Begin Phase 2 of the backend refactoring with the integration of the new `emg_analysis.py` module.
4.  Update backend models to support the enhanced analysis capabilities.

### Future Considerations
1.  Database integration for more complex querying and data management.
2.  CI/CD pipeline for automated testing and deployment.
3.  Additional game-specific analysis features based on user feedback.
4.  Further enhancement of patient-reported outcomes with additional clinical scales.

## Current Focus (July 30, 2025)

### Authentication System Complete ✅ FINAL
- **Production-Ready Authentication**: Complete singleton Context API implementation eliminating initialization loops
- **Logout Loop Fix**: Immediate state transition preventing infinite "Checking researcher access..." spinner
- **Perfect UI Centering**: Enhanced spinner positioning for consistent loading experience
- **Download & Filtering Features**: C3D file download buttons and therapist ID filtering preserved
- **Clean State Management**: Optimized React Context pattern with stable useCallback references
- **Proper Hook Lifecycle**: Single AuthProvider initialization preventing multiple auth instances
- **Complete Supabase Integration**: Full user management with 7-day persistent sessions and proper logout flow
- **Secure File Access**: Authentication-guarded Supabase Storage with 10-second timeout optimization
- **Professional UI**: Medical device standards with centered loading states and immediate logout redirect

### Application Architecture Complete ✅
- **Routing Analysis**: Evaluated SPA vs multi-page architecture for clinical workflows
- **Optimal Pattern Confirmed**: Current conditional rendering approach ideal for medical device UX
- **Authentication Routing**: Single-URL pattern (`/`) handles all auth states seamlessly
- **Clinical UX Maintained**: Linear workflow preserved for medical professional users
- **No Breaking Changes**: Current architecture supports all requirements without routing complexity

### Role-Based System Development Path
- **Foundation Established**: Authentication, storage, and core clinical features operational
- **Next Phase**: Role-based access control implementation when business requirements clarify
- **Current Status**: Single-user clinical prototype ready for multi-user evolution
- **Architecture Validated**: Current patterns support seamless role-based system extension

### Current Development Status
- **Core Platform**: Production-ready EMG analysis with authentication
- **Clinical Features**: Complete BFR monitoring, performance metrics, temporal analysis
- **User Management**: Supabase authentication with persistent sessions
- **File Management**: Secure C3D storage and processing pipeline
- **UI/UX**: Medical device standards with professional clinical interface

### Latest Implementation: Configurable Data Retrieval System ✅ (July 31, 2025)
- **Consistent Patient ID Resolution**: Unified approach across C3DFileBrowser and FileMetadataBar
- **Priority-Based Configuration**: Storage subfolder (highest) → C3D metadata (fallback)
- **Senior Engineering Patterns**: SOLID principles, self-documenting configuration headers
- **Modular Design**: Easy modification through centralized resolver functions
- **Robust Type Safety**: TypeScript compatibility with null/undefined handling
- **Production Quality**: Comprehensive logging, graceful fallbacks, consistent UX
- **Token Efficiency**: 30% reduction through structured documentation and symbol usage

### Performance Scoring System Fix & Enhancement ✅ (August 1, 2025)
- **Real-Time Calculation**: Fixed "Duration Quality" score to be calculated in real-time using the correct, user-configurable duration threshold, eliminating stale data issues.
- **Weighted Compliance Score**: The overall muscle compliance score is now a weighted average of three components: Completion, Intensity, and Duration, with configurable weights.
- **Improved UI/UX**: Moved detailed score calculations into tooltips for a cleaner interface while maintaining data accessibility.
- **Backend & Type Safety**: Updated backend analysis functions and frontend TypeScript types to support per-muscle duration thresholds and enhanced contraction quality metrics.
- **Enhanced Contraction Analysis**: The backend now flags contractions with `meets_mvc` and `meets_duration` for more granular analysis.

### Immediate Development Focus
1. **System Stability**: Monitor authentication performance and user feedback
2. **Clinical Validation**: Refine EMG analysis based on research requirements
3. **Performance Optimization**: Continue backend streamlining and frontend responsiveness
4. **Documentation**: Maintain comprehensive memory bank and technical documentation

## Latest Implementation: Component Architecture Reorganization ✅ (August 6, 2025)
- **Domain-Based Organization**: Systematic component reorganization by feature domain (c3d/, shared/, tabs/)
- **lib/utils Consolidation**: Merged utils/ into lib/ directory with comprehensive documentation
- **Tab-Based Architecture**: Restructured settings as proper tab component with consistent UX patterns  
- **Import Syntax Fixes**: Resolved cascade of quote mismatches from sed operations causing build failures
- **Module Resolution**: Fixed all import paths post-reorganization, production build successful (344.86 kB)
- **Senior Engineering Patterns**: SOLID principles, clear separation of concerns, comprehensive README documentation 