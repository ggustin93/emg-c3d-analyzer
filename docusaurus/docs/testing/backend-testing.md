---
sidebar_position: 1
title: Backend Testing
---

# Backend Testing Strategy

Comprehensive testing approach for the GHOSTLY+ FastAPI backend with 144+ tests achieving 100% pass rate.

## Test Suite Overview

### Test Distribution

- **Unit Tests** (11) - Core EMG processing algorithms
- **API Tests** (19) - FastAPI endpoint validation  
- **Integration Tests** (3) - Service layer integration
- **E2E Tests** (3) - Real C3D file processing
- **Frontend Tests** (78) - React component testing
- **Hook Tests** (30) - React hook validation
- **Total:** 144+ tests with 100% pass rate

## Critical Testing Architecture

### 🚨 Synchronous Supabase Client Testing

**NEVER use `AsyncMock` for Supabase client testing.**

**Why This Matters:**
- Supabase Python client is **synchronous** (`supabase-py`)
- AsyncMock returns coroutines that cause: `TypeError: 'coroutine' object is not iterable`
- Violates KISS principle - don't add async complexity where not needed

**Correct Approach:**
```python
# ✅ CORRECT - Use MagicMock for synchronous client
from unittest.mock import MagicMock

def test_supabase_service():
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.execute.return_value.data = [...]
    
# ❌ WRONG - Never use AsyncMock
from unittest.mock import AsyncMock  # Don't import this for Supabase
mock_client = AsyncMock()  # This will break
```

## Running Tests

### Complete Test Suite

```bash
# All tests with environment validation
./start_dev_simple.sh --test

# Backend tests only (33 tests)
cd backend
source venv/bin/activate
python -m pytest tests/ -v

# Frontend tests only (78 tests)
cd frontend
npm test -- --run

# Coverage reports
python -m pytest tests/ --cov=backend  # Backend: 62% EMG coverage
npm test -- --coverage                  # Frontend: React.StrictMode compatible
```

### Test Categories

#### Unit Tests (Core Algorithms)
```bash
python -m pytest tests/test_processor.py -v    # EMG processing
python -m pytest tests/test_algorithms.py -v   # Signal algorithms
python -m pytest tests/test_metrics.py -v      # Clinical metrics
```

#### API Tests (Endpoint Validation)
```bash
python -m pytest tests/test_api* -v            # All API tests (19)
python -m pytest tests/test_api_upload.py -v   # Upload endpoints
python -m pytest tests/test_api_auth.py -v     # Authentication
```

#### E2E Tests (Real Data)
```bash
python -m pytest tests/test_e2e* -v -s         # E2E with real C3D (3)
```

#### Frontend Tests
```bash
npm test hooks                                  # Hook tests only
npm test components                            # Component tests only
npm test -- --watch                           # Watch mode
```

## Test Data & Fixtures

### C3D Test Files
```
tests/fixtures/
├── sample.c3d           # Standard test file
├── complex.c3d          # Multi-channel EMG
├── minimal.c3d          # Edge case testing
└── corrupted.c3d       # Error handling
```

### Mock Data Patterns
```python
# Standard test patient
TEST_PATIENT = {
    "id": "test-patient-123",
    "patient_code": "P001",
    "therapist_id": "therapist-456"
}

# EMG test data
TEST_EMG_DATA = np.array([
    [0.1, 0.2, 0.3],  # Channel 1
    [0.4, 0.5, 0.6],  # Channel 2
])
```

## Test Architecture Patterns

### Repository Testing
```python
def test_repository_pattern():
    # Mock Supabase client (synchronous)
    mock_client = MagicMock()
    
    # Create repository with mock
    repo = TherapySessionRepository(mock_client)
    
    # Test CRUD operations
    result = repo.get_by_patient("patient-123")
    
    # Assert database calls
    mock_client.table.assert_called_with("therapy_sessions")
```

### Service Layer Testing
```python
def test_service_layer():
    # Mock dependencies
    mock_repo = MagicMock()
    mock_processor = MagicMock()
    
    # Create service
    service = TherapySessionService(mock_repo, mock_processor)
    
    # Test business logic
    result = service.process_session(test_data)
    
    # Verify orchestration
    assert mock_processor.process_c3d.called
    assert mock_repo.save.called
```

### API Endpoint Testing
```python
def test_api_endpoint():
    # Use TestClient for FastAPI
    response = client.post("/upload", files={"file": test_file})
    
    # Assert response
    assert response.status_code == 200
    assert "emg_analysis" in response.json()
```

## Quality Standards

### Test Coverage Requirements
- **Core EMG Processing**: >80% coverage required
- **API Endpoints**: 100% endpoint coverage
- **Critical Paths**: 100% E2E coverage
- **Frontend Components**: All user-facing components tested

### Performance Benchmarks
- Unit tests: `<100ms` per test
- Integration tests: `<500ms` per test
- E2E tests: `<5s` per test
- Full suite: `<60s` total

## Common Testing Patterns

### Testing with Real C3D Files
```python
def test_real_c3d_processing():
    # Load real test file
    test_file = "tests/fixtures/sample.c3d"
    
    # Process through actual pipeline
    processor = GHOSTLYC3DProcessor()
    results = processor.process_c3d(test_file)
    
    # Validate against known values
    assert len(results["contractions"]) == 5
    assert results["performance_score"] > 0.7
```

### Testing Webhook Processing
```python
def test_webhook_processing():
    # Mock webhook payload
    payload = {
        "record": {
            "name": "P001/test.c3d",
            "bucket_id": "c3d-examples"
        }
    }
    
    # Test webhook handler
    response = client.post("/webhooks/storage/c3d-upload", json=payload)
    
    # Verify background task queued
    assert response.status_code == 200
    assert response.json()["status"] == "processing"
```

## Continuous Integration

### GitHub Actions Configuration
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Backend Tests
        run: |
          cd backend
          pip install -r requirements.txt
          pytest tests/ -v
      - name: Frontend Tests
        run: |
          cd frontend
          npm ci
          npm test -- --run
```

## Test File Locations

- `backend/tests/` - All backend tests
- `backend/tests/fixtures/` - Test C3D files
- `frontend/src/tests/` - React component tests
- `frontend/src/hooks/__tests__/` - Hook tests
- `.github/workflows/test.yml` - CI configuration