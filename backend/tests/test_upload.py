#!/usr/bin/env python3
"""
GHOSTLY+ Upload Test Script
===========================

Simple script to test the GHOSTLY+ API upload endpoint with the sample C3D files.
"""

import requests
import os
import argparse
from pathlib import Path

def test_upload(base_url, c3d_file):
    """Test the GHOSTLY+ API upload endpoint with a C3D file."""
    print(f"Testing upload endpoint at {base_url} with file {c3d_file}")

    if not Path(c3d_file).exists():
        print(f"Error: File {c3d_file} not found")
        return

    # Upload file
    print("\nUploading C3D file...")
    files = {"file": open(c3d_file, "rb")}
    data = {
        "patient_id": "TEST001",
        "user_id": "USER001",
        "session_id": "SESSION001",
        "generate_plots": "true"
    }

    try:
        response = requests.post(f"{base_url}/upload", files=files, data=data)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            file_id = result.get("file_id", "unknown")
            print(f"File uploaded successfully with ID: {file_id}")
            print(f"Available channels: {', '.join(result.get('available_channels', []))}")
            print(f"Analytics: {len(result.get('analytics', {}))} channels analyzed")
            return True
        else:
            print(f"Error uploading file: {response.text}")
            print(f"Response headers: {response.headers}")
            print(f"Response status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"Exception during upload: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test GHOSTLY+ API Upload")
    parser.add_argument("--url", default="http://localhost:8081", help="Base URL of the API")
    parser.add_argument("--file", required=True, help="Path to a C3D file to upload")

    args = parser.parse_args()
    test_upload(args.url, args.file) 