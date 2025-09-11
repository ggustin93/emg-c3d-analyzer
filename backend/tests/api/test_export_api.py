"""API tests for enhanced export endpoints.

Following MVP plan: Test API format parameter works end-to-end.
Test architecture follows backend CLAUDE.md: FastAPI TestClient, no AsyncMock for Supabase.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app


class TestExportAPI:
    """API tests for export endpoints with format selection."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)

    @patch('database.supabase_client.get_supabase_client')
    def test_export_api_format_selection_json(self, mock_get_supabase, client):
        """Critical test: API format parameter works for JSON format."""
        # Arrange - Mock Supabase client
        mock_supabase = MagicMock()
        mock_get_supabase.return_value = mock_supabase
        
        # Mock performance data
        mock_performance_data = {
            'overall_score': 85.0,
            'compliance_score': 90.0,
            'symmetry_score': 80.0
        }
        
        mock_config_data = {
            'configuration_name': 'Test Configuration',
            'weight_compliance': 0.40
        }
        
        # Setup Supabase mock responses
        def table_mock(table_name):
            mock_table = MagicMock()
            if table_name == 'performance_scores':
                mock_table.select().eq().limit().execute.return_value.data = [mock_performance_data]
            elif table_name == 'therapy_sessions':
                mock_table.select().eq().limit().execute.return_value.data = [{'scoring_config_id': 'test-id'}]
            elif table_name == 'scoring_configuration':
                mock_table.select().eq().limit().execute.return_value.data = [mock_config_data]
            return mock_table
            
        mock_supabase.table.side_effect = table_mock
        
        # Act
        test_session_id = "550e8400-e29b-41d4-a716-446655440000"
        response = client.get(f"/export/session/{test_session_id}?format=json")
        
        # Assert
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.headers['content-type'] == 'application/json', "Should return JSON content-type"
        
        json_data = response.json()
        assert 'performance_scores' in json_data, "Performance scores missing from JSON response"
        assert 'scoring_configuration' in json_data, "Scoring configuration missing from JSON response"
        assert json_data['performance_scores']['overall_score'] == 85.0, "Performance data incorrect"

    @patch('database.supabase_client.get_supabase_client')  
    def test_export_api_format_selection_csv(self, mock_get_supabase, client):
        """Critical test: API format parameter works for CSV format."""
        # Arrange - Mock Supabase client
        mock_supabase = MagicMock()
        mock_get_supabase.return_value = mock_supabase
        
        # Mock performance data
        mock_performance_data = {
            'overall_score': 85.0,
            'compliance_score': 90.0,
            'symmetry_score': 80.0
        }
        
        mock_config_data = {
            'configuration_name': 'Test Configuration',
            'weight_compliance': 0.40
        }
        
        # Setup Supabase mock responses
        def table_mock(table_name):
            mock_table = MagicMock()
            if table_name == 'performance_scores':
                mock_table.select().eq().limit().execute.return_value.data = [mock_performance_data]
            elif table_name == 'therapy_sessions':
                mock_table.select().eq().limit().execute.return_value.data = [{'scoring_config_id': 'test-id'}]
            elif table_name == 'scoring_configuration':
                mock_table.select().eq().limit().execute.return_value.data = [mock_config_data]
            return mock_table
            
        mock_supabase.table.side_effect = table_mock
        
        # Act
        test_session_id = "550e8400-e29b-41d4-a716-446655440000"
        response = client.get(f"/export/session/{test_session_id}?format=csv")
        
        # Assert
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.headers['content-type'] == 'text/csv; charset=utf-8', "Should return CSV content-type"
        assert 'attachment' in response.headers.get('content-disposition', ''), "Should have attachment header"
        
        csv_content = response.text
        assert 'performance_overall_score' in csv_content, "Performance columns missing from CSV"
        assert '85.0' in csv_content, "Performance data missing from CSV"
        assert 'config_weight_compliance' in csv_content, "Configuration columns missing from CSV"

    @patch('database.supabase_client.get_supabase_client')
    def test_export_api_invalid_format(self, mock_get_supabase, client):
        """Test API rejects invalid format parameter."""
        # Mock Supabase client (needed for proper test isolation)
        mock_supabase = MagicMock()
        mock_get_supabase.return_value = mock_supabase
        
        test_session_id = "550e8400-e29b-41d4-a716-446655440000"
        response = client.get(f"/export/session/{test_session_id}?format=invalid")
        
        # Should return 422 for invalid enum value (FastAPI validation)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"

    def test_export_api_default_format(self, client):
        """Test API defaults to JSON format when no format specified."""
        with patch('database.supabase_client.get_supabase_client') as mock_get_supabase:
            # Mock basic setup
            mock_supabase = MagicMock()
            mock_get_supabase.return_value = mock_supabase
            mock_supabase.table().select().eq().limit().execute.return_value.data = []
            
            test_session_id = "550e8400-e29b-41d4-a716-446655440000"
            response = client.get(f"/export/session/{test_session_id}")
            
            assert response.status_code == 200, "Should succeed with default format"
            assert response.headers['content-type'] == 'application/json', "Should default to JSON"

    @patch('database.supabase_client.get_supabase_client')
    def test_export_api_error_handling(self, mock_get_supabase, client):
        """Test API handles database errors gracefully."""
        # Arrange - Mock Supabase to raise exception
        mock_get_supabase.side_effect = Exception("Database connection failed")
        
        # Act
        test_session_id = "550e8400-e29b-41d4-a716-446655440000"
        response = client.get(f"/export/session/{test_session_id}")
        
        # Assert
        assert response.status_code == 500, "Should return 500 on database error"
        assert 'error' in response.text.lower(), "Should include error message"