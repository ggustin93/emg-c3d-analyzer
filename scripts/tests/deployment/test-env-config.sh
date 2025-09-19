#!/bin/bash

# Environment Configuration Test
# Verifies that all required environment variables are properly configured

FRONTEND_URL="https://emg-c3d-analyzer.vercel.app"

echo "Testing Environment Configuration..."
echo ""

# Test if API calls work (indicates VITE_API_URL is set)
echo "1. Testing VITE_API_URL configuration:"
api_response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/api/health")

if [[ "$api_response" == "200" ]]; then
    echo "  ✅ VITE_API_URL appears to be configured correctly"
else
    echo "  ❌ VITE_API_URL may not be configured (API returns $api_response)"
    echo "     Expected: VITE_API_URL=https://emg-c3d-analyzer-backend.onrender.com"
fi

# Check if the app loads (basic configuration)
echo ""
echo "2. Testing basic app configuration:"
app_response=$(curl -s "$FRONTEND_URL" | head -100)

if echo "$app_response" | grep -q "EMG C3D Analyzer"; then
    echo "  ✅ App title is present"
else
    echo "  ❌ App may not be loading correctly"
fi

if echo "$app_response" | grep -q "id=\"root\""; then
    echo "  ✅ React root element is present"
else
    echo "  ❌ React root element not found"
fi

# Test if JavaScript bundles are loading
echo ""
echo "3. Testing JavaScript bundle loading:"
js_response=$(curl -s "$FRONTEND_URL" | grep -o "src=\"/assets/.*\.js\"" | head -1)

if [[ -n "$js_response" ]]; then
    echo "  ✅ JavaScript bundles are referenced"
    
    # Extract JS file path and test if it loads
    js_path=$(echo "$js_response" | sed 's/src="//;s/"//')
    js_load_response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL$js_path")
    
    if [[ "$js_load_response" == "200" ]]; then
        echo "  ✅ JavaScript bundles are loading successfully"
    else
        echo "  ❌ JavaScript bundles are not loading (HTTP $js_load_response)"
    fi
else
    echo "  ❌ No JavaScript bundles found in HTML"
fi

# Check for environment variable hints in the app
echo ""
echo "4. Checking for Supabase configuration:"
# This is indirect - we check if the app makes Supabase calls
supabase_check=$(curl -s "$FRONTEND_URL" | grep -o "supabase" | head -1)

if [[ -n "$supabase_check" ]]; then
    echo "  ✅ Supabase references found in app"
    echo "     Assuming VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set"
else
    echo "  ⚠️  No Supabase references found"
    echo "     May need to verify Supabase environment variables"
fi

# Summary
echo ""
echo "Summary of Required Environment Variables:"
echo ""
echo "  VITE_API_URL:"
if [[ "$api_response" == "200" ]]; then
    echo "    ✅ Appears to be configured"
else
    echo "    ❌ Needs to be set to: https://emg-c3d-analyzer-backend.onrender.com"
fi

echo ""
echo "  VITE_SUPABASE_URL:"
echo "    ⚠️  Cannot verify directly - check Vercel dashboard"

echo ""
echo "  VITE_SUPABASE_ANON_KEY:"
echo "    ⚠️  Cannot verify directly - check Vercel dashboard"

echo ""
echo "  VITE_STORAGE_BUCKET_NAME:"
echo "    ⚠️  Cannot verify directly - should be: c3d-examples"

echo ""
echo "📝 To verify/set environment variables:"
echo "   1. Go to Vercel Dashboard"
echo "   2. Navigate to Project Settings → Environment Variables"
echo "   3. Ensure all VITE_* variables are set"
echo "   4. Redeploy after making changes"