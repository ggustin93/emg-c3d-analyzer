#!/usr/bin/env python3
"""Test webhook through ngrok URL"""
import json
import requests
from datetime import datetime

# Test through ngrok URL
ngrok_url = "https://f93d31e82664.ngrok-free.app"
webhook_endpoint = f"{ngrok_url}/webhooks/storage/c3d-upload"

# Create a valid webhook payload
payload = {
    "eventType": "storage-object-uploaded",
    "bucket": "c3d-examples",
    "objectName": "test-ngrok.c3d",
    "objectSize": 1024,
    "contentType": "application/octet-stream",
    "timestamp": datetime.now().isoformat()
}

print("🧪 Testing webhook through ngrok...")
print(f"📡 URL: {webhook_endpoint}")
print(f"📦 Payload: {json.dumps(payload, indent=2)}")

try:
    response = requests.post(
        webhook_endpoint,
        json=payload,
        headers={
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true"
        }
    )
    print(f"\n✅ Status Code: {response.status_code}")
    print(f"📄 Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"\n❌ Error: {e}")