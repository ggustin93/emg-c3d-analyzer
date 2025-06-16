# GHOSTLY+ API Testing

This directory contains tests for the GHOSTLY+ API.

## Available Tests

1. **test_api.py** - Tests all API endpoints with a C3D file
2. **test_upload.py** - Tests specifically the upload endpoint with a C3D file

## Running the Tests

### Prerequisites

- Python 3.10+
- The backend server running (on port 8080 by default)
- Sample C3D files (available in `frontend/public/samples/`)

### Running the API Test

```bash
# From the project root directory
cd backend/tests
python test_api.py --url http://localhost:8080 --file ../../frontend/public/samples/Ghostly_Emg_20230321_17-23-09-0409.c3d
```

### Running the Upload Test

```bash
# From the project root directory
cd backend/tests
python test_upload.py --url http://localhost:8080 --file ../../frontend/public/samples/Ghostly_Emg_20230321_17-23-09-0409.c3d
```

## Frontend Tests

The frontend tests are located in `frontend/src/tests/` and can be run with Playwright:

```bash
# From the project root directory
cd frontend
npm install @playwright/test
npx playwright install
npm run test:e2e
```

## Troubleshooting

If you encounter issues with the tests:

1. Make sure the backend server is running on the correct port
2. Check that the C3D files are accessible
3. Verify that the API endpoints are working by manually testing them with curl or Postman 