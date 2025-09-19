#!/bin/bash

# Test script to debug the /analysis route issue on Vercel

echo "================================================"
echo "Debugging Analysis Route on Vercel"
echo "================================================"
echo ""

BASE_URL="https://emg-c3d-analyzer.vercel.app"

# Test if the backend API is accessible
echo "1. Testing Backend API Availability"
echo "--------------------------------"

# Check if the backend endpoint is reachable
echo -n "Testing backend /upload endpoint... "
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/upload")
echo "HTTP $response"

if [[ "$response" == "404" ]] || [[ "$response" == "405" ]]; then
    echo "❌ Backend API is NOT available at $BASE_URL/api/"
    echo "   The frontend is trying to call the backend but it's not deployed"
elif [[ "$response" == "422" ]] || [[ "$response" == "400" ]]; then
    echo "✅ Backend API is reachable (returned validation error as expected)"
else
    echo "⚠️  Unexpected response: $response"
fi

echo ""
echo "2. Testing Analysis Page Load"
echo "--------------------------------"

# Test the analysis page with parameters
test_url="$BASE_URL/analysis?file=test.c3d&date=2025-09-19T07:52:28.351Z"
echo -n "Testing analysis page load... "
response=$(curl -s -o /dev/null -w "%{http_code}" -H "Accept: text/html" "$test_url")
echo "HTTP $response"

# Get the page content to check for errors
echo ""
echo "3. Checking Page Content for Errors"
echo "--------------------------------"
content=$(curl -s -H "Accept: text/html" "$test_url" | head -500)

# Check if it's returning the HTML shell (SPA)
if [[ "$content" == *"<!DOCTYPE html"* ]]; then
    echo "✅ SPA HTML is loading"
    
    # Check if there are any inline error messages
    if [[ "$content" == *"error"* ]] || [[ "$content" == *"Error"* ]]; then
        echo "⚠️  Page contains error references"
    fi
else
    echo "❌ Not returning HTML content"
fi

echo ""
echo "4. Required Environment Variables"
echo "--------------------------------"
echo "Make sure these are set in Vercel:"
echo "- VITE_API_URL: Should point to your backend (e.g., https://your-backend.com)"
echo "- VITE_SUPABASE_URL: Your Supabase project URL"
echo "- VITE_SUPABASE_ANON_KEY: Your Supabase anon key"
echo "- VITE_STORAGE_BUCKET_NAME: 'c3d-examples' (or your bucket name)"

echo ""
echo "================================================"
echo "Diagnosis Summary"
echo "================================================"
echo ""
echo "The white page issue is likely because:"
echo "1. The backend API is not deployed/accessible"
echo "2. The frontend tries to call /api/upload but gets 404"
echo "3. The error isn't handled gracefully, resulting in white page"
echo ""
echo "Solutions:"
echo "1. Deploy your FastAPI backend separately (Railway, Render, etc.)"
echo "2. Set VITE_API_URL in Vercel to point to the backend"
echo "3. Ensure all Supabase environment variables are set"
echo ""