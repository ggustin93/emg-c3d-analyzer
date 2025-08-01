# System Patterns

## Architecture Overview

The application follows a decoupled, two-part architecture: a **Backend API** and a **Frontend Application**.

### 1. Backend (Python/FastAPI)
- **Location**: `backend/`
- **Responsibility**: Handles all business logic, data processing, and serves a RESTful API.
- **Core Components**:
    - `api.py`: Defines all the FastAPI endpoints. This is the main interface for the frontend.
    - `processor.py`: The core processing engine (`GHOSTLYC3DProcessor`). It orchestrates the analysis by applying the correct metrics to the correct signal types (Raw vs. Activated).
    - `models.py`: Pydantic data models for API validation, including the `SessionConfig` model for game parameters and the new `EMGChannelSignalData` model.
    - `emg_analysis.py`: Standalone, stateless functions for specific EMG metric calculations (RMS, MAV, MPF, etc.) and contraction analysis with MVC threshold support. Now includes advanced temporal analysis and fatigue metrics.
    - `main.py`: The main entry point for launching the Uvicorn server.
    - `config.py`: Centralized configuration for the backend.
    - `tests/`: Integration tests for the API.

### 2. Frontend (React/TypeScript)
- **Location**: `frontend/`
- **Responsibility**: Provides the user interface (UI) and interacts with the backend API.
- **Core Components**:
    - UI components are built with React and `shadcn/ui`.
    - Custom hooks in `frontend/src/hooks/` encapsulate state management and data processing logic.
    - All visualization is done client-side using Recharts.
    - Enhanced `EMGChart` component with RMS envelope display, optional raw EMG, and contraction period visualization.
    - `usePlotDataProcessor` hook (refactored from `useEmgDataFetching`) for downsampling and processing plot data.
- **Authentication & Navigation**:
    - Single-page application (SPA) pattern with conditional rendering
    - `AuthGuard` component handles authentication state management
    - No routing library required - optimal for medical device linear workflows
    - State-driven navigation: `AuthGuard` → `SessionLoader` → `GameSessionTabs`
- **Configurable Data Retrieval System**:
    - **Patient ID Resolution**: Storage subfolder (P005/, P008/) → C3D metadata fallback
    - **Session Date Resolution**: Filename extraction (YYYYMMDD) → C3D metadata fallback
    - **Architecture**: Self-documenting configuration headers, modular resolver functions
    - **Implementation**: SOLID principles with consistent priority-based configuration
    - **Components**: C3DFileBrowser and FileMetadataBar use identical resolution logic
    - **Maintainability**: Senior engineering patterns for easy priority modification

### Directory Structure
```
emg-c3d-analyzer/
├── backend/
│   ├── tests/
│   ├── __init__.py
│   ├── api.py
│   ├── processor.py
│   ├── models.py
│   ├── emg_analysis.py
│   ├── config.py
│   ├── main.py
├── frontend/
│   └── src/
├── pyproject.toml
└── start_dev.sh
```

## Authentication & Navigation Architecture

### Single-Page Application Pattern
The application uses a clean SPA pattern optimized for medical device workflows:

```typescript
// App.tsx - Root navigation control
<AuthGuard>
  {!analysisResult ? <SessionLoader /> : <GameSessionTabs />}
</AuthGuard>

// AuthGuard.tsx - Authentication state management
if (!isAuthenticated) return <LoginPage />;
return <>{children}</>;
```

### URL Strategy
- **Single URL Entry Point**: `/` handles all application states
- **State-Driven Navigation**: Authentication and data states control view rendering
- **Medical Device UX**: Linear workflow without route confusion for clinical users
- **No Routing Library**: React Router unnecessary - conditional rendering optimal

### Navigation Flow
1. **Unauthenticated**: `/` → `LoginPage` (full-page login interface)
2. **Authenticated + No Data**: `/` → `SessionLoader` (file selection interface)
3. **Authenticated + Data Loaded**: `/` → `GameSessionTabs` (analysis interface)

### Benefits of Current Pattern
- **Clinical Workflow Alignment**: Matches linear medical device interaction patterns
- **Simplified User Experience**: No URL navigation confusion for medical professionals
- **State Persistence**: Zustand manages session state without routing complexity
- **Mobile Optimization**: Single URL works seamlessly across all devices
- **Error Reduction**: No broken routes or navigation edge cases

## Core Processing Logic

The system intelligently processes EMG signals with a focus on clinical relevance and flexible channel handling.

1. **Signal Processing**:
   * **EMG Data Extraction**: The `GHOSTLYC3DProcessor` extracts all channels from the C3D file.
   * **Signal Analysis**: For each channel, the processor calculates:
     * RMS (Root Mean Square) envelope for better clinical interpretation
     * MAV (Mean Absolute Value) for amplitude assessment
     * Spectral parameters (MPF, MDF) for frequency analysis
     * Fatigue indices (including Dimitrov's FI_nsm5) for fatigue estimation
   * **Temporal Analysis**: New advanced temporal analysis provides statistical metrics (mean, std, min, max, coefficient of variation) for each parameter.

2. **Contraction Analysis**:
   * **Detection Algorithm**: Identifies muscle contractions based on signal characteristics.
   * **MVC-Based Assessment**: Evaluates contractions against muscle-specific MVC thresholds.
   * **Contraction Metrics**: Calculates duration, amplitude, and other clinically relevant parameters.

3. **Resilient Channel Handling**:
   * The system now flexibly handles different C3D channel naming conventions.
   * Channel analytics are stored under the actual C3D channel names.
   * The processor attempts to find "activated" versions of channels for contraction analysis when available.

## Design Patterns

### API Design
- **Stateless Backend**: The backend is designed to be completely stateless, processing data on-demand without relying on saving files between requests.
- **Single-Response Data Flow**: The `/upload` endpoint returns all necessary data in one response, including EMG signals, analytics, and metadata.
- **RESTful Endpoints**: Clearly defined in `backend/api.py`.
- **Frontend UI Focus**: The UI emphasizes clinically relevant metrics and visualizations.

### Data Processing
- **Enhanced EMG Analysis**: The new `emg_analysis.py` provides advanced metrics for better clinical assessment.
- **Flexible Channel Handling**: The processor can work with various C3D channel naming conventions.
- **Modular Processing**: Each analysis function is independent and stateless for better maintainability.
- **Temporal Analysis**: New statistical metrics for each parameter provide deeper insights into muscle activity patterns.

### Frontend Development Patterns
- **Component-Based Architecture**: React components for modular UI development.
- **UI Components**: Primarily from `shadcn/ui`.
- **Authentication Architecture**: Complete Supabase integration with secure route protection
  - `useAuth`: Centralized authentication hook with persistent login and state management
  - `AuthGuard`: Route protection component that wraps protected application areas  
  - `UserProfile`: Professional user interface with logout functionality
  - Supabase Storage integration for secure C3D file access
- **Custom React Hooks for State Management**:
  - `useChannelManagement`: Manages channel selection and mapping.
  - `usePlotDataProcessor`: Processes EMG signal data for visualization (downsampling, etc.).
  - `useGameSessionData`: Manages the state of the `GameSession` object.
  - `usePerformanceMetrics`: Calculates performance metrics from analysis results.
- **Zustand for Global State**: A centralized Zustand store (`useSessionStore`) holds all patient-specific session parameters (MVC values, thresholds, etc.). This is the single source of truth for configuration.
- **Reactive Hooks**: Custom hooks (`usePerformanceMetrics`, `useLiveAnalytics`) subscribe to the Zustand store. When parameters in the store change, these hooks automatically re-calculate analytics and performance scores, triggering seamless UI updates.
- **Weighted Score Calculation**: The `usePerformanceMetrics` hook now calculates the overall muscle compliance score as a weighted average of Completion, Intensity, and Duration components, with weights being configurable through the UI.
- **Enhanced Visualization**:
  - RMS envelope as the primary signal display for better clinical interpretation.
  - Optional raw EMG display for detailed analysis when needed.
  - Contraction period visualization directly on charts.
  - MVC threshold reference lines for performance assessment.

## Component Relationships

### Data Flow
1. **File Upload**: Frontend sends C3D file and processing parameters to Backend API (`/upload`).
2. **Processing**: The backend's `GHOSTLYC3DProcessor` extracts all channels and performs comprehensive analysis.
3. **Complete Response**: The backend returns a single response containing:
   - All EMG signal data (raw signals, RMS envelopes, time axes)
   - Complete analytics for all channels
   - Metadata and available channels
4. **Frontend Processing**: The frontend processes the data for visualization:
   - `usePlotDataProcessor` handles downsampling for efficient plotting
   - `EMGChart` renders the data with RMS envelope, optional raw EMG, and contraction markers
   - `StatsPanel` displays the analytics in a clinically relevant format

### Dependencies
- FastAPI ← Pydantic Models
- `GHOSTLYC3DProcessor` ← `emg_analysis` functions
- Frontend Hooks ← API Service
- `EMGChart` ← Recharts

## Technical Patterns

### Error Handling
- Consistent error types
- Detailed error messages
- Error recovery procedures
- Logging and monitoring
- User feedback
- Type safety with proper handling of nullable fields

### Performance Optimization
- **Stateless Processing**: All data is processed on-demand without relying on file storage between requests.
- **Bundled Response**: All necessary data is returned in a single API call, reducing network overhead.
- **Frontend Processing**: Signal downsampling and visualization processing are handled client-side.
- **Component-Level Memoization**: Key components use `React.memo`, `useMemo`, and `useCallback` for efficiency.

### Security
- Input validation
- File type checking
- Size limitations
- Access control
- Data protection

## Testing Patterns
- Unit tests for components
- Integration tests for API
- Performance benchmarks
- Error case validation
- Security testing

## Interactive Features
- RMS envelope as primary signal display
- Optional raw EMG display
- Contraction period visualization
- Zoom/pan functionality
- MVC threshold reference lines

## Clinical Relevance
- **Enhanced EMG Analysis**: Advanced metrics for better rehabilitation assessment
- **Temporal Analysis**: Statistical insights into muscle activity patterns
- **Contraction Quality**: Assessment based on MVC thresholds
- **Fatigue Estimation**: Multiple metrics for comprehensive fatigue analysis 