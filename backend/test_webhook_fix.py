#!/usr/bin/env python3
"""Test script to verify webhook processing fix."""

import json
import requests
import time

# Webhook endpoint
url = "http://localhost:8080/webhooks/storage/c3d-upload"

# Simulate a Supabase Storage event
webhook_payload = {
    "type": "INSERT",
    "table": "objects",
    "record": {
        "id": "test-fix-001",
        "bucket_id": "c3d-examples",
        "name": f"P001/test_fix_{time.time()}.c3d",
        "owner": "service_role",
        "created_at": "2025-09-04T19:16:00.000Z",
        "updated_at": "2025-09-04T19:16:00.000Z",
        "last_accessed_at": None,
        "metadata": {
            "eTag": "test-etag",
            "size": 2869936,
            "mimetype": "application/octet-stream",
            "cacheControl": "max-age=3600",
            "lastModified": "2025-09-04T19:16:00.000Z",
            "contentLength": 2869936,
            "httpStatusCode": 200
        },
        "buckets": {
            "id": "c3d-examples",
            "name": "c3d-examples",
            "owner": "service_role",
            "created_at": "2024-01-01T00:00:00.000Z",
            "updated_at": "2024-01-01T00:00:00.000Z",
            "public": False
        }
    },
    "schema": "storage",
    "old_record": None
}

# Headers (no signature for testing)
headers = {
    "Content-Type": "application/json",
    "x-supabase-signature": ""  # Empty for testing (no secret configured)
}

print("🔄 Sending webhook test request...")
print(f"📦 File: {webhook_payload['record']['name']}")

try:
    # Send the webhook request
    response = requests.post(url, json=webhook_payload, headers=headers)
    
    print(f"📡 Response Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success: {data.get('message', 'No message')}")
        print(f"📝 Session Code: {data.get('session_code', 'N/A')}")
        print(f"🆔 Session ID: {data.get('session_id', 'N/A')}")
        print(f"⏱️ Processing Time: {data.get('processing_time_ms', 0):.1f}ms")
        
        # Wait a bit for background processing
        if data.get('session_code'):
            print("\n⏳ Waiting for background processing...")
            time.sleep(5)
            
            # Check status
            status_url = f"http://localhost:8080/webhooks/storage/status/{data['session_code']}"
            status_response = requests.get(status_url)
            if status_response.status_code == 200:
                status_data = status_response.json()
                print(f"📊 Processing Status: {status_data.get('status', 'Unknown')}")
                if status_data.get('error_message'):
                    print(f"❌ Error: {status_data['error_message']}")
                if status_data.get('has_analysis'):
                    print("✅ Analysis completed successfully!")
    else:
        print(f"❌ Error Response: {response.text}")
        
except Exception as e:
    print(f"❌ Request failed: {e}")