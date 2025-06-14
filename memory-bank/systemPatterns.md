# System Patterns

## Architecture Overview

The application follows a decoupled, two-part architecture: a **Backend API** and a **Frontend Application**.

### 1. Backend (Python/FastAPI)
- **Location**: `backend/`
- **Responsibility**: Handles all business logic, data processing, and serves a RESTful API.
- **Core Components**:
    - `api.py`: Defines all the FastAPI endpoints. This is the main interface for the frontend.
    - `processor.py`: The core processing engine (`GHOSTLYC3DProcessor`). It orchestrates the analysis by applying the correct metrics to the correct signal types (Raw vs. Activated).
    - `models.py`: Pydantic data models for API validation.
    - `emg_analysis.py`: Standalone, stateless functions for specific EMG metric calculations (RMS, MAV, MPF, etc.).
    - `plotting.py`: Functions to generate plots using Matplotlib.
    - `main.py`: The main entry point for launching the Uvicorn server.
    - `tests/`: Integration tests for the API.

### 2. Frontend (React/TypeScript)
- **Location**: `frontend/`
- **Responsibility**: Provides the user interface (UI) and interacts with the backend API.
- **Core Components**:
    - UI components are built with React and `shadcn/ui`.
    - Custom hooks in `frontend/src/hooks/` encapsulate state management and data fetching logic.
    - Communicates with the backend via HTTP requests to the FastAPI endpoints.

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
│   ├── plotting.py
│   └── main.py
├── data/
│   ├── uploads/
│   ├── results/
│   └── plots/
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
3.  **Result Aggregation**: The results from both analyses are merged under a single, clean channel name (e.g., "CH1"). This provides a unified and scientifically valid set of analytics to the frontend.

## Design Patterns

### API Design
- RESTful endpoints defined in `backend/api.py`.
- **Clean Analytics Object**: The API returns a clean `analytics` object with aggregated results under base channel names (e.g., "CH1"), abstracting the Raw/Activated complexity from the client.
- **Frontend UI Focus**: The UI, specifically the `StatsPanel`, intentionally omits the raw signal's "Min/Max Value". This focuses the user on clinically relevant metrics derived from detected contractions (e.g., "Max Amplitude") rather than raw signal characteristics, which are less pertinent for therapeutic assessment and can be confusing.

### Data Processing
- **Targeted Analysis Pipeline**: The processor doesn't just run all metrics on all data. It intelligently selects which analysis to run on which type of signal, ensuring the scientific validity of the results.
- Modular processing steps.
- Configurable parameters at the API level.

### Frontend Development Patterns
- Component-based architecture (React).
- UI components primarily from `shadcn/ui`.
- **Custom React Hooks for State Management**:
  - `useChannelManagement`: **Crucially, this hook now derives the list of selectable "muscles" (e.g., "CH1") from the keys of the `analytics` object returned by the API.** It also accepts a `plotMode` ('raw' | 'activated') and uses a `useEffect` to automatically select the correct corresponding plot channels (e.g., "CH1 Raw" or "CH1 activated"). This centralizes the channel switching logic.
  - `useEmgDataFetching`: Manages fetching raw EMG data for plots.
  - `useGameSessionData`: Manages the state of the `GameSession` object, deriving it from the analysis result.
- **Path Aliases**: The frontend is configured via `craco.config.js` to use the `@/` path alias, which maps to the `src/` directory. This allows for cleaner imports (e.g., `import MyComponent from '@/components/MyComponent'`).

## Component Relationships

### Data Flow
1.  **File Upload**: Frontend sends C3D file to Backend API.
2.  **Processing**: Backend's `GHOSTLYC3DProcessor` extracts "Raw" and "Activated" channels.
3.  **Targeted Analysis**: Runs contraction analysis on "Activated" signals and full-signal analysis on "Raw" signals.
4.  **Aggregation**: Merges results into a clean analytics object.
5.  **API Response**: Backend sends the aggregated results, a list of all available channels, and the source filename back to the Frontend.
6.  **UI Display**: Frontend uses the clean analytics keys to populate the "Analyse Muscle" dropdown. It uses the `available_channels` list to request the correct "Raw" data for plotting.

### Dependencies
- FastAPI ← Pydantic Models
- `GHOSTLYC3DProcessor` ← `emg_analysis` functions
- API ← File Storage
- Frontend Hooks ← API Service

## Technical Patterns

### Error Handling
- Consistent error types
- Detailed error messages
- Error recovery procedures
- Logging and monitoring
- User feedback

### Performance Optimization
- Async operations
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