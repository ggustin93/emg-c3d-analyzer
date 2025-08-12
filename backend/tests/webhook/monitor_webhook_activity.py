#!/usr/bin/env python3
"""
Webhook Activity Monitor
=======================

Simple script to monitor webhook activity in real-time.
This helps verify that Supabase is automatically triggering your webhook.

Usage:
    python monitor_webhook_activity.py
    
Then upload a C3D file to Supabase Storage 'c3d-examples' bucket and watch for activity.
"""

import time
import os
from pathlib import Path
from datetime import datetime


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def log(level: str, message: str):
    """Formatted logging with timestamp."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    color = {
        "INFO": Colors.BLUE,
        "SUCCESS": Colors.GREEN,
        "WARNING": Colors.YELLOW,
        "ERROR": Colors.RED
    }.get(level, Colors.BLUE)
    
    print(f"{color}[{timestamp}] {Colors.BOLD}{level}{Colors.END}: {message}")


def monitor_webhook_logs():
    """Monitor webhook activity in backend logs."""
    log_file = Path("logs/backend.error.log")
    
    if not log_file.exists():
        log("ERROR", "Backend log file not found. Is the backend running?")
        log("INFO", "Start the backend with: ./start_dev.sh --webhook")
        return
    
    log("SUCCESS", "Monitoring webhook activity...")
    log("INFO", "Webhook indicators: 🚀 📁 🔄 ✅ ❌ 📊")
    print(f"{Colors.YELLOW}{'='*60}{Colors.END}")
    log("INFO", "Upload a C3D file to Supabase Storage 'c3d-examples' bucket now!")
    log("INFO", "Press Ctrl+C to stop monitoring")
    print(f"{Colors.YELLOW}{'='*60}{Colors.END}")
    
    # Track file size to detect new log entries
    last_size = log_file.stat().st_size
    webhook_activity_count = 0
    
    try:
        while True:
            current_size = log_file.stat().st_size
            
            if current_size > last_size:
                # New log content
                with open(log_file, 'r') as f:
                    f.seek(last_size)
                    new_content = f.read()
                    last_size = current_size
                    
                    # Process new lines
                    for line in new_content.strip().split('\n'):
                        if line.strip():
                            # Check for webhook activity indicators
                            webhook_indicators = ['🚀', '📁', '🔄', '✅', '❌', '📊']
                            
                            if any(indicator in line for indicator in webhook_indicators):
                                webhook_activity_count += 1
                                print(f"{Colors.GREEN}[WEBHOOK #{webhook_activity_count:02d}]{Colors.END} {line}")
                            elif any(keyword in line.lower() for keyword in ['webhook', 'storage', 'c3d-upload']):
                                print(f"{Colors.BLUE}[WEBHOOK]{Colors.END} {line}")
                            elif 'error' in line.lower() or 'exception' in line.lower():
                                print(f"{Colors.RED}[ERROR]{Colors.END} {line}")
                            elif any(keyword in line for keyword in ['INFO:', 'DEBUG:', 'WARNING:']):
                                # Regular log entries (less prominent)
                                print(f"{Colors.BLUE}[LOG]{Colors.END} {line}")
            
            time.sleep(0.5)  # Check every 500ms for responsive monitoring
            
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}{'='*60}{Colors.END}")
        log("INFO", f"Monitoring stopped. Detected {webhook_activity_count} webhook activities.")
        if webhook_activity_count > 0:
            log("SUCCESS", "✅ Webhook system is working! Supabase is triggering your script.")
        else:
            log("WARNING", "⚠️  No webhook activity detected. Check your Supabase webhook configuration.")


def check_environment():
    """Check if environment is ready for webhook testing."""
    issues = []
    
    # Check if backend is running
    try:
        import requests
        response = requests.get("http://localhost:8080", timeout=2)
        log("SUCCESS", "✅ Backend is running on port 8080")
    except:
        issues.append("Backend not running on port 8080")
    
    # Check if ngrok is running (look for ngrok log)
    ngrok_log = Path("logs/ngrok.log")
    if ngrok_log.exists():
        with open(ngrok_log, 'r') as f:
            content = f.read()
            if 'ngrok-free.app' in content:
                import re
                match = re.search(r'https://[a-zA-Z0-9-]+\.ngrok-free\.app', content)
                if match:
                    ngrok_url = match.group(0)
                    log("SUCCESS", f"✅ ngrok tunnel active: {ngrok_url}")
                    log("INFO", f"📡 Webhook URL: {ngrok_url}/webhooks/storage/c3d-upload")
                else:
                    issues.append("ngrok URL not found in logs")
            else:
                issues.append("ngrok tunnel not detected")
    else:
        issues.append("ngrok not running (no log file found)")
    
    # Check log file exists
    if not Path("logs/backend.error.log").exists():
        issues.append("Backend log file not found")
    
    if issues:
        log("WARNING", "Environment issues detected:")
        for issue in issues:
            print(f"  {Colors.RED}❌{Colors.END} {issue}")
        log("INFO", "Start the complete environment with: ./start_dev.sh --webhook")
        print()
        return False
    else:
        log("SUCCESS", "✅ Environment ready for webhook testing!")
        print()
        return True


def main():
    """Main execution."""
    print(f"{Colors.BOLD}Webhook Activity Monitor{Colors.END}")
    print(f"{Colors.BOLD}{'='*30}{Colors.END}\n")
    
    if not check_environment():
        log("INFO", "Fix environment issues and try again")
        return
    
    monitor_webhook_logs()


if __name__ == "__main__":
    main()