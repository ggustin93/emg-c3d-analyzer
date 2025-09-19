#!/bin/bash

# CORS Configuration Test
# Verifies that CORS is properly configured for frontend-backend communication

FRONTEND_URL="https://emg-c3d-analyzer.vercel.app"
BACKEND_URL="https://emg-c3d-analyzer-backend.onrender.com"

echo "Testing CORS Configuration..."
echo ""

# Test CORS preflight request
echo "1. Testing CORS preflight (OPTIONS) request:"
cors_response=$(curl -s -X OPTIONS \
    -H "Origin: $FRONTEND_URL" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    -I "$BACKEND_URL/upload" 2>/dev/null)

# Check for CORS headers
if echo "$cors_response" | grep -qi "access-control-allow-origin"; then
    echo "  ✅ CORS headers are present"
    
    # Extract and display CORS headers
    echo ""
    echo "  CORS Headers detected:"
    echo "$cors_response" | grep -i "access-control" | sed 's/^/    /'
    
    # Check if specific origin is allowed
    if echo "$cors_response" | grep -qi "access-control-allow-origin.*$FRONTEND_URL"; then
        echo ""
        echo "  ✅ Frontend origin is explicitly allowed"
    elif echo "$cors_response" | grep -qi "access-control-allow-origin.*\*"; then
        echo ""
        echo "  ⚠️  Wildcard origin allowed (less secure)"
    else
        echo ""
        echo "  ❌ Frontend origin may not be allowed"
    fi
else
    echo "  ❌ CORS headers not found"
    echo "     Backend may not be configured for cross-origin requests"
fi

# Test actual POST request with CORS
echo ""
echo "2. Testing actual POST request with CORS:"
post_response=$(curl -s -X POST \
    -H "Origin: $FRONTEND_URL" \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}' \
    -o /dev/null -w "%{http_code}" \
    "$BACKEND_URL/health")

if [[ "$post_response" == "200" ]] || [[ "$post_response" == "405" ]]; then
    echo "  ✅ CORS allows POST requests"
else
    echo "  ❌ CORS may be blocking requests (HTTP $post_response)"
fi

# Test credentials support
echo ""
echo "3. Testing CORS credentials support:"
creds_response=$(curl -s -I -X OPTIONS \
    -H "Origin: $FRONTEND_URL" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Authorization" \
    "$BACKEND_URL/health" 2>/dev/null)

if echo "$creds_response" | grep -qi "access-control-allow-credentials.*true"; then
    echo "  ✅ CORS allows credentials"
else
    echo "  ⚠️  CORS credentials support not detected"
    echo "     Authentication may not work properly"
fi

# Summary
echo ""
echo "Summary:"
if echo "$cors_response" | grep -qi "access-control-allow-origin"; then
    echo "✅ CORS is configured and working!"
else
    echo "❌ CORS configuration needs attention"
    echo ""
    echo "Backend should include these headers:"
    echo "  Access-Control-Allow-Origin: $FRONTEND_URL"
    echo "  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS"
    echo "  Access-Control-Allow-Headers: Content-Type, Authorization"
    echo "  Access-Control-Allow-Credentials: true"
fi