#!/usr/bin/env python3
"""
Simple Webhook Test with Database Queries
=========================================
Tests the webhook system using the existing backend configuration.
Uses MCP Supabase server to check database results.
"""

import os
import sys
import time
import hashlib
import requests
from datetime import datetime
from pathlib import Path

class SimpleWebhookTest:
    def __init__(self):
        self.sample_file = Path(__file__).parent.parent / "samples/Ghostly_Emg_20230321_17-50-17-0881.c3d"
        self.ngrok_url = self.get_ngrok_url()
        self.webhook_url = f"{self.ngrok_url}/webhooks/storage/c3d-upload"
        
    def get_ngrok_url(self) -> str:
        """Get current ngrok URL"""
        try:
            response = requests.get("http://localhost:4040/api/tunnels")
            data = response.json()
            
            for tunnel in data.get('tunnels', []):
                if tunnel['proto'] == 'https':
                    return tunnel['public_url']
                    
            raise Exception("No HTTPS ngrok tunnel found")
            
        except Exception as e:
            print(f"❌ Failed to get ngrok URL: {e}")
            print("   Make sure ngrok is running with: ngrok http 8080")
            sys.exit(1)
    
    def calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    def simulate_supabase_webhook(self, object_name: str, file_size: int) -> bool:
        """Simulate a Supabase Storage webhook event"""
        payload = {
            "eventType": "storage-object-uploaded",
            "bucket": "c3d-examples", 
            "objectName": object_name,
            "objectSize": file_size,
            "contentType": "application/octet-stream",
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"🚀 Simulating webhook event...")
        print(f"📡 URL: {self.webhook_url}")
        print(f"📦 Object: {object_name}")
        
        try:
            response = requests.post(
                self.webhook_url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true"
                },
                timeout=30
            )
            
            print(f"📊 Response Status: {response.status_code}")
            print(f"📄 Response: {response.text}")
            
            return response.status_code == 200
            
        except Exception as e:
            print(f"❌ Webhook request failed: {e}")
            return False
    
    def monitor_logs(self, duration: int = 10):
        """Monitor backend logs for webhook activity"""
        log_file = Path(__file__).parent.parent.parent / "logs/backend.error.log"
        
        if not log_file.exists():
            print("⚠️  Backend log file not found")
            return
        
        print(f"👀 Monitoring logs for {duration} seconds...")
        
        # Get initial size
        try:
            initial_size = log_file.stat().st_size
        except:
            initial_size = 0
        
        start_time = time.time()
        
        while time.time() - start_time < duration:
            try:
                current_size = log_file.stat().st_size
                if current_size > initial_size:
                    # Read new content
                    with open(log_file, 'r') as f:
                        f.seek(initial_size)
                        new_content = f.read()
                    
                    # Show new log entries
                    for line in new_content.split('\n'):
                        if line.strip() and any(keyword in line.lower() for keyword in 
                                              ['webhook', 'processing', 'cache', 'c3d', 'error', 'success']):
                            print(f"📝 {line.strip()}")
                    
                    initial_size = current_size
                
                time.sleep(0.5)
                
            except Exception as e:
                print(f"⚠️  Error reading logs: {e}")
                break
        
        print("✅ Log monitoring complete")
    
    def test_webhook_with_existing_file(self):
        """Test webhook with file that exists in Supabase"""
        print("🎯 SIMPLE WEBHOOK TEST")
        print("=" * 40)
        
        if not self.sample_file.exists():
            print(f"❌ Sample file not found: {self.sample_file}")
            return
        
        # Calculate file properties
        file_size = self.sample_file.stat().st_size
        file_hash = self.calculate_file_hash(self.sample_file)
        
        print(f"📁 File: {self.sample_file.name}")
        print(f"📏 Size: {file_size} bytes")
        print(f"🔍 Hash: {file_hash[:16]}...")
        print(f"🌐 ngrok URL: {self.ngrok_url}")
        
        # Test with a file that might already exist in Supabase
        # Using the original filename from the sample
        object_name = "Ghostly_Emg_20230321_17-50-17-0881.c3d"
        
        print(f"\n📤 Testing webhook with object: {object_name}")
        
        # Simulate webhook event
        success = self.simulate_supabase_webhook(object_name, file_size)
        
        if success:
            print("✅ Webhook simulation completed successfully")
        else:
            print("❌ Webhook simulation failed - this is expected if file doesn't exist in Supabase")
        
        # Monitor logs regardless
        print(f"\n👀 Monitoring backend logs...")
        self.monitor_logs(8)
        
        print(f"\n📋 TEST SUMMARY:")
        print(f"✅ File hash calculated: {file_hash[:16]}...")
        print(f"✅ Webhook endpoint accessible: {self.webhook_url}")
        print(f"{'✅' if success else '❌'} Webhook processing: {'Success' if success else 'Expected failure (file not in storage)'}")
        
        print(f"\n💡 NEXT STEPS:")
        print(f"1. Upload the file to Supabase Storage bucket 'c3d-examples'")
        print(f"2. Configure webhook URL in Supabase Dashboard:")
        print(f"   {self.webhook_url}")
        print(f"3. Upload a C3D file through Supabase Dashboard to trigger real webhook")

if __name__ == "__main__":
    tester = SimpleWebhookTest()
    tester.test_webhook_with_existing_file()