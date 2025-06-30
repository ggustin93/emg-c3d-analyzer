# GHOSTLY+ EMG Analyzer Testing

This directory contains tests for the GHOSTLY+ EMG Analyzer backend.

## Test Philosophy

The tests are designed to align with the stateless architecture outlined in `todo.md`. This means we focus on two primary areas:

1.  **Unit/Integration tests for the core processing logic**: Verifying that the `emg_analysis` and `processor` modules correctly calculate all required metrics from a C3D file.
2.  **API Integration tests for the `/upload` endpoint**: Ensuring the API correctly processes an uploaded file and returns a single, comprehensive JSON response containing all data needed by the frontend.

Tests for stateful endpoints have been removed as they will be deprecated in the new architecture.

## Available Tests

1. **test_emg_analysis.py** - Unit tests for the core EMG analysis functions
2. **test_processor.py** - Integration tests for the GHOSTLYC3DProcessor class
3. **test_api_integration.py** - Comprehensive API integration tests using FastAPI's TestClient
4. **debug_emg_analysis.py** - Standalone debugging script for EMG analysis functions with sample data

## Running the Tests

### Using the Test Runner Script

The easiest way to run tests is to use the provided shell script:

```bash
# Run all tests
./run_tests.sh

# Run tests in verbose mode
./run_tests.sh -v

# Install dependencies before running tests
./run_tests.sh -i

# Install dependencies and run in verbose mode
./run_tests.sh -i -v
```

The script handles:
- Setting up the Python path correctly
- Installing required dependencies (with `-i` flag)
- Running all tests with proper configuration

### Manual Test Execution

If you prefer to run tests manually:

```bash
# From the project root directory
export PYTHONPATH=/path/to/emg-c3d-analyzer:$PYTHONPATH
cd backend/tests
python run_tests.py [--verbose]

# Or run individual test files
python -m unittest test_emg_analysis.py
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