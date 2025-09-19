#!/bin/bash

# API Endpoints Integration Test
# Tests the integration between frontend and backend API endpoints

FRONTEND_URL="https://emg-c3d-analyzer.vercel.app"
BACKEND_URL="https://emg-c3d-analyzer-backend.onrender.com"

echo "Testing API Endpoints Integration..."
echo ""

# Test health endpoint through proxy
echo "1. Testing /api/health proxy:"
api_health_response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/api/health")

if [[ "$api_health_response" == "200" ]]; then
    echo "  ✅ API proxy is working correctly"
else
    echo "  ❌ API proxy not working (HTTP $api_health_response)"
    echo "     Please verify Vercel rewrites configuration"
fi

# Test upload endpoint
echo ""
echo "2. Testing /api/upload endpoint:"
upload_response=$(curl -s -X POST \
    -H "Content-Type: multipart/form-data" \
    -o /dev/null -w "%{http_code}" \
    "$FRONTEND_URL/api/upload")

if [[ "$upload_response" == "422" ]] || [[ "$upload_response" == "400" ]]; then
    echo "  ✅ Upload endpoint is reachable (expects data)"
elif [[ "$upload_response" == "404" ]]; then
    echo "  ❌ Upload endpoint not found - API proxy issue"
else
    echo "  ⚠️  Unexpected response (HTTP $upload_response)"
fi

# Test analysis endpoint
echo ""
echo "3. Testing /api/analysis/recalc endpoint:"
analysis_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{}' \
    -o /dev/null -w "%{http_code}" \
    "$FRONTEND_URL/api/analysis/recalc")

if [[ "$analysis_response" == "422" ]] || [[ "$analysis_response" == "400" ]]; then
    echo "  ✅ Analysis endpoint is reachable (expects data)"
elif [[ "$analysis_response" == "404" ]]; then
    echo "  ❌ Analysis endpoint not found - API proxy issue"
else
    echo "  ⚠️  Unexpected response (HTTP $analysis_response)"
fi

# Test scoring configuration endpoint
echo ""
echo "4. Testing /api/scoring/configurations endpoint:"
scoring_response=$(curl -s -o /dev/null -w "%{http_code}" \
    "$FRONTEND_URL/api/scoring/configurations")

if [[ "$scoring_response" == "200" ]] || [[ "$scoring_response" == "401" ]]; then
    echo "  ✅ Scoring endpoint is reachable"
elif [[ "$scoring_response" == "404" ]]; then
    echo "  ❌ Scoring endpoint not found - API proxy issue"
else
    echo "  ⚠️  Unexpected response (HTTP $scoring_response)"
fi

# Summary
echo ""
echo "Summary:"
if [[ "$api_health_response" == "200" ]]; then
    echo "✅ API integration is working correctly!"
else
    echo "❌ API integration needs configuration"
    echo ""
    echo "Required Actions:"
    echo "1. Verify VITE_API_URL is set in Vercel environment variables"
    echo "2. Check vercel.json rewrites configuration"
    echo "3. Ensure backend is running at $BACKEND_URL"
fi