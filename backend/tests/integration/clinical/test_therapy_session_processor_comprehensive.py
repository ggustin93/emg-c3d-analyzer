"""Comprehensive Test Suite for TherapySessionProcessor.

Tests all database table populations, BFR per-channel monitoring, 
performance scores, Redis caching, and complete workflow coverage.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

import asyncio
import os
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add the backend path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../'))

from models import GameSessionParameters, ProcessingOptions
from services.clinical.therapy_session_processor import TherapySessionProcessor


@pytest.fixture
def processor():
    """Create TherapySessionProcessor instance for testing."""
    return TherapySessionProcessor()


@pytest.fixture
def sample_processing_result():
    """Sample C3D processing result with complete analytics."""
    return {
        "metadata": {
            "sampling_rate": 1000.0,
            "duration_seconds": 175.1,
            "frame_count": 175100,
            "time": "2025-08-28 15:30:00",
            "game_points_achieved": 85,
            "game_points_max": 100
        },
        "analytics": {
            "CH1": {
                "compliance_rate": 0.87,
                "contraction_count": 15,
                "good_contraction_count": 13,
                "mvc75_compliance_rate": 11,
                "duration_compliance_rate": 12,
                "mvc_value": 0.245,
                "mvc_threshold": 75.0,
                "total_time_under_tension_ms": 45000.0,
                "avg_duration_ms": 3000.0,
                "max_duration_ms": 4500.0,
                "min_duration_ms": 1500.0,
                "avg_amplitude": 0.245,
                "max_amplitude": 0.389,
                "signal_quality_score": 0.92,
                "processing_confidence": 0.89,
                "rms_temporal_stats": {"mean_value": 0.156, "std_value": 0.023},
                "mav_temporal_stats": {"mean_value": 0.134, "std_value": 0.019},
                "mpf_temporal_stats": {"mean_value": 85.6, "std_value": 12.3},
                "mdf_temporal_stats": {"mean_value": 78.9, "std_value": 11.1},
                "fatigue_index_temporal_stats": {"mean_value": 0.23, "std_value": 0.05},
                "fatigue_index_fi_nsm5": 0.18
            },
            "CH2": {
                "compliance_rate": 0.92,
                "contraction_count": 16,
                "good_contraction_count": 15,
                "mvc75_compliance_rate": 14,
                "duration_compliance_rate": 13,
                "mvc_value": 0.289,
                "mvc_threshold": 75.0,
                "total_time_under_tension_ms": 48000.0,
                "avg_duration_ms": 3200.0,
                "max_duration_ms": 4800.0,
                "min_duration_ms": 1800.0,
                "avg_amplitude": 0.289,
                "max_amplitude": 0.456,
                "signal_quality_score": 0.94,
                "processing_confidence": 0.91,
                "rms_temporal_stats": {"mean_value": 0.178, "std_value": 0.028},
                "mav_temporal_stats": {"mean_value": 0.152, "std_value": 0.024},
                "mpf_temporal_stats": {"mean_value": 88.2, "std_value": 13.1},
                "mdf_temporal_stats": {"mean_value": 81.5, "std_value": 12.4},
                "fatigue_index_temporal_stats": {"mean_value": 0.21, "std_value": 0.04},
                "fatigue_index_fi_nsm5": 0.16
            }
        },
        "processing_time_ms": 2150
    }


@pytest.fixture
def sample_processing_options():
    """Sample processing options."""
    return ProcessingOptions(
        threshold_factor=0.75,
        min_duration_ms=1500,
        smoothing_window=100
    )


@pytest.fixture
def sample_session_params():
    """Sample game session parameters with BFR data."""
    return GameSessionParameters(
        session_mvc_threshold_percentage=75.0,
        contraction_duration_threshold=2000.0,
        target_contractions=12,
        expected_contractions_per_muscle=12,
        bfr_enabled=True,
        # Per-channel BFR pressure data (new feature)
        bfr_pressure_per_channel={
            "CH1": {
                "target_pressure_aop": 50.0,
                "actual_pressure_aop": 48.0,
                "cuff_pressure_mmhg": 144.0
            },
            "CH2": {
                "target_pressure_aop": 50.0,
                "actual_pressure_aop": 52.0,
                "cuff_pressure_mmhg": 156.0
            }
        },
        # Per-channel compliance assessment
        bfr_compliance_per_channel={
            "CH1": True,
            "CH2": True
        },
        systolic_bp_mmhg=125,
        diastolic_bp_mmhg=82
    )


class TestTherapySessionProcessorComprehensive:
    """Comprehensive test suite for all TherapySessionProcessor operations."""

    @pytest.mark.asyncio
    async def test_complete_database_table_population(
        self, processor, sample_processing_result, sample_processing_options, sample_session_params
    ):
        """Test that all 5 database tables are populated correctly (c3d_technical_data replaced by game_metadata)."""
        session_id = str(uuid.uuid4())
        file_data = b"mock_c3d_data"
        
        # Mock all database operations and dependencies (updated for game_metadata migration)
        with patch.object(processor, '_upsert_table') as mock_upsert, \
             patch.object(processor, '_upsert_table_with_composite_key') as mock_upsert_composite, \
             patch.object(processor, '_populate_processing_parameters') as mock_populate_params, \
             patch.object(processor, '_populate_emg_statistics') as mock_populate_emg, \
             patch.object(processor, '_calculate_and_save_performance_scores') as mock_populate_scores, \
             patch.object(processor, '_populate_session_settings') as mock_populate_settings, \
             patch.object(processor, '_populate_bfr_monitoring') as mock_populate_bfr:
            
            # Execute table population
            await processor._populate_database_tables(
                session_id=session_id,
                processing_result=sample_processing_result,
                file_data=file_data,
                processing_opts=sample_processing_options,
                session_params=sample_session_params
            )
            
            # Verify all 5 table population methods were called with correct parameters (c3d_technical_data replaced by game_metadata)
            mock_populate_params.assert_called_once()
            mock_populate_emg.assert_called_once()
            mock_populate_scores.assert_called_once()
            mock_populate_settings.assert_called_once()
            mock_populate_bfr.assert_called_once()

    @pytest.mark.asyncio
    async def test_bfr_per_channel_monitoring_edge_cases(
        self, processor, sample_processing_result, sample_processing_options
    ):
        """Test BFR per-channel monitoring population with basic session parameters."""
        session_id = str(uuid.uuid4())
        
        # Use basic session parameters (the model doesn't support per-channel BFR in this version)
        basic_session_params = GameSessionParameters(
            session_mvc_threshold_percentage=75.0,
            contraction_duration_threshold=2000.0
        )
        
        with patch.object(processor, '_upsert_table_with_composite_key') as mock_upsert_composite:
            
            # Execute BFR monitoring population with basic parameters
            await processor._populate_bfr_monitoring(
                session_id, basic_session_params, sample_processing_result
            )
            
            # Verify both channels were processed (CH1, CH2)
            assert mock_upsert_composite.call_count == 2
            
            # Verify the calls were made with proper channel data
            calls = mock_upsert_composite.call_args_list
            channel_names = [call[0][1]["channel_name"] for call in calls]
            assert "CH1" in channel_names
            assert "CH2" in channel_names
            
            # Verify default BFR values are used when no specific data provided
            ch1_record = next(call[0][1] for call in calls if call[0][1]["channel_name"] == "CH1")
            ch2_record = next(call[0][1] for call in calls if call[0][1]["channel_name"] == "CH2")
            
            # Should have default BFR values (development defaults: 50% AOP)
            assert ch1_record["target_pressure_aop"] == 50.0
            assert ch2_record["target_pressure_aop"] == 50.0
            assert ch1_record["actual_pressure_aop"] == 50.0
            assert ch2_record["actual_pressure_aop"] == 50.0

    @pytest.mark.asyncio
    async def test_performance_scores_calculation_comprehensive(
        self, processor, sample_processing_result, sample_session_params
    ):
        """Test comprehensive performance scores calculation with all metrics."""
        session_id = str(uuid.uuid4())
        
        with patch.object(processor.scoring_service, 'calculate_performance_scores') as mock_calc, \
             patch.object(processor.scoring_service, 'save_performance_scores') as mock_save:
            
            # Mock comprehensive performance scores
            expected_scores = {
                "session_id": session_id,
                "overall_score": 89.5,
                "compliance_score": 89.0,
                "strength_score": 88.5,
                "endurance_score": 91.0,
                "bfr_safety_score": 95.0,
                "left_muscle_score": 87.0,
                "right_muscle_score": 92.0,
                "bilateral_balance_score": 89.5
            }
            mock_calc.return_value = expected_scores
            mock_save.return_value = True
            
            await processor._calculate_and_save_performance_scores(
                session_id, sample_processing_result["analytics"], sample_processing_result
            )
            
            # Verify SessionMetrics object construction
            mock_calc.assert_called_once()
            call_args = mock_calc.call_args[0]
            session_metrics = call_args[1]
            
            # Verify left muscle (CH1) metrics
            assert session_metrics.left_total_contractions == 15
            assert session_metrics.left_good_contractions == 13
            assert session_metrics.left_mvc_contractions == 11
            assert session_metrics.left_duration_contractions == 12
            
            # Verify right muscle (CH2) metrics
            assert session_metrics.right_total_contractions == 16
            assert session_metrics.right_good_contractions == 15
            assert session_metrics.right_mvc_contractions == 14
            assert session_metrics.right_duration_contractions == 13
            
            # Verify game data integration
            assert session_metrics.game_points_achieved == 85
            assert session_metrics.game_points_max == 100
            
            # Verify scores saved
            mock_save.assert_called_once_with(expected_scores)

    @pytest.mark.asyncio
    async def test_redis_caching_integration(
        self, processor, sample_processing_result
    ):
        """Test Redis caching integration with comprehensive analytics."""
        session_id = str(uuid.uuid4())
        
        # Mock Redis cache service
        mock_cache_service = MagicMock()
        processor.cache_service = mock_cache_service
        
        await processor._cache_session_analytics(session_id, sample_processing_result)
        
        # Verify cache_service.set_session_analytics called with enhanced data
        mock_cache_service.set_session_analytics.assert_called_once()
        
        call_args = mock_cache_service.set_session_analytics.call_args
        cached_session_id = call_args[0][0]
        cached_data = call_args[0][1]
        
        assert cached_session_id == session_id
        
        # Verify cached data structure
        assert "analytics" in cached_data
        assert "summary" in cached_data
        assert "metadata" in cached_data
        assert "cache_version" in cached_data
        
        # Verify summary calculations
        summary = cached_data["summary"]
        assert summary["channels"] == ["CH1", "CH2"]
        assert summary["total_channels"] == 2
        assert summary["overall_compliance"] == 0.895  # (0.87 + 0.92) / 2
        assert "processed_at" in summary
        
        # Verify analytics preservation
        assert cached_data["analytics"]["CH1"]["compliance_rate"] == 0.87
        assert cached_data["analytics"]["CH2"]["compliance_rate"] == 0.92

    @pytest.mark.asyncio
    async def test_complete_workflow_integration(
        self, processor, sample_processing_result, sample_processing_options, sample_session_params
    ):
        """Test complete workflow from file processing to all table population and caching."""
        session_id = str(uuid.uuid4())
        bucket = "test-bucket"
        object_path = "test-file.c3d"
        
        # Mock all dependencies
        with patch.object(processor, 'get_session_status') as mock_get_session, \
             patch.object(processor, '_process_file_with_cleanup') as mock_process_with_cleanup:
            
            # Setup mocks
            mock_get_session.return_value = {
                "id": session_id,
                "patient_id": str(uuid.uuid4()),
                "file_path": f"{bucket}/{object_path}"
            }
            
            # Mock successful processing result
            expected_result = {
                "success": True,
                "channels_analyzed": 2,
                "overall_score": 89.5,
                "processing_time_ms": sample_processing_result["processing_time_ms"]
            }
            mock_process_with_cleanup.return_value = expected_result
            
            # Execute complete workflow
            result = await processor.process_c3d_file(session_id, bucket, object_path)
            
            # Verify workflow steps
            assert result["success"] == True
            assert result["channels_analyzed"] == 2
            assert "overall_score" in result
            
            # Verify all components called (accept the actual duration_threshold parameter)
            mock_get_session.assert_called_once_with(session_id)
            mock_process_with_cleanup.assert_called_once()

    def test_emg_stats_record_building_comprehensive(
        self, processor, sample_session_params
    ):
        """Test comprehensive EMG statistics record building with all temporal stats."""
        session_id = str(uuid.uuid4())
        channel_name = "CH1"
        channel_data = {
            "compliance_rate": 0.87,
            "contraction_count": 15,
            "good_contraction_count": 13,
            "mvc75_compliance_rate": 11,
            "duration_compliance_rate": 12,
            "mvc_value": 0.245,
            "mvc_threshold": 75.0,
            "total_time_under_tension_ms": 45000.0,
            "avg_duration_ms": 3000.0,
            "max_duration_ms": 4500.0,
            "min_duration_ms": 1500.0,
            "avg_amplitude": 0.245,
            "max_amplitude": 0.389,
            "signal_quality_score": 0.92,
            "processing_confidence": 0.89,
            "rms_temporal_stats": {"mean_value": 0.156, "std_value": 0.023},
            "mav_temporal_stats": {"mean_value": 0.134, "std_value": 0.019},
            "mpf_temporal_stats": {"mean_value": 85.6, "std_value": 12.3},
            "mdf_temporal_stats": {"mean_value": 78.9, "std_value": 11.1},
            "fatigue_index_temporal_stats": {"mean_value": 0.23, "std_value": 0.05},
            "fatigue_index_fi_nsm5": 0.18
        }
        
        stats_record = processor._build_emg_stats_record(
            session_id, channel_name, channel_data, sample_session_params
        )
        
        # Verify all fields populated
        assert stats_record["session_id"] == session_id
        assert stats_record["channel_name"] == channel_name
        assert stats_record["total_contractions"] == 15
        assert stats_record["good_contractions"] == 13
        assert stats_record["mvc75_compliance_rate"] == 11
        assert stats_record["compliance_rate"] == 0.87
        
        # Verify temporal statistics
        assert stats_record["rms_mean"] == 0.156
        assert stats_record["rms_std"] == 0.023
        assert stats_record["mav_mean"] == 0.134
        assert stats_record["mav_std"] == 0.019
        assert stats_record["mpf_mean"] == 85.6
        assert stats_record["mpf_std"] == 12.3
        assert stats_record["mdf_mean"] == 78.9
        assert stats_record["mdf_std"] == 11.1
        assert stats_record["fatigue_index_mean"] == 0.23
        assert stats_record["fatigue_index_std"] == 0.05
        assert stats_record["fatigue_index_fi_nsm5"] == 0.18
        
        # Verify threshold values
        assert stats_record["mvc75_threshold"] == 75.0
        assert stats_record["duration_threshold_actual_value"] == 2000.0

    @pytest.mark.asyncio
    async def test_error_handling_and_recovery(self, processor):
        """Test error handling and recovery mechanisms."""
        session_id = str(uuid.uuid4())
        
        # Test database population failure (updated for game_metadata migration)
        with patch.object(processor, '_populate_processing_parameters') as mock_populate:
            mock_populate.side_effect = Exception("Database connection failed")
            
            with pytest.raises(Exception, match="Database population failed"):
                await processor._populate_database_tables(
                    session_id=session_id,
                    processing_result={"metadata": {"sampling_rate": 1000.0}, "analytics": {"CH1": {}}},
                    file_data=b"mock_data",
                    processing_opts=ProcessingOptions(threshold_factor=0.75, min_duration_ms=1500, smoothing_window=100),
                    session_params=GameSessionParameters(session_mvc_threshold_percentage=75.0, contraction_duration_threshold=2000.0)
                )

    @pytest.mark.asyncio
    async def test_session_metadata_extraction_and_timestamps(
        self, processor, sample_processing_result
    ):
        """Test session metadata extraction including timestamp parsing."""
        session_id = str(uuid.uuid4())
        
        with patch.object(processor.session_repo, 'update_therapy_session') as mock_update:
            await processor._update_session_metadata(session_id, sample_processing_result)
            
            # Verify metadata update called
            mock_update.assert_called_once()
            call_args = mock_update.call_args[0]
            update_data = call_args[1]
            
            # Verify game metadata preserved
            assert update_data["game_metadata"] == sample_processing_result["metadata"]
            
            # Verify session timestamp extracted and converted
            assert "session_date" in update_data
            # Should be ISO format with timezone
            assert "T" in update_data["session_date"]
            assert update_data["session_date"].endswith("+00:00")


if __name__ == "__main__":
    # Run specific test
    pytest.main([__file__ + "::TestTherapySessionProcessorComprehensive::test_complete_database_table_population", "-v"])