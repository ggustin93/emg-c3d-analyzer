#!/usr/bin/env python3
"""Simple webhook test script"""
import json
import requests
from datetime import datetime

# Create a valid webhook payload
payload = {
    "eventType": "storage-object-uploaded",
    "bucket": "c3d-examples",
    "objectName": "test-file.c3d",
    "objectSize": 1024,
    "contentType": "application/octet-stream",
    "timestamp": datetime.now().isoformat()
}

# Send the request
try:
    response = requests.post(
        "http://localhost:8080/webhooks/storage/c3d-upload",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")