# EMG C3D Analyzer - Test Suite

## Overview

Comprehensive test suite for the EMG C3D Analyzer application, covering health checks, integration tests, and deployment verification.

## Directory Structure

```
scripts/tests/
├── README.md                   # This file
├── run-all-tests.sh           # Main test runner
├── health/                    # Service health checks
│   ├── quick-health-check.sh # Quick API health verification
│   ├── backend-health.sh     # Backend service health
│   └── frontend-health.sh    # Frontend service health
├── integration/               # Integration tests
│   ├── verify-backend-connection.sh  # Backend connection test
│   ├── test-analysis-route.sh       # Analysis route testing
│   ├── test-api-endpoints.sh        # API endpoint integration
│   └── test-cors.sh                 # CORS configuration test
└── deployment/                # Deployment verification
    ├── verify-production.sh   # Production deployment check
    ├── test-env-config.sh     # Environment configuration
    └── test-build.sh          # Build process verification
```

## Quick Start

### Run All Tests
```bash
./scripts/tests/run-all-tests.sh
```

### Run Specific Category
```bash
# Health checks only
./scripts/tests/run-all-tests.sh health

# Integration tests only
./scripts/tests/run-all-tests.sh integration

# Deployment tests only
./scripts/tests/run-all-tests.sh deployment
```

### Run Individual Tests
```bash
# Quick health check
./scripts/tests/health/quick-health-check.sh

# Backend health
./scripts/tests/health/backend-health.sh

# API endpoints test
./scripts/tests/integration/test-api-endpoints.sh
```

## Test Categories

### 🏥 Health Tests
Quick verification that services are running and accessible.

- **quick-health-check.sh**: Rapid API connectivity test
- **backend-health.sh**: Backend service availability and endpoints
- **frontend-health.sh**: Frontend deployment and routes

### 🔗 Integration Tests
Verify communication between frontend and backend services.

- **verify-backend-connection.sh**: Frontend-to-backend connectivity
- **test-analysis-route.sh**: Analysis page functionality
- **test-api-endpoints.sh**: All API endpoints through proxy
- **test-cors.sh**: Cross-origin resource sharing configuration

### 📦 Deployment Tests
Ensure successful deployment and configuration.

- **verify-production.sh**: Complete production verification
- **test-env-config.sh**: Environment variable configuration
- **test-build.sh**: Build process and output validation

## Test Results

The test runner provides colored output:
- ✅ Green: Test passed
- ❌ Red: Test failed
- ⚠️ Yellow: Warning or partial success
- ⏭️ Blue: Test skipped

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed
- `2`: Configuration error

## Environment URLs

- **Frontend**: https://emg-c3d-analyzer.vercel.app
- **Backend**: https://emg-c3d-analyzer-backend.onrender.com

## Required Environment Variables

For full functionality, ensure these are set in Vercel:

```bash
VITE_API_URL=https://emg-c3d-analyzer-backend.onrender.com
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_STORAGE_BUCKET_NAME=c3d-examples
```

## Troubleshooting

### API Proxy Not Working
If API calls return 404:
1. Check vercel.json rewrites configuration
2. Verify VITE_API_URL environment variable
3. Redeploy after changes

### CORS Issues
If CORS errors occur:
1. Verify backend CORS configuration
2. Check allowed origins include frontend URL
3. Ensure credentials are allowed if using auth

### Build Failures
If builds fail:
1. Check TypeScript errors with `npx tsc --noEmit`
2. Verify all dependencies are installed
3. Check for path resolution issues in vite.config.ts

## Best Practices

1. **Run tests after deployment**: Wait 2-3 minutes after pushing changes
2. **Check all categories**: Use `run-all-tests.sh` for comprehensive verification
3. **Fix failures immediately**: Don't let failing tests accumulate
4. **Update tests**: When adding features, add corresponding tests

## Contributing

When adding new tests:
1. Place in appropriate category folder
2. Follow naming convention: `test-[feature].sh`
3. Include clear output messages
4. Use consistent exit codes (0=success, 1=failure)
5. Update this README with new test description