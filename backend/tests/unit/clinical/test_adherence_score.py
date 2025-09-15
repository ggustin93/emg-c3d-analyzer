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
        # Mock patient lookup to return patient_code
        self.service.client.table().select().eq().execute.return_value.data = [{"patient_code": "P001"}]
        
        # Mock storage response with real GHOSTLY filename pattern from tests/samples
        # Using actual GHOSTLY format: Ghostly_Emg_20230321_17-50-17-0881.c3d
        from datetime import datetime, timezone, timedelta
        today = datetime.now(timezone.utc)
        mock_storage_files = [
            {"name": f"Ghostly_Emg_{(today - timedelta(days=i)).strftime('%Y%m%d')}_17-50-17-0881.c3d"}
            for i in range(10)  # 10 files from today going back 10 days (only 7 should be counted for protocol_day=7)
        ]
        self.service.client.storage.from_().list.return_value = mock_storage_files
        
        # Test on day 7: expected = 2.14 * 7 = 14.98 sessions
        # Only 7 files should be counted (within protocol day boundary)
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert result["completed_sessions"] == 7
        assert result["expected_sessions"] == pytest.approx(14.98, rel=0.01)
        # Adherence = (7 / 14.98) * 100 = 46.7%
        assert result["adherence_score"] == pytest.approx(46.7, rel=0.5)
        assert result["category"] == "Poor"  # <50% range

    def test_clinical_threshold_excellent(self):
        """Test Excellent threshold (≥85%)."""
        # Mock patient lookup
        self.service.client.table().select().eq().execute.return_value.data = [{"patient_code": "P001"}]
        
        # Mock storage with 18 sessions within protocol day boundary (need 85% = 12.7+ sessions)
        from datetime import datetime, timezone, timedelta
        today = datetime.now(timezone.utc)
        mock_storage_files = [
            {"name": f"Ghostly_Emg_{(today - timedelta(days=i%7)).strftime('%Y%m%d')}_17-50-17-0881.c3d"}
            for i in range(18)  # 18 files, but some days repeated (all within 7-day boundary)
        ]
        self.service.client.storage.from_().list.return_value = mock_storage_files
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        # All 18 sessions are within protocol day boundary
        assert result["completed_sessions"] == 18
        # Adherence = (18 / 14.98) * 100 = 120.16% → capped at 100%
        assert result["adherence_score"] == 100  # Capped at 100%
        assert result["category"] == "Excellent"
        assert "Meeting/exceeding" in result["interpretation"]

    def test_clinical_threshold_good(self):
        """Test Good threshold (70-84%)."""
        # Mock patient lookup
        self.service.client.table().select().eq().execute.return_value.data = [{"patient_code": "P001"}]
        
        # Mock 11 sessions for day 7 (11/14.98 = 73.43%)
        # Need to ensure all 11 files are within the 7-day protocol boundary
        from datetime import datetime, timezone, timedelta
        today = datetime.now(timezone.utc)
        mock_storage_files = [
            {"name": f"Ghostly_Emg_{(today - timedelta(days=i%7)).strftime('%Y%m%d')}_17-50-17-{i:04d}.c3d"}
            for i in range(11)  # 11 files, cycling through days 0-6
        ]
        self.service.client.storage.from_().list.return_value = mock_storage_files
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert 70 <= result["adherence_score"] < 85
        assert result["category"] == "Good"
        assert "Adequate with minor gaps" in result["interpretation"]

    def test_clinical_threshold_moderate(self):
        """Test Moderate threshold (50-69%)."""
        # Mock patient lookup
        self.service.client.table().select().eq().execute.return_value.data = [{"patient_code": "P001"}]
        
        # Mock 8 sessions for day 7 (8/14.98 = 53.40%)
        # Need to ensure all 8 files are within the 7-day protocol boundary
        from datetime import datetime, timezone, timedelta
        today = datetime.now(timezone.utc)
        mock_storage_files = [
            {"name": f"Ghostly_Emg_{(today - timedelta(days=i%7)).strftime('%Y%m%d')}_17-50-17-{i:04d}.c3d"}
            for i in range(8)  # 8 files, cycling through days 0-6
        ]
        self.service.client.storage.from_().list.return_value = mock_storage_files
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert 50 <= result["adherence_score"] < 70
        assert result["category"] == "Moderate"
        assert "intervention consideration" in result["interpretation"]

    def test_clinical_threshold_poor(self):
        """Test Poor threshold (<50%)."""
        # Mock patient lookup
        self.service.client.table().select().eq().execute.return_value.data = [{"patient_code": "P001"}]
        
        # Mock 5 sessions for day 7 (5/14.98 = 33.38%)
        from datetime import datetime, timezone, timedelta
        today = datetime.now(timezone.utc)
        mock_storage_files = [
            {"name": f"Ghostly_Emg_{(today - timedelta(days=i)).strftime('%Y%m%d')}_17-50-17-0881.c3d"}
            for i in range(5)  # 5 files within 7-day boundary
        ]
        self.service.client.storage.from_().list.return_value = mock_storage_files
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert result["adherence_score"] < 50
        assert result["category"] == "Poor"
        assert "Significant concern" in result["interpretation"]

    def test_zero_sessions_scenario(self):
        """Test adherence with zero completed sessions."""
        # Mock patient lookup
        self.service.client.table().select().eq().execute.return_value.data = [{"patient_code": "P001"}]
        
        # Mock empty storage response
        self.service.client.storage.from_().list.return_value = []
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert result["completed_sessions"] == 0
        assert result["adherence_score"] == 0
        assert result["category"] == "Poor"

    def test_expected_sessions_rate(self):
        """Test the expected sessions rate: 15 per 7 days ≈ 2.14 × t."""
        # Mock patient lookup
        self.service.client.table().select().eq().execute.return_value.data = [{"patient_code": "P001"}]
        
        # Mock empty storage response - we're testing the calculation
        self.service.client.storage.from_().list.return_value = []
        
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
        # Mock database error during patient lookup
        self.service.client.table().select().eq().execute.side_effect = Exception("Database error")
        
        result = self.service.calculate_adherence_score("patient_1", protocol_day=7)
        
        assert "error" in result
        assert "Database error" in result["error"]

    def test_date_cutoff_calculation(self):
        """Test that sessions are filtered by protocol day cutoff."""
        # Mock patient lookup
        self.service.client.table().select().eq().execute.return_value.data = [{"patient_code": "P001"}]
        
        # Mock storage files with dates spanning more than 7 days
        from datetime import datetime, timezone, timedelta
        today = datetime.now(timezone.utc)
        mock_storage_files = [
            {"name": f"Ghostly_Emg_{(today - timedelta(days=i)).strftime('%Y%m%d')}_17-50-17-0881.c3d"}
            for i in range(10)  # Files from 10 days ago to today
        ]
        self.service.client.storage.from_().list.return_value = mock_storage_files
        
        # Call the method with protocol_day=7
        result = self.service.calculate_adherence_score("test_patient", protocol_day=7)
        
        # Verify storage was called
        self.service.client.storage.from_.assert_called_with("c3d-examples")
        
        # Should count only 7 files (within protocol day boundary), not all 10
        assert result["completed_sessions"] == 7
        assert result["expected_sessions"] == pytest.approx(14.98, rel=0.01)