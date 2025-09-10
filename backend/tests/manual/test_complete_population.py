#!/usr/bin/env python3
"""
Test script to verify all database tables are populated correctly.
This demonstrates that the webhook processing flow populates ALL required tables.
"""

import asyncio
import sys
import os
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from services.clinical.therapy_session_processor import TherapySessionProcessor
from models.api.request_response import GameSessionParameters


@pytest.mark.skip(reason="Manual test script - not for CI execution")
async def test_all_tables_populated():
    """Test that all 5 database tables are populated when processing a session."""
    
    print("\n" + "="*80)
    print("TESTING COMPLETE DATABASE POPULATION")
    print("="*80)
    
    # Create mocked dependencies
    mock_c3d_processor = MagicMock()
    mock_emg_data_repo = MagicMock()
    mock_session_repo = MagicMock()
    mock_cache_service = MagicMock()
    mock_performance_service = AsyncMock()  # Must be AsyncMock for await
    mock_supabase_client = MagicMock()
    
    # Configure performance service to return proper scores
    mock_performance_service.calculate_session_performance.return_value = {
        "overall_score": 85.0,
        "channel_scores": {"CH1": 88.0, "CH2": 82.0},
        "contraction_quality_score": 90.0,
        "duration_compliance_score": 80.0,
        "bfr_pressure_aop": 50.0
    }
    
    # Create processor
    processor = TherapySessionProcessor(
        c3d_processor=mock_c3d_processor,
        emg_data_repo=mock_emg_data_repo,
        session_repo=mock_session_repo,
        cache_service=mock_cache_service,
        performance_service=mock_performance_service,
        supabase_client=mock_supabase_client
    )
    
    # Prepare test data
    session_code = "P001S001"
    session_uuid = str(uuid4())
    
    # Sample processing result with analytics
    processing_result = {
        "analytics": {
            "CH1": {
                "mvc_value": 1.5e-4,
                "contractions": [
                    {"meets_mvc": True, "mean_amplitude": 1.2e-4, "duration_ms": 1500},
                    {"meets_mvc": True, "mean_amplitude": 1.3e-4, "duration_ms": 1600},
                    {"meets_mvc": False, "mean_amplitude": 0.9e-4, "duration_ms": 1200},
                ],
                "avg_amplitude": 1.1e-4,
                "compliance_rate": 0.67
            },
            "CH2": {
                "mvc_value": 1.5e-4,
                "contractions": [
                    {"meets_mvc": True, "mean_amplitude": 1.4e-4, "duration_ms": 1700},
                    {"meets_mvc": True, "mean_amplitude": 1.3e-4, "duration_ms": 1600},
                ],
                "avg_amplitude": 1.35e-4,
                "compliance_rate": 1.0
            }
        },
        "metadata": {
            "sampling_rate": 1000.0,
            "frame_count": 175000
        }
    }
    
    # Create proper session params with required attributes
    session_params = GameSessionParameters()
    
    # Create processing options with proper values instead of MagicMock
    processing_opts = MagicMock()
    processing_opts.highpass_freq = 20.0
    processing_opts.lowpass_freq = 450.0
    processing_opts.notch_freq = 60.0
    processing_opts.notch_quality = 30.0
    processing_opts.envelope_lowpass = 6.0
    processing_opts.mvc_threshold = 0.75
    processing_opts.contraction_min_duration = 1000
    
    # Track which tables are populated
    tables_populated = []
    
    # Mock database operations to track table populations
    async def mock_bulk_insert(table_name, records):
        tables_populated.append(table_name)
        print(f"  ✅ Populating table: {table_name} with {len(records)} records")
        return None
    
    async def mock_upsert_composite(table_name, record, keys):
        if table_name not in tables_populated:
            tables_populated.append(table_name)
        print(f"  ✅ Upserting into table: {table_name} (composite keys: {keys})")
        return None
    
    async def mock_upsert(table_name, record, key_field=None):
        if table_name not in tables_populated:
            tables_populated.append(table_name)
        key_info = f" (key: {key_field})" if key_field else ""
        print(f"  ✅ Upserting into table: {table_name}{key_info}")
        return None
    
    # Patch the database operations
    with patch.object(processor, '_bulk_insert_table', new=mock_bulk_insert):
        with patch.object(processor, '_upsert_table_with_composite_key', new=mock_upsert_composite):
            with patch.object(processor, '_upsert_table', new=mock_upsert):
                
                print(f"\nProcessing session: {session_code}")
                print("-" * 40)
                
                # Call the main population method
                try:
                    await processor._populate_all_database_tables(
                        session_code, 
                        session_uuid,
                        processing_result, 
                        processing_opts, 
                        session_params
                    )
                    print("\n✅ Database population completed successfully!")
                    
                except Exception as e:
                    print(f"\n❌ Error during population: {e}")
                    raise
    
    # Verify all expected tables were populated
    print("\n" + "="*80)
    print("VERIFICATION RESULTS")
    print("="*80)
    
    expected_tables = [
        'emg_statistics',
        'processing_parameters', 
        'performance_scores',
        'session_settings',
        'bfr_monitoring'
    ]
    
    print("\nExpected tables to be populated:")
    for table in expected_tables:
        status = "✅" if table in tables_populated else "❌"
        print(f"  {status} {table}")
    
    missing_tables = [t for t in expected_tables if t not in tables_populated]
    
    if not missing_tables:
        print("\n🎉 SUCCESS: All 5 tables are now being populated correctly!")
        print("\nThis fixes the issue where 4 tables were empty after webhook processing.")
        print("\nKey fixes implemented:")
        print("  1. Fixed _populate_database_tables method signature")
        print("  2. Fixed BFR monitoring to use composite key upserts")
        print("  3. Added all required BFR fields (pressure values, safety compliance)")
        print("  4. Used config values instead of hardcoded values")
    else:
        print(f"\n❌ FAILED: Missing tables: {missing_tables}")
    
    return len(missing_tables) == 0


if __name__ == "__main__":
    # Run the test
    success = asyncio.run(test_all_tables_populated())
    sys.exit(0 if success else 1)