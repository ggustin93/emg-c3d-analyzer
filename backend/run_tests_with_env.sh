#!/bin/bash

# EMG C3D Analyzer Test Runner with Environment Variables
# Ensures all .env variables are loaded before running tests

set -euo pipefail

echo "🧪 EMG C3D Analyzer Test Runner"
echo "================================"

# Change to backend directory
cd "$(dirname "$0")"

# Check if .env file exists
if [[ ! -f .env ]]; then
    echo "❌ Error: .env file not found in backend directory"
    exit 1
fi

echo "📋 Loading environment variables from .env file..."

# Load environment variables from .env file (handles comments and empty lines)
set -a  # automatically export all variables
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Source the variable (handle lines with = sign)  
    if [[ "$line" =~ ^[^=]+= ]]; then
        # Remove any surrounding quotes and export
        eval "export $line"
        echo "   ✅ $(echo "$line" | cut -d'=' -f1)"
    fi
done < .env
set +a  # stop automatically exporting

# Activate virtual environment
echo "🔄 Activating Python virtual environment..."
source venv/bin/activate

# Set Python path
export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

# Verify key environment variables are loaded
echo "🔍 Verifying Supabase configuration..."
if [[ -z "${SUPABASE_URL:-}" ]]; then
    echo "❌ Error: SUPABASE_URL not loaded from .env"
    exit 1
fi

if [[ -z "${SUPABASE_SERVICE_KEY:-}" ]]; then
    echo "❌ Error: SUPABASE_SERVICE_KEY not loaded from .env"
    exit 1
fi

echo "   ✅ SUPABASE_URL: $SUPABASE_URL"
echo "   ✅ SUPABASE_SERVICE_KEY: [LOADED]"

# Set testing environment
export SKIP_E2E_TESTS=false
export ENVIRONMENT=testing

echo "🎯 Running test suite..."
echo "=============================="

# Run tests based on command line arguments
if [[ $# -eq 0 ]]; then
    # Run all tests by default
    echo "Running all tests..."
    python -m pytest tests/ -v --tb=short
elif [[ "$1" == "e2e" ]]; then
    # Run only E2E tests
    echo "Running E2E tests only..."
    python -m pytest tests/e2e/ -v -s
elif [[ "$1" == "quick" ]]; then
    # Run quick tests (no E2E)
    echo "Running quick test suite (no E2E)..."
    python -m pytest tests/ -v --tb=short -m "not e2e"
else
    # Pass through custom arguments
    echo "Running custom test command: $*"
    python -m pytest "$@"
fi

echo "🏁 Test execution completed"