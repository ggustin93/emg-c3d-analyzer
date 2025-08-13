#!/usr/bin/env python3
"""
Simple test script for metadata service creation
Tests the KISS database simplification without file download
"""
import asyncio
import sys
from pathlib import Path

# Ensure backend is on sys.path when running directly
backend_dir = Path(__file__).resolve().parents[2]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from services.metadata_service import MetadataService

async def test_metadata_creation():
    """Test creating therapy session entry with minimal data (KISS)"""
    
    try:
        print("🧪 Testing metadata service creation...")
        
        metadata_service = MetadataService()
        
        # Create minimal entry without file hash (testing NOT NULL constraint fix)
        session_id = await metadata_service.create_metadata_entry(
            file_path="test/minimal_creation_test.c3d",
            file_hash="test_hash_12345",
            file_size_bytes=1024,
            patient_id=None,  # NULL to avoid foreign key constraint
            session_id=None,
            metadata={"test": "minimal_creation"}
        )
        
        print(f"✅ SUCCESS: Created therapy session with minimal data: {session_id}")
        
        # Try to retrieve it
        session = await metadata_service.get_by_id(session_id)
        if session:
            print(f"✅ VERIFIED: Retrieved session data:")
            print(f"   - File path: {session.get('file_path')}")
            print(f"   - Processing status: {session.get('processing_status')}")
            print(f"   - Original sampling rate: {session.get('original_sampling_rate')} (should be NULL)")
            print(f"   - Channel names: {session.get('channel_names')} (should be [])")
        else:
            print("❌ FAILED: Could not retrieve created session")
            
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_metadata_creation())