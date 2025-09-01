# System Patterns

## Architecture Overview

EMG processing platform with stateless backend and reactive frontend for clinical rehabilitation workflows.

### Core Architecture

#### Backend (Python/FastAPI)
**Location**: `backend/`  
**Structure**: Domain-Driven Design

- `api/`: FastAPI endpoints with modular routing
- `services/`: Business logic organized by domain
  - `analysis/`: MVC estimation, threshold management
  - `clinical/`: Performance scoring, session processing
  - `data/`: Export, metadata services
  - `c3d/`: File processing and parsing
  - `infrastructure/`: Webhook security
- `emg/`: Signal processing algorithms
- `models/`: Pydantic data models
- `database/`: Supabase client
- `tests/`: 135 tests with domain organization

#### Frontend (React/TypeScript)
**Location**: `frontend/`  
**Structure**: Component-based architecture

- `components/`: UI components organized by feature
  - `tabs/`: Main application tabs
  - `auth/`: Authentication components
  - `shared/`: Reusable components
  - `ui/`: shadcn/ui base components
- `hooks/`: Custom React hooks for business logic
- `store/`: Zustand state management
- `services/`: API and storage services
- `types/`: TypeScript definitions

### Key Patterns

#### Dual Signal Detection
- **Temporal Detection**: Activated signals (5% threshold) for timing
- **Amplitude Assessment**: RMS envelope (10% threshold) for MVC compliance
- **Clinical Validation**: 2x better signal-to-noise ratio

#### Single Source of Truth
- Backend analytics flags are authoritative
- Frontend uses backend data for all calculations
- Graceful fallbacks for missing data

#### Stateless Processing
- All data returned in single API response
- Client-side caching and processing
- No server-side session storage

#### Authentication Flow
- Supabase Auth with Row Level Security
- Single-page application with conditional rendering
- Linear workflow optimized for medical use

### Data Flow

1. **Upload**: C3D file → Backend processing
2. **Analysis**: EMG signal extraction → Contraction detection → Metrics calculation
3. **Response**: Complete data bundle → Frontend
4. **Visualization**: Client-side rendering with Recharts
5. **Interaction**: Real-time recalculation on parameter changes

### Testing Strategy
- Backend: 135 tests (unit, integration, API, E2E)
- Frontend: 78 tests (components, hooks, integration)
- Total: 223 tests with 100% pass rate
- Real clinical data validation

### Development Workflow
- Native development: `./start_dev_simple.sh`
- Docker development: `./start_dev.sh`
- Webhook testing: ngrok integration
- Database management: Storage-integrated tools