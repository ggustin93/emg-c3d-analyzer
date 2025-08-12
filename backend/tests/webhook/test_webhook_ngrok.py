#!/usr/bin/env python3
"""
Webhook + ngrok Integration Test Script
=====================================

This script tests the complete webhook system with ngrok integration:
1. Starts the development environment with webhook support
2. Verifies ngrok tunnel is created and accessible
3. Tests webhook endpoint directly
4. Monitors webhook activity from Supabase uploads
5. Validates complete C3D processing pipeline

Usage:
    python test_webhook_ngrok.py
    
Requirements:
    - ngrok installed and configured with auth token
    - Supabase project with webhook configured
    - Backend dependencies installed (poetry)
"""

import os
import sys
import time
import json
import hmac
import hashlib
import requests
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

# Configuration
BASE_DIR = Path(__file__).parent
BACKEND_PORT = 8080
WEBHOOK_SECRET = "your-webhook-secret-here"  # Should match your Supabase webhook secret
TEST_TIMEOUT = 60  # seconds


class Colors:
    """ANSI color codes for output formatting."""
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


class WebhookTester:
    """Comprehensive webhook testing with ngrok integration."""
    
    def __init__(self):
        self.dev_process: Optional[subprocess.Popen] = None
        self.ngrok_url: Optional[str] = None
        self.webhook_url: Optional[str] = None
        self.start_time = time.time()
        
    def log(self, level: str, message: str):
        """Formatted logging with timestamp."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        color = {
            "INFO": Colors.BLUE,
            "SUCCESS": Colors.GREEN,
            "WARNING": Colors.YELLOW,
            "ERROR": Colors.RED
        }.get(level, Colors.BLUE)
        
        print(f"{color}[{timestamp}] {Colors.BOLD}{level}{Colors.END}: {message}")
    
    def start_development_environment(self) -> bool:
        """Start development environment with webhook support."""
        self.log("INFO", "Starting development environment with webhook support...")
        
        try:
            # Start development environment with webhook flag
            cmd = ["./start_dev.sh", "--webhook", "--kill"]
            self.dev_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                cwd=BASE_DIR
            )
            
            # Monitor startup output to extract ngrok URL
            self.log("INFO", "Waiting for services to start (up to 60 seconds)...")
            
            for _ in range(60):  # 60 second timeout
                if self.dev_process.poll() is not None:
                    # Process terminated
                    output = self.dev_process.stdout.read()
                    self.log("ERROR", f"Development script terminated early: {output}")
                    return False
                
                # Check logs for ngrok URL
                self._extract_ngrok_url()
                if self.ngrok_url:
                    self.webhook_url = f"{self.ngrok_url}/webhooks/storage/c3d-upload"
                    self.log("SUCCESS", f"ngrok tunnel ready: {self.ngrok_url}")
                    self.log("SUCCESS", f"Webhook URL: {self.webhook_url}")
                    return True
                
                time.sleep(1)
            
            self.log("ERROR", "Timeout waiting for ngrok tunnel to start")
            return False
            
        except Exception as e:
            self.log("ERROR", f"Failed to start development environment: {e}")
            return False
    
    def _extract_ngrok_url(self):
        """Extract ngrok URL from logs."""
        try:
            ngrok_log = BASE_DIR / "logs" / "ngrok.log"
            if ngrok_log.exists():
                with open(ngrok_log, 'r') as f:
                    content = f.read()
                    # Look for ngrok URL pattern
                    import re
                    match = re.search(r'https://[a-zA-Z0-9-]+\.ngrok-free\.app', content)
                    if match:
                        self.ngrok_url = match.group(0)
        except Exception as e:
            self.log("WARNING", f"Could not extract ngrok URL from logs: {e}")
    
    def test_webhook_endpoint(self) -> bool:
        """Test webhook endpoint directly with mock payload."""
        if not self.webhook_url:
            self.log("ERROR", "Webhook URL not available")
            return False
            
        self.log("INFO", "Testing webhook endpoint directly...")
        
        # Create mock Supabase Storage webhook payload
        mock_payload = {
            "event_type": "storage-object-uploaded",
            "bucket": "c3d-examples",
            "object_name": "test-file.c3d",
            "object_size": 1024,
            "created_at": datetime.utcnow().isoformat() + "Z"
        }
        
        # Create HMAC signature (if webhook secret is configured)
        payload_json = json.dumps(mock_payload, sort_keys=True)
        if WEBHOOK_SECRET and WEBHOOK_SECRET != "your-webhook-secret-here":
            signature = hmac.new(
                WEBHOOK_SECRET.encode('utf-8'),
                payload_json.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            headers = {
                'Content-Type': 'application/json',
                'X-Supabase-Signature': f'sha256={signature}'
            }
        else:
            headers = {'Content-Type': 'application/json'}
            self.log("WARNING", "No webhook secret configured - signature verification will be skipped")
        
        try:
            response = requests.post(
                self.webhook_url,
                json=mock_payload,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                self.log("SUCCESS", "Webhook endpoint responded successfully")
                self.log("INFO", f"Response: {response.json()}")
                return True
            else:
                self.log("ERROR", f"Webhook endpoint returned {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log("ERROR", f"Failed to test webhook endpoint: {e}")
            return False
    
    def monitor_webhook_activity(self, duration: int = 30) -> bool:
        """Monitor webhook activity in logs for specified duration."""
        self.log("INFO", f"Monitoring webhook activity for {duration} seconds...")
        self.log("INFO", "Upload a C3D file to Supabase Storage 'c3d-examples' bucket now!")
        
        backend_log = BASE_DIR / "logs" / "backend.error.log"
        if not backend_log.exists():
            self.log("ERROR", "Backend log file not found")
            return False
        
        # Get initial log size
        initial_size = backend_log.stat().st_size
        webhook_detected = False
        
        start_time = time.time()
        while time.time() - start_time < duration:
            try:
                current_size = backend_log.stat().st_size
                if current_size > initial_size:
                    # New log content available
                    with open(backend_log, 'r') as f:
                        f.seek(initial_size)
                        new_content = f.read()
                        initial_size = current_size
                        
                        # Look for webhook activity indicators
                        webhook_indicators = ['🚀', '📁', '🔄', '✅', '❌', '📊']
                        for line in new_content.split('\n'):
                            if any(indicator in line for indicator in webhook_indicators):
                                self.log("INFO", f"Webhook activity: {line.strip()}")
                                webhook_detected = True
                
                time.sleep(1)
                
            except Exception as e:
                self.log("WARNING", f"Error monitoring logs: {e}")
                break
        
        if webhook_detected:
            self.log("SUCCESS", "Webhook activity detected in logs!")
            return True
        else:
            self.log("WARNING", "No webhook activity detected during monitoring period")
            return False
    
    def check_supabase_configuration(self) -> bool:
        """Provide guidance for Supabase webhook configuration."""
        if not self.webhook_url:
            self.log("ERROR", "Webhook URL not available for configuration")
            return False
            
        self.log("INFO", "Supabase Webhook Configuration:")
        print(f"  {Colors.YELLOW}1.{Colors.END} Go to your Supabase project dashboard")
        print(f"  {Colors.YELLOW}2.{Colors.END} Navigate to Database > Webhooks")
        print(f"  {Colors.YELLOW}3.{Colors.END} Create new webhook with these settings:")
        print(f"     {Colors.BOLD}URL:{Colors.END} {self.webhook_url}")
        print(f"     {Colors.BOLD}HTTP Method:{Colors.END} POST")
        print(f"     {Colors.BOLD}Table:{Colors.END} storage.objects")
        print(f"     {Colors.BOLD}Events:{Colors.END} INSERT")
        print(f"     {Colors.BOLD}Filters:{Colors.END} bucket = 'c3d-examples'")
        if WEBHOOK_SECRET and WEBHOOK_SECRET != "your-webhook-secret-here":
            print(f"     {Colors.BOLD}Secret:{Colors.END} {WEBHOOK_SECRET}")
        print(f"  {Colors.YELLOW}4.{Colors.END} Enable the webhook")
        print(f"  {Colors.YELLOW}5.{Colors.END} Test by uploading a C3D file to 'c3d-examples' bucket")
        print()
        
        return True
    
    def run_comprehensive_test(self) -> bool:
        """Run complete webhook test suite."""
        self.log("INFO", "Starting comprehensive webhook + ngrok test...")
        print(f"{Colors.BOLD}=" * 60 + Colors.END)
        
        success = True
        
        # Step 1: Start development environment
        if not self.start_development_environment():
            self.log("ERROR", "Failed to start development environment")
            return False
        
        # Wait for backend to be fully ready
        self.log("INFO", "Waiting for backend to be fully ready...")
        time.sleep(10)
        
        # Step 2: Test webhook endpoint directly
        if not self.test_webhook_endpoint():
            self.log("WARNING", "Direct webhook test failed, but continuing...")
            success = False
        
        # Step 3: Show configuration instructions
        self.check_supabase_configuration()
        
        # Step 4: Monitor for real webhook activity
        if not self.monitor_webhook_activity(30):
            self.log("WARNING", "No webhook activity detected from Supabase")
            success = False
        
        # Summary
        duration = time.time() - self.start_time
        print(f"\n{Colors.BOLD}=" * 60 + Colors.END)
        if success:
            self.log("SUCCESS", f"Comprehensive webhook test completed successfully in {duration:.1f}s")
        else:
            self.log("WARNING", f"Webhook test completed with warnings in {duration:.1f}s")
        
        return success
    
    def cleanup(self):
        """Clean up processes and resources."""
        self.log("INFO", "Cleaning up test environment...")
        
        if self.dev_process:
            try:
                # Send SIGTERM to development script
                self.dev_process.terminate()
                self.dev_process.wait(timeout=10)
                self.log("SUCCESS", "Development environment stopped")
            except subprocess.TimeoutExpired:
                self.log("WARNING", "Development environment didn't stop gracefully, force killing...")
                self.dev_process.kill()
            except Exception as e:
                self.log("ERROR", f"Error stopping development environment: {e}")


def main():
    """Main test execution."""
    print(f"{Colors.BOLD}Webhook + ngrok Integration Test{Colors.END}")
    print(f"{Colors.BOLD}=" * 40 + Colors.END)
    
    # Check prerequisites
    if not Path("start_dev.sh").exists():
        print(f"{Colors.RED}ERROR: start_dev.sh not found. Run from project root.{Colors.END}")
        sys.exit(1)
    
    if subprocess.run(["command", "-v", "ngrok"], capture_output=True).returncode != 0:
        print(f"{Colors.RED}ERROR: ngrok not installed. Please install and configure ngrok first.{Colors.END}")
        sys.exit(1)
    
    tester = WebhookTester()
    
    try:
        success = tester.run_comprehensive_test()
        
        # Keep environment running for manual testing
        if success:
            print(f"\n{Colors.GREEN}Test completed successfully!{Colors.END}")
            print(f"{Colors.YELLOW}Development environment is still running for manual testing.{Colors.END}")
            print(f"{Colors.YELLOW}Upload files to Supabase and monitor logs in real-time.{Colors.END}")
            print(f"{Colors.YELLOW}Press Ctrl+C to stop.{Colors.END}")
            
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print(f"\n{Colors.BLUE}Stopping test environment...{Colors.END}")
        
    except KeyboardInterrupt:
        print(f"\n{Colors.BLUE}Test interrupted by user{Colors.END}")
    except Exception as e:
        print(f"{Colors.RED}Test failed with error: {e}{Colors.END}")
    finally:
        tester.cleanup()


if __name__ == "__main__":
    main()