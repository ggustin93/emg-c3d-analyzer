"""
GHOSTLY+ API Test Script
========================

Simple script to test the GHOSTLY+ API endpoints with an example C3D file.
"""

import requests
import os
import argparse
from pathlib import Path

def test_api(base_url, c3d_file):
    """Test the GHOSTLY+ API with a C3D file."""
    print(f"Testing API at {base_url} with file {c3d_file}")

    if not Path(c3d_file).exists():
        print(f"Error: File {c3d_file} not found")
        return

    # Test root endpoint
    print("\n1. Testing root endpoint...")
    response = requests.get(f"{base_url}/")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    # Upload file
    print("\n2. Uploading C3D file...")
    files = {"file": open(c3d_file, "rb")}
    data = {
        "patient_id": "TEST001",
        "user_id": "USER001",
        "session_id": "SESSION001",
        "generate_plots": "true"
    }

    response = requests.post(f"{base_url}/upload", files=files, data=data)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        file_id = result["file_id"]
        print(f"File uploaded successfully with ID: {file_id}")

        # List all results
        print("\n3. Listing all results...")
        response = requests.get(f"{base_url}/results")
        print(f"Status: {response.status_code}")
        print(f"Results: {response.json()}")

        # Get the specific result
        print(f"\n4. Getting result for {file_id}...")
        response = requests.get(f"{base_url}/results/{file_id}")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            analytics = result["analytics"]
            print(f"Channels: {', '.join(analytics.keys())}")

            # For the first channel, get raw data
            if analytics:
                channel = list(analytics.keys())[0]
                print(f"\n5. Getting raw data for channel {channel}...")
                response = requests.get(f"{base_url}/raw-data/{file_id}/{channel}")
                print(f"Status: {response.status_code}")
                if response.status_code == 200:
                    print(f"Raw data retrieved successfully")

                # Check if the plot was generated
                print(f"\n6. Checking plot for channel {channel}...")
                plot_url = f"{base_url}/plot/{file_id}/{channel}"
                print(f"Plot URL: {plot_url}")

                # Check if the report was generated
                print(f"\n7. Checking report...")
                report_url = f"{base_url}/report/{file_id}"
                print(f"Report URL: {report_url}")
    else:
        print(f"Error uploading file: {response.text}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test GHOSTLY+ API")
    parser.add_argument("--url", default="http://localhost:8080", help="Base URL of the API")
    parser.add_argument("--file", required=True, help="Path to a C3D file to upload")

    args = parser.parse_args()
    test_api(args.url, args.file)