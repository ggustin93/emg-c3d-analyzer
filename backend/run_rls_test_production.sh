#!/bin/bash

# RLS Production Test Runner with Real Credentials
# =================================================
# Tests clinical notes with actual researcher account
# Credentials: researcher@ghostly.be / ghostly2025

set -e

echo "🔬 CLINICAL NOTES RLS PRODUCTION TEST"
echo "====================================="
echo ""

# Load environment variables from .env
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo "✅ Loaded environment variables from .env"
else
    echo "⚠️  No .env file found, using existing environment"
fi

# Ensure we have required Supabase variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: Missing required Supabase environment variables"
    echo "   Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set"
    exit 1
fi

echo "📊 Configuration:"
echo "   Supabase URL: $SUPABASE_URL"
echo "   Test Email: researcher@ghostly.be"
echo ""

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Activated Python virtual environment"
fi

# Set Python path
export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

# Run the RLS production test
echo "🚀 Starting RLS test with production credentials..."
echo "=============================================="
echo ""

python tests/test_clinical_notes_rls_production.py

echo ""
echo "=============================================="
echo "Test completed. Check results above for RLS validation."