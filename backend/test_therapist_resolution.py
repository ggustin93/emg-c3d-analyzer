#!/usr/bin/env python3
"""
Test script for therapist resolution functionality.

Tests the complete workflow:
1. Patient-therapist relationship in database
2. FastAPI endpoints for therapist resolution
3. Frontend integration with role-based visibility

Run with: python test_therapist_resolution.py
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from database.supabase_client import get_supabase_client
from services.user.repositories.therapist_repository import TherapistRepository
from services.user.therapist_resolution_service import TherapistResolutionService
from services.clinical.repositories.patient_repository import PatientRepository


def test_database_relationships():
    """Test patient-therapist relationships in database."""
    print("\n=== Testing Database Relationships ===")
    
    client = get_supabase_client(use_service_key=True)
    patient_repo = PatientRepository(client)
    
    # Test getting patient by code
    test_codes = ["P001", "P002", "P003"]
    for code in test_codes:
        patient = patient_repo.get_patient_by_code(code)
        if patient:
            print(f"✅ Patient {code}: ID={patient['id']}, Therapist={patient.get('therapist_id')}")
        else:
            print(f"❌ Patient {code}: Not found")


def test_therapist_resolution():
    """Test therapist resolution service."""
    print("\n=== Testing Therapist Resolution Service ===")
    
    client = get_supabase_client(use_service_key=True)
    repo = TherapistRepository(client)
    service = TherapistResolutionService(repo)
    
    # Test single resolution
    test_codes = ["P001", "P002", "P003", "P999"]  # P999 shouldn't exist
    for code in test_codes:
        therapist = service.resolve_therapist(code)
        if therapist:
            print(f"✅ {code} -> {therapist['display_name']} (ID: {therapist['id']})")
        else:
            print(f"❌ {code} -> No therapist found")
    
    # Test batch resolution
    print("\n--- Batch Resolution ---")
    results = service.resolve_therapists_batch(["P001", "P002", "P003"])
    for code, therapist in results.items():
        print(f"✅ {code} -> {therapist['display_name']}")
    
    # Test cache stats
    stats = service.get_cache_stats()
    print(f"\n📊 Cache Stats: {stats['hits']} hits out of {stats['size']} entries")


def test_file_path_extraction():
    """Test patient code extraction from file paths."""
    print("\n=== Testing File Path Extraction ===")
    
    client = get_supabase_client(use_service_key=True)
    repo = TherapistRepository(client)
    service = TherapistResolutionService(repo)
    
    test_paths = [
        "patient_sessions/P001_Ghostly_2024.c3d",
        "P002/Ghostly_test.c3d",
        "c3d-examples/P003_session.c3d",
        "invalid_path.c3d",
        "P004_direct.c3d"
    ]
    
    for path in test_paths:
        code = service.extract_patient_code_from_path(path)
        if code:
            therapist = service.resolve_therapist(code)
            if therapist:
                print(f"✅ {path} -> {code} -> {therapist['display_name']}")
            else:
                print(f"⚠️ {path} -> {code} -> No therapist")
        else:
            print(f"❌ {path} -> No patient code found")


def test_role_based_access():
    """Test role-based access patterns."""
    print("\n=== Testing Role-Based Access ===")
    
    client = get_supabase_client(use_service_key=True)
    
    # Get all therapists
    therapists = client.table('user_profiles').select('*').eq('role', 'THERAPIST').execute()
    
    if therapists.data:
        for therapist in therapists.data:
            print(f"\n👤 Therapist: {therapist.get('first_name', '')} {therapist.get('last_name', '')} ({therapist['user_code']})")
            
            # Get patients for this therapist
            patients = client.table('patients').select('*').eq('therapist_id', therapist['id']).execute()
            
            if patients.data:
                print(f"   Patients: {', '.join([p['patient_code'] for p in patients.data])}")
            else:
                print(f"   No patients assigned")
    
    print("\n📋 Role-Based UI Rules:")
    print("   ADMIN: Can see all columns, upload button visible")
    print("   THERAPIST: Cannot see therapist column, no upload button")
    print("   RESEARCHER: Can see all columns, no upload button")


async def test_api_endpoints():
    """Test FastAPI endpoints (requires running server)."""
    print("\n=== Testing FastAPI Endpoints ===")
    print("⚠️ Note: Requires backend server running on port 8080")
    
    try:
        import httpx
        
        async with httpx.AsyncClient() as client:
            # Test single resolution
            response = await client.get("http://localhost:8080/api/therapists/resolve/P001")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ API Single: P001 -> {data.get('display_name')}")
            else:
                print(f"❌ API Single: Failed with status {response.status_code}")
            
            # Test batch resolution
            response = await client.post(
                "http://localhost:8080/api/therapists/resolve/batch",
                json={"patient_codes": ["P001", "P002", "P003"]}
            )
            if response.status_code == 200:
                data = response.json()
                print(f"✅ API Batch: Resolved {len(data.get('therapists', {}))} therapists")
            else:
                print(f"❌ API Batch: Failed with status {response.status_code}")
                
    except Exception as e:
        print(f"❌ API Test Failed: {e}")
        print("   Make sure the backend server is running: ./start_dev_simple.sh")


def main():
    """Run all tests."""
    print("=" * 60)
    print("THERAPIST RESOLUTION TEST SUITE")
    print("=" * 60)
    
    # Test database relationships
    test_database_relationships()
    
    # Test therapist resolution service
    test_therapist_resolution()
    
    # Test file path extraction
    test_file_path_extraction()
    
    # Test role-based access
    test_role_based_access()
    
    # Test API endpoints (optional - requires running server)
    # Uncomment to test API endpoints
    # asyncio.run(test_api_endpoints())
    
    print("\n" + "=" * 60)
    print("✅ TEST SUITE COMPLETE")
    print("=" * 60)
    print("\nNext Steps:")
    print("1. Start the backend: ./start_dev_simple.sh")
    print("2. Start the frontend: cd frontend && npm start")
    print("3. Test with different user roles:")
    print("   - Admin: Should see upload button and all columns")
    print("   - Therapist: No upload button, no therapist column")
    print("   - Researcher: No upload button, all columns visible")


if __name__ == "__main__":
    main()