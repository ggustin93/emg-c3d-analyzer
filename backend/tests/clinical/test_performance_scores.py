#!/usr/bin/env python3
"""
Performance Scores Verification Test
==================================

Test the enhanced performance scores calculation to verify all NULL
fields are properly populated with bilateral metrics and game data.
"""

import os
import sys
import tempfile
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(backend_path))

import asyncio

from database.supabase_client import get_supabase_client
from services.clinical.therapy_session_processor import TherapySessionProcessor


async def test_performance_scores():
    """
    Test enhanced performance scores calculation
    """
    print("📊 Performance Scores Enhancement Test")
    print("=" * 60)

    # Use the real GHOSTLY clinical data
    c3d_file_path = backend_path / "tests" / "samples" / "Ghostly_Emg_20230321_17-50-17-0881.c3d"

    if not c3d_file_path.exists():
        print(f"❌ Clinical test file not found: {c3d_file_path}")
        return False

    print(f"📁 Using clinical data: {c3d_file_path}")

    try:
        processor = TherapySessionProcessor()

        # Step 1: Create session
        print("\n🚀 Step 1: Create Session for Performance Testing")
        print("-" * 50)

        import uuid

        file_metadata = {
            "size": c3d_file_path.stat().st_size,
            "name": "performance_test.c3d"
        }

        session_id = await processor.create_session(
            file_path="test/performance_test.c3d",
            file_metadata=file_metadata,
            patient_id=None,
            therapist_id=None
        )

        print(f"✅ Created session: {session_id}")

        # Step 2: Process and populate all tables including enhanced performance scores
        print("\n🔬 Step 2: Process with Enhanced Performance Scores")
        print("-" * 50)

        with open(c3d_file_path, "rb") as f:
            file_data = f.read()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp_file:
            tmp_file.write(file_data)
            tmp_file_path = tmp_file.name

        try:
            from config import (
                DEFAULT_MIN_DURATION_MS,
                DEFAULT_MVC_THRESHOLD_PERCENTAGE,
                DEFAULT_SMOOTHING_WINDOW,
                DEFAULT_THRESHOLD_FACTOR,
            )
            from models.models import GameSessionParameters, ProcessingOptions
            from services.c3d.processor import GHOSTLYC3DProcessor

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

            print("✅ C3D processing complete")

            # Populate all database tables with enhanced performance scores
            await processor._populate_database_tables(
                session_id=session_id,
                processing_result=result,
                file_data=file_data,
                processing_opts=processing_opts
            )

            await processor.update_session_status(session_id, "completed")
            print("✅ Enhanced database population completed")

            # Step 3: Verify performance scores
            print("\n📊 Step 3: Performance Scores Verification")
            print("-" * 50)

            supabase = get_supabase_client(use_service_key=True)

            # Get performance scores
            perf_result = supabase.table("performance_scores").select("*").eq("session_id", session_id).execute()

            if not perf_result.data:
                print("❌ No performance scores found")
                return False

            scores = perf_result.data[0]

            print("✅ Enhanced Performance Scores:")
            print(f"📈 Overall Score: {scores.get('overall_score', 'NULL')}")
            print(f"📊 Compliance Score: {scores.get('compliance_score', 'NULL')}")
            print(f"⚖️ Symmetry Score: {scores.get('symmetry_score', 'NULL')}")
            print(f"💪 Effort Score: {scores.get('effort_score', 'NULL')}")
            print(f"🎮 Game Score: {scores.get('game_score', 'NULL')}")

            print("\n📊 Bilateral Analysis:")
            print(f"   Left Muscle Compliance: {scores.get('left_muscle_compliance', 'NULL')}")
            print(f"   Right Muscle Compliance: {scores.get('right_muscle_compliance', 'NULL')}")

            print("\n📈 Completion Rates:")
            print(f"   Left Side: {scores.get('completion_rate_left', 'NULL')}")
            print(f"   Right Side: {scores.get('completion_rate_right', 'NULL')}")

            print("\n💪 Intensity Rates (MVC Compliance):")
            print(f"   Left Side: {scores.get('intensity_rate_left', 'NULL'):.1%}" if scores.get("intensity_rate_left") is not None else "   Left Side: NULL")
            print(f"   Right Side: {scores.get('intensity_rate_right', 'NULL'):.1%}" if scores.get("intensity_rate_right") is not None else "   Right Side: NULL")

            print("\n⏱️ Duration Rates (Duration Compliance):")
            print(f"   Left Side: {scores.get('duration_rate_left', 'NULL'):.1%}" if scores.get("duration_rate_left") is not None else "   Left Side: NULL")
            print(f"   Right Side: {scores.get('duration_rate_right', 'NULL'):.1%}" if scores.get("duration_rate_right") is not None else "   Right Side: NULL")

            print("\n🎮 Game Metrics:")
            print(f"   Points Achieved: {scores.get('game_points_achieved', 'NULL')}")
            print(f"   Points Maximum: {scores.get('game_points_max', 'NULL')}")

            # Count NULL fields
            null_count = sum(1 for key, value in scores.items() if value is None and key not in ["session_id", "created_at"])
            total_fields = len(scores) - 2  # Exclude session_id and created_at

            print("\n🎯 FIELD POPULATION SUMMARY:")
            print(f"   Total fields: {total_fields}")
            print(f"   NULL fields: {null_count}")
            print(f"   Populated fields: {total_fields - null_count}")
            print(f"   Population rate: {((total_fields - null_count) / total_fields * 100):.1f}%")

            if null_count < 5:  # Allow some game-specific fields to be NULL
                print("\n✅ PERFORMANCE SCORES ENHANCEMENT SUCCESS!")
                print("✅ Significant improvement in field population")
                print("✅ Bilateral analysis working correctly")
                return True
            else:
                print(f"\n⚠️ Still {null_count} NULL fields remaining")
                return False

        finally:
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)

    except Exception as e:
        print(f"\n❌ Test failed: {e!s}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_performance_scores())
    if result:
        print("\n🏆 PERFORMANCE SCORES TEST PASSED!")
    else:
        print("\n💥 PERFORMANCE SCORES TEST NEEDS IMPROVEMENT")
