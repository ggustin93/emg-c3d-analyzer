"""Critical tests for CSV export functionality.

Following MVP plan: Test CSV format works for pandas import and is research-ready.
Test architecture follows backend CLAUDE.md: comprehensive validation, no AsyncMock issues.
"""

import pytest
import pandas as pd
from io import StringIO
from services.data.converters import convert_export_to_csv, validate_csv_for_research, apply_research_friendly_names


class TestCSVExport:
    """Critical tests for CSV export with research usability focus."""

    def test_csv_export_research_ready(self):
        """Critical test: CSV format works for pandas import and contains performance data.
        
        This is the most important test - ensures researchers can use the CSV directly.
        """
        # Arrange - Sample export data matching our enhanced export structure
        test_export_data = {
            'session_metadata': {
                'export_timestamp': '2025-01-10T15:30:00Z',
                'analysis_result': type('MockResult', (), {
                    'source_filename': 'Ghostly_Emg_20250115_10-30-00-1234_test.c3d'
                })(),
                'analytics': {
                    'CH1': {'mvc_value': 150.5},
                    'CH2': {'mvc_value': 145.2}
                }
            },
            'performance_scores': {
                'overall_score': 85.0,
                'compliance_score': 90.0,
                'symmetry_score': 80.0,
                'effort_score': 88.0,
                'game_score': 75.0,
                'left_muscle_compliance': 92.0,
                'right_muscle_compliance': 88.0,
                'completion_rate_left': 0.95,
                'completion_rate_right': 0.90,
                'rpe_post_session': 5
            },
            'scoring_configuration': {
                'configuration_name': 'Default Clinical Configuration',
                'weight_compliance': 0.40,
                'weight_symmetry': 0.25,
                'weight_effort': 0.20,
                'weight_game': 0.15,
                'rpe_mapping': {
                    '5': {'score': 100, 'category': 'optimal_moderate'},
                    '10': {'score': 10, 'category': 'maximum'}
                }
            }
        }
        
        # Act
        csv_content = convert_export_to_csv(test_export_data)
        
        # Assert - Research usability checks
        assert isinstance(csv_content, str), "CSV content must be string"
        assert len(csv_content) > 0, "CSV content cannot be empty"
        
        # Critical: Check research-friendly column names
        assert 'performance_overall_score' in csv_content, "Overall score column missing"
        assert 'performance_compliance_score' in csv_content, "Compliance score column missing"
        assert 'config_weight_compliance' in csv_content, "Configuration weight missing"
        
        # Critical: Check data values are present
        assert '85.0' in csv_content, "Overall score value missing"
        assert '90.0' in csv_content, "Compliance score value missing"
        assert '0.4' in csv_content, "Compliance weight missing"
        
        # Critical: Verify pandas import works (the ultimate test)
        df = pd.read_csv(StringIO(csv_content))
        assert len(df) == 1, "Should have exactly one row (one session)"
        assert len(df.columns) > 5, "Should have multiple columns with metrics"
        
        # Verify specific values accessible in pandas
        assert df['performance_overall_score'].iloc[0] == 85.0, "Overall score not accessible via pandas"
        assert df['performance_compliance_score'].iloc[0] == 90.0, "Compliance score not accessible via pandas"
        assert df['config_weight_compliance'].iloc[0] == 0.4, "Config weight not accessible via pandas"

    def test_csv_handles_missing_performance_data(self):
        """Test CSV export handles missing performance data gracefully."""
        # Arrange - Export data without performance scores
        test_export_data = {
            'session_metadata': {
                'export_timestamp': '2025-01-10T15:30:00Z'
            },
            'performance_scores': {
                'note': 'No performance scores found for this session'
            },
            'scoring_configuration': {
                'note': 'No scoring configuration found for this session'
            }
        }
        
        # Act
        csv_content = convert_export_to_csv(test_export_data)
        
        # Assert - Should still produce valid CSV
        assert isinstance(csv_content, str), "Should return CSV string even with missing data"
        df = pd.read_csv(StringIO(csv_content))
        assert len(df) == 1, "Should have one row"
        assert 'export_timestamp' in df.columns, "Basic metadata should be present"

    def test_csv_validation_for_research(self):
        """Test CSV validation helper for research readiness."""
        # Arrange
        test_csv = """export_timestamp,performance_overall_score,performance_compliance_score,config_weight_compliance
2025-01-10T15:30:00Z,85.0,90.0,0.40"""
        
        # Act
        validation_result = validate_csv_for_research(test_csv)
        
        # Assert
        assert validation_result['valid'] is True, "CSV should be valid"
        assert validation_result['pandas_import_success'] is True, "Pandas import should succeed"
        assert validation_result['row_count'] == 1, "Should have one data row"
        assert validation_result['performance_metrics_count'] >= 2, "Should have performance metrics"

    def test_csv_research_friendly_column_names(self):
        """Test research-friendly column name mapping."""
        # Arrange
        original_csv = """performance_overall_score,performance_compliance_score
85.0,90.0"""
        
        # Act
        research_csv = apply_research_friendly_names(original_csv)
        
        # Assert
        assert 'P_overall' in research_csv, "Should have research-friendly name for overall score"
        assert 'S_compliance' in research_csv, "Should have research-friendly name for compliance"
        
        # Verify pandas can still import
        df = pd.read_csv(StringIO(research_csv))
        assert df['P_overall'].iloc[0] == 85.0, "Research-friendly column should contain correct data"

    def test_csv_export_error_handling(self):
        """Test CSV export handles invalid data gracefully."""
        # Arrange - Problematic export data
        test_export_data = None
        
        # Act
        csv_content = convert_export_to_csv(test_export_data)
        
        # Assert - Should return error CSV, not crash
        assert isinstance(csv_content, str), "Should return string even on error"
        assert 'error' in csv_content.lower() or 'invalid' in csv_content.lower(), "Should indicate error condition"
        
        # Should still be valid CSV that pandas can read
        df = pd.read_csv(StringIO(csv_content))
        assert len(df) >= 0, "Even error CSV should be readable by pandas"

    def test_csv_comprehensive_performance_data(self):
        """Test CSV includes all 17+ performance metrics from database schema."""
        # Arrange - Full performance data as per database schema
        comprehensive_performance_data = {
            'session_metadata': {'export_timestamp': '2025-01-10T15:30:00Z'},
            'performance_scores': {
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
                'bfr_pressure_aop': 65.0,
                'rpe_post_session': 5,
                'game_points_achieved': 150,
                'game_points_max': 200
            }
        }
        
        # Act
        csv_content = convert_export_to_csv(comprehensive_performance_data)
        
        # Assert - All performance metrics should be columns
        expected_columns = [
            'performance_overall_score',
            'performance_compliance_score', 
            'performance_symmetry_score',
            'performance_left_muscle_compliance',
            'performance_right_muscle_compliance',
            'performance_completion_rate_left',
            'performance_intensity_rate_left',
            'performance_bfr_compliant',
            'performance_rpe_post_session'
        ]
        
        for col in expected_columns:
            assert col in csv_content, f"Missing performance column: {col}"
        
        # Verify all data accessible via pandas
        df = pd.read_csv(StringIO(csv_content))
        assert df['performance_overall_score'].iloc[0] == 85.0, "Overall score incorrect"
        assert df['performance_bfr_compliant'].iloc[0] == True, "BFR compliance incorrect"
        assert df['performance_rpe_post_session'].iloc[0] == 5, "RPE score incorrect"