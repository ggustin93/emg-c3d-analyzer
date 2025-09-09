#!/usr/bin/env python
"""
Integration test with real C3D patterns from GHOSTLY data.

This test verifies the complete processing pipeline with realistic data patterns:
- CH1: 20 contractions, 100% MVC compliance, 0% duration compliance
- CH2: 9 contractions, 100% MVC compliance, 0% duration compliance

This pattern (strong but brief contractions) is clinically valid and common
in the GHOSTLY trial data.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from uuid import uuid4
from datetime import datetime, timezone

from services.clinical.therapy_session_processor import TherapySessionProcessor
from services.clinical.performance_scoring_service import PerformanceScoringService, SessionMetrics


class TestRealC3DPatternsIntegration:
    """Test real C3D patterns from GHOSTLY trial data."""
    
    @pytest.fixture
    def realistic_analytics(self):
        """Realistic analytics data from actual GHOSTLY C3D file."""
        return {
            "CH1": {
                "contraction_count": 20,
                "mvc_compliant_count": 20,  # 100% met MVC threshold
                "duration_compliant_count": 0,  # 0% met duration threshold  
                "good_contraction_count": 0,  # None met BOTH thresholds
                "mvc_value": 0.75,
                "mvc_threshold": 562.5,
                "compliance_rate": 0.50,  # Average of MVC (100%) and duration (0%)
                "avg_duration_ms": 1725.0,
                "max_duration_ms": 2850.0,
                "min_duration_ms": 950.0,
                "avg_amplitude": 485.2,
                "max_amplitude": 750.0
            },
            "CH2": {
                "contraction_count": 9,
                "mvc_compliant_count": 9,  # 100% met MVC threshold
                "duration_compliant_count": 0,  # 0% met duration threshold
                "good_contraction_count": 0,  # None met BOTH thresholds  
                "mvc_value": 0.72,
                "mvc_threshold": 540.0,
                "compliance_rate": 0.50,  # Average of MVC (100%) and duration (0%)
                "avg_duration_ms": 1650.0,
                "max_duration_ms": 2700.0,
                "min_duration_ms": 890.0,
                "avg_amplitude": 465.8,
                "max_amplitude": 720.0
            }
        }
    
    @pytest.fixture
    def mock_processor(self):
        """Create a mock TherapySessionProcessor."""
        # Create mock dependencies
        mock_c3d_processor = MagicMock()
        mock_emg_data_repo = MagicMock()
        mock_session_repo = MagicMock()
        mock_cache_service = MagicMock()
        mock_performance_service = MagicMock()
        mock_supabase_client = MagicMock()
        
        # Configure mock Supabase client chain
        mock_table = MagicMock()
        mock_upsert = MagicMock()
        mock_execute = MagicMock()
        mock_execute.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])
        mock_upsert.execute = mock_execute.execute
        mock_table.upsert.return_value = mock_upsert
        mock_supabase_client.table.return_value = mock_table
        
        # Create processor with injected dependencies  
        processor = TherapySessionProcessor(
            c3d_processor=mock_c3d_processor,
            emg_data_repo=mock_emg_data_repo,
            session_repo=mock_session_repo,
            cache_service=mock_cache_service,
            performance_service=mock_performance_service,
            supabase_client=mock_supabase_client
        )
        
        # Mock additional repositories
        processor.patient_repo = MagicMock()
        processor.user_repo = MagicMock()
        
        return processor
    
    def test_session_metrics_creation_with_real_patterns(self, mock_processor, realistic_analytics):
        """Test SessionMetrics creation with realistic GHOSTLY data patterns."""
        session_id = str(uuid4())
        
        # Create metrics from realistic analytics
        metrics = mock_processor._create_session_metrics_from_analytics(session_id, realistic_analytics)
        
        # Verify metrics were created successfully
        assert metrics is not None
        assert metrics.session_id == session_id
        
        # Verify left muscle (CH1) metrics
        assert metrics.left_total_contractions == 20
        assert metrics.left_mvc_contractions == 20  # 100% MVC compliance
        assert metrics.left_duration_contractions == 0  # 0% duration compliance
        assert metrics.left_good_contractions == 0  # None met both
        
        # Verify right muscle (CH2) metrics  
        assert metrics.right_total_contractions == 9
        assert metrics.right_mvc_contractions == 9  # 100% MVC compliance
        assert metrics.right_duration_contractions == 0  # 0% duration compliance
        assert metrics.right_good_contractions == 0  # None met both
    
    def test_performance_scores_calculation_with_real_patterns(self):
        """Test performance scores calculation with realistic GHOSTLY data."""
        session_id = str(uuid4())
        
        # Create SessionMetrics with realistic data
        metrics = SessionMetrics(
            session_id=session_id,
            left_total_contractions=20,
            left_good_contractions=0,
            left_mvc_contractions=20,
            left_duration_contractions=0,
            right_total_contractions=9,
            right_good_contractions=0,
            right_mvc_contractions=9,
            right_duration_contractions=0,
            bfr_pressure_aop=50.0,
            bfr_compliant=True,
            rpe_post_session=None,
            game_points_achieved=None,
            game_points_max=None,
            expected_contractions_per_muscle=12
        )
        
        # Calculate performance scores
        scoring_service = PerformanceScoringService()
        
        # Mock the scoring configuration lookup
        with patch.object(scoring_service.scoring_repo, 'get_session_scoring_config', return_value=str(uuid4())), \
             patch.object(scoring_service.scoring_repo, 'get_scoring_config_by_id') as mock_get_config:
            
            # Mock scoring configuration
            mock_get_config.return_value = {
                "id": str(uuid4()),
                "name": "GHOSTLY-TRIAL-DEFAULT",
                "weight_compliance": 0.5,
                "weight_symmetry": 0.25,
                "weight_effort": 0.25,
                "weight_game": 0.0,
                "compliance_weights": {
                    "completion": 0.33,
                    "intensity": 0.33,
                    "duration": 0.34
                }
            }
            
            scores = scoring_service.calculate_performance_scores(session_id, metrics)
            
            # Verify scores are calculated correctly
            assert scores is not None
            assert "error" not in scores
            
            # Verify intensity rates are 100% (all contractions met MVC)
            assert scores["intensity_rate_left"] == 1.0  # 20/20 = 100%
            assert scores["intensity_rate_right"] == 1.0  # 9/9 = 100%
            
            # Verify duration rates are 0% (no contractions met duration)
            assert scores["duration_rate_left"] == 0.0  # 0/20 = 0%
            assert scores["duration_rate_right"] == 0.0  # 0/9 = 0%
            
            # Verify completion rates
            assert scores["completion_rate_left"] == 1.0  # 20/12 = 1.67, capped at 1.0
            assert scores["completion_rate_right"] == 0.75  # 9/12 = 0.75
            
            # Verify compliance scores reflect the mixed performance
            # Left: (1.0 * 0.33 + 1.0 * 0.33 + 0.0 * 0.34) = 0.66
            # Right: (0.75 * 0.33 + 1.0 * 0.33 + 0.0 * 0.34) = 0.58
            assert 0.6 <= scores["left_muscle_compliance"] <= 0.7
            assert 0.5 <= scores["right_muscle_compliance"] <= 0.6
            
            # Verify symmetry score accounts for different contraction counts
            # Asymmetry due to CH1:20 vs CH2:9 contractions
            assert 0.6 <= scores["symmetry_score"] <= 0.8
    
    @pytest.mark.asyncio
    async def test_complete_pipeline_with_real_patterns(self, mock_processor, realistic_analytics):
        """Test complete processing pipeline with realistic GHOSTLY data."""
        session_id = str(uuid4())
        session_code = "P001S001"
        
        processing_result = {
            "success": True,
            "metadata": {
                "sampling_rate": 1000.0,
                "duration_seconds": 175.1,
                "frame_count": 175100,
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            "analytics": realistic_analytics
        }
        
        # Mock the performance scoring service
        with patch('services.clinical.performance_scoring_service.PerformanceScoringService') as MockPerfService:
            mock_perf_instance = MagicMock()
            mock_perf_instance.calculate_performance_scores.return_value = {
                "session_id": session_id,
                "scoring_config_id": str(uuid4()),
                "overall_score": 0.6,  # Realistic for 100% MVC, 0% duration
                "compliance_score": 0.62,
                "symmetry_score": 0.69,
                "effort_score": 0.0,
                "game_score": 0.0,
                "completion_rate_left": 1.0,
                "intensity_rate_left": 1.0,
                "duration_rate_left": 0.0,
                "completion_rate_right": 0.75,
                "intensity_rate_right": 1.0,
                "duration_rate_right": 0.0,
                "left_muscle_compliance": 0.66,
                "right_muscle_compliance": 0.58
            }
            MockPerfService.return_value = mock_perf_instance
            
            # Execute the performance calculation
            await mock_processor._calculate_and_save_performance_scores(
                session_code, session_id, realistic_analytics, processing_result
            )
            
            # Verify SessionMetrics was created correctly
            mock_perf_instance.calculate_performance_scores.assert_called_once()
            call_args = mock_perf_instance.calculate_performance_scores.call_args[0]
            passed_metrics = call_args[1]
            
            # Verify the metrics passed have correct values (no fallback)
            assert passed_metrics.left_mvc_contractions == 20
            assert passed_metrics.left_duration_contractions == 0
            assert passed_metrics.right_mvc_contractions == 9
            assert passed_metrics.right_duration_contractions == 0
            
            # Verify database upsert was attempted
            mock_processor.supabase_client.table.assert_called()
    
    def test_data_quality_validation_with_real_patterns(self, mock_processor, realistic_analytics):
        """Test data quality validation detects patterns correctly."""
        session_id = str(uuid4())
        
        # Capture log messages
        import logging
        with patch.object(logging.getLogger('services.clinical.therapy_session_processor'), 'info') as mock_info, \
             patch.object(logging.getLogger('services.clinical.therapy_session_processor'), 'warning') as mock_warning:
            
            # Validate CH1 data
            mock_processor._validate_analytics_data_quality(
                realistic_analytics["CH1"], "CH1", session_id
            )
            
            # Should log info about the pattern (MVC met, duration not met, no good contractions)
            mock_info.assert_called()
            info_message = str(mock_info.call_args)
            assert "Performance pattern" in info_message or "contraction summary" in info_message
            
            # Should NOT log warnings since this is a valid pattern
            mock_warning.assert_not_called()