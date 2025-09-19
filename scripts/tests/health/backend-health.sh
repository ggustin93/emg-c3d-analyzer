#!/bin/bash

# Backend Service Health Check
# Verifies that the backend API is running and healthy

BACKEND_URL="https://emg-c3d-analyzer-backend.onrender.com"

echo "Checking Backend Service Health..."
echo "URL: $BACKEND_URL"
echo ""

# Check health endpoint
response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")

if [[ "$response" == "200" ]]; then
    echo "✅ Backend service is healthy (HTTP $response)"
    
    # Check response time
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$BACKEND_URL/health")
    echo "📊 Response time: ${response_time}s"
    
    # Check specific endpoints
    echo ""
    echo "Checking critical endpoints:"
    
    # Upload endpoint
    upload_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/upload")
    if [[ "$upload_response" == "422" ]]; then
        echo "  ✅ /upload endpoint is accessible"
    else
        echo "  ❌ /upload endpoint issue (HTTP $upload_response)"
    fi
    
    # Analysis endpoint
    analysis_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/analysis/recalc")
    if [[ "$analysis_response" == "422" ]] || [[ "$analysis_response" == "400" ]]; then
        echo "  ✅ /analysis/recalc endpoint is accessible"
    else
        echo "  ❌ /analysis/recalc endpoint issue (HTTP $analysis_response)"
    fi
    
    exit 0
else
    echo "❌ Backend service is not healthy (HTTP $response)"
    echo "Please check the Render deployment logs"
    exit 1
fi