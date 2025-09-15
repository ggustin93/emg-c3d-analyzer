#!/usr/bin/env python3
"""
Test script to validate the adherence score temporal baseline fix.
Tests both API endpoint and service layer with the new implementation.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

def test_api_endpoint():
    """Test the adherence API endpoint with protocol day calculation."""
    import requests
    from database.supabase_client import get_supabase_client
    
    print("\n" + "="*60)
    print("Testing Adherence API Endpoint")
    print("="*60)
    
    # Test patient codes
    test_patients = ["P001", "P002", "P003"]
    
    for patient_code in test_patients:
        try:
            # Call the API endpoint
            response = requests.get(f"http://localhost:8080/scoring/adherence/{patient_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"\n✅ Patient {patient_code}:")
                print(f"   Protocol Day: {data.get('protocol_day', 'N/A')} of {data.get('trial_duration', 14)}")
                print(f"   Sessions: {data.get('sessions_completed', 0)}/{data.get('sessions_expected', 'N/A')}")
                print(f"   Adherence Score: {data.get('adherence_score', 'N/A')}%")
                print(f"   Clinical Threshold: {data.get('clinical_threshold', 'N/A')}")
                print(f"   Total Planned: {data.get('total_sessions_planned', 30)} sessions")
                
                # Validate protocol day is reasonable
                if data.get('protocol_day'):
                    assert 1 <= data['protocol_day'] <= 365, f"Protocol day {data['protocol_day']} out of range"
                    print(f"   ✓ Protocol day validation passed")
                
            elif response.status_code == 404:
                print(f"\n⚠️  Patient {patient_code} not found in database")
            else:
                print(f"\n❌ Patient {patient_code}: API error {response.status_code}")
                print(f"   {response.text}")
                
        except Exception as e:
            print(f"\n❌ Error testing {patient_code}: {e}")
    
    print("\n" + "-"*60)

def test_service_layer():
    """Test the PerformanceScoringService directly."""
    from services.clinical.performance_scoring_service import PerformanceScoringService
    from database.supabase_client import get_supabase_client
    
    print("\n" + "="*60)
    print("Testing PerformanceScoringService")
    print("="*60)
    
    try:
        service = PerformanceScoringService()
        supabase = get_supabase_client(use_service_key=True)
        
        # Get a test patient
        patient_result = supabase.table("patients").select("id, patient_code, created_at").limit(1).execute()
        
        if patient_result.data:
            patient = patient_result.data[0]
            patient_id = patient["id"]
            patient_code = patient["patient_code"]
            
            print(f"\nTesting with patient {patient_code} (ID: {patient_id})")
            
            # Test different protocol days
            test_days = [1, 3, 7, 14]
            
            for day in test_days:
                result = service.calculate_adherence_score(patient_id, protocol_day=day)
                
                print(f"\n📊 Day {day}:")
                print(f"   Expected Sessions: {result['expected_sessions']:.2f}")
                print(f"   Completed Sessions: {result['completed_sessions']}")
                print(f"   Adherence Score: {result['adherence_score']:.1f}%")
                print(f"   Category: {result['category']}")
                
                # Validate the calculation
                expected_rate = result.get('total_sessions_planned', 30) / 14  # Sessions per day
                expected_sessions = expected_rate * day
                
                assert abs(result['expected_sessions'] - expected_sessions) < 0.1, \
                    f"Expected sessions calculation mismatch"
                print(f"   ✓ Calculation validated")
        else:
            print("\n⚠️  No patients found in database for testing")
            
    except Exception as e:
        print(f"\n❌ Service layer error: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "-"*60)

def test_database_fields():
    """Verify the database has the new fields."""
    from database.supabase_client import get_supabase_client
    
    print("\n" + "="*60)
    print("Testing Database Schema")
    print("="*60)
    
    try:
        supabase = get_supabase_client(use_service_key=True)
        
        # Check if patients table has new columns
        result = supabase.table("patients").select("id, treatment_start_date, total_sessions_planned").limit(1).execute()
        
        if result.data:
            print("\n✅ Database schema updated successfully:")
            print("   - treatment_start_date field exists")
            print("   - total_sessions_planned field exists")
            
            sample = result.data[0]
            print(f"\n📋 Sample data:")
            print(f"   Treatment Start: {sample.get('treatment_start_date', 'Not set')}")
            print(f"   Total Sessions Planned: {sample.get('total_sessions_planned', 'Not set')}")
        else:
            print("\n⚠️  No data to verify, but query succeeded (fields exist)")
            
    except Exception as e:
        if "column" in str(e).lower():
            print(f"\n❌ Database schema not updated: Missing columns")
            print(f"   Please run the migration: supabase db push")
        else:
            print(f"\n❌ Database error: {e}")
    
    print("\n" + "-"*60)

def main():
    """Run all tests."""
    print("\n🧪 ADHERENCE TEMPORAL BASELINE FIX - VALIDATION SUITE")
    print("="*60)
    
    # Check if backend is running
    try:
        import requests
        response = requests.get("http://localhost:8080/health")
        if response.status_code != 200:
            print("\n⚠️  Backend not responding. Start it with: ./start_dev_simple.sh")
            return
    except:
        print("\n⚠️  Backend not running. Start it with: ./start_dev_simple.sh")
        return
    
    # Run tests
    test_database_fields()
    test_api_endpoint()
    test_service_layer()
    
    print("\n" + "="*60)
    print("✅ VALIDATION COMPLETE")
    print("="*60)
    print("\nNext steps:")
    print("1. If database fields are missing, run: supabase db push")
    print("2. Test in frontend: Check patient table shows 'Day X of 14'")
    print("3. Verify adherence scores are now calculated correctly")
    print("\n")

if __name__ == "__main__":
    main()