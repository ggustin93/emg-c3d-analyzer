#!/usr/bin/env python3
"""
Automated Webhook Testing with Database Verification
===================================================
This script automates the complete webhook testing workflow:
1. Uploads a real C3D file to Supabase Storage
2. Monitors webhook processing in real-time
3. Queries database for cached results
4. Tests duplicate detection
5. Displays comprehensive results
"""

import os
import sys
import time
import json
import hashlib
import asyncio
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List

# Add backend to path for imports (now from tests/webhook subfolder)
sys.path.append(str(Path(__file__).parent.parent.parent / 'backend'))

try:
    from supabase import create_client, Client
    print("✅ Supabase client imported successfully")
except ImportError:
    print("❌ Error: supabase-py not installed. Install with: pip install supabase")
    sys.exit(1)

class WebhookTester:
    def __init__(self):
        self.setup_colors()
        self.setup_supabase()
        self.sample_file = Path(__file__).parent.parent / "samples/Ghostly_Emg_20230321_17-50-17-0881.c3d"
        self.ngrok_url = self.get_ngrok_url()
        self.test_bucket = "c3d-examples"
        
    def setup_colors(self):
        """Setup console colors"""
        self.COLORS = {
            'HEADER': '\033[95m',
            'BLUE': '\033[94m',
            'CYAN': '\033[96m',
            'GREEN': '\033[92m',
            'WARNING': '\033[93m',
            'FAIL': '\033[91m',
            'BOLD': '\033[1m',
            'UNDERLINE': '\033[4m',
            'END': '\033[0m'
        }
    
    def print_colored(self, message: str, color: str = 'END'):
        """Print colored message"""
        print(f"{self.COLORS.get(color, '')}{message}{self.COLORS['END']}")
    
    def setup_supabase(self):
        """Setup Supabase client"""
        try:
            # Load environment variables (you'll need to set these)
            supabase_url = os.getenv('SUPABASE_URL', 'https://egihfsmxphqcsjotmhmm.supabase.co')
            supabase_service_key = os.getenv('SUPABASE_SERVICE_KEY')
            
            if not supabase_service_key:
                self.print_colored("❌ SUPABASE_SERVICE_KEY not set. Please set environment variable.", 'FAIL')
                self.print_colored("   Get it from Supabase Dashboard > Settings > API > service_role key", 'CYAN')
                sys.exit(1)
                
            self.supabase: Client = create_client(supabase_url, supabase_service_key)
            self.print_colored("✅ Supabase client initialized", 'GREEN')
            
        except Exception as e:
            self.print_colored(f"❌ Failed to setup Supabase: {e}", 'FAIL')
            sys.exit(1)
    
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
            self.print_colored(f"❌ Failed to get ngrok URL: {e}", 'FAIL')
            self.print_colored("   Make sure ngrok is running with: ngrok http 8080", 'CYAN')
            sys.exit(1)
    
    def calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    def upload_file_to_storage(self, file_path: Path, object_name: str) -> bool:
        """Upload file to Supabase Storage"""
        try:
            self.print_colored(f"📤 Uploading {file_path.name} to {self.test_bucket}/{object_name}...", 'BLUE')
            
            with open(file_path, 'rb') as f:
                result = self.supabase.storage.from_(self.test_bucket).upload(object_name, f)
                
            self.print_colored(f"✅ Upload successful: {result}", 'GREEN')
            return True
            
        except Exception as e:
            # File might already exist - try to update instead
            try:
                with open(file_path, 'rb') as f:
                    result = self.supabase.storage.from_(self.test_bucket).update(object_name, f)
                self.print_colored(f"✅ File updated: {result}", 'GREEN')
                return True
            except Exception as e2:
                self.print_colored(f"❌ Upload failed: {e2}", 'FAIL')
                return False
    
    def monitor_webhook_logs(self, duration: int = 10) -> List[str]:
        """Monitor backend logs for webhook activity"""
        log_file = Path(__file__).parent.parent.parent / "logs/backend.error.log"
        
        if not log_file.exists():
            self.print_colored("⚠️  Backend log file not found", 'WARNING')
            return []
        
        # Get initial file size
        initial_size = log_file.stat().st_size
        
        self.print_colored(f"👀 Monitoring webhook activity for {duration} seconds...", 'CYAN')
        
        webhook_logs = []
        start_time = time.time()
        
        while time.time() - start_time < duration:
            try:
                current_size = log_file.stat().st_size
                if current_size > initial_size:
                    # Read new content
                    with open(log_file, 'r') as f:
                        f.seek(initial_size)
                        new_content = f.read()
                        
                    # Filter webhook-related logs
                    for line in new_content.split('\n'):
                        if any(keyword in line.lower() for keyword in ['webhook', 'c3d', 'processing', 'cache']):
                            webhook_logs.append(line.strip())
                            if line.strip():
                                self.print_colored(f"📝 {line.strip()}", 'CYAN')
                    
                    initial_size = current_size
                
                time.sleep(0.5)
                
            except Exception as e:
                self.print_colored(f"⚠️  Error monitoring logs: {e}", 'WARNING')
                break
        
        return webhook_logs
    
    def query_database_metadata(self, object_name: str) -> Optional[Dict]:
        """Query c3d_metadata table"""
        try:
            result = self.supabase.table('c3d_metadata').select('*').eq('object_name', object_name).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            self.print_colored(f"❌ Error querying metadata: {e}", 'FAIL')
            return None
    
    def query_database_cache(self, file_hash: str) -> Optional[Dict]:
        """Query analysis_cache table"""
        try:
            result = self.supabase.table('analysis_cache').select('*').eq('file_hash', file_hash).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            self.print_colored(f"❌ Error querying cache: {e}", 'FAIL')
            return None
    
    def display_database_results(self, metadata: Dict, cache: Dict, file_hash: str):
        """Display database query results"""
        self.print_colored("\n" + "="*60, 'HEADER')
        self.print_colored("📊 DATABASE RESULTS", 'HEADER')
        self.print_colored("="*60, 'HEADER')
        
        # Metadata results
        if metadata:
            self.print_colored("✅ C3D Metadata Found:", 'GREEN')
            self.print_colored(f"   📁 Object: {metadata.get('object_name')}", 'CYAN')
            self.print_colored(f"   🪣 Bucket: {metadata.get('bucket_name')}", 'CYAN')
            self.print_colored(f"   📏 Size: {metadata.get('file_size')} bytes", 'CYAN')
            self.print_colored(f"   🕒 Uploaded: {metadata.get('upload_timestamp')}", 'CYAN')
            self.print_colored(f"   🔍 Hash: {metadata.get('file_hash', 'N/A')[:16]}...", 'CYAN')
        else:
            self.print_colored("❌ No metadata found in database", 'FAIL')
        
        # Cache results
        if cache:
            self.print_colored("\n✅ Analysis Cache Found:", 'GREEN')
            self.print_colored(f"   🔍 Hash: {cache.get('file_hash', 'N/A')[:16]}...", 'CYAN')
            self.print_colored(f"   ⚙️  Processed: {cache.get('created_at')}", 'CYAN')
            self.print_colored(f"   📊 Channels: {len(cache.get('analysis_result', {}).get('analytics', {}))}", 'CYAN')
            
            # Show analytics summary
            analytics = cache.get('analysis_result', {}).get('analytics', {})
            if analytics:
                self.print_colored("   📈 Channel Analytics:", 'CYAN')
                for channel, data in analytics.items():
                    contractions = data.get('contraction_count', 0)
                    rms = data.get('rms', 0)
                    self.print_colored(f"      {channel}: {contractions} contractions, RMS: {rms:.6f}", 'BLUE')
        else:
            self.print_colored("\n❌ No analysis cache found", 'FAIL')
    
    def test_duplicate_detection(self, object_name: str, file_hash: str) -> bool:
        """Test duplicate detection by re-uploading same file"""
        self.print_colored(f"\n🔄 Testing duplicate detection...", 'BLUE')
        
        # Re-upload the same file
        success = self.upload_file_to_storage(self.sample_file, object_name)
        
        if success:
            # Monitor for duplicate detection logs
            logs = self.monitor_webhook_logs(8)
            
            # Check if duplicate was detected
            duplicate_detected = any('duplicate' in log.lower() for log in logs)
            
            if duplicate_detected:
                self.print_colored("✅ Duplicate detection working correctly", 'GREEN')
                return True
            else:
                self.print_colored("⚠️  Duplicate detection may not be working", 'WARNING')
                return False
        
        return False
    
    async def run_automated_test(self):
        """Run the complete automated test"""
        self.print_colored("🚀 AUTOMATED WEBHOOK TESTING", 'HEADER')
        self.print_colored("="*50, 'HEADER')
        
        # Verify sample file exists
        if not self.sample_file.exists():
            self.print_colored(f"❌ Sample file not found: {self.sample_file}", 'FAIL')
            return
        
        # Calculate file hash
        file_hash = self.calculate_file_hash(self.sample_file)
        self.print_colored(f"🔍 File hash: {file_hash[:16]}...", 'CYAN')
        
        # Create unique object name with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        object_name = f"test_automated_{timestamp}.c3d"
        
        self.print_colored(f"📡 ngrok URL: {self.ngrok_url}", 'CYAN')
        self.print_colored(f"🎯 Webhook endpoint: {self.ngrok_url}/webhooks/storage/c3d-upload", 'CYAN')
        
        # Step 1: Upload file
        self.print_colored(f"\n📤 STEP 1: Uploading C3D file", 'BOLD')
        upload_success = self.upload_file_to_storage(self.sample_file, object_name)
        
        if not upload_success:
            self.print_colored("❌ Upload failed, cannot continue test", 'FAIL')
            return
        
        # Step 2: Monitor webhook processing
        self.print_colored(f"\n👀 STEP 2: Monitoring webhook processing", 'BOLD')
        webhook_logs = self.monitor_webhook_logs(12)
        
        # Step 3: Query database
        self.print_colored(f"\n🔍 STEP 3: Querying database", 'BOLD')
        
        # Wait a moment for processing to complete
        time.sleep(2)
        
        metadata = self.query_database_metadata(object_name)
        cache = self.query_database_cache(file_hash)
        
        # Step 4: Display results
        self.display_database_results(metadata, cache, file_hash)
        
        # Step 5: Test duplicate detection
        self.print_colored(f"\n🔄 STEP 5: Testing duplicate detection", 'BOLD')
        duplicate_success = self.test_duplicate_detection(object_name, file_hash)
        
        # Final summary
        self.print_colored("\n" + "="*50, 'HEADER')
        self.print_colored("📋 TEST SUMMARY", 'HEADER')
        self.print_colored("="*50, 'HEADER')
        
        results = {
            "File Upload": "✅" if upload_success else "❌",
            "Webhook Processing": "✅" if webhook_logs else "⚠️",
            "Database Metadata": "✅" if metadata else "❌",
            "Analysis Cache": "✅" if cache else "❌", 
            "Duplicate Detection": "✅" if duplicate_success else "⚠️"
        }
        
        for test, status in results.items():
            self.print_colored(f"{status} {test}", 'GREEN' if '✅' in status else ('WARNING' if '⚠️' in status else 'FAIL'))
        
        # Cleanup option
        self.print_colored(f"\n🧹 Cleanup: To remove test file, run:", 'CYAN')
        self.print_colored(f"   supabase storage rm {self.test_bucket} {object_name}", 'BLUE')

if __name__ == "__main__":
    # Check if service key is provided
    if not os.getenv('SUPABASE_SERVICE_KEY'):
        print("❌ Please set SUPABASE_SERVICE_KEY environment variable")
        print("   Get it from Supabase Dashboard > Settings > API > service_role key")
        print("   Then run: export SUPABASE_SERVICE_KEY=your_key_here")
        sys.exit(1)
    
    tester = WebhookTester()
    asyncio.run(tester.run_automated_test())