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
- **Custom React Hooks for State Management**:
  - `useChannelManagement`: Manages channel selection and mapping.
  - `usePlotDataProcessor`: Processes EMG signal data for visualization (downsampling, etc.).
  - `useGameSessionData`: Manages the state of the `GameSession` object.
  - `usePerformanceMetrics`: Calculates performance metrics from analysis results.
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