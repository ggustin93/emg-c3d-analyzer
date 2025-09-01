# Backend Test Suite

Test suite for the EMG C3D Analyzer backend with type-based organization and domain preservation.

## Test Summary

- **18 test files** across 4 categories
- **135 tests total** (100% passing)
- **47% code coverage** on critical components
- **Dependencies**: pytest, pytest-cov, httpx, FastAPI TestClient
- **Clinical Data**: Real 2.74MB GHOSTLY C3D files


## Test Categories

### Unit Tests (`tests/unit/`) - 7 Files
Test individual functions and classes in isolation without external dependencies.

#### EMG Processing (`tests/unit/emg/`) - 5 files
- **`test_emg_analysis.py`**: Core EMG signal processing algorithms, RMS calculation, contraction detection
- **`test_contraction_flags.py`**: Contraction validation flags, MVC thresholds, duration compliance
- **`test_processing_parameters.py`**: Signal processing parameter validation, Nyquist frequency safety
- **`test_processor.py`**: C3D processor core functionality, channel mapping, error handling  
- **`test_serialization.py`**: Data serialization/deserialization, JSON conversion, type safety

#### Clinical Logic (`tests/unit/clinical/`) - 2 files
- **`test_performance_scoring_service_comprehensive.py`**: GHOSTLY+ performance scoring algorithm, RPE mapping, compliance calculations
- **`validate_metrics_definitions_compliance.py`**: Compliance validation against metricsDefinitions.md specification, single source of truth verification

### Integration Tests (`tests/integration/`) - 6 Files  
Test component interactions, database operations, and service coordination.

#### Clinical Workflows (`tests/integration/clinical/`) - 3 files
- **`test_therapy_session_processor_critical.py`**: Critical therapy session processing workflows, error handling, data integrity
- **`test_therapy_session_processor_comprehensive.py`**: Complete database table population (6 tables), BFR per-channel monitoring, Redis caching integration
- **`test_database_table_population.py`**: Database table population validation, composite key operations, per-channel BFR support, development defaults

#### General Integration (`tests/integration/`) - 3 files  
- **`test_scoring_config_integration.py`**: Scoring configuration integration, weight management, clinical compliance
- **`test_database_improvement.py`**: Database schema improvements, migration validation, performance optimization
- **`test_metadata_creation.py`**: Metadata creation and validation, session parameters, C3D header processing

### End-to-End Tests (`tests/e2e/`) - 2 Files  
Test complete user workflows with real C3D data.

- **`test_e2e_complete_workflow.py`**: Complete user workflow from C3D upload to therapeutic assessment, performance benchmarks, API consistency
- **`test_webhook_complete_integration.py`**: Full webhook integration with Supabase Storage, patient/therapist lookup, session creation with real clinical data (2.74MB GHOSTLY files)

### API Tests (`tests/api/`) - 3 Files  
Test HTTP endpoints, routing, and request/response validation.

- **`test_api_endpoints.py`**: All FastAPI endpoint testing, authentication, validation, error handling with TestClient
- **`test_scoring_config_api.py`**: Scoring configuration API endpoints, weight updates, clinical parameter management
- **`test_webhook_system_critical.py`**: Webhook system API testing, file upload handling, error recovery mechanisms

## 📁 Directory Structure (Type-Based with Domain Preservation)

```
tests/
├── unit/                          # 7 files - Pure unit tests
│   ├── emg/                      # EMG algorithm tests (5 files)
│   │   ├── test_emg_analysis.py         # Core signal processing
│   │   ├── test_contraction_flags.py    # Validation flags
│   │   ├── test_processing_parameters.py # Parameter validation
│   │   ├── test_processor.py           # C3D processor core
│   │   └── test_serialization.py       # Data serialization
│   └── clinical/                 # Clinical logic tests (2 files)
│       ├── test_performance_scoring_service_comprehensive.py # GHOSTLY+ scoring
│       └── validate_metrics_definitions_compliance.py # Spec compliance
├── integration/                   # 6 files - Component integration
│   ├── clinical/                 # Therapy workflows (3 files)
│   │   ├── test_therapy_session_processor_critical.py # Critical workflows
│   │   ├── test_therapy_session_processor_comprehensive.py # Complete integration
│   │   └── test_database_table_population.py # Database validation
│   ├── test_scoring_config_integration.py # Scoring integration
│   ├── test_database_improvement.py      # Database improvements
│   └── test_metadata_creation.py         # Metadata processing
├── e2e/                          # 2 files - End-to-end workflows
│   ├── test_e2e_complete_workflow.py    # Complete user workflow
│   └── test_webhook_complete_integration.py # Full webhook integration
├── api/                          # 3 files - API layer testing
│   ├── test_api_endpoints.py            # All FastAPI endpoints
│   ├── test_scoring_config_api.py       # Scoring API endpoints  
│   └── test_webhook_system_critical.py  # Webhook API testing
├── samples/                      # Real clinical data
│   └── Ghostly_Emg_20230321_17-50-17-0881.c3d # 2.74MB GHOSTLY file
├── conftest.py                   # Pytest configuration and fixtures
├── run_tests.py                  # Test runner script
├── run_tests.sh                  # Bash test runner
└── README.md                     # This documentation
```


## 🔍 Key Differences Between Test Types

### **Unit vs Integration vs API vs E2E**

| Aspect | Unit | Integration | API | E2E |
|--------|------|-------------|-----|-----|
| **Speed** | ⚡ Fast (<1s) | 🟡 Medium (1-5s) | 🟡 Medium (1-5s) | 🔴 Slow (10-60s) |
| **Scope** | Single function | Multiple components | HTTP layer | Complete system |
| **Dependencies** | None (mocked) | Real database | FastAPI TestClient | External services |
| **Data** | Synthetic/minimal | Test database | API requests | Real clinical files |
| **Failures** | Algorithm bugs | Integration issues | API contract issues | System-wide problems |
| **When to Run** | Always | CI/CD + dev | CI/CD + dev | Before deployment |

### **Test Execution Strategies**

- **Development**: Run unit tests frequently, integration occasionally
- **Pre-commit**: Unit + Integration tests (fast feedback)  
- **CI/CD Pipeline**: All tests including E2E (comprehensive validation)
- **Production Deploy**: Full E2E suite with real data validation

## Running Tests

```bash
# Complete test suite (recommended)
source venv/bin/activate
export PYTHONPATH="${PWD}:${PYTHONPATH:-}"
python -m pytest tests/ -v --tb=short --cov=. --cov-report=term

# By category
python -m pytest tests/unit/ -v           # Unit tests only (fast)
python -m pytest tests/integration/ -v   # Integration tests
python -m pytest tests/api/ -v           # API endpoint tests  
python -m pytest tests/e2e/ -v -s        # E2E tests (requires setup)

# All tests run by default (no skips)
python -m pytest tests/ -v --tb=short    # All 135 tests execute

# Disable E2E tests if needed (not recommended)
export SKIP_E2E_TESTS=true  # Only if E2E environment unavailable

# Coverage analysis
python -m pytest tests/ --cov=backend --cov-report=html
open htmlcov/index.html                   # View coverage report
```

## Running in Docker

Using the provided `docker-compose.yml`:

```bash
# Start dependencies (Redis) and backend container
docker compose up -d redis backend

# Option A: install dev deps in the running backend container and run tests
docker compose exec backend sh -lc "pip install -r backend/requirements-dev.txt && pytest backend/tests -m 'not e2e' -v"

# Option B: run one-off container for tests
docker compose run --rm backend sh -lc "pip install -r backend/requirements-dev.txt && pytest backend/tests -m 'not e2e' -v"

# Run e2e tests when services and env are configured
docker compose exec backend sh -lc "pytest backend/tests/e2e -m e2e -v"
```

Notes:
- The compose file sets `REDIS_URL=redis://redis:6379/0`; bring `redis` up first.
- Ensure required env vars (e.g., `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`) are available to the backend service.
- The default backend image target is production; installing `backend/requirements-dev.txt` adds pytest at runtime.

Pytest markers are declared in `pytest.ini`:

```ini
[pytest]
markers =
    e2e: end-to-end tests requiring external services
```

## Prerequisites

- Python 3.10+
- Backend dependencies installed (see `backend/requirements.txt`)
- For e2e/webhook tests: running backend, Supabase credentials (if applicable), and any required services (e.g., Redis) configured via environment variables.
- Sample C3D files for integration/e2e tests under `backend/tests/samples/`.

## Notes

- Some tests interact with external systems. They should be clearly marked and skipped by default.
- If a test relies on configuration, prefer environment variables and document expected values in the test or an adjacent README.
- We welcome incremental improvements: small, focused tests are better than none.