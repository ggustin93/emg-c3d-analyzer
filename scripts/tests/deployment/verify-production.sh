#!/bin/bash

echo "================================================"
echo "Production Deployment Verification"
echo "================================================"
echo ""

FRONTEND_URL="https://emg-c3d-analyzer.vercel.app"
BACKEND_URL="https://emg-c3d-analyzer-backend.onrender.com"

echo "1. Backend Health Check"
echo "------------------------"
response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
if [[ "$response" == "200" ]]; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed (HTTP $response)"
fi

echo ""
echo "2. Frontend API Proxy Test"
echo "------------------------"
echo "Testing if frontend can reach backend..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/api/health")
if [[ "$response" == "200" ]]; then
    echo "✅ Frontend → Backend connection working!"
    echo "🎉 Your /analysis route should now work!"
else
    echo "❌ Frontend cannot reach backend (HTTP $response)"
    echo "   Please verify VITE_API_URL is set in Vercel"
fi

echo ""
echo "3. Analysis Route Test"
echo "------------------------"
echo "Checking if analysis page loads..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/analysis")
if [[ "$response" == "200" ]]; then
    echo "✅ Analysis page loads successfully"
else
    echo "⚠️ Analysis page returned HTTP $response"
fi

echo ""
echo "4. CORS Validation"
echo "------------------------"
echo "Checking CORS headers..."
cors_test=$(curl -s -I -X OPTIONS \
    -H "Origin: $FRONTEND_URL" \
    -H "Access-Control-Request-Method: POST" \
    "$BACKEND_URL/upload" 2>/dev/null | grep -i "access-control-allow-origin" || echo "none")

if [[ "$cors_test" != "none" ]]; then
    echo "✅ CORS is properly configured"
    echo "   $cors_test"
else
    echo "⚠️ CORS headers not found"
fi

echo ""
echo "================================================"
echo "Summary"
echo "================================================"

if [[ $(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/api/health") == "200" ]]; then
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo ""
    echo "Your application is properly configured:"
    echo "- Frontend: $FRONTEND_URL"
    echo "- Backend: $BACKEND_URL"
    echo "- The /analysis route should now work correctly"
    echo ""
    echo "Try it out:"
    echo "1. Go to $FRONTEND_URL"
    echo "2. Navigate to Analysis tab"
    echo "3. Select a C3D file from the browser"
    echo "4. The analysis should now process successfully!"
else
    echo "⚠️ CONFIGURATION NEEDED"
    echo ""
    echo "Please ensure these environment variables are set in Vercel:"
    echo "- VITE_API_URL=$BACKEND_URL"
    echo "- VITE_SUPABASE_URL=<your-supabase-url>"
    echo "- VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>"
    echo ""
    echo "After setting them, redeploy your Vercel app."
fi
echo ""