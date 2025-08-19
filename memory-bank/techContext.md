# Technical Context

## Technology Stack

### Core Backend Technologies
- Python 3.10+ (Project configured for >=3.10,<3.12)
- FastAPI
- Poetry (Package Management)
- ezc3d (C3D File Processing)
- `python-multipart` (For FastAPI file uploads)

### Core Frontend Technologies
- React (via Create React App - `react-scripts`)
- TypeScript
- Tailwind CSS (via shadcn/ui)
- shadcn/ui (for UI components)
- Recharts (for client-side data visualization)

### Key Backend Dependencies
```toml
[Dependencies]
python = ">=3.10.0,<3.12" # Updated to allow Python 3.11 for Render compatibility
ezc3d = "^1.5.18"
fastapi = "^0.115.12"
pydantic = "^2.11.4"
numpy = "^2.2.5"
pandas = "^2.2.3"
scipy = "^1.15.3"
# matplotlib and seaborn will be removed in the stateless architecture
uvicorn = "^0.34.2"
requests = "^2.32.3"
python-multipart = "^0.0.9" # Added for FastAPI file uploads
# Other dependencies are resolved by Poetry via poetry.lock
```

### Key Frontend Dependencies (Managed via npm - `frontend/package.json`)
- `react`
- `react-dom`
- `typescript`
- `tailwindcss`
- `@radix-ui/react-icons` (for icons)
- `axios` (for API calls)
- `recharts` (for client-side data visualization)
- `@supabase/supabase-js` (for authentication and storage)
- `zustand` (for state management)
- Specific `shadcn/ui` components. New components are added via `npx shadcn@latest add <component-name>`.

### Theming
- Primary color configured via CSS variables in `frontend/src/index.css`: `--primary: 177 87% 43%` (hex `#0ecfc5`). `--ring` matches primary.
- Tabs in `GameSessionTabs.tsx` use `bg-primary`, `text-primary-foreground`, and `border-primary`.

## Development Environment

### Required Tools
- Git
- Python (3.10+ recommended)
- Poetry (Python package manager) OR Docker (containerized approach)
- Node.js (LTS version recommended, comes with npm) OR Docker
- Code editor with Python/TypeScript support
- **Docker** (recommended for consistent development environment)
- **Serena MCP** (advanced code analysis and intelligent tooling)

### Setup Instructions
(Refer to `README.md` for the most current and detailed setup steps.)
1. Clone repository.
2. Configure Poetry for in-project virtual environment (optional but recommended): `poetry config virtualenvs.in-project true`
3. Backend: Run `poetry install` in the project root.
4. Frontend: Navigate to `frontend/` directory. Run `npm install`.

### Development Commands

#### Docker-Based Development (Recommended)
Enhanced `start_dev.sh` v3.0 - Complete Docker containerization with production-ready workflows.

```bash
# Docker containerized development (recommended)
./start_dev.sh                        # Start all services in containers
./start_dev.sh --full                 # Start with Redis GUI and reverse proxy
./start_dev.sh --prod                 # Production environment simulation
./start_dev.sh --rebuild              # Rebuild containers and start
./start_dev.sh --logs [service]       # Show service logs (backend/frontend/redis)
./start_dev.sh --shell [service]      # Open shell in container
./start_dev.sh --test                 # Run tests in containers
./start_dev.sh --clean                # Clean containers and volumes
./start_dev.sh --reset                # Complete reset with image removal

# Coolify deployment preparation
./start_dev.sh --coolify              # Generate Coolify configuration
./start_dev.sh --build-prod           # Build production images
```

#### Native Development (Alternative)
Primary development script: `start_dev_simple.sh` - Production-ready development environment with robust logging and monitoring.

```bash
# Production-ready native development
./start_dev_simple.sh                 # Full stack with logging & monitoring
./start_dev_simple.sh --backend-only  # API development focus with health checks
./start_dev_simple.sh --frontend-only # Frontend development only
./start_dev_simple.sh --install       # Auto-creates venv & installs all dependencies
./start_dev_simple.sh --test          # Run comprehensive test suite (43 tests)
./start_dev_simple.sh --kill          # Graceful shutdown with cleanup

# Advanced webhook testing with ngrok integration
./start_dev.sh --webhook              # Development + ngrok tunnel for webhook testing

# Virtual environment management (automated by start_dev_simple.sh)
# Manual venv setup if needed:
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Manual frontend dependency installation
cd frontend
npm ci  # Preferred for CI/development (uses package-lock.json)
npm install  # Alternative if no lockfile exists

# Real-time monitoring and debugging
tail -f logs/backend.error.log        # Backend error monitoring with structured logging
tail -f logs/frontend.log             # Frontend development server output and build info
```

#### Serena MCP Integration
Advanced code analysis and intelligent development assistance through Serena MCP server.

```bash
# Serena MCP capabilities available:
# - Intelligent code search and analysis
# - Symbol-level code understanding and modification
# - Pattern-based search across the entire codebase
# - Memory management for project context
# - Automated refactoring and code generation
```

## Configuration

### Project Configuration
- Backend: Poetry for dependency management (`pyproject.toml`, `poetry.lock`).
- Frontend: npm for dependency management (`frontend/package.json`).
- Frontend: `shadcn/ui` configured via `components.json`.
- Ruff for Python code formatting.
- Pyright for Python type checking.
- Backend: Centralized configuration in `backend/config.py`.

### Frontend API Endpoint Configuration
- The frontend uses the `REACT_APP_API_URL` environment variable to determine the backend API URL.
  - **Local Development:** Defaults to `http://localhost:8080`. Can be overridden by creating `frontend/.env` with `REACT_APP_API_URL=your_url`.
  - **Production Deployment:** This variable **must** be set in the frontend hosting environment (e.g., Vercel) to the live backend URL.
- The `frontend/.env` file is correctly ignored by Git.

### Troubleshooting Frontend Dependencies
- On occasion, the local `node_modules` cache can become inconsistent, leading to module resolution errors even when code and package versions are correct (e.g., `Module '"lucide-react"' has no exported member '...'`).
- **Solution**: Perform a clean reinstall of frontend dependencies from the `frontend/` directory:
  ```bash
  rm -rf node_modules package-lock.json && npm install
  ```

## Testing Infrastructure

### Comprehensive Test Suite (43 Tests)
- **Backend Testing**: 11 total tests with pytest framework
  - **Unit Tests**: 9 tests covering EMG analysis (62% coverage)
  - **Integration Tests**: 2 async database tests (pytest-asyncio)
  - **API Tests**: 20 FastAPI TestClient endpoint validation tests
  - **E2E Tests**: Real C3D file processing with actual clinical data
- **Frontend Testing**: 34 tests with Vitest framework
  - React component testing with Testing Library
  - Hook testing (6 tests for usePerformanceMetrics)
  - Integration testing across 7 test files

### Testing Configuration
```ini
# pytest.ini - Backend testing configuration
[pytest]
markers =
    e2e: end-to-end tests requiring external services
asyncio_mode = auto
```

### Test Dependencies
**Backend (`requirements.txt`)**:
- `pytest` - Testing framework
- `pytest-cov` - Coverage reporting
- `pytest-asyncio` - Async test support

**Frontend (`package.json`)**:
- `vitest` - Testing framework
- `@testing-library/react` - Component testing utilities
- `@testing-library/jest-dom` - Additional matchers

### Real Data Testing
- **E2E Validation**: Uses actual GHOSTLY rehabilitation C3D files (2.74MB)
- **Clinical Data**: `Ghostly_Emg_20230321_17-50-17-0881.c3d` with 175.1s EMG data
- **Processing Validation**: Complete pipeline from upload to therapeutic compliance metrics
- **Performance Benchmarks**: API response time validation and processing monitoring

### Test Execution Commands
```bash
# Backend tests (in virtual environment)
source venv/bin/activate
python -m pytest tests/ -v                    # All tests with verbose output
python -m pytest tests/test_e2e* -v -s       # E2E tests with real C3D data
python -m pytest tests/ --cov=backend        # Tests with coverage report

# Frontend tests
cd frontend
npm test                                      # Interactive test runner
npm test -- --run                           # Run tests once
npm test hooks                               # Hook tests only
npm test -- --coverage                      # Tests with coverage

# Integrated test execution
./start_dev_simple.sh --test                # All 43 tests via development script
```

## Deployment
- **Backend (FastAPI):**
    - Successfully deployed to Render.
    - **Build Command on Render:** `poetry install --only main --no-root`
    - **Start Command on Render:** `uvicorn backend.api:app --host 0.0.0.0 --port $PORT`
    - Python version on Render aligned with project (`>=3.10,<3.12`).
    - `python-multipart` added for file uploads.
    - **Stateless Architecture**: The new stateless design is ideal for Render's free tier, as it doesn't rely on persistent file storage between requests.
- **Frontend (React):**
    - Successfully deployed to Vercel.
    - Configured to point to the Render backend via the `REACT_APP_API_URL` environment variable set in Vercel project settings.
    - Vercel "Root Directory" setting for the project is `frontend`.

### Code Style
```toml
[tool.ruff]
select = ['E', 'W', 'F', 'I', 'B', 'C4', 'ARG', 'SIM']
ignore = ['W291', 'W292', 'W293']
```

## Technical Constraints

### Performance Requirements
- Fast C3D file processing
- Real-time EMG analysis
- Client-side data visualization
- Stateless backend processing

### Security Requirements
- Input validation
- File type verification
- Size limits on uploads
- Access control (future)

### Compatibility Requirements
- C3D file format compliance
- REST API standards
- JSON data format

## Infrastructure

### File Storage
- Moving away from local file system storage to a stateless model.
- All necessary data is returned directly in API responses.
- Temporary processing of uploaded C3D files during request handling only.

### API Server
- FastAPI application (the `app` instance is in `backend.api`).
- The server is launched via `backend.api.api:app` with uvicorn.
- CORS middleware enabled.
- Async request handling.
- Stateless processing model.

### Processing Pipeline
- EMG data extraction
- Signal processing (filtering, etc.)
- Analytics calculation (contractions, RMS, MAV, MPF, MDF, FI_nsm5)
- Enhanced temporal analysis for clinical metrics
- Complete data bundling in API response

## Data Models

### Key Backend Models
- **EMGChannelSignalData**: New model for storing complete signal data for a channel:
  ```python
  class EMGChannelSignalData(BaseModel):
      sampling_rate: float
      time_axis: List[float]
      data: List[float]  # Primary C3D signal
      rms_envelope: Optional[List[float]] = None
      activated_data: Optional[List[float]] = None
  ```

- **TemporalAnalysisStats**: New model for enhanced clinical metrics:
  ```python
  class TemporalAnalysisStats(BaseModel):
      mean_value: Optional[float] = None
      std_value: Optional[float] = None
      min_value: Optional[float] = None
      max_value: Optional[float] = None
      valid_windows: Optional[int] = None
      coefficient_of_variation: Optional[float] = None
  ```

- **ChannelAnalytics**: Enhanced with temporal analysis:
  ```python
  class ChannelAnalytics(BaseModel):
      rms: Optional[float]
      mav: Optional[float]
      fatigue_index_fi_nsm5: Optional[float]
      rms_temporal_stats: Optional[TemporalAnalysisStats] = None
      mav_temporal_stats: Optional[TemporalAnalysisStats] = None
      fatigue_index_temporal_stats: Optional[TemporalAnalysisStats] = None
      mpf: Optional[float]
      mdf: Optional[float]
      # ... other fields ...
  ```

- **EMGAnalysisResult**: Enhanced to include complete signal data:
  ```python
  class EMGAnalysisResult(BaseModel):
      file_id: str
      # ... existing fields ...
      emg_signals: Dict[str, EMGChannelSignalData]  # Complete signal data
      # ... other fields ...
  ```

### Key Frontend Types
- Corresponding TypeScript interfaces for all backend models.
- Enhanced types for the new data structures and analytics.

## Monitoring and Maintenance

### Enhanced Logging Infrastructure
- **Structured Development Logging**: Production-quality logging system via `start_dev_simple.sh`
  - **Backend Logs**: Separate stdout (`logs/backend.log`) and stderr (`logs/backend.error.log`) streams
  - **Frontend Logs**: Development server output (`logs/frontend.log`) with build information
  - **Real-time Monitoring**: `tail -f logs/backend.error.log` for live error tracking
  - **Automatic Cleanup**: Fresh log files created for each development session
- **Health Check Logging**: Comprehensive service monitoring with contextual error reporting
- **Process Management Logs**: PID tracking, graceful shutdown, and startup validation logging
- **Virtual Environment Logs**: Dependency installation and validation with structured output
- **Production Deployment**: 
  - Render provides centralized logging for deployed backend
  - Vercel provides logging for deployed frontend
- **Cross-Platform Compatibility**: Logging works consistently on macOS and Linux development environments

### Testing Infrastructure

#### Complete Testing Suite (43 Tests Passing)
- **Total Coverage**: 9 backend tests + 34 frontend tests ensuring code quality and reliability
- **Automated Testing**: Integrated into `start_dev_simple.sh --test` for comprehensive validation
- **Virtual Environment**: All backend tests run in isolated Python venv with proper dependency management

#### Frontend Testing (Vitest + React Testing Library) - 34/34 Tests Passing
- **Test Framework**: Vitest for fast unit testing with TypeScript support and hot reload
- **Component Testing**: React Testing Library for user-focused component testing across 7 test files
- **Test Organization**: Co-located tests in `__tests__/` directories following React best practices
- **Coverage Areas**: Comprehensive testing of components, hooks, contraction analysis, and performance metrics
- **Hook Testing**: Custom hooks tested with exported utility functions (6 hook tests)
- **Integration Tests**: Cross-component workflows with data flow validation
- **Business Logic**: Contraction analysis, performance calculations, and data transformation testing

#### Backend Testing (pytest) - 9/9 Tests Passing
- **Test Framework**: pytest with pytest-cov for coverage reporting and pytest-asyncio for async testing
- **Core Module Coverage**: 62% coverage for `emg_analysis.py` (main EMG processing module)
- **Virtual Environment**: All tests run in isolated venv with automatic dependency validation
- **Test Organization**: Comprehensive unit tests for EMG analysis functions and signal processing
- **API Testing**: FastAPI endpoint testing with file upload validation

#### Enhanced Test Commands
```bash
# Comprehensive test suite (recommended)
./start_dev_simple.sh --test          # Run all 43 tests with environment validation

# Frontend Tests (34 tests)
cd frontend
npm test                    # Run all tests in watch mode
npm test -- --run         # Run tests once with results summary
npm test hooks             # Run hook tests only (6 tests)
npm test components        # Run component tests
npm test -- --coverage    # Run with coverage report

# Backend Tests (9 tests) 
cd backend
source venv/bin/activate   # Required for backend testing
python -m pytest tests/ -v                    # Run backend tests with verbose output
python -m pytest tests/ --cov=emg --cov-report=term-missing  # Run with coverage
python -m pytest tests/test_emg_analysis.py   # Run specific EMG analysis tests

# Testing with dependency validation
./start_dev_simple.sh --install --test       # Install deps and run comprehensive tests
```

#### Test Infrastructure Features
- **Virtual Environment Integration**: Backend tests automatically run in isolated Python venv
- **Dependency Validation**: Test runner verifies all required libraries (ezc3d, fastapi, pytest, etc.)
- **Cross-Platform Support**: Tests run consistently on macOS and Linux
- **Coverage Reporting**: Detailed coverage metrics for both frontend and backend
- **Automated Validation**: Integrated into development workflow via enhanced start script

### Deprecated Scripts
- `setup.sh` has been deleted as its functionality was outdated and is now covered by `README.md` manual setup instructions. `start_dev.sh` updated accordingly.

## Project Structure
- Poetry files moved to the root directory for better management.

## Import Strategy
- Standardized relative imports within the backend module to resolve import errors. 

## Tooltips
- **UI Components**: Primarily uses **shadcn/ui**, a collection of reusable UI components. This is the preferred library for building UI elements to maintain consistency and reduce custom component development.
- **Tooltips**: A data-driven, composable tooltip system has been implemented to ensure consistency and maintainability.
  - **Base Component**: `frontend/src/components/ui/tooltip.tsx` provides the base styling and portal functionality for all tooltips.
  - **Clinical Context Wrapper**: `frontend/src/components/ui/clinical-tooltip.tsx` is a wrapper that structures tooltips with a title, description, and sections.
  - **Data Source**: All tooltip content is centralized in `frontend/src/data/tooltipData.ts`. This separates content from presentation.
  - **Usage**: To use a tooltip for a specific metric (e.g., RPE Score), use its dedicated preset component (e.g., `<RPEScoreTooltip>`). To create a new tooltip, add a new data function to `tooltipData.ts` and a corresponding preset component to `clinical-tooltip.tsx`. 