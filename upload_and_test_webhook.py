#!/usr/bin/env python3
"""
Upload real C3D file to Supabase Storage and monitor webhook processing
"""

import os
import time
from supabase import create_client, Client
from datetime import datetime

def upload_and_test_webhook():
    """Upload C3D file to Supabase and monitor webhook"""
    
    # Supabase configuration
    SUPABASE_URL = "https://egihfsmxphqcsjotmhmm.supabase.co"
    SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnaWhmc214cGhxY3Nqb3RtaG1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzEzMzQwOSwiZXhwIjoyMDYyNzA5NDA5fQ.G3gP5taCBZLh3fa0fh8dD5wUl8AroX-S6gCwMoa6ABY"
    
    # Initialize Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # Real C3D file path
    c3d_file_path = "/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/backend/tests/samples/Ghostly_Emg_20230321_17-50-17-0881.c3d"
    
    if not os.path.exists(c3d_file_path):
        print(f"❌ C3D file not found: {c3d_file_path}")
        return
    
    print(f"🚀 Uploading real C3D file to Supabase Storage...")
    print(f"📁 File: {os.path.basename(c3d_file_path)}")
    print(f"📊 Size: {os.path.getsize(c3d_file_path):,} bytes")
    
    # Generate unique file path
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    storage_path = f"webhook_test/{timestamp}_Ghostly_Emg_20230321_17-50-17-0881.c3d"
    
    try:
        # Read file data
        with open(c3d_file_path, 'rb') as f:
            file_data = f.read()
        
        print(f"📤 Uploading to: c3d-examples/{storage_path}")
        
        # Upload to Supabase Storage (this should trigger the webhook automatically)
        response = supabase.storage.from_("c3d-examples").upload(
            path=storage_path,
            file=file_data,
            file_options={"content-type": "application/octet-stream"}
        )
        
        if response:
            print(f"✅ Upload successful!")
            print(f"📍 Storage path: {storage_path}")
            print(f"🔗 Response: {response}")
            
            # Check if file exists in storage
            print(f"\n🔍 Verifying file in storage...")
            file_list = supabase.storage.from_("c3d-examples").list(path="webhook_test/")
            uploaded_file = next((f for f in file_list if f['name'] == os.path.basename(storage_path)), None)
            
            if uploaded_file:
                print(f"✅ File verified in storage:")
                print(f"   📏 Size: {uploaded_file.get('metadata', {}).get('size', 'N/A')} bytes")
                print(f"   📅 Created: {uploaded_file.get('created_at', 'N/A')}")
                print(f"   🔐 ETag: {uploaded_file.get('metadata', {}).get('eTag', 'N/A')}")
            
            # Monitor webhook processing
            print(f"\n🔄 Monitoring webhook processing...")
            print(f"💡 Check backend logs for webhook activity:")
            print(f"   tail -f logs/backend.error.log | grep -E '(🚀|📁|🔄|✅|❌|📊)'")
            
            # Wait a moment and check database for new session
            print(f"\n⏳ Waiting 10 seconds for webhook processing...")
            time.sleep(10)
            
            # Query database for new therapy sessions
            print(f"\n📊 Checking database for new therapy sessions...")
            sessions = supabase.table("therapy_sessions").select("*").execute()
            
            if sessions.data:
                latest_session = max(sessions.data, key=lambda x: x['created_at'])
                if storage_path in latest_session.get('file_path', ''):
                    print(f"✅ Webhook processing successful!")
                    print(f"   🆔 Session ID: {latest_session['id']}")
                    print(f"   📁 File path: {latest_session['file_path']}")
                    print(f"   📊 Processing status: {latest_session['processing_status']}")
                    print(f"   📈 Channels: {latest_session['channel_count']}")
                    print(f"   ⚡ Sampling rate: {latest_session['original_sampling_rate']} Hz")
                    
                    # Check processing parameters
                    params = supabase.table("processing_parameters").select("*").eq("session_id", latest_session['id']).execute()
                    if params.data:
                        param = params.data[0]
                        print(f"   🎛️ Processing parameters:")
                        print(f"      🌊 Filter: {param['filter_low_cutoff_hz']}-{param['filter_high_cutoff_hz']} Hz")
                        print(f"      📏 RMS window: {param['rms_window_size_ms']} ms")
                        print(f"      🎯 MVC method: {param['mvc_calculation_method']}")
                        print(f"      🔔 Notch filter: {param['notch_filter_enabled']} @ {param['notch_filter_frequency_hz']} Hz")
                else:
                    print(f"⚠️ Session found but doesn't match our upload")
            else:
                print(f"⚠️ No therapy sessions found in database")
            
        else:
            print(f"❌ Upload failed:")
            print(f"   Error: {response}")
            
    except Exception as e:
        print(f"❌ Upload error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    upload_and_test_webhook()