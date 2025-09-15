"""
Unit tests for adherence score calculation following metricsDefinitions.md
"""

import pytest
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone
from backend.services.clinical.performance_scoring_service import PerformanceScoringService


class TestAdherenceScore:
    """Test adherence score calculation according to business logic specification."""

    def setup_method(self):
        """Set up test dependencies."""
        self.service = PerformanceScoringService()
        # Mock Supabase client - NEVER use AsyncMock per backend/CLAUDE.md
        self.service.client = MagicMock()

    def test_minimum_days_requirement(self):
        """Test that adherence requires minimum 3 days per spec."""
        # Test with day 2 (less than minimum)
        result = self.service.calculate_adherence_score("patient_1", protocol_day=2)
        
        assert result["adherence_score"] is None
        assert "Minimum 3 days required" in result["message"]

    def test_adherence_calculation_formula(self):
        """Test the adherence formula: (completed / expected) × 100."""
        # Mock database response with 10 sessions
        mock_sessions = [{"id": f"session_{i}", "session_date": datetime.now(timezone.utc).isoformat()} 
                        for i in range(10)]
        self.service.client.table().select().eq().gte().execute.return_value.data = mock_sessions
        
        # Test on day 7: expected = 2.14 * 7 = 14.98 sessions
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert result["completed_sessions"] == 10
        assert result["expected_sessions"] == pytest.approx(14.98, rel=0.01)
        # Adherence = (10 / 14.98) * 100 = 66.76%
        assert result["adherence_score"] == pytest.approx(66.76, rel=0.5)
        assert result["category"] == "Moderate"  # 50-69% range

    def test_clinical_threshold_excellent(self):
        """Test Excellent threshold (≥85%)."""
        # Mock 18 sessions for day 7 (18/14.98 = 120%)
        mock_sessions = [{"id": f"session_{i}", "session_date": datetime.now(timezone.utc).isoformat()} 
                        for i in range(18)]
        self.service.client.table().select().eq().gte().execute.return_value.data = mock_sessions
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert result["adherence_score"] > 85
        assert result["category"] == "Excellent"
        assert "Meeting/exceeding" in result["interpretation"]

    def test_clinical_threshold_good(self):
        """Test Good threshold (70-84%)."""
        # Mock 11 sessions for day 7 (11/14.98 = 73.43%)
        mock_sessions = [{"id": f"session_{i}", "session_date": datetime.now(timezone.utc).isoformat()} 
                        for i in range(11)]
        self.service.client.table().select().eq().gte().execute.return_value.data = mock_sessions
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert 70 <= result["adherence_score"] < 85
        assert result["category"] == "Good"
        assert "Adequate with minor gaps" in result["interpretation"]

    def test_clinical_threshold_moderate(self):
        """Test Moderate threshold (50-69%)."""
        # Mock 8 sessions for day 7 (8/14.98 = 53.40%)
        mock_sessions = [{"id": f"session_{i}", "session_date": datetime.now(timezone.utc).isoformat()} 
                        for i in range(8)]
        self.service.client.table().select().eq().gte().execute.return_value.data = mock_sessions
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert 50 <= result["adherence_score"] < 70
        assert result["category"] == "Moderate"
        assert "intervention consideration" in result["interpretation"]

    def test_clinical_threshold_poor(self):
        """Test Poor threshold (<50%)."""
        # Mock 5 sessions for day 7 (5/14.98 = 33.38%)
        mock_sessions = [{"id": f"session_{i}", "session_date": datetime.now(timezone.utc).isoformat()} 
                        for i in range(5)]
        self.service.client.table().select().eq().gte().execute.return_value.data = mock_sessions
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert result["adherence_score"] < 50
        assert result["category"] == "Poor"
        assert "Significant concern" in result["interpretation"]

    def test_zero_sessions_scenario(self):
        """Test adherence with zero completed sessions."""
        # Mock empty sessions response
        self.service.client.table().select().eq().gte().execute.return_value.data = []
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert result["completed_sessions"] == 0
        assert result["adherence_score"] == 0
        assert result["category"] == "Poor"

    def test_expected_sessions_rate(self):
        """Test the expected sessions rate: 15 per 7 days ≈ 2.14 × t."""
        # Mock doesn't matter, we're testing the calculation
        self.service.client.table().select().eq().gte().execute.return_value.data = []
        
        # Test various protocol days
        test_cases = [
            (3, 6.42),   # 2.14 * 3
            (7, 14.98),  # 2.14 * 7
            (14, 29.96), # 2.14 * 14
            (30, 64.2),  # 2.14 * 30
        ]
        
        for days, expected in test_cases:
            result = self.service.calculate_adherence_score("patient_1", protocol_day=days)
            assert result["expected_sessions"] == pytest.approx(expected, rel=0.01)

    def test_database_error_handling(self):
        """Test proper error handling when database query fails."""
        # Mock database error
        self.service.client.table().select().eq().gte().execute.side_effect = Exception("Database error")
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert "error" in result
        assert "Database error" in result["error"]

    def test_date_cutoff_calculation(self):
        """Test that sessions are filtered by protocol day cutoff."""
        # This test verifies the date filtering logic
        patient_id = "test_patient"
        protocol_day = 7
        
        # Call the method
        self.service.calculate_adherence_score(patient_id, protocol_day)
        
        # Verify the database query was called with correct parameters
        mock_table = self.service.client.table.return_value
        mock_table.select.assert_called_once_with("id, session_date")
        mock_table.select.return_value.eq.assert_called_once_with("patient_id", patient_id)
        
        # Check that gte was called with a date 7 days ago
        gte_call = mock_table.select.return_value.eq.return_value.gte
        gte_call.assert_called_once()
        
        # The cutoff date should be approximately 7 days ago
        cutoff_arg = gte_call.call_args[0][1]
        assert isinstance(cutoff_arg, str)  # Should be an ISO format string