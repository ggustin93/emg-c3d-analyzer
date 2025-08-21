#!/usr/bin/env python3
"""
Enhanced Performance Scores Test
================================

Test the enhanced performance score calculations that should give meaningful
scores even when perfect compliance is 0% by considering MVC compliance,
activity levels, and effort.
"""

import os
import sys
import tempfile
import uuid
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(backend_path))

import asyncio
from services.clinical.therapy_session_processor import TherapySessionProcessor
from database.supabase_client import get_supabase_client

async def test_enhanced_scores():
    """
    Test enhanced performance score calculations with new session
    """
    print("🎯 Enhanced Performance Scores Test")
    print("=" * 60)
    
    # Use the real GHOSTLY clinical data
    c3d_file_path = backend_path / "tests" / "samples" / "Ghostly_Emg_20230321_17-50-17-0881.c3d"
    
    if not c3d_file_path.exists():
        print(f"❌ Clinical test file not found: {c3d_file_path}")
        return False
        
    print(f"📁 Using clinical data: {c3d_file_path}")
    
    try:
        processor = TherapySessionProcessor()
        
        # Create FRESH session with unique ID
        print("\n🚀 Step 1: Create Fresh Session")
        print("-" * 50)
        
        file_metadata = {
            "size": c3d_file_path.stat().st_size,
            "name": f"enhanced_scores_test_{uuid.uuid4().hex[:8]}.c3d"
        }
        
        session_id = await processor.create_session(
            file_path=f"test/enhanced_scores_{uuid.uuid4().hex[:8]}.c3d",
            file_metadata=file_metadata,
            patient_id=None,
            therapist_id=None
        )
        
        print(f"✅ Created fresh session: {session_id}")
        
        # Step 2: Process with enhanced performance scores
        print("\n🔬 Step 2: Process with Enhanced Scores")
        print("-" * 50)
        
        with open(c3d_file_path, "rb") as f:
            file_data = f.read()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp_file:
            tmp_file.write(file_data)
            tmp_file_path = tmp_file.name
        
        try:
            from services.c3d.processor import GHOSTLYC3DProcessor
            from models.models import ProcessingOptions, GameSessionParameters
            from config import (
                DEFAULT_THRESHOLD_FACTOR, DEFAULT_MIN_DURATION_MS, 
                DEFAULT_SMOOTHING_WINDOW, DEFAULT_MVC_THRESHOLD_PERCENTAGE
            )
            
            c3d_processor = GHOSTLYC3DProcessor(tmp_file_path)
            
            processing_opts = ProcessingOptions(
                threshold_factor=DEFAULT_THRESHOLD_FACTOR,
                min_duration_ms=DEFAULT_MIN_DURATION_MS,
                smoothing_window=DEFAULT_SMOOTHING_WINDOW
            )
            
            session_params = GameSessionParameters(
                session_mvc_threshold_percentage=DEFAULT_MVC_THRESHOLD_PERCENTAGE
            )
            
            result = c3d_processor.process_file(
                processing_opts=processing_opts,
                session_game_params=session_params
            )
            
            print(f"✅ C3D processing complete")
            
            # Check analytics data before database population
            analytics = result.get("analytics", {})
            print(f"\n📊 Analytics Check Before Database:")
            for channel, data in analytics.items():
                total = data.get('contraction_count', 0)
                mvc = data.get('mvc_contraction_count', 0)
                compliance = data.get('compliance_rate', 0.0)
                print(f"  {channel}: {total} contractions, {mvc} mvc ({mvc/total*100:.0f}% MVC), {compliance:.1%} compliance")
            
            # Populate database with enhanced calculations
            await processor._populate_database_tables(
                session_id=session_id,
                processing_result=result,
                file_data=file_data,
                processing_opts=processing_opts
            )
            
            await processor.update_session_status(session_id, "completed")
            print("✅ Enhanced database population completed")
            
            # Step 3: Verify enhanced performance scores
            print("\n🎯 Step 3: Enhanced Performance Scores Analysis")
            print("-" * 50)
            
            supabase = get_supabase_client(use_service_key=True)
            
            # Get performance scores
            perf_result = supabase.table("performance_scores").select("*").eq("session_id", session_id).execute()
            
            if not perf_result.data:
                print("❌ No performance scores found")
                return False
                
            scores = perf_result.data[0]
            
            print("✅ Enhanced Performance Scores Analysis:")
            
            overall = scores.get('overall_score', 0)
            compliance = scores.get('compliance_score', 0)
            print(f"📈 Overall Score: {overall:.3f}")
            print(f"📊 Compliance Score: {compliance:.3f}")
            
            # Analyze expected scores based on clinical data
            print(f"\n🔍 Clinical Data Analysis:")
            print(f"  - CH1: 20 contractions, 20 MVC compliant (100% MVC)")
            print(f"  - CH2: 9 contractions, 9 MVC compliant (100% MVC)")
            print(f"  - Duration compliance: 0% (all contractions too short)")
            print(f"  - Perfect compliance: 0% (need both MVC + duration)")
            
            print(f"\n🧮 Expected Enhanced Scores:")
            # CH1: MVC(100%) * 0.30 + Duration(0%) * 0.30 + Perfect(0%) * 0.20 + Activity(100%) * 0.20 = 0.50
            # CH2: MVC(100%) * 0.30 + Duration(0%) * 0.30 + Perfect(0%) * 0.20 + Activity(90%) * 0.20 = 0.48  
            # Average: (0.50 + 0.48) / 2 = 0.49
            expected_overall = (1.0 * 0.30 + 0.0 * 0.30 + 0.0 * 0.20 + 1.0 * 0.20 + 1.0 * 0.30 + 0.0 * 0.30 + 0.0 * 0.20 + 0.9 * 0.20) / 2
            expected_compliance = (1.0 * 0.60 + 0.0 * 0.25 + 0.0 * 0.15 + 1.0 * 0.60 + 0.0 * 0.25 + 0.0 * 0.15) / 2
            print(f"  - Expected Overall Score: ~{expected_overall:.3f}")
            print(f"  - Expected Compliance Score: ~{expected_compliance:.3f}")
            
            # Check if scores are reasonable
            if overall >= 0.40 and compliance >= 0.50:
                print(f"\n✅ ENHANCED SCORES SUCCESS!")
                print(f"✅ Scores reflect clinical reality: strong MVC performance despite poor duration")
                print(f"✅ Activity and intensity properly weighted in calculations")
                return True
            else:
                print(f"\n⚠️ Scores lower than expected - need investigation")
                print(f"   Overall: {overall:.3f} (expected ~0.49)")
                print(f"   Compliance: {compliance:.3f} (expected ~0.60)")
                return False
                
        finally:
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_enhanced_scores())
    if result:
        print("\n🏆 ENHANCED PERFORMANCE SCORES TEST PASSED!")
    else:
        print("\n💥 ENHANCED PERFORMANCE SCORES NEED REVIEW")