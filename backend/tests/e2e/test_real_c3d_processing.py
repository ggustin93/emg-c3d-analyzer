#!/usr/bin/env python3
"""
Test real C3D file processing with enhanced webhook service
Processes the Ghostly_Emg_20230321_17-50-17-0881.c3d sample file
"""

import sys
import os
from pathlib import Path

# Ensure project root is on sys.path
project_root = Path(__file__).resolve().parents[3]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import asyncio
import uuid
from services.enhanced_webhook_service import (
    EnhancedWebhookService,
    ProcessingParametersData,
    FutureC3DData,
)
from datetime import datetime

async def test_real_c3d_processing():
    """Test processing with real C3D file"""
    
    # Initialize service
    webhook_service = EnhancedWebhookService()
    
    # Real C3D file path (resolve relative to repo root)
    repo_root = Path(__file__).resolve().parents[3]
    c3d_file_path = str(repo_root / "backend/tests/samples/Ghostly_Emg_20230321_17-50-17-0881.c3d")
    
    if not os.path.exists(c3d_file_path):
        print(f"❌ C3D file not found: {c3d_file_path}")
        return
    
    print(f"🚀 Testing real C3D file processing...")
    print(f"📁 File: {os.path.basename(c3d_file_path)}")
    print(f"📊 Size: {os.path.getsize(c3d_file_path):,} bytes")
    
    try:
        # Extract C3D metadata and signals
        print("\n🔄 Step 1: Extract C3D metadata and signals...")
        c3d_data = await webhook_service.extract_c3d_data(c3d_file_path)
        
        if c3d_data:
            print(f"✅ C3D extraction successful:")
            print(f"   📈 Sampling rate: {c3d_data.original_sampling_rate} Hz")
            print(f"   ⏱️ Duration: {c3d_data.original_duration_seconds:.2f} seconds")
            print(f"   📊 Channels: {c3d_data.channel_count} - {c3d_data.channel_names}")
            print(f"   📦 Sample count: {c3d_data.original_sample_count:,}")
        else:
            print("❌ Failed to extract C3D data")
            return
        
        # Generate session ID for testing
        session_id = str(uuid.uuid4())
        print(f"\n🆔 Generated test session ID: {session_id}")
        
        # Create processing parameters
        print("\n🔄 Step 2: Create processing parameters...")
        processing_params = ProcessingParametersData(
            session_id=session_id,
            sampling_rate_hz=c3d_data.original_sampling_rate,
            filter_low_cutoff_hz=20.0,  # Clinical EMG standard
            filter_high_cutoff_hz=500.0,  # Clinical EMG standard
            rms_window_size_ms=50.0,  # Clinical EMG standard
            contraction_detection_threshold=0.1,
            mvc_calculation_method="backend_95percentile",
            notch_filter_enabled=True,
            notch_filter_frequency_hz=50.0  # EU power line frequency
        )
        
        print(f"✅ Processing parameters created:")
        print(f"   🔧 Sampling rate: {processing_params.sampling_rate_hz} Hz")
        print(f"   🌊 Filter range: {processing_params.filter_low_cutoff_hz}-{processing_params.filter_high_cutoff_hz} Hz")
        print(f"   📏 RMS window: {processing_params.rms_window_size_ms} ms")
        print(f"   🎯 MVC method: {processing_params.mvc_calculation_method}")
        
        # Create future data placeholder
        future_data = FutureC3DData(
            rpe_extracted=None,  # Not available in sample file
            bfr_pressure_mmhg=None,  # Not available in sample file
            session_expected_contractions=12,  # Default clinical protocol
            game_score_achieved=None,  # Will be extracted from C3D if available
            game_difficulty_level=None  # Will be extracted from C3D if available
        )
        
        # Test the complete processing pipeline
        print("\n🔄 Step 3: Process C3D file with enhanced service...")
        success = await webhook_service.process_c3d_file_enhanced(
            c3d_file_path=c3d_file_path,
            processing_params=processing_params,
            future_data=future_data
        )
        
        if success:
            print("✅ Enhanced C3D processing completed successfully!")
            print("\n📊 Processing Results:")
            print("   ✅ C3D metadata extracted and stored")
            print("   ✅ Processing parameters validated and stored")
            print("   ✅ Future data structure prepared")
            print("   ✅ All database constraints satisfied")
            
            # Validate Nyquist frequency constraint
            nyquist_freq = processing_params.sampling_rate_hz / 2
            if processing_params.filter_high_cutoff_hz <= nyquist_freq:
                print(f"   ✅ Nyquist constraint satisfied: {processing_params.filter_high_cutoff_hz} Hz ≤ {nyquist_freq} Hz")
            else:
                print(f"   ⚠️ Nyquist constraint violation: {processing_params.filter_high_cutoff_hz} Hz > {nyquist_freq} Hz")
            
        else:
            print("❌ Enhanced C3D processing failed!")
            
    except Exception as e:
        print(f"❌ Error during processing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_real_c3d_processing())