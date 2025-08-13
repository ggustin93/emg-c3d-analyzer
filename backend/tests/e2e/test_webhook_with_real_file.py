#!/usr/bin/env python3
"""
Test webhook with real C3D file by simulating Supabase Storage webhook
"""
from pathlib import Path

import requests
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone

def calculate_file_hash(file_path):
    """Calculate SHA-256 hash of file"""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()

def create_webhook_signature(payload, secret):
    """Create HMAC-SHA256 signature for webhook"""
    signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return f"sha256={signature}"

def test_webhook_with_real_file():
    """Test webhook endpoint with real C3D file"""
    
    # Real C3D file path (resolve relative to repo root)
    repo_root = Path(__file__).resolve().parents[3]
    c3d_file_path = str(repo_root / "backend/tests/samples/Ghostly_Emg_20230321_17-50-17-0881.c3d")
    
    if not os.path.exists(c3d_file_path):
        print(f"❌ C3D file not found: {c3d_file_path}")
        return
    
    print(f"🚀 Testing webhook with real C3D file...")
    print(f"📁 File: {os.path.basename(c3d_file_path)}")
    print(f"📊 Size: {os.path.getsize(c3d_file_path):,} bytes")
    
    # Calculate file hash
    file_hash = calculate_file_hash(c3d_file_path)
    file_size = os.path.getsize(c3d_file_path)
    
    print(f"🔐 File hash: {file_hash[:16]}...")
    
    # Create webhook payload in Supabase format
    webhook_payload = {
        "type": "INSERT",
        "table": "objects",
        "schema": "storage",
        "record": {
            "id": f"test_{datetime.now().isoformat()}",
            "bucket_id": "c3d-examples",
            "name": "real_test/Ghostly_Emg_20230321_17-50-17-0881.c3d",
            "owner": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_accessed_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "eTag": f'"{file_hash}"',
                "size": file_size,
                "mimetype": "application/octet-stream",
                "cacheControl": "max-age=3600",
                "lastModified": datetime.now(timezone.utc).isoformat(),
                "contentLength": file_size,
                "httpStatusCode": 200
            }
        },
        "old_record": None
    }
    
    payload_json = json.dumps(webhook_payload)
    print(f"📨 Webhook payload: {payload_json[:100]}...")
    
    # Create webhook signature
    webhook_secret = "test_secret_key_for_development"
    signature = create_webhook_signature(payload_json, webhook_secret)
    
    # Webhook headers
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature.replace("sha256=", ""),  # Remove sha256= prefix
        "User-Agent": "Supabase-Webhooks/1.0"
    }
    
    # Send webhook request
    webhook_url = "http://localhost:8080/webhooks/storage/c3d-upload"
    
    try:
        print(f"🔄 Sending webhook request to {webhook_url}")
        response = requests.post(webhook_url, data=payload_json, headers=headers, timeout=30)
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"📝 Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("✅ Webhook processed successfully!")
            try:
                response_data = response.json()
                print(f"📋 Response: {json.dumps(response_data, indent=2)}")
            except:
                print(f"📋 Response Text: {response.text}")
        else:
            print(f"❌ Webhook failed with status {response.status_code}")
            print(f"📋 Error Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_webhook_with_real_file()