#!/bin/bash

# Test script to validate CI/CD pipeline fixes
# Simulates the GitHub Actions integration test environment

set -e  # Exit on any error

echo "🧪 Testing GitHub Actions CI/CD Pipeline Fixes"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    local test_name="$1"
    local result="$2"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✅ $test_name: PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        ((TESTS_FAILED++))
    fi
}

echo "🔍 Test 1: Backend Directory Structure"
cd backend
if [ -f "api/main.py" ] && [ -f "main.py" ] && [ -f "config.py" ]; then
    test_result "Backend structure verification" "PASS"
else
    test_result "Backend structure verification" "FAIL"
fi

echo ""
echo "🔍 Test 2: Python Environment and Dependencies"
# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "📦 Using existing virtual environment..."
    source venv/bin/activate
else
    echo "📦 Creating temporary virtual environment for testing..."
    python3 -m venv test_venv
    source test_venv/bin/activate
    pip install --upgrade pip > /dev/null 2>&1
    pip install -r requirements.txt > /dev/null 2>&1
fi

# Test critical dependencies (same as CI workflow)
echo "Checking critical dependencies..."
python -c "
import sys
critical_deps = [
    ('fastapi', 'FastAPI web framework'),
    ('uvicorn', 'ASGI server'),  
    ('ezc3d', 'C3D file processing'),
    ('pydantic', 'Data validation'),
    ('numpy', 'Numerical computing'),
    ('structlog', 'Structured logging')
]

missing_deps = []
for dep, desc in critical_deps:
    try:
        __import__(dep)
        print(f'✅ {dep}: {desc}')
    except ImportError as e:
        print(f'❌ {dep}: {desc} - MISSING ({e})')
        missing_deps.append(dep)

if missing_deps:
    print(f'💥 Missing critical dependencies: {missing_deps}')
    sys.exit(1)
else:
    print('🎉 All critical dependencies are available')
"

if [ $? -eq 0 ]; then
    test_result "Dependency verification" "PASS"
else
    test_result "Dependency verification" "FAIL"
fi

echo ""
echo "🔍 Test 3: Backend Import Validation (CI Simulation)"
# Test the exact import logic from our CI fix
python -c "
import sys
import os

# Add current directory to Python path for imports (same as CI)
sys.path.insert(0, os.getcwd())

try:
    print('Testing basic imports...')
    import fastapi
    print(f'✅ FastAPI {fastapi.__version__} imported')
    
    import uvicorn  
    print(f'✅ Uvicorn {uvicorn.__version__} imported')
    
    print('Testing application imports...')
    from api.main import app
    print('✅ Backend application imported successfully')
    
    # Test if the app is a FastAPI instance
    if isinstance(app, fastapi.FastAPI):
        print('✅ App is a valid FastAPI instance')
    else:
        print(f'❌ App is not a FastAPI instance: {type(app)}')
        exit(1)
        
except Exception as e:
    print(f'❌ Backend import failed: {e}')
    import traceback
    traceback.print_exc()
    exit(1)
"

if [ $? -eq 0 ]; then
    test_result "Backend import validation" "PASS"
else
    test_result "Backend import validation" "FAIL"
fi

echo ""
echo "🔍 Test 4: Server Startup Simulation"
# Set environment variables like CI
export PYTHONPATH="$(pwd)"
export HOST="0.0.0.0"
export PORT="8081"  # Use different port to avoid conflicts
export LOG_LEVEL="debug"

# Check if port is available
if netstat -tuln 2>/dev/null | grep -q ":8081 "; then
    echo "⚠️  Port 8081 is already in use, trying to free it..."
    lsof -ti:8081 | xargs kill -9 2>/dev/null || echo "No processes to kill on port 8081"
    sleep 2
fi

echo "🚀 Starting backend server on port 8081..."
echo "Command: python -m uvicorn api.main:app --host 0.0.0.0 --port 8081 --log-level debug"

# Start server in background (like CI)
python -m uvicorn api.main:app --host 0.0.0.0 --port 8081 --log-level debug > /tmp/test_backend.log 2>&1 &
backend_pid=$!
echo "Backend PID: $backend_pid"

# Wait a moment for startup
sleep 3

# Check if process is still running
if kill -0 $backend_pid 2>/dev/null; then
    echo "✅ Backend process is running"
    server_startup="PASS"
else
    echo "❌ Backend process failed to start"
    echo "Logs:"
    cat /tmp/test_backend.log 2>/dev/null || echo "No logs available"
    server_startup="FAIL"
fi

test_result "Server startup simulation" "$server_startup"

echo ""
echo "🔍 Test 5: Health Check Simulation"
if [ "$server_startup" = "PASS" ]; then
    echo "Testing health check endpoint..."
    
    # Simulate the CI health check logic
    health_check_passed=false
    for attempt in {1..10}; do
        echo "Health check attempt $attempt/10..."
        
        # Check if port is listening
        if netstat -tuln 2>/dev/null | grep -q ":8081 "; then
            echo "✅ Port 8081 is listening"
        else
            echo "⚠️  Port 8081 is not listening yet"
        fi
        
        # Try health check
        if curl -f -s -m 5 http://localhost:8081/health; then
            echo ""
            echo "🎉 Health check successful!"
            health_check_passed=true
            break
        else
            echo "❌ Health check failed, retrying..."
            if [ $attempt -eq 10 ]; then
                echo "Health check failed after 10 attempts"
                echo "Backend logs:"
                tail -20 /tmp/test_backend.log 2>/dev/null || echo "No logs available"
            fi
        fi
        
        sleep 2
    done
    
    if [ "$health_check_passed" = true ]; then
        test_result "Health check simulation" "PASS"
    else
        test_result "Health check simulation" "FAIL"
    fi
else
    echo "Skipping health check - server startup failed"
    test_result "Health check simulation" "SKIP"
fi

echo ""
echo "🔍 Test 6: API Endpoint Test"
if [ "$health_check_passed" = true ]; then
    echo "Testing root API endpoint..."
    if curl -f -s http://localhost:8081/ | grep -q "GHOSTLY"; then
        echo "✅ Root endpoint returns expected content"
        test_result "API endpoint test" "PASS"
    else
        echo "❌ Root endpoint test failed"
        test_result "API endpoint test" "FAIL"
    fi
else
    echo "Skipping API test - health check failed"
    test_result "API endpoint test" "SKIP"
fi

echo ""
echo "🛑 Cleanup"
# Stop the test server
if [ -n "$backend_pid" ] && kill -0 $backend_pid 2>/dev/null; then
    echo "Stopping test backend server..."
    kill $backend_pid 2>/dev/null || true
    sleep 2
    # Force kill if still running
    if kill -0 $backend_pid 2>/dev/null; then
        kill -9 $backend_pid 2>/dev/null || true
    fi
fi

# Clean up test virtual environment if we created it
if [ -d "test_venv" ]; then
    echo "Cleaning up test virtual environment..."
    deactivate 2>/dev/null || true
    rm -rf test_venv
fi

# Clean up test logs
rm -f /tmp/test_backend.log

echo ""
echo "📊 Test Results Summary"
echo "======================"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! The CI/CD pipeline fixes should work correctly.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed. The CI/CD pipeline may still have issues.${NC}"
    exit 1
fi
