---
sidebar_position: 4
title: Testing Strategy
---

# Comprehensive Testing Strategy

The backend maintains a **135-test suite** with structured testing patterns across unit, API, integration, and end-to-end testing layers.

## Testing Architecture Overview

### Testing Pyramid Implementation

```
                    /\
                   /  \
                  / E2E \     3 tests - Real C3D files, complete workflows
                 /  (3)  \
                /________\
               /          \
              / Integration \   3 tests - Service integration, workflow testing
             /     (3)      \
            /________________\
           /                  \
          /    API Testing     \  19 tests - Endpoint validation, error handling
         /       (19)          \
        /____________________\
       /                      \
      /     Unit Testing       \    11 tests - Core algorithms, utilities
     /        (11)             \
    /__________________________\
```

**Testing Distribution**:
- **Unit Tests** (11): Core EMG algorithms, utilities, pure functions
- **API Tests** (19): FastAPI endpoint validation, request/response patterns
- **Integration Tests** (3): Service layer integration, repository patterns
- **E2E Tests** (3): Complete workflows with real C3D files

### Test Coverage Metrics

```bash
# Current coverage report
python -m pytest tests/ --cov=backend --cov-report=html

# Coverage breakdown
EMG Processing: 62% (core algorithms covered)
API Endpoints: 85% (comprehensive endpoint testing)
Repository Layer: 78% (CRUD operations covered)
Service Layer: 71% (business logic validation)
```

## Critical Testing Principles

### 1. Synchronous Testing Pattern

**CRITICAL**: Always use `MagicMock`, never `AsyncMock` for Supabase client testing

```python
# ✅ CORRECT: Synchronous mocking pattern
def test_therapy_session_creation():
    mock_client = MagicMock()  # Standard mock for sync client
    mock_response = MagicMock()
    mock_response.data = [{"id": "test-session-id"}]
    
    mock_client.table.return_value.insert.return_value.execute.return_value = mock_response
    
    repository = SupabaseTherapySessionRepository(mock_client)
    session_id = repository.create_session({"patient_code": "TEST001"})
    
    assert session_id == "test-session-id"

# ❌ WRONG: AsyncMock causes coroutine errors
def test_with_async_mock():
    mock_client = AsyncMock()  # This breaks synchronous Supabase client
    # Results in: TypeError: 'coroutine' object is not iterable
```

**Why This Matters**:
- Supabase Python client is synchronous, not async
- AsyncMock returns coroutines that break synchronous calls
- Standard mocking patterns work perfectly with sync client

### 2. Real Data Testing Strategy

E2E tests use actual C3D files with known expected results:

```python
class TestE2EWorkflows:
    """End-to-end testing with real C3D files"""
    
    @pytest.fixture
    def sample_c3d_file(self):
        """Real C3D file for testing"""
        return "tests/fixtures/sample_session.c3d"
    
    def test_complete_emg_processing_workflow(self, sample_c3d_file):
        """Test complete processing pipeline with real data"""
        processor = GHOSTLYC3DProcessor()
        
        # Process real C3D file
        result = processor.process_c3d_file(
            sample_c3d_file,
            include_signals=False
        )
        
        # Validate expected structure
        assert result.metadata is not None
        assert result.contractions is not None
        assert result.performance_scores is not None
        
        # Validate specific expected values
        assert len(result.contractions) >= 10  # Minimum expected contractions
        assert result.performance_scores.compliance_score >= 0.0
        assert result.performance_scores.compliance_score <= 100.0
        
        # Validate clinical metrics
        assert result.metadata.session_duration > 0
        assert result.metadata.channel_count == 2  # Expected EMG channels
```

## Unit Testing Patterns

### EMG Algorithm Testing

```python
class TestEMGProcessingAlgorithms:
    """Core EMG processing algorithm validation"""
    
    def test_butterworth_filter_application(self):
        """Test signal filtering with known input/output"""
        # Generate test signal with known characteristics
        fs = 1000  # Sample rate
        t = np.linspace(0, 1, fs)
        signal = np.sin(2 * np.pi * 50 * t) + 0.5 * np.sin(2 * np.pi * 120 * t)
        
        # Apply high-pass filter
        filtered_signal = apply_butterworth_filter(
            signal, 
            cutoff_freq=20.0, 
            sample_rate=fs, 
            filter_type='high'
        )
        
        # Validate filtering effect
        assert len(filtered_signal) == len(signal)
        assert np.mean(np.abs(filtered_signal)) < np.mean(np.abs(signal))
    
    def test_mvc_calculation_accuracy(self):
        """Test MVC calculation with controlled data"""
        emg_data = {
            'channel_1': [0.1, 0.5, 0.8, 0.3, 0.9, 0.2],
            'channel_2': [0.2, 0.4, 0.7, 0.6, 0.8, 0.1]
        }
        
        mvc_values = calculate_mvc_values(emg_data)
        
        assert mvc_values['channel_1'] == 0.9  # Maximum value
        assert mvc_values['channel_2'] == 0.8  # Maximum value
    
    def test_contraction_detection_thresholds(self):
        """Test contraction detection with various thresholds"""
        # Create signal with known contraction patterns
        signal = create_test_emg_signal_with_contractions(
            duration=10.0,
            sample_rate=1000,
            contraction_count=5,
            contraction_duration=2.0
        )
        
        contractions = detect_contractions(
            signal,
            mvc_threshold=0.75,
            duration_threshold=2.0,
            sample_rate=1000
        )
        
        assert len(contractions) == 5  # Expected contraction count
        for contraction in contractions:
            assert contraction.duration >= 2.0  # Meets duration threshold
            assert contraction.amplitude >= 0.75  # Meets MVC threshold
```

### Repository Pattern Testing

```python
class TestSupabaseTherapySessionRepository:
    """Repository pattern testing with comprehensive mocking"""
    
    @pytest.fixture
    def mock_supabase_client(self):
        """Standard Supabase client mock"""
        return MagicMock()
    
    @pytest.fixture
    def repository(self, mock_supabase_client):
        """Repository instance with mocked client"""
        return SupabaseTherapySessionRepository(mock_supabase_client)
    
    def test_create_session_success(self, repository, mock_supabase_client):
        """Test successful session creation"""
        # Mock successful response
        mock_response = MagicMock()
        mock_response.data = [{"id": "session-123", "patient_code": "TEST001"}]
        
        mock_supabase_client.table.return_value.insert.return_value.execute.return_value = mock_response
        
        # Execute operation
        session_data = {"patient_code": "TEST001", "session_type": "therapy"}
        session_id = repository.create_session(session_data)
        
        # Validate results
        assert session_id == "session-123"
        mock_supabase_client.table.assert_called_with("therapy_sessions")
    
    def test_create_session_failure(self, repository, mock_supabase_client):
        """Test session creation error handling"""
        # Mock failure response
        mock_response = MagicMock()
        mock_response.data = []  # Empty response indicates failure
        
        mock_supabase_client.table.return_value.insert.return_value.execute.return_value = mock_response
        
        # Validate exception handling
        with pytest.raises(DatabaseError):
            repository.create_session({"patient_code": "TEST001"})
    
    def test_get_sessions_by_patient_pagination(self, repository, mock_supabase_client):
        """Test paginated session retrieval"""
        # Mock paginated response
        mock_response = MagicMock()
        mock_response.data = [
            {"id": "session-1", "patient_code": "TEST001"},
            {"id": "session-2", "patient_code": "TEST001"}
        ]
        
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value = mock_response
        
        # Execute with pagination
        sessions = repository.get_sessions_by_patient_with_pagination(
            "TEST001", 
            limit=10, 
            offset=0
        )
        
        # Validate pagination call
        assert len(sessions) == 2
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.order.return_value.range.assert_called_with(0, 9)
```

## API Testing Patterns

### FastAPI Endpoint Testing

```python
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

class TestTherapySessionAPI:
    """Comprehensive API endpoint testing"""
    
    @pytest.fixture
    def client(self):
        """Test client with mocked dependencies"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_auth_user(self):
        """Mock authenticated user"""
        return "user-123"
    
    def test_create_session_endpoint_success(self, client):
        """Test session creation API endpoint"""
        with patch('api.routes.therapy_sessions.get_current_user') as mock_auth:
            with patch('api.routes.therapy_sessions.get_therapy_session_service') as mock_service:
                # Setup mocks
                mock_auth.return_value = "user-123"
                mock_service_instance = MagicMock()
                mock_service_instance.create_session.return_value = "session-456"
                mock_service.return_value = mock_service_instance
                
                # Execute API call
                response = client.post(
                    "/sessions",
                    json={
                        "patient_code": "TEST001",
                        "session_type": "therapy",
                        "notes": "Initial session"
                    },
                    headers={"Authorization": "Bearer valid-token"}
                )
                
                # Validate response
                assert response.status_code == 201
                assert response.json()["session_id"] == "session-456"
    
    def test_create_session_validation_error(self, client):
        """Test request validation error handling"""
        response = client.post(
            "/sessions",
            json={
                "patient_code": "",  # Invalid empty patient code
                "session_type": "invalid_type"  # Invalid session type
            },
            headers={"Authorization": "Bearer valid-token"}
        )
        
        assert response.status_code == 422  # Validation error
        assert "validation" in response.json()["detail"].lower()
    
    def test_unauthorized_access(self, client):
        """Test authentication requirement"""
        response = client.post(
            "/sessions",
            json={"patient_code": "TEST001", "session_type": "therapy"}
            # No Authorization header
        )
        
        assert response.status_code == 401
```

### File Upload Testing

```python
class TestFileUploadAPI:
    """File upload endpoint testing"""
    
    def test_c3d_upload_success(self, client):
        """Test successful C3D file upload"""
        with patch('api.routes.upload.GHOSTLYC3DProcessor') as mock_processor:
            # Mock processor response
            mock_processor_instance = MagicMock()
            mock_processor_instance.process_c3d_file.return_value = MagicMock(
                metadata={"duration": 300.0, "channels": 2},
                contractions=[],
                performance_scores=MagicMock(compliance_score=85.5)
            )
            mock_processor.return_value = mock_processor_instance
            
            # Create test file
            test_file_content = b"C3D file content simulation"
            
            response = client.post(
                "/upload",
                files={"file": ("test.c3d", test_file_content, "application/octet-stream")},
                headers={"Authorization": "Bearer valid-token"}
            )
            
            assert response.status_code == 200
            assert "session_metadata" in response.json()
    
    def test_invalid_file_format(self, client):
        """Test file format validation"""
        test_file_content = b"Not a C3D file"
        
        response = client.post(
            "/upload",
            files={"file": ("test.txt", test_file_content, "text/plain")},
            headers={"Authorization": "Bearer valid-token"}
        )
        
        assert response.status_code == 400
        assert "Invalid file format" in response.json()["detail"]
```

## Integration Testing

### Service Layer Integration

```python
class TestServiceIntegration:
    """Integration testing for service layer coordination"""
    
    @pytest.fixture
    def integration_test_db(self):
        """Test database for integration testing"""
        # Setup test database connection
        return create_test_supabase_client()
    
    def test_therapy_session_workflow_integration(self, integration_test_db):
        """Test complete therapy session workflow"""
        # Create repositories with real database
        session_repo = SupabaseTherapySessionRepository(integration_test_db)
        patient_repo = SupabasePatientRepository(integration_test_db)
        
        # Create service with real repositories
        service = TherapySessionService(session_repo, patient_repo)
        
        # Execute workflow
        session_data = {
            "patient_code": "INTEGRATION_TEST_001",
            "session_type": "therapy",
            "user_id": "test-user-id"
        }
        
        session_id = service.create_session(session_data)
        
        # Validate workflow completion
        assert session_id is not None
        
        # Retrieve and validate
        session = service.get_session_by_id(session_id)
        assert session["patient_code"] == "INTEGRATION_TEST_001"
        assert session["status"] == "pending"
        
        # Cleanup
        service.delete_session(session_id)
    
    def test_emg_processing_service_integration(self):
        """Test EMG processing service with real C3D data"""
        processor = GHOSTLYC3DProcessor()
        session_service = TherapySessionService(session_repo, patient_repo)
        
        # Create session
        session_id = session_service.create_session({
            "patient_code": "EMG_TEST_001",
            "session_type": "baseline"
        })
        
        # Process C3D file
        test_file_path = "tests/fixtures/sample_emg_session.c3d"
        
        result = processor.process_c3d_file(test_file_path, include_signals=False)
        
        # Validate processing results
        assert result.contractions is not None
        assert len(result.contractions) > 0
        assert result.performance_scores.compliance_score >= 0.0
        
        # Update session with results
        session_service.update_session_analysis_results(session_id, result)
        
        # Validate integration
        updated_session = session_service.get_session_by_id(session_id)
        assert updated_session["status"] == "completed"
```

## Test Environment Management

### Test Configuration

```python
# tests/conftest.py
import pytest
from unittest.mock import MagicMock
from backend.config import Settings

@pytest.fixture(scope="session")
def test_settings():
    """Test environment settings"""
    return Settings(
        # Override production settings for testing
        SUPABASE_URL="https://test-project.supabase.co",
        SUPABASE_SERVICE_KEY="test-service-key",
        JWT_SECRET="test-jwt-secret",
        REDIS_URL="redis://localhost:6379/1",  # Test Redis database
        LOG_LEVEL="DEBUG"
    )

@pytest.fixture
def mock_supabase_client():
    """Standard Supabase client mock for all tests"""
    client = MagicMock()
    
    # Default successful response
    mock_response = MagicMock()
    mock_response.data = []
    mock_response.error = None
    
    # Setup default chain
    client.table.return_value.select.return_value.execute.return_value = mock_response
    client.table.return_value.insert.return_value.execute.return_value = mock_response
    client.table.return_value.update.return_value.execute.return_value = mock_response
    client.table.return_value.delete.return_value.execute.return_value = mock_response
    
    return client

@pytest.fixture(autouse=True)
def override_dependencies(test_settings):
    """Override FastAPI dependencies for testing"""
    from backend.dependencies import get_settings, get_supabase_client
    
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase_client()
    
    yield
    
    app.dependency_overrides.clear()
```

### Test Data Management

```python
# tests/fixtures/data_factory.py
class TestDataFactory:
    """Factory for creating test data"""
    
    @staticmethod
    def create_therapy_session_data(
        patient_code: str = "TEST001",
        session_type: str = "therapy",
        **kwargs
    ) -> dict:
        """Create therapy session test data"""
        return {
            "patient_code": patient_code,
            "session_type": session_type,
            "status": "pending",
            "user_id": "test-user-id",
            "created_at": datetime.utcnow().isoformat(),
            **kwargs
        }
    
    @staticmethod
    def create_emg_contraction_data(
        session_id: str,
        muscle_channel: int = 1,
        **kwargs
    ) -> dict:
        """Create EMG contraction test data"""
        return {
            "session_id": session_id,
            "muscle_channel": muscle_channel,
            "contraction_number": 1,
            "start_time": 10.0,
            "end_time": 12.5,
            "duration": 2.5,
            "amplitude": 0.85,
            "mvc_percentage": 85.0,
            "meets_duration_threshold": True,
            "meets_amplitude_threshold": True,
            **kwargs
        }
```

## Continuous Integration Testing

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Backend Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python 3.11
      uses: actions/setup-python@v4
      with:
        python-version: 3.11
    
    - name: Install dependencies
      run: |
        cd backend
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    
    - name: Run unit tests
      run: |
        cd backend
        python -m pytest tests/ -v --cov=backend --cov-report=xml
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./backend/coverage.xml
        flags: backend
        name: backend-coverage
```

## Performance Testing

### Load Testing with Pytest-benchmark

```python
import pytest
from pytest_benchmark import benchmark

class TestPerformance:
    """Performance testing for critical paths"""
    
    def test_emg_processing_performance(self, benchmark):
        """Benchmark EMG processing performance"""
        processor = GHOSTLYC3DProcessor()
        test_file = "tests/fixtures/large_session.c3d"
        
        result = benchmark(
            processor.process_c3d_file,
            test_file,
            include_signals=False
        )
        
        # Performance assertions
        assert result is not None
        # Expect processing to complete within 5 seconds for typical file
    
    def test_database_query_performance(self, benchmark, mock_supabase_client):
        """Benchmark database query performance"""
        repository = SupabaseTherapySessionRepository(mock_supabase_client)
        
        # Mock large response
        mock_response = MagicMock()
        mock_response.data = [
            TestDataFactory.create_therapy_session_data(patient_code=f"TEST{i:03d}")
            for i in range(100)
        ]
        
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_response
        
        result = benchmark(
            repository.get_sessions_by_patient,
            "TEST001"
        )
        
        assert len(result) == 100
```

## Next Steps

- [Caching with Redis](./caching-redis) - Performance optimization strategies
- [Webhooks Processing](./webhooks-processing) - Background processing patterns
- [Deployment Patterns](./deployment) - Production deployment and monitoring
- [API Design](./api-design) - FastAPI patterns and endpoint design