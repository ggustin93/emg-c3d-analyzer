# GHOSTLY+ EMG Analyzer Testing

This directory contains tests for the GHOSTLY+ EMG Analyzer backend.

## Test Philosophy

The tests are designed to align with the stateless architecture outlined in `todo.md`. This means we focus on two primary areas:

1.  **Unit/Integration tests for the core processing logic**: Verifying that the `emg_analysis` and `processor` modules correctly calculate all required metrics from a C3D file.
2.  **API Integration tests for the `/upload` endpoint**: Ensuring the API correctly processes an uploaded file and returns a single, comprehensive JSON response containing all data needed by the frontend.

Tests for stateful endpoints have been removed as they will be deprecated in the new architecture.

## Test Results

✅ **All 45 tests passing** - Last run: August 12, 2025
- 15 core backend tests
- 30 webhook tests (18 validation + 12 integration)
- 0 failures, 0 errors
- Only deprecation warnings (external dependencies)

## Available Tests

### Core Tests (15 tests)
1. **test_emg_analysis.py** - Unit tests for the core EMG analysis functions (6 tests)
2. **test_processor.py** - Integration tests for the GHOSTLYC3DProcessor class (4 tests)
3. **test_contraction_flags.py** - Tests for contraction validation flags (3 tests)
4. **test_serialization.py** - Tests for numpy JSON serialization fixes (2 tests)
5. **debug_emg_analysis.py** - Standalone debugging script for EMG analysis functions with sample data

### Webhook Tests (30 tests)
6. **webhook/** - Complete webhook testing suite (see webhook/README.md for details)
   - **test_webhook_validation.py** - Webhook payload validation tests (18 tests)
   - **test_integration_webhook.py** - Full webhook integration testing (12 tests)
   - Automated testing with database verification
   - ngrok tunnel integration testing
   - Real-time webhook monitoring utilities

## Running the Tests

### Quick Test Commands

```bash
# Run all tests (recommended)
cd backend
python -m pytest tests/ -v

# Run core tests only (excludes webhook tests)
python -m pytest tests/ -v --ignore=tests/webhook

# Run webhook tests only
python -m pytest tests/webhook/ -v

# Run specific test file
python -m pytest tests/test_emg_analysis.py -v

# Run with coverage
python -m pytest tests/ --cov=backend --cov-report=html
```

### Legacy Test Runner (if available)

```bash
# Run all tests using shell script
./run_tests.sh

# Run tests in verbose mode
./run_tests.sh -v

# Install dependencies before running tests
./run_tests.sh -i
```

### Running Individual Test Categories

```bash
# EMG analysis tests
python -m pytest tests/test_emg_analysis.py -v

# C3D processor tests  
python -m pytest tests/test_processor.py -v

# Webhook validation tests
python -m pytest tests/webhook/test_webhook_validation.py -v

# Webhook integration tests
python -m pytest tests/webhook/test_integration_webhook.py -v
```

### Prerequisites

- Python 3.10+
- Required packages:
  - fastapi
  - pydantic
  - numpy
  - scipy
  - ezc3d
  - httpx (for API testing)
- Sample C3D files (for integration tests)

## Test Data

The tests use synthetic data generated within the test files themselves. For integration tests that require C3D files, please place sample files in the appropriate test data directory.

## Frontend Tests

The frontend tests are located in `