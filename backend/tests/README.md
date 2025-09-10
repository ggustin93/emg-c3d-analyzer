# Backend Test Suite Architecture

This document describes the comprehensive test architecture for the EMG C3D Analyzer backend, focusing on reliable sample file management and robust testing patterns.

## 🎯 Architectural Overview

### Test Hierarchy

```
tests/
├── conftest.py                 # Central configuration & fixtures
├── unit/                       # Unit tests (fast, isolated)
│   ├── c3d/                   # C3D processing tests
│   ├── clinical/              # Clinical logic tests
│   └── services/              # Service layer tests
├── integration/               # Integration tests (database, APIs)
│   └── clinical/              # End-to-end clinical workflows
├── e2e/                       # End-to-end tests (complete workflows)
│   ├── test_webhook_*.py      # Webhook integration tests
│   └── test_e2e_*.py          # Complete user workflows
└── samples/                   # C3D sample files for testing
    └── Ghostly_Emg_*.c3d      # Real GHOSTLY trial data
```

## 🔧 Sample File Management Architecture

### Problem Solved

The previous test architecture suffered from unreliable access to C3D sample files:
- Files would get deleted during test runs
- Inconsistent path resolution across different test types
- No centralized management of test assets
- Tests failing due to missing sample files

### Solution: Centralized TestSampleManager

```python
from conftest import TestSampleManager

# Automatically ensures sample file exists
sample_path = TestSampleManager.ensure_sample_file_exists()
```

#### Key Features

1. **Automatic Fallback Resolution**: Searches multiple locations for sample files
2. **Copy-on-Demand**: Copies files from available locations to primary test location
3. **Path Consistency**: Provides consistent absolute paths across all test types
4. **Validation**: Validates file existence and readability before use

#### Fallback Location Priority

1. `frontend/public/samples/` (most reliable - served by web server)
2. `frontend/src/tests/samples/` (development samples)
3. `frontend/build/samples/` (built assets)
4. `backend/tests/samples/` (primary test location)

### Integration Patterns

#### Unit Tests
```python
@classmethod
def setUpClass(cls):
    """Setup with centralized sample management."""
    try:
        from conftest import TestSampleManager
        cls.sample_file = TestSampleManager.ensure_sample_file_exists()
    except ImportError:
        # Fallback for standalone execution
        cls.sample_file = Path(...) / "samples" / "file.c3d"
```

#### Integration Tests
```python
def test_webhook_processing(self):
    """Test with reliable sample file access."""
    from conftest import TestSampleManager
    sample_path = TestSampleManager.ensure_sample_file_exists()
    
    # Mock download to return actual sample
    mock_download.return_value = str(sample_path)
```

#### Pytest Fixtures
```python
@pytest.fixture
def sample_c3d_file() -> Path:
    """Fixture providing guaranteed sample file access."""
    return TestSampleManager.ensure_sample_file_exists()
```

## 🧪 Test Execution Patterns

### Running Tests

```bash
# All tests with sample validation
python -m pytest tests/

# Specific test categories
python -m pytest tests/unit/c3d/ -v        # C3D processing tests
python -m pytest tests/integration/ -v      # Integration tests
python -m pytest tests/e2e/ -v             # End-to-end tests

# Real-time monitoring
python -m pytest tests/ -v -s --tb=short
```

### Test Configuration

The `pytest_configure` hook in `conftest.py` validates sample file availability before running any tests:

```python
def pytest_configure(config):
    """Validate test setup before execution."""
    try:
        TestSampleManager.ensure_sample_file_exists()
        print("✅ Test configuration validated - sample file available")
    except FileNotFoundError as e:
        pytest.exit(f"❌ Test configuration failed: {e}")
```

## 📊 Test Categories & Markers

### Automatic Test Markers

Tests are automatically marked based on their location:

- `@pytest.mark.unit` - Unit tests in `tests/unit/`
- `@pytest.mark.integration` - Integration tests in `tests/integration/`
- `@pytest.mark.e2e` - End-to-end tests in `tests/e2e/`
- `@pytest.mark.webhook` - Webhook-related tests
- `@pytest.mark.c3d` - C3D processing tests
- `@pytest.mark.clinical` - Clinical workflow tests

### Running by Category

```bash
# Run only unit tests
python -m pytest -m "unit" -v

# Run only C3D-related tests
python -m pytest -m "c3d" -v

# Run integration and E2E tests
python -m pytest -m "integration or e2e" -v
```

## 🧹 Cleanup & Resource Management

### Automatic Cleanup Fixtures

```python
def test_with_cleanup(auto_cleanup_test_artifacts):
    """Test with automatic resource cleanup."""
    files_to_cleanup, sessions_to_cleanup = auto_cleanup_test_artifacts
    
    # Test creates files in Supabase Storage
    files_to_cleanup.append("c3d-examples/test.c3d")
    
    # Test creates database records
    sessions_to_cleanup.append(session_id)
    
    # Cleanup happens automatically after test
```

### Cleanup Scope

- **Supabase Storage**: Removes test files from storage buckets
- **Database Records**: Cascading deletion of test session data
- **Temporary Files**: Local temporary files and directories

## 🔒 Security & Isolation

### Test Isolation

- Unique identifiers for all test artifacts
- Separate test data from production data
- Automatic cleanup prevents test pollution
- Mocked external dependencies

### Sample File Protection

- Sample files are copied, not moved
- Original sample files remain untouched
- Centralized management prevents accidental deletion
- Version control tracks sample file integrity

## 📈 Performance Considerations

### Optimization Patterns

1. **Lazy Loading**: Sample files loaded only when needed
2. **Caching**: File paths cached during test session
3. **Parallel Execution**: Tests designed for parallel execution
4. **Resource Pooling**: Shared fixtures reduce setup time

### Benchmark Results

- Sample file resolution: <50ms
- Unit test execution: ~7 tests in 0.07s
- Integration test setup: ~500ms per test
- Full test suite: ~3-5 minutes

## 🛠️ Development Guidelines

### Adding New Tests

1. **Unit Tests**: Add to appropriate `tests/unit/` subdirectory
2. **Integration Tests**: Add to `tests/integration/` with cleanup fixtures
3. **E2E Tests**: Add to `tests/e2e/` with comprehensive workflow validation

### Sample File Usage

```python
# ✅ Correct: Use centralized manager
from conftest import TestSampleManager
sample_path = TestSampleManager.ensure_sample_file_exists()

# ❌ Incorrect: Hardcoded paths
sample_path = Path("/hardcoded/path/to/sample.c3d")

# ❌ Incorrect: No validation
sample_path = Path("samples/file.c3d")  # May not exist
```

### Mock Patterns

```python
# ✅ Correct: Mock external dependencies
@patch('services.therapy_processor.download_from_storage')
def test_processing(mock_download):
    mock_download.return_value = str(sample_path)

# ✅ Correct: Use realistic test data
mock_processor.return_value.process_file.return_value = {
    "success": True,
    "analytics": {"CH1": {"compliance_rate": 0.85}}
}
```

## 🚀 Troubleshooting

### Common Issues

#### Sample File Not Found
```bash
❌ Test configuration failed: Sample file not found in any location
```
**Solution**: Ensure sample files exist in one of the fallback locations, typically `frontend/public/samples/`

#### Import Errors
```bash
ModuleNotFoundError: No module named 'conftest'
```
**Solution**: Add tests directory to Python path:
```python
tests_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(tests_dir))
from conftest import TestSampleManager
```

#### Test Isolation Issues
```bash
Test pollution: Previous test data affecting current test
```
**Solution**: Use cleanup fixtures consistently:
```python
def test_something(auto_cleanup_test_artifacts):
    files, sessions = auto_cleanup_test_artifacts
    # Track all created resources
```

### Debug Commands

```bash
# Validate sample file availability
python -c "from tests.conftest import TestSampleManager; print(TestSampleManager.ensure_sample_file_exists())"

# Check test discovery
python -m pytest --collect-only tests/

# Run with maximum verbosity
python -m pytest tests/ -vvv --tb=long
```

## 📚 Related Documentation

- **C3D Processing**: `services/c3d/README.md`
- **Clinical Workflows**: `services/clinical/README.md`
- **Database Schema**: `memory-bank/architecture/remote-schema.sql`
- **API Documentation**: `api/README.md`

---

## Summary

This test architecture provides:

✅ **Reliability**: Guaranteed sample file access across all test types  
✅ **Isolation**: Proper test isolation with automatic cleanup  
✅ **Performance**: Optimized for fast execution and parallel testing  
✅ **Maintainability**: Centralized configuration and consistent patterns  
✅ **Scalability**: Easy to add new tests and extend functionality  

The centralized sample file management eliminates the root cause of test failures and provides a solid foundation for reliable testing of the EMG C3D analysis pipeline.