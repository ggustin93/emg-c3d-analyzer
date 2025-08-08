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
- Poetry (Python package manager)
- Node.js (LTS version recommended, comes with npm)
- Code editor with Python/TypeScript support

### Setup Instructions
(Refer to `README.md` for the most current and detailed setup steps.)
1. Clone repository.
2. Configure Poetry for in-project virtual environment (optional but recommended): `poetry config virtualenvs.in-project true`
3. Backend: Run `poetry install` in the project root.
4. Frontend: Navigate to `frontend/` directory. Run `npm install`.

### Development Commands
(Refer to `README.md` for primary instructions. `start_dev.sh` is the recommended way to run the full dev environment.)
```bash
# Install/Update backend dependencies (from project root)
poetry install

# Install/Update frontend dependencies (from frontend/ directory)
cd frontend
npm install
cd ..

# Run the full development environment (backend & frontend)
# This script handles starting both servers.
./start_dev.sh

# --- Manual Start ---
# Run backend development server (from project root)
poetry run python -m backend.main

# Run frontend development server (from frontend/ directory)
cd frontend
npm start
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
- The server is launched via `backend.main`.
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

### Logging
- Backend logs to `backend.log` and `backend.error.log` during local development via `start_dev.sh`.
- Render provides its own logging for the deployed backend.
- Vercel provides logging for the deployed frontend.

### Testing
- Unit tests with pytest (current coverage may vary).
- API integration tests (current coverage may vary).

### Deprecated Scripts
- `setup.sh` has been deleted as its functionality was outdated and is now covered by `README.md` manual setup instructions. `start_dev.sh` updated accordingly.

## Project Structure
- Poetry files moved to the root directory for better management.

## Import Strategy
- Standardized relative imports within the backend module to resolve import errors. 