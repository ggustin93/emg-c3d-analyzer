# System Patterns

## Architecture Overview

The application follows a decoupled, two-part architecture: a **Backend API** and a **Frontend Application**.

### 1. Backend (Python/FastAPI)
- **Location**: `backend/`
- **Responsibility**: Handles all business logic, data processing, and serves a RESTful API.
- **Core Components**:
    - `api.py`: Defines all the FastAPI endpoints. This is the main interface for the frontend.
    - `processor.py`: The core processing engine (`GHOSTLYC3DProcessor`). It orchestrates the analysis by applying the correct metrics to the correct signal types (Raw vs. Activated).
    - `models.py`: Pydantic data models for API validation, including the new `SessionConfig` model for game parameters.
    - `emg_analysis.py`: Standalone, stateless functions for specific EMG metric calculations (RMS, MAV, MPF, etc.) and contraction analysis with MVC threshold support.
    - `main.py`: The main entry point for launching the Uvicorn server.
    - `tests/`: Integration tests for the API.

### 2. Frontend (React/TypeScript)
- **Location**: `frontend/`
- **Responsibility**: Provides the user interface (UI) and interacts with the backend API.
- **Core Components**:
    - UI components are built with React and `shadcn/ui`.
    - Custom hooks in `frontend/src/hooks/` encapsulate state management and data fetching logic.
    - Communicates with the backend via HTTP requests to the FastAPI endpoints.
    - New `SessionConfigPanel` component for inputting game session parameters.
    - Enhanced `EMGChart` component with zoom/pan functionality and MVC threshold visualization.

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
│   ├── main.py
├── data/
│   ├── uploads/
│   ├── results/
│   ├── cache/
├── frontend/
│   └── src/
├── pyproject.toml
└── start_dev.sh
```

## Core Processing Logic

The system intelligently distinguishes between **Raw** and **Activated** EMG signals based on channel names from the C3D file.

1.  **Signal Identification**: The `GHOSTLYC3DProcessor` identifies pairs of channels (e.g., "CH1 Raw" and "CH1 activated").
2.  **Targeted Analysis**:
    *   **Contraction Analysis** (`analyze_contractions`) is performed **only on the "activated" signal**, as it represents a clean muscle activation envelope.
    *   **Full-Signal Metrics** (RMS, MAV, MPF, MDF, etc.) are performed **only on the "Raw" signal**, as they require the complete, unprocessed signal data for valid calculations.
3.  **Game-Specific Analysis**:
    *   **Muscle-Specific MVC Threshold Analysis**: Each muscle has its own MVC (Maximum Voluntary Contraction) value and threshold percentage to account for anatomical differences. Contractions are evaluated against these muscle-specific thresholds to determine if they are "good" contractions.
    *   **Performance Tracking**: The system counts good contractions and compares against expected contractions count.
4.  **Result Aggregation**: The results from both analyses are merged under a single, clean channel name (e.g., "CH1"). This provides a unified and scientifically valid set of analytics to the frontend.

## Design Patterns

### API Design
- RESTful endpoints defined in `backend/api.py`.
- **Clean Analytics Object**: The API returns a clean `analytics` object with aggregated results under base channel names (e.g., "CH1"), abstracting the Raw/Activated complexity from the client.
- **Frontend UI Focus**: The UI, specifically the `StatsPanel`, intentionally omits the raw signal's "Min/Max Value". This focuses the user on clinically relevant metrics derived from detected contractions (e.g., "Max Amplitude") rather than raw signal characteristics, which are less pertinent for therapeutic assessment and can be confusing.
- **Game Session Parameters**: The API now accepts and processes game-specific parameters like MVC value, MVC threshold percentage, and expected contractions count.

### Data Processing
- **Targeted Analysis Pipeline**: The processor doesn't just run all metrics on all data. It intelligently selects which analysis to run on which type of signal, ensuring the scientific validity of the results.
- **MVC Threshold Analysis**: The system evaluates contractions against the MVC threshold to determine if they are "good" contractions for rehabilitation purposes.
- Modular processing steps.
- Configurable parameters at the API level.

### Frontend Development Patterns
- Component-based architecture (React).
- UI components primarily from `shadcn/ui`.
- **Custom React Hooks for State Management**:
  - `useChannelManagement`: **Crucially, this hook now derives the list of selectable "muscles" (e.g., "CH1") from the keys of the `analytics` object returned by the API.** It also accepts a `plotMode` ('raw' | 'activated') and uses a `useEffect` to automatically select the correct corresponding plot channels (e.g., "CH1 Raw" or "CH1 activated"). This centralizes the channel switching logic.
  - `useEmgDataFetching`: Manages fetching raw EMG data for plots.
  - `useGameSessionData`: Manages the state of the `GameSession` object, deriving it from the analysis result, now with proper handling of nullable fields.
- **Path Aliases**: The frontend is configured via `craco.config.js` to use the `@/` path alias, which maps to the `src/` directory. This allows for cleaner imports (e.g., `import MyComponent from '@/components/MyComponent'`).
- **Interactive Chart Components**: The `EMGChart` component now includes Brush for zoom/pan functionality and ReferenceLine for MVC threshold visualization.
- **Configuration UI**: The new `SessionConfigPanel` component provides a dedicated interface for inputting game session parameters.

## Component Relationships

### Data Flow
1.  **File Upload**: Frontend sends C3D file and processing parameters (including game session parameters) to Backend API (`/upload`).
2.  **Caching Check**: The backend calculates a hash of the file content + parameters and checks if a result already exists in the `data/cache` directory. If so, it returns the cached result immediately.
3.  **Processing (Cache Miss)**: If no cache entry is found, the backend's `GHOSTLYC3DProcessor` extracts "Raw" and "Activated" channels. This heavy processing is run in a thread pool to avoid blocking the server.
4.  **Targeted Analysis**: Runs contraction analysis on "Activated" signals and full-signal analysis on "Raw" signals.
5.  **Game-Specific Analysis**: If MVC value and threshold are provided, contractions are evaluated against the threshold to determine if they are "good" contractions.
6.  **Result Persistence**:
    *   The main analysis object (containing aggregated results) is saved to a JSON file in `data/results`.
    *   All raw and activated signal data is serialized to a separate `_raw_emg.json` file in `data/results`.
    *   A marker file containing the path to the main result is created in `data/cache`.
7.  **API Response**: Backend sends the aggregated results, a list of all available channels, and the source filename back to the Frontend.
8.  **UI Display**: Frontend uses the clean analytics keys to populate the "Analyse Muscle" dropdown. It uses the `available_channels` list to request the correct data for plotting.
9.  **Plot Data Fetching**: When a plot is requested, the frontend calls the `/raw-data` endpoint.
10. **Optimized Data Retrieval**: The `/raw-data` endpoint reads directly from the pre-serialized `_raw_emg.json` file, providing near-instant access without reprocessing the C3D file.
11. **Interactive Chart Rendering**: The `EMGChart` component renders the data with zoom/pan functionality via Brush and displays the MVC threshold via ReferenceLine.

### Dependencies
- FastAPI ← Pydantic Models
- `GHOSTLYC3DProcessor` ← `emg_analysis` functions
- API ← File Storage
- Frontend Hooks ← API Service
- `EMGChart` ← Recharts (Brush, ReferenceLine)

## Technical Patterns

### Error Handling
- Consistent error types
- Detailed error messages
- Error recovery procedures
- Logging and monitoring
- User feedback
- Type safety with proper handling of nullable fields

### Performance Optimization
- Async operations with `FastAPI.concurrency.run_in_threadpool`.
- **Backend Request Caching**: The `/upload` endpoint uses a sha256 hash of file content and processing parameters for robust caching.
- **Data Pre-serialization**: All EMG data is extracted and saved to a dedicated file during initial processing to accelerate subsequent reads.
- **Frontend In-Memory Caching**: A simple `Map` caches downsampled plot data in the `useEmgDataFetching` hook to prevent redundant API calls.
- Result caching
- Efficient file handling
- Memory management
- Resource cleanup

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
- Game-specific feature validation

## Caching Mechanism
- Use file content and parameter hashes for cache keys.
- Store cache markers in `data/cache/` for robustness.

## Async Processing
- Utilize `run_in_threadpool` for CPU-bound operations to maintain API responsiveness.

## Interactive Features
- Zoom/pan functionality using Recharts Brush component for better data exploration.
- Visual MVC threshold reference line for clear feedback on contraction quality.
- Game session configuration panel for easy parameter input. 