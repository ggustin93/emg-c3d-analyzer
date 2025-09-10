"""Critical tests for enhanced export functionality.

Following MVP plan: Test that export includes performance scores for researchers.
Test architecture follows backend CLAUDE.md: synchronous Supabase, MagicMock (not AsyncMock).
"""

import pytest
from unittest.mock import MagicMock
from uuid import UUID

from services.data.export_service import EnhancedEMGDataExporter


class TestEnhancedExport:
    """Critical tests for enhanced export with performance data."""

    def test_export_includes_critical_performance_data(self):
        """Critical test: Ensure export has performance scores for researchers.
        
        Following CLAUDE.md #16: Use MagicMock for Supabase (synchronous), not AsyncMock.
        """
        # Arrange - Mock Supabase (synchronous, following CLAUDE.md #16)
        mock_supabase = MagicMock()
        
        # Mock performance scores query response (17+ fields from database schema)
        mock_performance_data = {
            'overall_score': 85.0,
            'compliance_score': 90.0,
            'symmetry_score': 80.0,
            'effort_score': 88.0,
            'game_score': 75.0,
            'left_muscle_compliance': 92.0,
            'right_muscle_compliance': 88.0,
            'completion_rate_left': 0.95,
            'completion_rate_right': 0.90,
            'intensity_rate_left': 0.85,
            'intensity_rate_right': 0.80,
            'duration_rate_left': 0.90,
            'duration_rate_right': 0.88,
            'bfr_compliant': True,
            'rpe_post_session': 5,
            'game_points_achieved': 150,
            'game_points_max': 200
        }
        
        # Mock scoring configuration
        mock_scoring_config = {
            'configuration_name': 'Default Clinical Configuration',
            'weight_compliance': 0.40,
            'weight_symmetry': 0.25,
            'weight_effort': 0.20,
            'weight_game': 0.15,
            'rpe_mapping': {
                '0': {'score': 10, 'category': 'no_exertion'},
                '5': {'score': 100, 'category': 'optimal_moderate'},
                '10': {'score': 10, 'category': 'maximum'}
            }
        }
        
        # Configure Supabase mock for multiple table queries
        mock_performance_result = MagicMock()
        mock_performance_result.data = [mock_performance_data]
        
        mock_session_result = MagicMock() 
        mock_session_result.data = [{'scoring_config_id': 'test-config-id'}]
        
        mock_config_result = MagicMock()
        mock_config_result.data = [mock_scoring_config]
        
        # Mock the table queries separately
        def table_mock(table_name):
            mock_table = MagicMock()
            if table_name == 'performance_scores':
                mock_table.select().eq().limit().execute.return_value = mock_performance_result
            elif table_name == 'therapy_sessions':
                mock_table.select().eq().limit().execute.return_value = mock_session_result
            elif table_name == 'scoring_configuration':
                mock_table.select().eq().limit().execute.return_value = mock_config_result
            return mock_table
            
        mock_supabase.table.side_effect = table_mock
        
        # Mock processor with analysis result
        mock_processor = MagicMock()
        mock_processor.latest_analysis_result = MagicMock(
            emg_signals={'CH1': MagicMock(data=[1, 2, 3])},
            analytics={'CH1': {'mvc_value': 100}}
        )
        
        export_service = EnhancedEMGDataExporter(mock_processor, mock_supabase)
        test_session_id = "550e8400-e29b-41d4-a716-446655440000"
        
        # Act
        result = export_service.get_comprehensive_export_data(test_session_id)
        
        # Assert - Critical data present
        assert 'performance_scores' in result, "Performance scores missing from export"
        assert 'scoring_configuration' in result, "Scoring configuration missing from export"
        
        # Verify performance data structure
        performance = result['performance_scores']
        assert performance['overall_score'] == 85.0, "Overall score incorrect"
        assert performance['compliance_score'] == 90.0, "Compliance score incorrect"
        assert performance['symmetry_score'] == 80.0, "Symmetry score incorrect"
        
        # Verify scoring configuration for reproducibility
        config = result['scoring_configuration']
        assert config['weight_compliance'] == 0.40, "Compliance weight incorrect"
        assert config['weight_symmetry'] == 0.25, "Symmetry weight incorrect"
        assert 'rpe_mapping' in config, "RPE mapping missing"
        
        # Ensure no regression - existing data still there
        assert 'session_metadata' in result, "Session metadata missing (regression)"

    def test_export_handles_missing_performance_data_gracefully(self):
        """Test that export works even when performance data is unavailable."""
        # Arrange - Mock Supabase with no performance data
        mock_supabase = MagicMock()
        mock_supabase.table().select().eq().limit().execute.return_value.data = []
        
        mock_processor = MagicMock()
        mock_processor.latest_analysis_result = MagicMock(
            emg_signals={'CH1': MagicMock(data=[1, 2, 3])},
            analytics={'CH1': {'mvc_value': 100}}
        )
        
        export_service = EnhancedEMGDataExporter(mock_processor, mock_supabase)
        
        # Act
        result = export_service.get_comprehensive_export_data("test-session-id")
        
        # Assert - Should still return base export data
        assert 'session_metadata' in result, "Base export data missing"
        assert 'performance_scores' in result, "Performance scores field missing"
        assert result['performance_scores']['note'] == "No performance scores found for this session"

    def test_export_without_supabase_client(self):
        """Test that export works without Supabase client (fallback mode)."""
        # Arrange - No Supabase client
        mock_processor = MagicMock()
        mock_processor.latest_analysis_result = MagicMock(
            emg_signals={'CH1': MagicMock(data=[1, 2, 3])},
            analytics={'CH1': {'mvc_value': 100}}
        )
        
        export_service = EnhancedEMGDataExporter(mock_processor, supabase_client=None)
        
        # Act
        result = export_service.get_comprehensive_export_data("test-session-id")
        
        # Assert - Should return base export without performance data
        assert 'session_metadata' in result, "Base export missing"
        assert 'performance_scores' not in result, "Performance scores should not be present without Supabase"

    def test_export_preserves_existing_functionality(self):
        """Test that existing export_data method still works (no regression)."""
        # Arrange
        mock_processor = MagicMock()
        mock_processor.latest_analysis_result = MagicMock()
        mock_processor.latest_analysis_result.emg_signals = {
            'CH1': MagicMock(data=[1, 2, 3], time_axis=[0.1, 0.2, 0.3])
        }
        mock_processor.latest_analysis_result.analytics = {
            'CH1': {'mvc_value': 100}
        }
        
        export_service = EnhancedEMGDataExporter(mock_processor)
        
        # Act
        result = export_service.export_data(['CH1'], 'test.c3d', {'format': 'json'})
        
        # Assert - Existing functionality preserved
        assert result['success'] is True, "Export should succeed"
        assert 'CH1' in result['export_data']['data'], "Channel data missing"
        assert result['export_data']['data']['CH1']['signal_data'] == [1, 2, 3], "Signal data incorrect"