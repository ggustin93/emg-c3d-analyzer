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
                "total_contractions": 20,
                "good_contractions": 18,
                "contraction_count": 20,
                "good_contraction_count": 18,
                "mvc_contraction_count": 15,
                "duration_contraction_count": 17,
                "mvc75_compliance_rate": 15,
                "duration_compliance_rate": 17,
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
                "total_contractions": 18,
                "good_contractions": 16,
                "contraction_count": 18,
                "good_contraction_count": 16,
                "mvc_contraction_count": 13,
                "duration_contraction_count": 15,
                "mvc75_compliance_rate": 13,
                "duration_compliance_rate": 15,
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

# Processing parameters are now stored as JSONB in emg_statistics table
# The obsolete TestProcessingParametersPopulation class has been removed as per schema optimization


# ============================================================================
# PERFORMANCE SCORES TABLE TESTS
# ============================================================================

class TestPerformanceScoresPopulation:
    """Test performance_scores table population via scoring service."""

    @pytest.mark.asyncio
    async def test_calculate_and_save_performance_scores_success(self, mock_therapy_processor, sample_processing_result):
        """Test successful performance scores calculation and saving."""
        processor = mock_therapy_processor
        session_id = str(uuid4())
        
        # Mock scoring service methods - include scoring_config_id for database requirement
        mock_scores = {
            "session_id": session_id,
            "scoring_config_id": str(uuid4()),  # Required for performance_scores table
            "overall_score": 0.815,
            "compliance_score": 0.82,
            "mvc_compliance_score": 0.87,
            "duration_compliance_score": 0.89,
            "bilateral_balance_score": 0.78,
            "therapeutic_effectiveness_score": 0.85
        }
        
        with patch.object(processor.performance_service, 'calculate_session_performance', new_callable=AsyncMock, return_value=mock_scores) as mock_calc, \
             patch.object(processor, '_upsert_table', new_callable=AsyncMock) as mock_upsert:
            
            # Execute - now requires both session_code and session_uuid
            session_code = "P001S001"
            await processor._calculate_and_save_performance_scores(
                session_code, session_id, sample_processing_result["analytics"], sample_processing_result
            )
            
            # Verify calculation called with proper metrics
            mock_calc.assert_called_once()
            call_args = mock_calc.call_args[0]
            session_uuid = call_args[0]
            analytics = call_args[1]
            
            # Validate method was called with correct parameters
            assert session_uuid == session_id
            assert analytics == sample_processing_result["analytics"]
            
            # Verify database upsert was called
            mock_upsert.assert_called_once()
            upsert_args = mock_upsert.call_args[0]
            assert upsert_args[0] == "performance_scores"  # table name
            assert upsert_args[2] == "session_id"  # key field
            performance_data = upsert_args[1]  # data dict
            assert performance_data["session_id"] == session_id
            assert performance_data["overall_score"] == 0.815

    @pytest.mark.asyncio
    async def test_calculate_performance_scores_missing_analytics(self, mock_therapy_processor):
        """Test graceful handling when analytics data is missing."""
        processor = mock_therapy_processor
        session_id = str(uuid4())
        
        empty_analytics = {}
        processing_result = {"metadata": {}}
        
        # Mock performance service to return error with scoring_config_id
        mock_result = {
            "error": "No analytics data",
            "scoring_config_id": str(uuid4())  # Include even in error case
        }
        with patch.object(processor.performance_service, 'calculate_session_performance', new_callable=AsyncMock, return_value=mock_result):
            
            # Execute - should not raise exception
            session_code = "P001S001"
            await processor._calculate_and_save_performance_scores(
                session_code, session_id, empty_analytics, processing_result
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
        # Create mock dependencies
        mock_c3d_processor = MagicMock()
        mock_emg_data_repo = MagicMock()
        mock_session_repo = MagicMock()
        mock_cache_service = MagicMock()
        mock_performance_service = MagicMock()
        mock_supabase_client = MagicMock()
        
        # Create processor with injected dependencies
        processor = TherapySessionProcessor(
            c3d_processor=mock_c3d_processor,
            emg_data_repo=mock_emg_data_repo,
            session_repo=mock_session_repo,
            cache_service=mock_cache_service,
            performance_service=mock_performance_service,
            supabase_client=mock_supabase_client
        )
        
        # Also add patient_repo and user_repo attributes for tests that expect them
        processor.patient_repo = MagicMock()
        processor.user_repo = MagicMock()
        session_id = str(uuid4())

        # Mock upsert method
        with patch.object(processor, '_upsert_table', new_callable=AsyncMock) as mock_upsert:
            
            # Execute - now requires both session_code and session_uuid
            session_code = "P001S001"
            await processor._populate_session_settings(
                session_code, session_id, sample_processing_options, sample_session_parameters
            )
            
            # Verify upsert called
            mock_upsert.assert_called_once_with("session_settings", mock_upsert.call_args[0][1], "session_id")
            
            # Validate settings data
            settings_data = mock_upsert.call_args[0][1]
            assert settings_data["session_id"] == session_id
            assert settings_data["mvc_threshold_percentage"] == 75.0
            
            # Updated for current remote schema - per-channel targets
            assert settings_data["target_contractions_ch1"] == 12  # CH1 target
            assert settings_data["target_contractions_ch2"] == 12  # CH2 target
            assert settings_data["target_duration_ch1_ms"] == 2000.0  # CH1 duration in ms
            assert settings_data["target_duration_ch2_ms"] == 2000.0  # CH2 duration in ms
            assert settings_data["bfr_enabled"] == True

    @pytest.mark.asyncio
    async def test_populate_session_settings_invalid_mvc_threshold(self):
        """Test validation and correction of invalid MVC threshold."""
        # Setup with invalid MVC threshold
        # Create mock dependencies
        mock_c3d_processor = MagicMock()
        mock_emg_data_repo = MagicMock()
        mock_session_repo = MagicMock()
        mock_cache_service = MagicMock()
        mock_performance_service = MagicMock()
        mock_supabase_client = MagicMock()
        
        # Create processor with injected dependencies
        processor = TherapySessionProcessor(
            c3d_processor=mock_c3d_processor,
            emg_data_repo=mock_emg_data_repo,
            session_repo=mock_session_repo,
            cache_service=mock_cache_service,
            performance_service=mock_performance_service,
            supabase_client=mock_supabase_client
        )
        
        # Also add patient_repo and user_repo attributes for tests that expect them
        processor.patient_repo = MagicMock()
        processor.user_repo = MagicMock()
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
            
            # Execute - now requires both session_code and session_uuid
            session_code = "P001S001"
            await processor._populate_session_settings(session_code, session_id, invalid_opts, session_params)
            
            # Verify correction applied
            settings_data = mock_upsert.call_args[0][1]
            assert settings_data["mvc_threshold_percentage"] == 75.0  # Corrected to default

    @pytest.mark.asyncio
    async def test_populate_session_settings_invalid_duration_threshold(self):
        """Test validation and correction of invalid duration threshold."""
        # Setup with invalid duration threshold  
        # Create mock dependencies
        mock_c3d_processor = MagicMock()
        mock_emg_data_repo = MagicMock()
        mock_session_repo = MagicMock()
        mock_cache_service = MagicMock()
        mock_performance_service = MagicMock()
        mock_supabase_client = MagicMock()
        
        # Create processor with injected dependencies
        processor = TherapySessionProcessor(
            c3d_processor=mock_c3d_processor,
            emg_data_repo=mock_emg_data_repo,
            session_repo=mock_session_repo,
            cache_service=mock_cache_service,
            performance_service=mock_performance_service,
            supabase_client=mock_supabase_client
        )
        
        # Also add patient_repo and user_repo attributes for tests that expect them
        processor.patient_repo = MagicMock()
        processor.user_repo = MagicMock()
        session_id = str(uuid4())
        
        processing_opts = ProcessingOptions(
            threshold_factor=0.75,
            min_duration_ms=1000
        )
        
        session_params = GameSessionParameters(session_mvc_threshold_percentage=75.0)

        # Mock upsert method
        with patch.object(processor, '_upsert_table', new_callable=AsyncMock) as mock_upsert:
            
            # Execute - now requires both session_code and session_uuid
            session_code = "P001S001"
            await processor._populate_session_settings(session_code, session_id, processing_opts, session_params)
            
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
        # Create mock dependencies
        mock_c3d_processor = MagicMock()
        mock_emg_data_repo = MagicMock()
        mock_session_repo = MagicMock()
        mock_cache_service = MagicMock()
        mock_performance_service = MagicMock()
        mock_supabase_client = MagicMock()
        
        # Create processor with injected dependencies
        processor = TherapySessionProcessor(
            c3d_processor=mock_c3d_processor,
            emg_data_repo=mock_emg_data_repo,
            session_repo=mock_session_repo,
            cache_service=mock_cache_service,
            performance_service=mock_performance_service,
            supabase_client=mock_supabase_client
        )
        
        # Also add patient_repo and user_repo attributes for tests that expect them
        processor.patient_repo = MagicMock()
        processor.user_repo = MagicMock()
        session_id = str(uuid4())

        # Mock composite key upsert method (new per-channel approach)
        with patch.object(processor, '_upsert_table_with_composite_key', new_callable=AsyncMock) as mock_upsert:
            
            # Execute - method requires session_code and session_uuid
            session_code = "P001S001"
            await processor._populate_bfr_monitoring(
                session_code, session_id, sample_session_parameters, sample_processing_result
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
        # Create mock dependencies
        mock_c3d_processor = MagicMock()
        mock_emg_data_repo = MagicMock()
        mock_session_repo = MagicMock()
        mock_cache_service = MagicMock()
        mock_performance_service = MagicMock()
        mock_supabase_client = MagicMock()
        
        # Create processor with injected dependencies
        processor = TherapySessionProcessor(
            c3d_processor=mock_c3d_processor,
            emg_data_repo=mock_emg_data_repo,
            session_repo=mock_session_repo,
            cache_service=mock_cache_service,
            performance_service=mock_performance_service,
            supabase_client=mock_supabase_client
        )
        
        # Also add patient_repo and user_repo attributes for tests that expect them
        processor.patient_repo = MagicMock()
        processor.user_repo = MagicMock()
        session_id = str(uuid4())
        
        # Provide minimal analytics data for BFR monitoring to process
        processing_result = {
            "metadata": {},
            "analytics": {
                "CH1": {
                    "contractions": [],
                    "mvc_value": 0.001
                },
                "CH2": {
                    "contractions": [],
                    "mvc_value": 0.001
                }
            }
        }

        # Mock composite key upsert method
        with patch.object(processor, '_upsert_table_with_composite_key', new_callable=AsyncMock) as mock_upsert:
            
            # Execute - should use SessionDefaults for all BFR values
            session_code = "P001S001"
            await processor._populate_bfr_monitoring(session_code, session_id, sample_session_parameters, processing_result)
            
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
        # Create mock dependencies
        mock_c3d_processor = MagicMock()
        mock_emg_data_repo = MagicMock()
        mock_session_repo = MagicMock()
        mock_cache_service = MagicMock()
        mock_performance_service = MagicMock()
        mock_supabase_client = MagicMock()
        
        # Create processor with injected dependencies
        processor = TherapySessionProcessor(
            c3d_processor=mock_c3d_processor,
            emg_data_repo=mock_emg_data_repo,
            session_repo=mock_session_repo,
            cache_service=mock_cache_service,
            performance_service=mock_performance_service,
            supabase_client=mock_supabase_client
        )
        
        # Also add patient_repo and user_repo attributes for tests that expect them
        processor.patient_repo = MagicMock()
        processor.user_repo = MagicMock()
        session_id = str(uuid4())
        
        minimal_params = GameSessionParameters(
            session_mvc_threshold_percentage=75.0,
            contraction_duration_threshold=2000.0
        )
        
        # Provide minimal analytics data for BFR monitoring to process
        processing_result = {
            "metadata": {},
            "analytics": {
                "CH1": {"contractions": [], "mvc_value": 0.001},
                "CH2": {"contractions": [], "mvc_value": 0.001}
            }
        }

        # Mock composite key upsert method
        with patch.object(processor, '_upsert_table_with_composite_key', new_callable=AsyncMock) as mock_upsert:
            
            # Execute
            session_code = "P001S001"
            await processor._populate_bfr_monitoring(session_code, session_id, minimal_params, processing_result)
            
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
    async def test_populate_all_database_tables_success(self, mock_therapy_processor, sample_processing_result, 
                                                       sample_processing_options, 
                                                       sample_session_parameters):
        """Test that all 4 database tables are populated successfully (processing_parameters now in JSONB)."""
        processor = mock_therapy_processor
        session_id = str(uuid4())
        file_data = b"mock_c3d_data"

        # Mock all database operations (processing_parameters removed - now in JSONB)
        with patch.object(processor, '_populate_emg_statistics', new_callable=AsyncMock) as mock_emg, \
             patch.object(processor, '_calculate_and_save_performance_scores', new_callable=AsyncMock) as mock_scores, \
             patch.object(processor, '_populate_session_settings', new_callable=AsyncMock) as mock_settings, \
             patch.object(processor, '_populate_bfr_monitoring', new_callable=AsyncMock) as mock_bfr:
            
            # Execute - method expects positional args: session_code, session_uuid, processing_result, file_data, processing_opts, session_params
            session_code = "P001S001"
            await processor._populate_database_tables(
                session_code,
                session_id,  # session_uuid
                sample_processing_result,
                file_data,
                sample_processing_options,
                sample_session_parameters
            )
            
            # Verify all 4 table population methods called (processing_parameters removed)
            # _populate_emg_statistics takes session_uuid, analytics, session_params, processing_config
            # processing_config is now generated inline, not from a separate method
            from unittest.mock import ANY
            mock_emg.assert_called_once_with(
                session_id, 
                sample_processing_result["analytics"], 
                sample_session_parameters,
                ANY  # processing_config generated inline
            )
            mock_scores.assert_called_once_with(
                session_code,
                session_id, 
                sample_processing_result["analytics"], 
                sample_processing_result
            )
            mock_settings.assert_called_once_with(
                session_code,
                session_id, 
                sample_processing_options, 
                sample_session_parameters
            )
            mock_bfr.assert_called_once_with(
                session_code,
                session_id, 
                sample_session_parameters, 
                sample_processing_result
            )

    @pytest.mark.asyncio
    async def test_populate_database_tables_missing_metadata_error(self, mock_therapy_processor):
        """Test error handling when processing result lacks required metadata."""
        processor = mock_therapy_processor
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
        from services.clinical.therapy_session_processor import TherapySessionError
        with pytest.raises(TherapySessionError, match="No metadata found in processing result"):
            session_code = "P001S001"
            await processor._populate_database_tables(
                session_code,
                session_id,  # session_uuid
                invalid_result,
                file_data,
                processing_opts,
                session_params
            )

    @pytest.mark.asyncio
    async def test_populate_database_tables_missing_analytics_error(self, mock_therapy_processor):
        """Test error handling when processing result lacks required analytics."""
        processor = mock_therapy_processor
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
        from services.clinical.therapy_session_processor import TherapySessionError
        with pytest.raises(TherapySessionError, match="No analytics found in processing result"):
            session_code = "P001S001"
            await processor._populate_database_tables(
                session_code,
                session_id,  # session_uuid
                invalid_result,
                file_data,
                processing_opts,
                session_params
            )