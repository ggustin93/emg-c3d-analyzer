# System Patterns

## Architecture Overview - Advanced EMG Processing Platform

The GHOSTLY+ EMG C3D Analyzer implements a revolutionary **dual signal detection approach** with decoupled, stateless architecture optimized for clinical rehabilitation workflows.

### 🎯 Dual Signal Detection Innovation (August 2025)

**Clinical Problem Solved**: Eliminated baseline noise false positives that were causing physiologically impossible contraction detections.

**Hybrid Approach**:
- **Temporal Detection**: Uses cleaner "activated" signals (5% threshold) for precise contraction timing
- **Amplitude Assessment**: Uses RMS envelope (10% threshold) for accurate MVC compliance
- **Signal Quality**: 2x cleaner signal-to-noise ratio compared to single signal detection
- **Clinical Validation**: +13% more contractions detected with real GHOSTLY clinical data

### 1. Backend (Python/FastAPI) - Advanced Dual Signal Processing
- **Location**: `backend/`
- **Responsibility**: Handles all business logic, data processing, and serves a RESTful API with revolutionary dual signal EMG analysis.
- **Core Components**:
    - `api/api.py`: FastAPI endpoints with comprehensive C3D processing capabilities
    - `services/c3d_processor.py`: Advanced C3D processing engine with dual signal detection
    - `emg/emg_analysis.py`: **Dual Signal Detection Algorithm** - Uses activated signals for timing, RMS for amplitude
    - `emg/signal_processing.py`: Low-level signal operations (filtering, smoothing, envelope calculation)
    - `models/models.py`: Pydantic data models with enhanced EMG channel support
    - `config.py`: Research-validated parameters (150ms merge, 50ms refractory, 5%/10% thresholds)
    - `tests/`: Production-ready test suite (43/43 tests passing) with real clinical data validation

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
- **EMG Chart Architecture (August 2025)**:
    - **Component Extraction**: Applied SOLID principles with separation of concerns
    - **Custom Hooks**: `useMVCCalculations` and `useContractionAnalysis` for domain logic
    - **Centralized Configuration**: `emgChartConfig.ts` for magic numbers and constants
    - **Structured Logging**: Professional logging service with categories and performance timing
    - **Performance Optimization**: React.memo, useMemo, useCallback for efficient rendering
    - **Maintainable Architecture**: Reduced from 1181 lines to clean, modular structure

### Directory Structure
```
emg-c3d-analyzer/
├── backend/
│   ├── tests/
│   │   ├── test_emg_analysis.py          # Unit tests (9 tests)
│   │   ├── test_integration.py           # Integration tests (2 tests)
│   │   ├── test_api_endpoints.py         # API tests (20 tests)
│   │   └── test_e2e_complete_workflow.py # E2E tests (real C3D data)
│   ├── __init__.py
│   ├── api.py
│   ├── processor.py
│   ├── models.py
│   ├── emg_analysis.py
│   ├── config.py
│   ├── main.py
├── frontend/
│   └── src/
│       ├── components/
│       │   └── tabs/
│       │       └── SignalPlotsTab/
│       │           ├── EMGChart.tsx          # Main chart component
│       │           └── EMGChartLegend.tsx   # Extracted legend component
│       ├── hooks/
│       │   ├── useMVCCalculations.ts        # MVC threshold logic
│       │   └── useContractionAnalysis.ts    # Contraction analysis logic
│       ├── config/
│       │   └── emgChartConfig.ts           # Centralized configuration
│       └── services/
│           └── logger.ts                   # Structured logging service
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
    * **Temporal Analysis**: Advanced temporal analysis provides statistical metrics (mean, std, min, max, coefficient of variation) for RMS, MAV, MPF, MDF, and FI; surfaced as `*_temporal_stats`.

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
 - **Contraction Quality Flags**: Domain logic defines explicit booleans (`meets_mvc`, `meets_duration`, `is_good`) with a clear truth table; duration default is 2000 ms and is synchronized from frontend and echoed in response metadata.

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
  - `usePerformanceMetrics`: Calculates performance metrics from analysis results using Single Source of Truth pattern.
  - `useMVCCalculations`: Extracts MVC threshold calculation logic with backend priority
  - `useContractionAnalysis`: Handles contraction area visualization and quality summary
  - `useLiveAnalytics`: Manages real-time recalculation of analytics when session parameters change
- **Zustand for Global State**: A centralized Zustand store (`useSessionStore`) holds all patient-specific session parameters (MVC values, thresholds, etc.). This is the single source of truth for configuration.
- **Reactive Hooks**: Custom hooks (`usePerformanceMetrics`, `useLiveAnalytics`) subscribe to the Zustand store. When parameters in the store change, these hooks automatically re-calculate analytics and performance scores, triggering seamless UI updates.
- **Single Source of Truth Pattern**: Performance calculations prioritize backend analytics flags (`meets_mvc`, `meets_duration`, `is_good`) over frontend calculations, ensuring consistency across components.
- **Weighted Score Calculation**: The `usePerformanceMetrics` hook now calculates the overall muscle compliance score as a weighted average of Completion, Intensity, and Duration components, with weights being configurable through the UI.
- **Enhanced Visualization**:
  - RMS envelope as the primary signal display for better clinical interpretation.
  - Optional raw EMG display for detailed analysis when needed.
  - Contraction period visualization directly on charts.
  - MVC threshold reference lines for performance assessment.
- **EMG Chart Refactoring Patterns (August 2025)**:
  - **SOLID Principles Applied**: Single responsibility components, dependency injection, separation of concerns
  - **Custom Hook Extraction**: Domain logic moved to specialized hooks (`useMVCCalculations`, `useContractionAnalysis`)
  - **Configuration Management**: Centralized constants and magic numbers in `emgChartConfig.ts`
  - **Structured Logging**: Professional logging service with categories (CHART_RENDER, DATA_PROCESSING, MVC_CALCULATION, CONTRACTION_ANALYSIS, PERFORMANCE, USER_INTERACTION)
  - **Performance Optimization**: Proper React memoization with useMemo, useCallback, React.memo
  - **Component Composition**: Large components broken into focused, testable units

### Role-based UX & Theming Tokens
- Settings follow a role-gated UX: Therapist/Admin can edit Performance Scoring and Therapeutic Parameters; Debug Mode temporarily unlocks controls; others are read-only with locks and badges.
- Read-only categories: Session Goals (C3D), ePRO (mobile), Contraction Detection (backend-optimized, RAW EMG).
- Theming uses shadcn tokens bound to CSS variables. Primary brand set to `#0ecfc5` (HSL 177 87% 43%); tabs use primary tokens.

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
5. **Chart Rendering (Refactored Architecture)**:
   - `useMVCCalculations` provides threshold calculations with backend priority
   - `useContractionAnalysis` generates contraction areas and quality summaries
   - `EMGChartLegend` component handles all legend display logic
   - Structured logging tracks performance and debugging information

### Dependencies
- FastAPI ← Pydantic Models
- `GHOSTLYC3DProcessor` ← `emg_analysis` functions
- Frontend Hooks ← API Service
- `EMGChart` ← Recharts
- **New Component Dependencies**:
  - `EMGChart` ← `useMVCCalculations` + `useContractionAnalysis` + `EMGChartLegend`
  - `useMVCCalculations` ← `emgChartConfig` + `logger`
  - `useContractionAnalysis` ← `emgChartConfig` + `logger`
  - All components ← `logger` service for structured logging

### EMG Chart Component Architecture (August 2025)

#### Core Components
```typescript
// Main chart component - orchestrates rendering
EMGChart.tsx (567 lines → clean, focused)
├── useMVCCalculations      // MVC threshold logic
├── useContractionAnalysis  // Contraction visualization logic  
├── EMGChartLegend         // Legend display component
├── logger                 // Structured logging service
└── emgChartConfig         // Centralized constants
```

#### Hook Responsibilities
- **`useMVCCalculations`**: 
  - Backend-prioritized MVC threshold calculations
  - Muscle name resolution with signal type support
  - Threshold data generation for legend display
- **`useContractionAnalysis`**:
  - Contraction area processing for visualization
  - Quality summary calculations (good/poor/mvc-only/duration-only counts)
  - Backend quality flag prioritization with frontend fallback

#### Logging Architecture
```typescript
// Professional logging with categories and performance timing
enum LogLevel { DEBUG, INFO, WARN, ERROR, NONE }
enum LogCategory { 
  CHART_RENDER, DATA_PROCESSING, MVC_CALCULATION, 
  CONTRACTION_ANALYSIS, PERFORMANCE, USER_INTERACTION 
}

// Usage examples
logger.startTimer('contraction-areas-calculation');
logger.mvcCalculation('Using backend threshold', { source: 'backend' });
logger.endTimer('contraction-areas-calculation');
```

## Technical Patterns

### Error Handling
- Consistent error types
- Detailed error messages
- Error recovery procedures
- Logging and monitoring
- User feedback
- Type safety with proper handling of nullable fields
- **Structured Error Logging**: Categories and context for debugging

### Performance Optimization
- **Stateless Processing**: All data is processed on-demand without relying on file storage between requests.
- **Bundled Response**: All necessary data is returned in a single API call, reducing network overhead.
- **Frontend Processing**: Signal downsampling and visualization processing are handled client-side.
- **Component-Level Memoization**: Key components use `React.memo`, `useMemo`, and `useCallback` for efficiency.
- **EMG Chart Performance Patterns**:
  - Proper React memoization for expensive calculations
  - Custom hook memoization with dependency arrays
  - Performance timing with logger.startTimer/endTimer
  - Efficient re-rendering with React.memo and useCallback

### Security
- Input validation
- File type checking
- Size limitations
- Access control
- Data protection

### Code Quality Patterns (August 2025)
- **SOLID Principles**: Single responsibility, open/closed, dependency inversion
- **Configuration Management**: Centralized constants prevent magic numbers
- **Structured Logging**: Categorized logging with performance timing
- **Component Extraction**: Large components broken into focused, testable units
- **Custom Hook Pattern**: Domain logic extracted to reusable hooks
- **Professional Architecture**: Senior engineering patterns for maintainability

## Development Environment Patterns

### Production-Ready Development Script Architecture
The enhanced `start_dev_simple.sh` follows enterprise-grade patterns for development environment management:

#### Process Management Pattern
```bash
# PID-based process tracking with graceful shutdown
readonly PID_FILE="$BASE_DIR/.dev_pids"
BACKEND_PID=""
FRONTEND_PID=""

# Graceful SIGTERM → SIGKILL fallback
kill "${pids_to_kill[@]}" 2>/dev/null || true
sleep 2
for pid in "${pids_to_kill[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
    fi
done
```

#### Virtual Environment Management Pattern
```bash
# Automatic venv creation and dependency management
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

# Dependency validation and auto-installation
if ! python -c "import fastapi, ezc3d" 2>/dev/null; then
    python -m pip install -r requirements.txt --upgrade
fi
```

#### Health Monitoring Pattern
```bash
# Backend health check with timeout
curl -s http://localhost:$BACKEND_PORT/health >/dev/null 2>&1

# Process liveness monitoring
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    log_error "Backend process died during startup!"
    break
fi
```

#### Structured Logging Pattern
```bash
# Separate stdout/stderr streams for debugging
backend_log="../logs/backend.log"
backend_err_log="../logs/backend.error.log"

# Real-time monitoring
tail -f logs/backend.error.log | grep -E "(🚀|📁|🔄|✅|❌|📊)"
```

### Testing Infrastructure Patterns (August 2025)

#### Comprehensive Test Suite Implementation
```
Production Testing Architecture (43 Tests Total)
├── Backend Tests (11 total)
│   ├── Unit Tests (9 tests): EMG analysis with 62% coverage
│   ├── Integration Tests (2 tests): Async database operations
│   ├── API Tests (20 tests): FastAPI TestClient validation
│   └── E2E Tests (3 tests): Real C3D file processing
└── Frontend Tests (34 tests)
    ├── Vitest with TypeScript support  
    ├── React Testing Library components
    ├── Hook testing (6 tests)
    └── Integration testing across 7 files
```

#### Testing Architecture Patterns
- **pytest Configuration**: `asyncio_mode=auto` for integration tests
- **FastAPI TestClient**: Comprehensive API endpoint validation
- **Real Data Validation**: E2E tests with actual 2.74MB GHOSTLY C3D files
- **Professional Fixtures**: Mock data generation and test utilities
- **Error Handling Testing**: Graceful failure patterns and meaningful errors
- **Performance Benchmarking**: API response time validation

#### E2E Testing Pattern with Real Clinical Data
```python
@pytest.fixture
def sample_c3d_file(self):
    """Use actual GHOSTLY C3D file for realistic E2E testing"""
    sample_path = Path("tests/samples/Ghostly_Emg_20230321_17-50-17-0881.c3d")
    if sample_path.exists():
        print(f"✅ Using actual C3D file: {sample_path}")
        print(f"📊 File size: {sample_path.stat().st_size / (1024*1024):.2f} MB")
        return sample_path
```

#### API Testing Pattern with TestClient
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_upload_endpoint_with_mock_file(self):
    with open(sample_file, 'rb') as f:
        files = {"file": ("test.c3d", f, "application/octet-stream")}
        response = client.post("/upload", files=files)
    assert response.status_code in [200, 400, 422, 500]
```

#### Test Organization Strategy
- **Co-located Testing**: Tests next to source with clear naming conventions
- **Real Data Testing**: E2E validation with actual clinical rehabilitation files
- **Virtual Environment Testing**: Backend tests in isolated Python environment
- **Comprehensive Coverage**: Unit → Integration → API → E2E workflow
- **Quality Gates**: Tests validate production-ready code quality

### Test Structure Pattern
```
backend/tests/
├── test_emg_analysis.py              # Unit tests (9 tests, 62% coverage)
├── test_integration.py               # Integration tests (2 async tests)  
├── test_api_endpoints.py             # API tests (20 FastAPI endpoints)
├── test_e2e_complete_workflow.py     # E2E tests (real C3D processing)
├── samples/
│   └── Ghostly_Emg_20230321_17-50-17-0881.c3d  # Real clinical data
└── pytest.ini                       # pytest configuration

frontend/src/
├── hooks/__tests__/
│   └── usePerformanceMetrics.test.ts # Hook unit tests (6 tests)
├── components/tabs/SignalPlotsTab/__tests__/
│   └── contraction-filtering.test.ts # Component tests
└── tests/
    ├── authBestPractices.test.tsx    # Integration tests
    └── authFlowTest.tsx              # Auth workflow tests
```

### Testing Patterns
- **Hook Testing**: Export utility functions for comprehensive unit testing
- **Component Testing**: User interaction focus with Testing Library
- **Business Logic Testing**: Critical calculations with edge case coverage
- **Integration Testing**: Cross-component workflows and authentication flows
- **Performance Testing**: Benchmarks for data processing and rendering
- **Virtual Environment Testing**: Isolated backend testing with automatic dependency validation
- **Comprehensive Coverage**: 43 tests ensuring frontend components and backend EMG processing reliability

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
- **Professional Visualization**: Clean, maintainable chart architecture supporting clinical workflows