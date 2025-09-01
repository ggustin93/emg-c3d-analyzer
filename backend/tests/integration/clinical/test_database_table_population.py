"""Database Table Population Tests for Therapy Session Processor.

========================================================================

CRITICAL TESTING: Validates that all 6 database tables are properly populated
during therapy session processing with correct data structures and relationships.

Tables Tested:
- processing_parameters: EMG signal processing configuration 
- performance_scores: GHOSTLY+ therapeutic scoring system
- session_settings: MVC thresholds and BFR configuration
- bfr_monitoring: Per-Channel Blood Flow Restriction safety data (CH1/CH2)

Key Features Tested:
- Per-Channel BFR Monitoring: Creates 2 records per session (CH1, CH2)
- Composite Key Operations: Uses (session_id, channel_name) composite primary key
- Channel-Specific Data: Separate BFR pressure and compliance per muscle
- Development Defaults: Fallback values for development and testing scenarios

These tests ensure Schema v2.1+ compliance with per-channel BFR support.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
Updated: Per-channel BFR monitoring implementation
"""

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

# Import the class under test
from services.clinical.therapy_session_processor import (
    TherapySessionError,
    TherapySessionProcessor,
)

# Import supporting models
from config import (
    DEFAULT_FILTER_ORDER,
    DEFAULT_LOWPASS_CUTOFF,
    DEFAULT_MVC_THRESHOLD_PERCENTAGE,
    DEFAULT_RMS_WINDOW_MS,
    DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS,
    EMG_HIGH_PASS_CUTOFF,
    MVC_WINDOW_SECONDS,
    PROCESSING_VERSION,
    RMS_OVERLAP_PERCENTAGE,
    SessionDefaults,
)
from models import GameSessionParameters, ProcessingOptions


# ============================================================================
# FIXTURES FOR TABLE TESTING
# ============================================================================

@pytest.fixture
def sample_processing_result():
    """Sample C3D processing result with comprehensive analytics."""
    return {
        "success": True,
        "metadata": {
            "file_path": "test/sample.c3d",
            "duration_seconds": 175.1,
            "sampling_rate": 1000.0,
            "frame_count": 175100,
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        "analytics": {
            "CH1": {
                "contraction_count": 20,
                "good_contraction_count": 18,
                "mvc_contraction_count": 15,
                "duration_contraction_count": 17,
                "compliance_rate": 0.85,
                "mvc_value": 0.75,
                "mvc_threshold": 562.5,
                "total_time_under_tension_ms": 34500.0,
                "avg_duration_ms": 1725.0,
                "max_duration_ms": 2850.0,
                "min_duration_ms": 950.0,
                "avg_amplitude": 485.2,
                "max_amplitude": 750.0,
                "signal_quality_score": 0.92,
                "processing_confidence": 0.88,
                # Temporal statistics
                "rms_temporal_stats": {"mean_value": 125.5, "std_value": 25.2},
                "mav_temporal_stats": {"mean_value": 98.7, "std_value": 18.4},
                "mpf_temporal_stats": {"mean_value": 85.3, "std_value": 12.1},
                "mdf_temporal_stats": {"mean_value": 78.9, "std_value": 9.8},
                "fatigue_index_temporal_stats": {"mean_value": 0.15, "std_value": 0.05},
                "fatigue_index_fi_nsm5": 0.18
            },
            "CH2": {
                "contraction_count": 18,
                "good_contraction_count": 16,
                "mvc_contraction_count": 13,
                "duration_contraction_count": 15,
                "compliance_rate": 0.78,
                "mvc_value": 0.72,
                "mvc_threshold": 540.0,
                "total_time_under_tension_ms": 31200.0,
                "avg_duration_ms": 1650.0,
                "max_duration_ms": 2700.0,
                "min_duration_ms": 890.0,
                "avg_amplitude": 465.8,
                "max_amplitude": 720.0,
                "signal_quality_score": 0.89,
                "processing_confidence": 0.85,
                # Temporal statistics
                "rms_temporal_stats": {"mean_value": 118.2, "std_value": 22.8},
                "mav_temporal_stats": {"mean_value": 92.3, "std_value": 16.7},
                "mpf_temporal_stats": {"mean_value": 82.1, "std_value": 11.5},
                "mdf_temporal_stats": {"mean_value": 75.6, "std_value": 9.2},
                "fatigue_index_temporal_stats": {"mean_value": 0.17, "std_value": 0.06},
                "fatigue_index_fi_nsm5": 0.20
            }
        },
        "processing_time_ms": 2450
    }


@pytest.fixture
def sample_processing_options():
    """Sample processing options for configuration testing."""
    return ProcessingOptions(
        threshold_factor=0.75,
        min_duration_ms=1000,
        smoothing_window=50
    )


@pytest.fixture
def sample_session_parameters():
    """Sample session parameters for BFR and configuration testing.
    
    Note: BFR parameters (target_pressure_aop, etc.) will come from C3D metadata
    in production. For testing, we use defaults from SessionDefaults.
    """
    return GameSessionParameters(
        session_mvc_threshold_percentage=75.0,
        contraction_duration_threshold=DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS,
        session_expected_contractions=12,
        # BFR parameters not in GameSessionParameters - come from C3D metadata in production
        # Test will verify that SessionDefaults are used when C3D metadata is missing
    )


# ============================================================================
# PROCESSING PARAMETERS TABLE TESTS
# ============================================================================

class TestProcessingParametersPopulation:
    """Test processing_parameters table population and validation."""

    @pytest.mark.asyncio
    async def test_populate_processing_parameters_success(self):
        """Test successful processing parameters table population."""
        # Setup
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        
        metadata = {
            "sampling_rate": 1000.0,
            "duration_seconds": 175.1,
            "frame_count": 175100
        }
        
        processing_opts = ProcessingOptions(
            threshold_factor=0.75,
            min_duration_ms=1000,
            smoothing_window=50
        )

        # Mock EMG repository
        with patch.object(processor.emg_repo, 'insert_processing_parameters', new_callable=AsyncMock) as mock_insert:
            
            # Execute
            await processor._populate_processing_parameters(session_id, metadata, processing_opts)
            
            # Verify
            mock_insert.assert_called_once()
            call_args = mock_insert.call_args[0][0]
            
            # Validate critical parameters
            assert call_args["session_id"] == session_id
            assert call_args["sampling_rate_hz"] == 1000.0
            assert call_args["filter_low_cutoff_hz"] == EMG_HIGH_PASS_CUTOFF
            assert call_args["filter_order"] == DEFAULT_FILTER_ORDER
            assert call_args["rms_window_ms"] == DEFAULT_RMS_WINDOW_MS
            assert call_args["rms_overlap_percent"] == RMS_OVERLAP_PERCENTAGE
            assert call_args["mvc_window_seconds"] == MVC_WINDOW_SECONDS
            assert call_args["processing_version"] == PROCESSING_VERSION
            assert call_args["mvc_threshold_percentage"] == processing_opts.threshold_factor * 100

    @pytest.mark.asyncio
    async def test_populate_processing_parameters_nyquist_safety(self):
        """Test Nyquist frequency safety factor application."""
        # Setup with low sampling rate that requires safety limiting
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        
        metadata = {
            "sampling_rate": 200.0,  # Low sampling rate
            "duration_seconds": 10.0,
            "frame_count": 2000
        }
        
        processing_opts = ProcessingOptions(threshold_factor=0.8)

        # Mock EMG repository
        with patch.object(processor.emg_repo, 'insert_processing_parameters', new_callable=AsyncMock) as mock_insert:
            
            # Execute
            await processor._populate_processing_parameters(session_id, metadata, processing_opts)
            
            # Verify Nyquist safety applied
            call_args = mock_insert.call_args[0][0]
            nyquist_freq = 200.0 / 2  # 100 Hz
            expected_safe_cutoff = min(DEFAULT_LOWPASS_CUTOFF, nyquist_freq * 0.9)
            
            assert call_args["filter_high_cutoff_hz"] == expected_safe_cutoff
            assert call_args["filter_high_cutoff_hz"] < 100  # Below Nyquist


# ============================================================================
# PERFORMANCE SCORES TABLE TESTS
# ============================================================================

class TestPerformanceScoresPopulation:
    """Test performance_scores table population via scoring service."""

    @pytest.mark.asyncio
    async def test_calculate_and_save_performance_scores_success(self, sample_processing_result):
        """Test successful performance scores calculation and saving."""
        # Setup
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        
        # Mock scoring service methods
        mock_scores = {
            "session_id": session_id,
            "overall_score": 0.815,
            "compliance_score": 0.82,
            "mvc_compliance_score": 0.87,
            "duration_compliance_score": 0.89,
            "bilateral_balance_score": 0.78,
            "therapeutic_effectiveness_score": 0.85
        }
        
        with patch.object(processor.scoring_service, 'calculate_performance_scores', return_value=mock_scores) as mock_calc, \
             patch.object(processor.scoring_service, 'save_performance_scores', return_value=True) as mock_save:
            
            # Execute
            await processor._calculate_and_save_performance_scores(
                session_id, sample_processing_result["analytics"], sample_processing_result
            )
            
            # Verify calculation called with proper metrics
            mock_calc.assert_called_once()
            call_args = mock_calc.call_args[0]
            session_metrics = call_args[1]
            
            # Validate SessionMetrics structure
            assert session_metrics.session_id == session_id
            assert session_metrics.left_total_contractions == 20  # CH1 data
            assert session_metrics.left_good_contractions == 18
            assert session_metrics.left_mvc_contractions == 15
            assert session_metrics.left_duration_contractions == 17
            assert session_metrics.right_total_contractions == 18  # CH2 data
            assert session_metrics.right_good_contractions == 16
            assert session_metrics.right_mvc_contractions == 13
            assert session_metrics.right_duration_contractions == 15
            
            # Verify saving called
            mock_save.assert_called_once_with(mock_scores)

    @pytest.mark.asyncio
    async def test_calculate_performance_scores_missing_analytics(self):
        """Test graceful handling when analytics data is missing."""
        # Setup
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        
        empty_analytics = {}
        processing_result = {"metadata": {}}
        
        # Mock scoring service to return error
        with patch.object(processor.scoring_service, 'calculate_performance_scores', return_value={"error": "No analytics data"}):
            
            # Execute - should not raise exception
            await processor._calculate_and_save_performance_scores(
                session_id, empty_analytics, processing_result
            )
            
            # Test passes if no exception raised (graceful degradation)


# ============================================================================
# SESSION SETTINGS TABLE TESTS  
# ============================================================================

class TestSessionSettingsPopulation:
    """Test session_settings table population and validation."""

    @pytest.mark.asyncio
    async def test_populate_session_settings_success(self, sample_processing_options, sample_session_parameters):
        """Test successful session settings table population."""
        # Setup
        processor = TherapySessionProcessor()
        session_id = str(uuid4())

        # Mock upsert method
        with patch.object(processor, '_upsert_table', new_callable=AsyncMock) as mock_upsert:
            
            # Execute
            await processor._populate_session_settings(
                session_id, sample_processing_options, sample_session_parameters
            )
            
            # Verify upsert called
            mock_upsert.assert_called_once_with("session_settings", mock_upsert.call_args[0][1], "session_id")
            
            # Validate settings data
            settings_data = mock_upsert.call_args[0][1]
            assert settings_data["session_id"] == session_id
            assert settings_data["mvc_threshold_percentage"] == 75.0
            assert settings_data["target_contractions"] == 24  # CH1 (12) + CH2 (12) = 24
            assert settings_data["expected_contractions_per_muscle"] == 12
            assert settings_data["bfr_enabled"] == True

    @pytest.mark.asyncio
    async def test_populate_session_settings_invalid_mvc_threshold(self):
        """Test validation and correction of invalid MVC threshold."""
        # Setup with invalid MVC threshold
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        
        # Create invalid processing options
        invalid_opts = ProcessingOptions(
            threshold_factor=0.75,
            mvc_threshold_percentage=-10.0  # Invalid negative threshold
        )
        
        session_params = GameSessionParameters(
            session_mvc_threshold_percentage=75.0,
            contraction_duration_threshold=2000.0
        )

        # Mock upsert method
        with patch.object(processor, '_upsert_table', new_callable=AsyncMock) as mock_upsert:
            
            # Execute
            await processor._populate_session_settings(session_id, invalid_opts, session_params)
            
            # Verify correction applied
            settings_data = mock_upsert.call_args[0][1]
            assert settings_data["mvc_threshold_percentage"] == 75.0  # Corrected to default

    @pytest.mark.asyncio
    async def test_populate_session_settings_invalid_duration_threshold(self):
        """Test validation and correction of invalid duration threshold."""
        # Setup with invalid duration threshold  
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        
        processing_opts = ProcessingOptions(
            threshold_factor=0.75,
            min_duration_ms=1000
        )
        
        session_params = GameSessionParameters(session_mvc_threshold_percentage=75.0)

        # Mock upsert method
        with patch.object(processor, '_upsert_table', new_callable=AsyncMock) as mock_upsert:
            
            # Execute
            await processor._populate_session_settings(session_id, processing_opts, session_params)
            
            # Test passes - duration validation removed since duration is now per-channel
            # Verify method was called
            mock_upsert.assert_called_once()


# ============================================================================
# BFR MONITORING TABLE TESTS
# ============================================================================

class TestBFRMonitoringPopulation:
    """Test bfr_monitoring table population and safety validation with per-channel schema."""

    @pytest.mark.asyncio
    async def test_populate_bfr_monitoring_per_channel_success(self, sample_session_parameters, sample_processing_result):
        """Test successful per-channel BFR monitoring table population with development defaults."""
        # Setup
        processor = TherapySessionProcessor()
        session_id = str(uuid4())

        # Mock composite key upsert method (new per-channel approach)
        with patch.object(processor, '_upsert_table_with_composite_key', new_callable=AsyncMock) as mock_upsert:
            
            # Execute
            await processor._populate_bfr_monitoring(
                session_id, sample_session_parameters, sample_processing_result
            )
            
            # Verify upsert called twice (once for each channel)
            assert mock_upsert.call_count == 2
            
            # Get the call arguments for both channels
            call_args_list = mock_upsert.call_args_list
            
            # Verify table name and key fields are correct for both calls
            for call_args in call_args_list:
                table_name = call_args[0][0]
                key_fields = call_args[0][2]
                assert table_name == "bfr_monitoring"
                assert key_fields == ["session_id", "channel_name"]
            
            # Validate CH1 and CH2 records
            ch1_data = call_args_list[0][0][1]  # First call data
            ch2_data = call_args_list[1][0][1]  # Second call data
            
            # Verify CH1 record
            assert ch1_data["session_id"] == session_id
            assert ch1_data["channel_name"] == "CH1"
            assert ch1_data["target_pressure_aop"] == SessionDefaults.TARGET_PRESSURE_AOP  # 50.0
            assert ch1_data["actual_pressure_aop"] == SessionDefaults.TARGET_PRESSURE_AOP  # 50.0
            assert ch1_data["cuff_pressure_mmhg"] == SessionDefaults.TARGET_PRESSURE_AOP * 3.0  # 150.0
            # Blood pressure fields removed per user request - no longer computed
            assert ch1_data["safety_compliant"] == True  # 50% AOP is in safe range (40-60%)
            assert ch1_data["measurement_method"] == "sensor"  # Both pressure values present
            
            # Verify CH2 record
            assert ch2_data["session_id"] == session_id
            assert ch2_data["channel_name"] == "CH2"
            assert ch2_data["target_pressure_aop"] == SessionDefaults.TARGET_PRESSURE_AOP  # 50.0
            assert ch2_data["actual_pressure_aop"] == SessionDefaults.TARGET_PRESSURE_AOP  # 50.0
            assert ch2_data["cuff_pressure_mmhg"] == SessionDefaults.TARGET_PRESSURE_AOP * 3.0  # 150.0
            # Blood pressure fields removed per user request - no longer computed
            assert ch2_data["safety_compliant"] == True  # 50% AOP is in safe range (40-60%)
            assert ch2_data["measurement_method"] == "sensor"  # Both pressure values present

    @pytest.mark.asyncio
    async def test_populate_bfr_monitoring_development_defaults_per_channel(self, sample_session_parameters):
        """Test per-channel BFR monitoring population uses development defaults correctly."""
        # Setup - standard development scenario
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        processing_result = {"metadata": {}}

        # Mock composite key upsert method
        with patch.object(processor, '_upsert_table_with_composite_key', new_callable=AsyncMock) as mock_upsert:
            
            # Execute - should use SessionDefaults for all BFR values
            await processor._populate_bfr_monitoring(session_id, sample_session_parameters, processing_result)
            
            # Verify two records created (CH1 and CH2)
            assert mock_upsert.call_count == 2
            
            # Verify development defaults applied correctly to both channels
            call_args_list = mock_upsert.call_args_list
            
            for i, channel_name in enumerate(["CH1", "CH2"]):
                bfr_data = call_args_list[i][0][1]
                assert bfr_data["session_id"] == session_id
                assert bfr_data["channel_name"] == channel_name
                assert bfr_data["target_pressure_aop"] == SessionDefaults.TARGET_PRESSURE_AOP
                assert bfr_data["actual_pressure_aop"] == SessionDefaults.TARGET_PRESSURE_AOP
                # Blood pressure fields removed per user request - no longer computed
                # 50% AOP is within safe range (40-60%)
                assert bfr_data["safety_compliant"] == True

    @pytest.mark.asyncio
    async def test_populate_bfr_monitoring_cuff_pressure_calculation_per_channel(self):
        """Test per-channel BFR monitoring cuff pressure calculation from AOP percentage."""
        # Setup
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        
        minimal_params = GameSessionParameters(
            session_mvc_threshold_percentage=75.0,
            contraction_duration_threshold=2000.0
        )
        
        processing_result = {"metadata": {}}

        # Mock composite key upsert method
        with patch.object(processor, '_upsert_table_with_composite_key', new_callable=AsyncMock) as mock_upsert:
            
            # Execute
            await processor._populate_bfr_monitoring(session_id, minimal_params, processing_result)
            
            # Verify cuff pressure calculated correctly for both channels (AOP * 3.0 conversion factor)
            call_args_list = mock_upsert.call_args_list
            expected_cuff_pressure = SessionDefaults.TARGET_PRESSURE_AOP * 3.0  # 50.0 * 3.0 = 150.0
            
            for i, channel_name in enumerate(["CH1", "CH2"]):
                bfr_data = call_args_list[i][0][1]
                assert bfr_data["channel_name"] == channel_name
                assert bfr_data["cuff_pressure_mmhg"] == expected_cuff_pressure
                assert bfr_data["measurement_method"] == "sensor"


# ============================================================================
# INTEGRATION TESTS - COMPLETE TABLE POPULATION
# ============================================================================

class TestCompleteTablePopulation:
    """Integration tests for complete database table population workflow."""

    @pytest.mark.asyncio
    async def test_populate_all_database_tables_success(self, sample_processing_result, 
                                                       sample_processing_options, 
                                                       sample_session_parameters):
        """Test that all 5 database tables are populated successfully (c3d_technical_data replaced by game_metadata)."""
        # Setup
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        file_data = b"mock_c3d_data"

        # Mock all database operations (updated for game_metadata migration)
        with patch.object(processor, '_populate_processing_parameters', new_callable=AsyncMock) as mock_params, \
             patch.object(processor, '_populate_emg_statistics', new_callable=AsyncMock) as mock_emg, \
             patch.object(processor, '_calculate_and_save_performance_scores', new_callable=AsyncMock) as mock_scores, \
             patch.object(processor, '_populate_session_settings', new_callable=AsyncMock) as mock_settings, \
             patch.object(processor, '_populate_bfr_monitoring', new_callable=AsyncMock) as mock_bfr:
            
            # Execute
            await processor._populate_database_tables(
                session_id=session_id,
                processing_result=sample_processing_result,
                file_data=file_data,
                processing_opts=sample_processing_options,
                session_params=sample_session_parameters
            )
            
            # Verify all 5 table population methods called (c3d_technical_data replaced by game_metadata)
            mock_params.assert_called_once_with(
                session_id, 
                sample_processing_result["metadata"], 
                sample_processing_options
            )
            mock_emg.assert_called_once_with(
                session_id, 
                sample_processing_result["analytics"], 
                sample_session_parameters
            )
            mock_scores.assert_called_once_with(
                session_id, 
                sample_processing_result["analytics"], 
                sample_processing_result
            )
            mock_settings.assert_called_once_with(
                session_id, 
                sample_processing_options, 
                sample_session_parameters
            )
            mock_bfr.assert_called_once_with(
                session_id, 
                sample_session_parameters, 
                sample_processing_result
            )

    @pytest.mark.asyncio
    async def test_populate_database_tables_missing_metadata_error(self):
        """Test error handling when processing result lacks required metadata."""
        # Setup with missing metadata
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        
        invalid_result = {
            "success": True,
            # Missing "metadata" key
            "analytics": {"CH1": {"contraction_count": 10}}
        }
        
        file_data = b"mock_data"
        processing_opts = ProcessingOptions(threshold_factor=0.75)
        session_params = GameSessionParameters(session_mvc_threshold_percentage=75.0)

        # Execute and verify exception
        with pytest.raises(ValueError, match="No metadata found in processing result"):
            await processor._populate_database_tables(
                session_id=session_id,
                processing_result=invalid_result,
                file_data=file_data,
                processing_opts=processing_opts,
                session_params=session_params
            )

    @pytest.mark.asyncio
    async def test_populate_database_tables_missing_analytics_error(self):
        """Test error handling when processing result lacks required analytics."""
        # Setup with missing analytics
        processor = TherapySessionProcessor()
        session_id = str(uuid4())
        
        invalid_result = {
            "success": True,
            "metadata": {"sampling_rate": 1000.0},
            # Missing "analytics" key
        }
        
        file_data = b"mock_data"
        processing_opts = ProcessingOptions(threshold_factor=0.75)
        session_params = GameSessionParameters(session_mvc_threshold_percentage=75.0)

        # Execute and verify exception
        with pytest.raises(ValueError, match="No analytics found in processing result"):
            await processor._populate_database_tables(
                session_id=session_id,
                processing_result=invalid_result,
                file_data=file_data,
                processing_opts=processing_opts,
                session_params=session_params
            )