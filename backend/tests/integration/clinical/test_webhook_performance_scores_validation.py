#!/usr/bin/env python
"""
Integration test for webhook performance scores validation.

Verifies that the performance_scores table is properly populated 
when processing C3D files through the webhook endpoint with proper
rate normalization and database constraints satisfied.
"""

import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from main import app
from database.supabase_client import get_supabase_client


class TestWebhookPerformanceScoresValidation:
    """Test webhook performance scores population and validation."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    @pytest.fixture
    def valid_webhook_payload(self):
        """Create valid webhook payload for C3D file."""
        return {
            "type": "INSERT",
            "table": "objects",
            "record": {
                "name": "P001/Ghostly_test.c3d",  # Correct format: PATIENT_CODE/C3D_FILENAME.c3d
                "bucket_id": "c3d-examples",
                "metadata": {
                    "size": 2800000,
                    "mimetype": "application/octet-stream"
                }
            },
            "schema": "storage"
        }
    
    @pytest.fixture
    def expected_tables(self):
        """List of tables that should be populated after webhook processing."""
        return [
            "therapy_sessions",
            "session_settings", 
            "emg_statistics",
            "bfr_monitoring",
            "scoring_configuration",
            "performance_scores"
        ]
    
    def _verify_performance_scores(self, session_id: str) -> dict:
        """
        Verify performance scores exist and are valid.
        
        Returns:
            dict: Performance scores data or empty dict if not found
        """
        supabase = get_supabase_client()
        
        try:
            result = supabase.table("performance_scores").select("*").eq("session_id", session_id).execute()
            
            if not result.data:
                return {}
                
            perf_data = result.data[0]
            
            # Verify database constraints are satisfied
            rate_fields = [
                'completion_rate_left', 
                'completion_rate_right',
                'intensity_rate_left',
                'intensity_rate_right', 
                'duration_rate_left',
                'duration_rate_right'
            ]
            
            for field in rate_fields:
                if perf_data.get(field) is not None:
                    rate_value = perf_data[field]
                    assert 0.0 <= rate_value <= 1.0, f"{field} = {rate_value} violates constraint (0.0 <= rate <= 1.0)"
            
            # Verify score fields are in valid range
            score_fields = [
                'overall_score',
                'compliance_score', 
                'symmetry_score',
                'left_muscle_compliance',
                'right_muscle_compliance'
            ]
            
            for field in score_fields:
                if perf_data.get(field) is not None:
                    score_value = perf_data[field]
                    assert 0.0 <= score_value <= 100.0, f"{field} = {score_value} violates constraint (0.0 <= score <= 100.0)"
            
            return perf_data
            
        except Exception as e:
            pytest.fail(f"Failed to verify performance scores: {e}")
    
    def _check_table_population(self, session_id: str, expected_tables: list) -> dict:
        """
        Check which tables are populated for the session.
        
        Returns:
            dict: Table name -> record count mapping
        """
        supabase = get_supabase_client()
        table_status = {}
        
        for table in expected_tables:
            try:
                result = supabase.table(table).select("id").eq("session_id", session_id).execute()
                table_status[table] = len(result.data) if result.data else 0
            except Exception as e:
                table_status[table] = f"Error: {e}"
        
        return table_status
    
    @patch('services.c3d.processor.GHOSTLYC3DProcessor.process_file')
    @patch('services.clinical.therapy_session_processor.TherapySessionProcessor._download_file_from_storage')
    def test_webhook_populates_performance_scores_with_normalized_rates(
        self, 
        mock_download,
        mock_process_c3d,
        client,
        valid_webhook_payload,
        expected_tables
    ):
        """
        Test that webhook processing populates performance_scores table
        with properly normalized rates that satisfy database constraints.
        """
        # Mock C3D file download to return a temporary file path
        mock_download.return_value = "mock_temp_file_path"
        
        # Mock C3D processing to return realistic analytics with actual GHOSTLY data patterns
        mock_process_c3d.return_value = {
            "success": True,
            "metadata": {
                "sampling_rate": 1000.0,
                "duration_seconds": 175.1,
                "frame_count": 175100
            },
            "analytics": {
                "CH1": {
                    "contraction_count": 20,
                    "mvc_compliant_count": 20,  # 100% met MVC (realistic)
                    "duration_compliant_count": 0,  # 0% met duration (realistic)
                    "good_contraction_count": 0,  # None met both
                    "mvc_value": 0.75,
                    "mvc_threshold": 562.5,
                    "compliance_rate": 0.50
                },
                "CH2": {
                    "contraction_count": 9,
                    "mvc_compliant_count": 9,  # 100% met MVC
                    "duration_compliant_count": 0,  # 0% met duration
                    "good_contraction_count": 0,  # None met both
                    "mvc_value": 0.72,
                    "mvc_threshold": 540.0,
                    "compliance_rate": 0.50
                }
            }
        }
        
        # Send webhook request
        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=valid_webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Verify webhook processed successfully
        assert response.status_code == 200, f"Webhook failed: {response.text}"
        
        result = response.json()
        session_id = result.get('session_id')
        
        assert session_id, "Session ID not returned from webhook"
        
        # Verify performance scores were saved with valid constraints
        perf_data = self._verify_performance_scores(session_id)
        
        assert perf_data, "Performance scores not found in database"
        
        # Verify all required fields exist
        required_fields = [
            'session_id', 
            'overall_score',
            'compliance_score',
            'scoring_config_id'
        ]
        
        for field in required_fields:
            assert field in perf_data, f"Required field {field} missing from performance scores"
            assert perf_data[field] is not None, f"Required field {field} is NULL"
        
        # Verify table population status
        table_status = self._check_table_population(session_id, expected_tables)
        
        missing_tables = [table for table, count in table_status.items() if count == 0]
        
        assert len(missing_tables) == 0, f"Missing data in tables: {missing_tables}. Status: {table_status}"
        
        # Log success information for debugging
        print(f"✅ Performance scores validation passed for session {session_id}")
        print(f"   - Overall Score: {perf_data.get('overall_score', 'N/A')}")
        print(f"   - Compliance Score: {perf_data.get('compliance_score', 'N/A')}")
        print(f"   - Completion Rate Left: {perf_data.get('completion_rate_left', 'N/A')}")
        print(f"   - Completion Rate Right: {perf_data.get('completion_rate_right', 'N/A')}")
        print(f"   - All {len(expected_tables)} tables populated: {table_status}")
    
    def test_webhook_handles_invalid_payload_gracefully(self, client):
        """Test webhook handles invalid payload without crashing."""
        invalid_payload = {
            "type": "INSERT",
            "table": "objects",  # Added required field
            "schema": "storage",  # Added required field
            "record": {
                "name": "invalid.txt",  # Not a C3D file
                "bucket_id": "wrong-bucket"
            }
        }
        
        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=invalid_payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Should handle gracefully (either skip or return appropriate error)
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}"
    
    @patch('services.clinical.therapy_session_processor.TherapySessionProcessor._download_file_from_storage')
    def test_webhook_handles_processing_failure_gracefully(
        self, 
        mock_download,
        client,
        valid_webhook_payload
    ):
        """Test webhook handles C3D processing failures gracefully."""
        # Mock download to simulate file processing error
        mock_download.side_effect = Exception("File download failed")
        
        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=valid_webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Should handle error gracefully (webhook returns 200 even on internal errors to prevent retries)
        assert response.status_code == 200, f"Expected status 200 for webhook, got: {response.status_code}"
        
        # Check that error was logged in response
        result = response.json()
        assert "error" in result or "status" in result, "Expected error indication in response"