# GHOSTLY+ EMG C3D Analyzer - Backend (KISS Architecture)

This directory contains the backend server for the GHOSTLY+ EMG C3D Analyzer application. It's a FastAPI-based API responsible for processing C3D files, performing EMG analysis, and serving the results in a stateless architecture optimized for cloud deployment.

## Architecture

The backend follows **KISS principles** with a clean, minimal structure supporting both real-time processing and automated workflows:

- **Real-time Processing**: Direct C3D upload via `/upload` endpoint with bundled response
- **Automated Processing**: Supabase Storage webhooks for background C3D analysis
- **Database Integration**: Analysis results cached with researcher authentication (RLS)
- **Stateless Design**: Maintains cloud deployment compatibility

### Directory Structure

```
backend/
├── api/                         # FastAPI application layer
│   ├── routes/                  # API endpoint routes
│   │   ├── analysis.py          # EMG analysis endpoints
│   │   ├── upload.py            # C3D file upload endpoints  
│   │   ├── webhooks.py          # Supabase webhook endpoints
│   │   ├── mvc.py               # MVC estimation endpoints
│   │   └── ...
│   └── dependencies/            # FastAPI dependency injection
│       ├── validation.py        # Request validation patterns
│       └── services.py          # Service dependency injection
├── models/                      # Pydantic data models (domain-organized)
│   ├── clinical/                # Clinical domain models
│   │   ├── patient.py           # Patient profile models
│   │   ├── session.py           # Therapy session models
│   │   └── scoring.py           # Performance scoring models
│   ├── user/                    # User domain models  
│   ├── data/                    # Data processing models
│   └── shared/                  # Common base models and enums
├── services/                    # Business logic services (domain-driven)
│   ├── clinical/                # Clinical domain services
│   │   ├── repositories/        # Data access layer
│   │   │   ├── patient_repository.py
│   │   │   ├── therapy_session_repository.py
│   │   │   └── emg_data_repository.py
│   │   ├── therapy_session_processor.py  # Session workflow orchestrator
│   │   └── performance_scoring_service.py # GHOSTLY+ scoring
│   ├── user/                    # User domain services
│   │   └── repositories/        # User data access
│   │       └── user_repository.py  # User profiles and authentication
│   ├── shared/                  # Common service components
│   │   └── repositories/        # Shared repository base classes
│   ├── c3d/                     # C3D file processing services
│   │   ├── processor.py         # High-level C3D processing
│   │   ├── reader.py            # C3D file reading and parsing
│   │   └── utils.py             # C3D utility functions
│   ├── analysis/                # EMG analysis services
│   │   ├── mvc_service.py       # MVC estimation service
│   │   └── threshold_service.py # Signal threshold calculations
│   ├── cache/                   # Caching infrastructure
│   │   ├── redis_cache_service.py # Redis-based caching
│   │   └── cache_patterns.py    # Caching strategy patterns
│   ├── data/                    # Data management services
│   │   ├── export_service.py    # Data export functionality
│   │   └── metadata_service.py  # Metadata extraction
│   └── infrastructure/          # Cross-cutting infrastructure
│       └── webhook_security.py  # Webhook security verification
├── emg/                         # EMG signal processing algorithms
│   ├── emg_analysis.py          # EMG metrics calculation
│   └── signal_processing.py    # Low-level signal operations
├── database/                    # Database integration layer
│   └── supabase_client.py       # Supabase client configuration
├── config.py                    # Unified configuration management
└── main.py                      # FastAPI application entry point
```

### Component Roles

#### API Layer
- **api/routes/upload.py**: 🌐 Real-time C3D file upload and processing endpoints
- **api/routes/webhooks.py**: 🔗 Supabase Storage webhook endpoints for automated processing
- **api/routes/mvc.py**: 💪 MVC estimation and threshold management endpoints
- **api/dependencies/validation.py**: ✅ Request validation and parameter extraction patterns

#### Domain Services (Business Logic)
- **services/clinical/therapy_session_processor.py**: ⚙️ Complete therapy session workflow orchestration
- **services/clinical/performance_scoring_service.py**: 🏆 GHOSTLY+ clinical performance scoring
- **services/c3d/processor.py**: 🏗️ High-level C3D file processing and analysis coordination
- **services/user/repositories/user_repository.py**: 👤 User authentication and profile management
- **services/analysis/mvc_service.py**: 💪 MVC estimation and muscle strength analysis

#### Data Models (Domain-Driven)
- **models/clinical/**: 🏥 Clinical domain models (patients, sessions, scoring)
- **models/user/**: 👥 User management models (profiles, authentication)
- **models/data/**: 📊 Data processing models (C3D parameters, processing options)
- **models/shared/**: 🔗 Common base models and enums

#### Signal Processing & Analysis
- **emg/signal_processing.py**: ⚡ Low-level EMG signal operations (filtering, smoothing, envelope calculation)
- **emg/emg_analysis.py**: 📊 EMG metrics calculation and contraction detection algorithms

#### Infrastructure
- **services/infrastructure/webhook_security.py**: 🔒 Secure webhook signature verification
- **services/cache/redis_cache_service.py**: ⚡ High-performance Redis caching
- **database/supabase_client.py**: 🗄️ Supabase database client configuration
- **config.py**: ⚙️ Unified configuration management

## Data Processing Architecture

The backend supports two complementary processing modes:

### Real-time Processing (Stateless)
1. C3D file uploaded via `/upload` endpoint
2. Complete analysis performed in-memory and returned immediately
3. No persistent storage - optimal for cloud deployment

### Automated Processing (Database-Cached)
1. Supabase Storage webhook triggers on C3D upload
2. Background processing with results cached in database
3. Row Level Security ensures only authenticated researchers access data
4. Analysis format matches `/upload` endpoint for frontend compatibility

## Import Patterns

### Domain-Driven Imports
- **Clinical Services**: `from services.clinical.therapy_session_processor import TherapySessionProcessor`
- **Clinical Repositories**: `from services.clinical.repositories import PatientRepository, TherapySessionRepository`
- **User Services**: `from services.user.repositories import UserRepository`
- **C3D Processing**: `from services.c3d.processor import GHOSTLYC3DProcessor`
- **Analysis Services**: `from services.analysis.mvc_service import MVCService`
- **Cache Services**: `from services.cache.redis_cache_service import get_cache_service`

### API Layer Imports  
- **Route Handlers**: `from api.routes.upload import router as upload_router`
- **Webhook Endpoints**: `from api.routes.webhooks import router as webhook_router`
- **Dependencies**: `from api.dependencies.validation import get_processing_options`

### Data Models (Domain-Organized)
- **Clinical Models**: `from models.clinical import Patient, TherapySession, PerformanceScores`
- **User Models**: `from models.user import UserProfile, UserProfileCreate`
- **Processing Models**: `from models.data import ProcessingOptions, C3DTechnicalData`
- **Shared Components**: `from models.shared import ProcessingStatus, SessionStatus`

### Signal Processing
- **EMG Analysis**: `from emg.emg_analysis import analyze_contractions`
- **Signal Processing**: `from emg.signal_processing import preprocess_emg_signal`

### Infrastructure
- **Database**: `from database.supabase_client import get_supabase_client`
- **Security**: `from services.infrastructure.webhook_security import WebhookSecurity`

## Resilient Channel Handling

The backend implements **flexible C3D channel processing** to handle various naming conventions:

- **Raw Channel Names**: Preserves original C3D channel names as data keys
- **Dual Signal Processing**: Implements hybrid approach using both "Raw" and "activated" signal variants for optimal contraction detection
- **Muscle Mapping Support**: Supports user-defined channel-to-muscle name mappings for display purposes
- **Fallback Mechanisms**: Gracefully handles missing or differently named channels

## EMG Analysis

The system includes EMG metrics:

- **Amplitude**: RMS, MAV with temporal windowing
- **Frequency**: Mean Power Frequency (MPF), Median Frequency (MDF)
- **Fatigue**: Dimitrov's Fatigue Index
- **Statistics**: Mean, standard deviation, coefficient of variation
- **Detection**: Dual signal approach using activated signals for timing and RMS for amplitude

## GHOSTLY+ Performance Scoring

The system implements **official GHOSTLY+ clinical trial metrics** following the multicenter RCT specification:

- **Overall Performance Score**: `P_overall = w_c × S_compliance + w_s × S_symmetry + w_e × S_effort + w_g × S_game`
- **Therapeutic Compliance**: Per-muscle compliance using completion, intensity, and duration rates with equal weighting (1/3 each)
- **Bilateral Symmetry**: CH1/CH2 analysis using `S_symmetry = (1 - |left - right| / (left + right))`
- **Clinical Effort Assessment**: RPE-based scoring with amplitude proxy when RPE unavailable
- **Game Performance Integration**: Game points achievement relative to maximum achievable points
- **GHOSTLY+ Weights**: Compliance (40%), Symmetry (25%), Effort (20%), Game (15%)
- **Clinical Validation**: Optimized for hospitalized older adults (≥65 years) with mobility restrictions

### Dual Signal Detection Algorithm

The system implements an advanced **dual signal detection approach** that addresses baseline noise issues:

- **Temporal Detection**: Uses cleaner "activated" signals (5% threshold) for precise contraction timing
- **Amplitude Assessment**: Uses RMS envelope (10% threshold) for accurate MVC compliance
- **Baseline Noise Reduction**: 2x cleaner signal-to-noise ratio compared to single signal detection
- **Physiological Parameters**: 150ms merge threshold, 50ms refractory period based on EMG research
- **Backward Compatibility**: Gracefully falls back to single signal detection when activated channels unavailable

## Webhook System

Automated C3D processing via Supabase Storage events:
- **Security**: HMAC-SHA256 signature verification with service key authentication
- **Database**: Analysis results cached with researcher authentication (RLS)
- **Compatibility**: Webhook data format matches `/upload` endpoint response
- **Testing**: ngrok tunnel required for local development webhook testing

### Webhook Testing Setup

For testing webhooks with Supabase Storage uploads:

```bash
# 1. Install and configure ngrok (one-time setup)
# Download from: https://ngrok.com/download
# Sign up: https://dashboard.ngrok.com/signup
# Get token: https://dashboard.ngrok.com/get-started/your-authtoken
./ngrok config add-authtoken YOUR_NGROK_TOKEN

# 2. Start development environment with integrated webhook testing
cd ../  # Go to project root
./start_dev.sh --webhook
# This automatically starts backend + frontend + ngrok tunnel
# and displays webhook configuration instructions

# 3. Configure webhook URL shown in startup output in Supabase Dashboard
# Example: https://abc123.ngrok-free.app/webhooks/storage/c3d-upload

# 4. Monitor webhook activity
tail -f logs/backend.error.log | grep -E "(🚀|📁|🔄|✅|❌|📊)"

# 5. Test by uploading C3D files via Supabase Dashboard
```

**Expected Flow**: Upload → Webhook Trigger → Patient/Therapist Lookup → File Download → C3D Processing → Database Population → Clinical Analysis → Success Response

**Integration Test Results**: 
- Session `b101a1a9-5c28-4c76-a6ce-06075d52998f` created with P001 patient and therapist extraction
- Complete EMG analysis: 20 contractions detected with clinical-grade amplitude/duration assessment  
- Therapeutic recommendation: Focus on contraction duration (100% MVC compliance, 0% duration compliance)

## Technical Implementation Details

### Signal Processing Pipeline

The backend implements a sophisticated EMG signal processing pipeline:

1. **Multi-Channel Detection**: Automatically identifies Raw and Activated signal variants
2. **Dual Signal Extraction**: Processes both signal types for optimal analysis
3. **Hybrid Detection Algorithm**: Uses activated signals for timing, RMS for amplitude
4. **Physiological Validation**: Applies research-based parameters for clinical accuracy

For detailed technical documentation, see [`docs/signal-processing/`](../docs/signal-processing/)

## Testing & Quality Assurance

### Test Suite (144 Tests - 100% Pass Rate ✅)

**Test Categories:**
- **Unit Tests**: 7 files, 21 tests - EMG algorithms and business logic
- **Integration Tests**: 6 files, 54 tests - Component interactions, database operations  
- **API Tests**: 3 files, 42 tests - FastAPI endpoint validation with RBAC
- **E2E Tests**: 2 files, 9 tests - Complete workflows with real clinical data
- **Webhook Tests**: Included in API/E2E - Supabase Storage integration
- **RBAC Tests**: 15 tests - Authentication and authorization validation

**Test Execution:**

### 🚀 Recommended: Use the Test Runner Script
```bash
# ALWAYS runs E2E tests with proper environment (SKIP_E2E_TESTS=false)
./run_tests_with_env.sh              # Run all 144 tests with .env loaded
./run_tests_with_env.sh e2e          # Run only E2E tests
./run_tests_with_env.sh quick        # Run quick tests (excludes E2E)

# The script automatically:
# - Loads .env file with Supabase credentials
# - Sets SKIP_E2E_TESTS=false (E2E always enabled!)
# - Activates virtual environment
# - Sets PYTHONPATH correctly
# - Verifies Supabase configuration
```

### Manual Test Execution (if needed)
```bash
# Complete test suite with coverage
source venv/bin/activate
export PYTHONPATH="${PWD}:${PYTHONPATH:-}"
export SKIP_E2E_TESTS=false  # IMPORTANT: Never skip E2E tests!
python -m pytest tests/ -v --tb=short --cov=. --cov-report=term --cov-report=html

# By test category (for development)
python -m pytest tests/unit/ -v           # Unit tests only
python -m pytest tests/integration/ -v    # Integration tests  
python -m pytest tests/api/ -v            # API endpoint tests
python -m pytest tests/e2e/ -v -s         # E2E tests with output

# Quick test run (no coverage)
python -m pytest tests/ --tb=no -q        # All 144 tests in ~45 seconds
```

**⚠️ IMPORTANT**: E2E tests MUST have valid Supabase credentials in `.env` file:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
```

**Quality Metrics:**
- **Test Pass Rate**: 100% (144/144 tests passing)
- **Code Coverage**: 60% overall
  - Core EMG algorithms: 98% coverage
  - API endpoints: 90% coverage
  - Clinical services: 73% coverage
  - Signal processing: 85% coverage
- **Real Clinical Data**: 2.74MB GHOSTLY C3D files
- **Test Organization**: Type-based with domain preservation
- **Production Parity**: Integration tests match exact production workflows

**Coverage Highlights:**
- `emg/emg_analysis.py`: 98% - Core signal processing algorithms
- `api/routes/upload.py`: 90% - Upload endpoint validation
- `api/routes/webhooks.py`: 88% - Webhook processing
- `services/clinical/performance_scoring_service.py`: 95% - GHOSTLY+ scoring
- `services/clinical/therapy_session_processor.py`: 73% - Session orchestration

For detailed test documentation with visual diagrams, see [`tests/README.md`](tests/README.md). 