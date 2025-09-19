#!/bin/bash

# Test script for Vercel deployment content serving
# Tests both static content delivery and SPA routing

echo "================================================"
echo "Testing EMG C3D Analyzer Vercel Deployment"
echo "================================================"
echo ""

BASE_URL="https://emg-c3d-analyzer.vercel.app"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test URL and check response
test_url() {
    local url=$1
    local description=$2
    local expected_type=$3
    local check_content=$4
    
    echo -n "Testing $description... "
    
    # Make request with appropriate headers
    if [[ "$expected_type" == "html" ]]; then
        # Browser-like request with HTML accept header
        response=$(curl -s -o /dev/null -w "%{http_code}" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" "$url")
    else
        # Direct file request without HTML accept header
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    fi
    
    if [[ "$response" == "200" ]]; then
        echo -e "${GREEN}✓${NC} (HTTP $response)"
        
        # If we need to check content
        if [[ ! -z "$check_content" ]]; then
            content=$(curl -s "$url")
            if [[ "$content" == *"$check_content"* ]]; then
                echo -e "  └─ Content check: ${GREEN}✓${NC} Found '$check_content'"
            else
                echo -e "  └─ Content check: ${RED}✗${NC} Didn't find '$check_content'"
                echo "  └─ First 100 chars: ${content:0:100}..."
            fi
        fi
    else
        echo -e "${RED}✗${NC} (HTTP $response)"
    fi
}

# Function to test content type
test_content_type() {
    local url=$1
    local description=$2
    local expected_type=$3
    
    echo -n "Testing content-type for $description... "
    
    # Get content-type header
    content_type=$(curl -s -I "$url" | grep -i "content-type:" | cut -d' ' -f2- | tr -d '\r\n')
    
    if [[ "$content_type" == *"$expected_type"* ]]; then
        echo -e "${GREEN}✓${NC} ($content_type)"
    else
        echo -e "${YELLOW}⚠${NC} Got: $content_type (expected: $expected_type)"
    fi
}

echo "1. Testing Static Content Files"
echo "--------------------------------"

# Test markdown files
test_url "$BASE_URL/content/about.md" "about.md (root level)" "file" "GHOSTLY+"
test_content_type "$BASE_URL/content/about.md" "about.md" "text/plain"

# Test FAQ manifest
test_url "$BASE_URL/content/faq/manifest.json" "FAQ manifest.json" "file" "version"
test_content_type "$BASE_URL/content/faq/manifest.json" "manifest.json" "application/json"

# Test nested FAQ content
test_url "$BASE_URL/content/faq/getting-started/what-is-platform.md" "FAQ nested markdown" "file" "question:"
test_url "$BASE_URL/content/faq/patients/add-patient.md" "FAQ patient markdown" "file" "question:"

echo ""
echo "2. Testing SPA Routes (Should return HTML)"
echo "-------------------------------------------"

# Test SPA routes - these should return HTML for React Router
test_url "$BASE_URL/" "Home page" "html" "<!DOCTYPE html"
test_url "$BASE_URL/dashboard" "Dashboard page" "html" "<!DOCTYPE html"
test_url "$BASE_URL/faq" "FAQ page" "html" "<!DOCTYPE html"
test_url "$BASE_URL/about" "About page" "html" "<!DOCTYPE html"
test_url "$BASE_URL/analysis?file=test.c3d" "Analysis page with params" "html" "<!DOCTYPE html"

echo ""
echo "3. Testing Assets"
echo "-----------------"

# Test if logo exists
test_url "$BASE_URL/vub_etro_logo.png" "VUB ETRO Logo" "file"

echo ""
echo "4. Testing Non-Existent Routes"
echo "-------------------------------"

# This should return HTML (for 404 handling by React Router)
test_url "$BASE_URL/non-existent-route" "Non-existent route" "html" "<!DOCTYPE html"

echo ""
echo "5. Advanced Content Checks"
echo "---------------------------"

# Check if FAQ content is actually JSON parseable
echo -n "Checking if manifest.json is valid JSON... "
if curl -s "$BASE_URL/content/faq/manifest.json" | python3 -m json.tool > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Valid JSON"
else
    echo -e "${RED}✗${NC} Invalid JSON"
fi

# Check markdown content structure
echo -n "Checking markdown frontmatter structure... "
md_content=$(curl -s "$BASE_URL/content/faq/getting-started/what-is-platform.md")
if [[ "$md_content" == *"---"* ]] && [[ "$md_content" == *"question:"* ]]; then
    echo -e "${GREEN}✓${NC} Has frontmatter"
else
    echo -e "${RED}✗${NC} Missing frontmatter"
fi

echo ""
echo "================================================"
echo "Test Summary"
echo "================================================"
echo ""
echo "If all tests show ✓, the deployment is working correctly!"
echo "If you see ✗, the content serving needs to be fixed."
echo ""
echo "Key things being tested:"
echo "- Static files (markdown, JSON) are served directly"
echo "- SPA routes return HTML for React Router"
echo "- Nested directories in /content work properly"
echo ""