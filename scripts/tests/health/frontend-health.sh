#!/bin/bash

# Frontend Service Health Check
# Verifies that the frontend is deployed and accessible

FRONTEND_URL="https://emg-c3d-analyzer.vercel.app"

echo "Checking Frontend Service Health..."
echo "URL: $FRONTEND_URL"
echo ""

# Check main page
response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")

if [[ "$response" == "200" ]]; then
    echo "✅ Frontend is accessible (HTTP $response)"
    
    # Check response time
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$FRONTEND_URL")
    echo "📊 Response time: ${response_time}s"
    
    # Check critical routes
    echo ""
    echo "Checking critical routes:"
    
    # Analysis page
    analysis_response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/analysis")
    if [[ "$analysis_response" == "200" ]]; then
        echo "  ✅ /analysis route is accessible"
    else
        echo "  ❌ /analysis route issue (HTTP $analysis_response)"
    fi
    
    # FAQ page
    faq_response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/faq")
    if [[ "$faq_response" == "200" ]]; then
        echo "  ✅ /faq route is accessible"
    else
        echo "  ❌ /faq route issue (HTTP $faq_response)"
    fi
    
    # About page
    about_response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/about")
    if [[ "$about_response" == "200" ]]; then
        echo "  ✅ /about route is accessible"
    else
        echo "  ❌ /about route issue (HTTP $about_response)"
    fi
    
    # Check static assets
    echo ""
    echo "Checking static assets:"
    
    # Favicon
    favicon_response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/favicon.ico")
    if [[ "$favicon_response" == "200" ]]; then
        echo "  ✅ Favicon is accessible"
    else
        echo "  ⚠️  Favicon not found (HTTP $favicon_response)"
    fi
    
    # Manifest
    manifest_response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/manifest.json")
    if [[ "$manifest_response" == "200" ]]; then
        echo "  ✅ Manifest is accessible"
    else
        echo "  ⚠️  Manifest not found (HTTP $manifest_response)"
    fi
    
    exit 0
else
    echo "❌ Frontend is not accessible (HTTP $response)"
    echo "Please check the Vercel deployment"
    exit 1
fi