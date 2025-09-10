#!/usr/bin/env python3
"""Safe MVC Endpoint Testing Script
===================================

Tests the /mvc/calibrate endpoint without affecting production data.
This script is completely safe - it only calls the isolated MVC calculation endpoint.

Usage:
    python scripts/test_mvc_endpoint.py
"""

import requests
import json
import pytest
from pathlib import Path
import sys

# Add backend to Python path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

@pytest.mark.skip(reason="Manual test script requiring live server - not for CI execution")
def test_mvc_endpoint():
    """Test the MVC calibration endpoint with sample data."""
    
    # API endpoint (adjust port if needed)
    BASE_URL = "http://localhost:8080"
    endpoint = f"{BASE_URL}/mvc/calibrate"
    
    print("🧪 Testing MVC Calibration Endpoint")
    print("=" * 50)
    
    # Test 1: Check if API is running
    try:
        health_response = requests.get(f"{BASE_URL}/health", timeout=5)
        if health_response.status_code == 200:
            print("✅ API is running and accessible")
        else:
            print("❌ API health check failed")
            return
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to API: {e}")
        print("💡 Make sure the backend is running: uvicorn main:app --reload --port 8080")
        return
    
    # Test 2: Find available C3D files
    sample_files = []
    
    # Look for C3D files in common locations
    search_paths = [
        backend_dir / "tests" / "samples",
        backend_dir / "samples",
        Path.cwd() / "samples",
    ]
    
    for search_path in search_paths:
        if search_path.exists():
            c3d_files = list(search_path.glob("*.c3d"))
            sample_files.extend(c3d_files)
    
    if not sample_files:
        print("⚠️ No C3D files found for testing")
        print("💡 Place a C3D file in backend/tests/samples/ or backend/samples/")
        
        # Test with no file (should return error)
        print("\n🧪 Testing endpoint without file...")
        test_no_file(endpoint)
        return
    
    # Test 3: Test with actual C3D file
    test_file = sample_files[0]
    print(f"\n🧪 Testing with C3D file: {test_file.name}")
    
    try:
        with open(test_file, 'rb') as f:
            files = {'file': (test_file.name, f, 'application/octet-stream')}
            data = {
                'user_id': 'test_user_mvc',
                'session_id': 'test_session_mvc', 
                'threshold_percentage': 75.0
            }
            
            print("📤 Uploading file and calculating MVC...")
            response = requests.post(endpoint, files=files, data=data, timeout=30)
            
            if response.status_code == 200:
                print("✅ MVC calculation successful!")
                
                # Parse and display results
                result = response.json()
                print("\n📊 MVC Results:")
                print("-" * 30)
                
                if 'mvc_estimations' in result:
                    for channel, estimation in result['mvc_estimations'].items():
                        print(f"Channel: {channel}")
                        print(f"  MVC Value: {estimation['mvc_value']:.4f}")
                        print(f"  Threshold (75%): {estimation['threshold_value']:.4f}")
                        print(f"  Confidence: {estimation['confidence_score']:.2f}")
                        print(f"  Method: {estimation['estimation_method']}")
                        print()
                
                if 'file_info' in result:
                    file_info = result['file_info']
                    print(f"File Info:")
                    print(f"  Channels Processed: {file_info.get('channels_processed', [])}")
                    print(f"  Sampling Rate: {file_info.get('sampling_rate', 'N/A')} Hz")
                    print()
                
                # Test different threshold percentages
                print("🧪 Testing different threshold percentages...")
                test_different_thresholds(endpoint, test_file)
                
            else:
                print(f"❌ MVC calculation failed: {response.status_code}")
                print(f"Response: {response.text}")
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")

def test_no_file(endpoint):
    """Test endpoint behavior without file."""
    try:
        response = requests.post(endpoint, timeout=10)
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 400:
            print("✅ Correctly rejects request without file")
        else:
            print("⚠️ Unexpected response for no-file request")
            
    except Exception as e:
        print(f"❌ No-file test failed: {e}")

def test_different_thresholds(endpoint, test_file):
    """Test with different threshold percentages."""
    thresholds = [60.0, 75.0, 85.0]
    
    for threshold in thresholds:
        try:
            with open(test_file, 'rb') as f:
                files = {'file': (test_file.name, f, 'application/octet-stream')}
                data = {
                    'user_id': 'test_threshold',
                    'threshold_percentage': threshold
                }
                
                response = requests.post(endpoint, files=files, data=data, timeout=30)
                
                if response.status_code == 200:
                    result = response.json()
                    if 'mvc_estimations' in result:
                        first_channel = list(result['mvc_estimations'].keys())[0]
                        estimation = result['mvc_estimations'][first_channel]
                        print(f"  {threshold}% threshold → {estimation['threshold_value']:.4f}")
                else:
                    print(f"  {threshold}% threshold → ERROR: {response.status_code}")
                    
        except Exception as e:
            print(f"  {threshold}% threshold → ERROR: {e}")

def main():
    """Main test execution."""
    print("🔬 MVC Endpoint Safety Testing")
    print("This script ONLY tests the /mvc/calibrate endpoint")
    print("It makes NO changes to the database or production system")
    print()
    
    test_mvc_endpoint()
    
    print("\n" + "=" * 50)
    print("✅ Testing completed safely!")
    print("💡 The MVC endpoint is isolated and safe to use for experimentation")
    print("💡 Next step: Review results and plan database integration")

if __name__ == "__main__":
    main()