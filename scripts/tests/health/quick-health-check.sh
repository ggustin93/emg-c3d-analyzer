#!/bin/bash

echo "Quick API Connection Test"
echo "========================="
echo ""
echo "Testing: https://emg-c3d-analyzer.vercel.app/api/health"
response=$(curl -s -w "\nHTTP Status: %{http_code}" "https://emg-c3d-analyzer.vercel.app/api/health")
echo "$response"
echo ""
if [[ "$response" == *"200"* ]]; then
    echo "✅ SUCCESS! Frontend can now reach backend!"
    echo "Your /analysis route should work now!"
else
    echo "⚠️ Still waiting for deployment to complete..."
    echo "Try again in 1-2 minutes"
fi