#!/bin/bash

echo "================================================"
echo "Verifying Backend Connection for EMG Analyzer"
echo "================================================"
echo ""

BACKEND_URL="https://emg-c3d-analyzer-backend.onrender.com"
FRONTEND_URL="https://emg-c3d-analyzer.vercel.app"

echo "1. Testing Direct Backend Access"
echo "--------------------------------"

# Test health endpoint
echo -n "Backend health check... "
response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
if [[ "$response" == "200" ]]; then
    echo "✅ Backend is healthy (HTTP $response)"
else
    echo "❌ Backend health check failed (HTTP $response)"
fi

# Test upload endpoint exists
echo -n "Upload endpoint check... "
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/upload")
if [[ "$response" == "422" ]]; then
    echo "✅ Upload endpoint exists (HTTP 422 - expects data)"
elif [[ "$response" == "405" ]]; then
    echo "⚠️ Upload endpoint exists but wrong method"
else
    echo "❌ Upload endpoint issue (HTTP $response)"
fi

echo ""
echo "2. Testing Frontend API Proxy"
echo "--------------------------------"

# Test if frontend is proxying to backend
echo -n "Testing frontend /api/health proxy... "
response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/api/health")
if [[ "$response" == "200" ]]; then
    echo "✅ Frontend is correctly proxying to backend"
elif [[ "$response" == "404" ]]; then
    echo "❌ Frontend /api proxy not working (404)"
    echo "   VITE_API_URL needs to be set in Vercel environment"
else
    echo "⚠️ Unexpected response (HTTP $response)"
fi

echo ""
echo "3. Configuration Requirements"
echo "--------------------------------"
echo "In Vercel Dashboard, ensure these environment variables are set:"
echo ""
echo "✓ VITE_API_URL=$BACKEND_URL"
echo "✓ VITE_SUPABASE_URL=<your-supabase-url>"
echo "✓ VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>"
echo "✓ VITE_STORAGE_BUCKET_NAME=c3d-examples"
echo ""

echo "4. Testing Analysis Page Requirements"
echo "--------------------------------"

# Check if backend can be reached from frontend context
echo -n "Checking CORS headers... "
cors_headers=$(curl -s -I -X OPTIONS "$BACKEND_URL/upload" 2>/dev/null | grep -i "access-control-allow-origin" || echo "none")
if [[ "$cors_headers" != "none" ]]; then
    echo "✅ CORS is configured"
    echo "   $cors_headers"
else
    echo "⚠️ CORS headers not found - may need configuration"
fi

echo ""
echo "================================================"
echo "Summary"
echo "================================================"
echo ""

# Final diagnosis
if [[ $(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health") == "200" ]]; then
    echo "✅ Backend is running at: $BACKEND_URL"
    
    if [[ $(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/api/health") == "200" ]]; then
        echo "✅ Frontend is correctly configured to use backend"
        echo ""
        echo "🎉 Your deployment should be working!"
        echo "The /analysis route should now function correctly."
    else
        echo "❌ Frontend is NOT configured to use backend"
        echo ""
        echo "📝 Action Required:"
        echo "1. Go to Vercel Dashboard"
        echo "2. Add environment variable: VITE_API_URL=$BACKEND_URL"
        echo "3. Redeploy the frontend"
    fi
else
    echo "❌ Backend is not accessible"
    echo "Check the Render deployment logs"
fi
echo ""