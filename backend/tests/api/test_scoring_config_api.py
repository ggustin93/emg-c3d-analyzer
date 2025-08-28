"""
Tests for Scoring Configuration API Endpoints

Tests the complete API for managing scoring weights with therapist/patient customization.
Validates single source of truth implementation and database consistency.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).resolve().parents[2]  # Go up two levels to reach the backend directory
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import json
from typing import Dict, List
from unittest.mock import Mock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient

# Import the main FastAPI app
from api.main import app
from api.routes.scoring_config import (
    ScoringConfigurationRequest,
    ScoringConfigurationResponse,
)


class TestScoringConfigurationAPI:
    """Test scoring configuration API endpoints"""

    @pytest.fixture
    def client(self):
        """FastAPI test client"""
        return TestClient(app)

    @pytest.fixture
    def mock_supabase_response(self):
        """Mock Supabase response for testing"""
        return {
            "data": [{
                "id": "test-config-123",
                "configuration_name": "Test Configuration",
                "description": "Test description",
                "weight_compliance": 0.400,
                "weight_symmetry": 0.250,
                "weight_effort": 0.200,
                "weight_game": 0.150,
                "weight_completion": 0.333,
                "weight_intensity": 0.333,
                "weight_duration": 0.334,
                "active": True,
                "created_at": "2025-08-22T10:00:00Z",
                "updated_at": "2025-08-22T10:00:00Z",
                "therapist_id": None,
                "patient_id": None
            }]
        }

    @pytest.fixture
    def valid_config_request(self):
        """Valid configuration request data"""
        return {
            "configuration_name": "Custom Test Config",
            "description": "Test configuration for unit tests",
            "weight_compliance": 0.40,
            "weight_symmetry": 0.25,
            "weight_effort": 0.20,
            "weight_game": 0.15,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334
        }

    @patch("api.routes.scoring_config.get_supabase_client")
    def test_get_scoring_configurations(self, mock_get_client, client, mock_supabase_response):
        """Test GET /scoring/configurations endpoint"""
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        mock_table.select.return_value.order.return_value.execute.return_value = Mock(**mock_supabase_response)
        mock_get_client.return_value = mock_client

        # Make request
        response = client.get("/scoring/configurations")

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["configuration_name"] == "Test Configuration"
        assert data[0]["weight_compliance"] == 0.400

    @patch("api.routes.scoring_config.get_supabase_client")
    def test_get_active_scoring_configuration(self, mock_get_client, client, mock_supabase_response):
        """Test GET /scoring/configurations/active endpoint"""
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = Mock(**mock_supabase_response)
        mock_get_client.return_value = mock_client

        # Make request
        response = client.get("/scoring/configurations/active")

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["configuration_name"] == "Test Configuration"
        assert data["active"] == True
        assert data["weight_compliance"] == 0.400

    @patch("api.routes.scoring_config.get_supabase_client")
    def test_get_active_scoring_configuration_not_found(self, mock_get_client, client):
        """Test GET /scoring/configurations/active when no active configuration exists"""
        # Setup mock for empty response
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = Mock(data=[])
        mock_get_client.return_value = mock_client

        # Make request
        response = client.get("/scoring/configurations/active")

        # Verify response
        assert response.status_code == 404
        assert "No active scoring configuration found" in response.json()["message"]

    @patch("api.routes.scoring_config.get_supabase_client")
    def test_create_scoring_configuration(self, mock_get_client, client, valid_config_request):
        """Test POST /scoring/configurations endpoint"""
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table

        # Mock successful insert
        mock_response_data = {**valid_config_request}
        mock_response_data.update({
            "id": "new-config-123",
            "active": False,
            "created_at": "2025-08-22T10:00:00Z",
            "updated_at": "2025-08-22T10:00:00Z"
        })
        mock_table.insert.return_value.execute.return_value = Mock(data=[mock_response_data])
        mock_get_client.return_value = mock_client

        # Make request
        response = client.post("/scoring/configurations", json=valid_config_request)

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["configuration_name"] == valid_config_request["configuration_name"]
        assert data["active"] == False  # New configs start inactive

    def test_create_scoring_configuration_invalid_weights(self, client):
        """Test POST /scoring/configurations with invalid weights (don't sum to 1.0)"""
        invalid_request = {
            "configuration_name": "Invalid Config",
            "weight_compliance": 0.50,  # These sum to 1.10, not 1.0
            "weight_symmetry": 0.30,
            "weight_effort": 0.20,
            "weight_game": 0.10,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334
        }

        # Make request
        response = client.post("/scoring/configurations", json=invalid_request)

        # Verify validation error
        assert response.status_code == 422  # Validation error
        assert "must sum to 1.0" in str(response.json())

    @patch("api.routes.scoring_config.get_supabase_client")
    def test_activate_scoring_configuration(self, mock_get_client, client):
        """Test PUT /scoring/configurations/{config_id}/activate endpoint"""
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table

        # Mock successful activation
        mock_table.update.return_value.neq.return_value.execute.return_value = Mock()  # Deactivate all
        mock_table.update.return_value.eq.return_value.execute.return_value = Mock(data=[{"id": "test-config-123"}])  # Activate specific
        mock_get_client.return_value = mock_client

        # Make request
        response = client.put("/scoring/configurations/test-config-123/activate")

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Configuration activated successfully"
        assert data["config_id"] == "test-config-123"

    @patch("api.routes.scoring_config.get_supabase_client")
    def test_get_custom_scoring_configuration_therapist_only(self, mock_get_client, client):
        """Test GET /scoring/configurations/custom for therapist-only configuration"""
        # Setup mock for therapist-specific config
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table

        therapist_config = {
            "id": "therapist-config-123",
            "configuration_name": "Dr. Smith Custom Config",
            "therapist_id": "therapist-123",
            "patient_id": None,
            "weight_compliance": 0.45,
            "weight_symmetry": 0.30,
            "weight_effort": 0.15,
            "weight_game": 0.10
        }

        mock_table.select.return_value.eq.return_value.is_.return_value.order.return_value.limit.return_value.execute.return_value = Mock(data=[therapist_config])
        mock_get_client.return_value = mock_client

        # Make request
        response = client.get("/scoring/configurations/custom?therapist_id=therapist-123")

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["therapist_id"] == "therapist-123"
        assert data["patient_id"] is None
        assert data["weight_compliance"] == 0.45

    @patch("api.routes.scoring_config.get_supabase_client")
    def test_get_custom_scoring_configuration_therapist_patient(self, mock_get_client, client):
        """Test GET /scoring/configurations/custom for therapist+patient specific configuration"""
        # Setup mock for therapist+patient specific config
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table

        patient_config = {
            "id": "patient-config-123",
            "configuration_name": "Dr. Smith + Patient 456 Custom Config",
            "therapist_id": "therapist-123",
            "patient_id": "patient-456",
            "weight_compliance": 0.50,
            "weight_symmetry": 0.20,
            "weight_effort": 0.20,
            "weight_game": 0.10
        }

        mock_table.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = Mock(data=[patient_config])
        mock_get_client.return_value = mock_client

        # Make request
        response = client.get("/scoring/configurations/custom?therapist_id=therapist-123&patient_id=patient-456")

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["therapist_id"] == "therapist-123"
        assert data["patient_id"] == "patient-456"
        assert data["weight_compliance"] == 0.50

    def test_get_custom_scoring_configuration_missing_therapist(self, client):
        """Test GET /scoring/configurations/custom without therapist_id parameter"""
        # Make request without therapist_id
        response = client.get("/scoring/configurations/custom")

        # Verify error
        assert response.status_code == 400
        assert "therapist_id is required" in response.json()["message"]

    @patch("api.routes.scoring_config.get_supabase_client")
    def test_create_custom_scoring_configuration(self, mock_get_client, client, valid_config_request):
        """Test POST /scoring/configurations/custom endpoint"""
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table

        # Add therapist_id to request
        custom_request = {**valid_config_request}
        custom_request.update({
            "therapist_id": "therapist-123",
            "patient_id": "patient-456"
        })

        # Mock no existing config
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = Mock(data=[])

        # Mock successful insert
        mock_response_data = {**custom_request}
        mock_response_data.update({
            "id": "custom-config-123",
            "active": False,
            "created_at": "2025-08-22T10:00:00Z",
            "updated_at": "2025-08-22T10:00:00Z"
        })
        mock_table.insert.return_value.execute.return_value = Mock(data=[mock_response_data])
        mock_get_client.return_value = mock_client

        # Make request
        response = client.post("/scoring/configurations/custom", json=custom_request)

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["therapist_id"] == "therapist-123"
        assert data["patient_id"] == "patient-456"
        assert data["active"] == False

    def test_create_custom_scoring_configuration_missing_therapist(self, client, valid_config_request):
        """Test POST /scoring/configurations/custom without therapist_id"""
        # Make request without therapist_id
        response = client.post("/scoring/configurations/custom", json=valid_config_request)

        # Verify error
        assert response.status_code == 400
        assert "therapist_id is required for custom configurations" in response.json()["message"]

    @patch("api.routes.scoring_config.get_supabase_client")
    def test_update_existing_custom_configuration(self, mock_get_client, client, valid_config_request):
        """Test updating an existing custom configuration"""
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table

        # Add therapist_id to request
        custom_request = {**valid_config_request}
        custom_request.update({"therapist_id": "therapist-123"})

        # Mock existing config found
        mock_table.select.return_value.eq.return_value.is_.return_value.execute.return_value = Mock(data=[{"id": "existing-config-123"}])

        # Mock successful update
        mock_response_data = {**custom_request}
        mock_response_data.update({
            "id": "existing-config-123",
            "active": False,
            "created_at": "2025-08-22T09:00:00Z",
            "updated_at": "2025-08-22T10:00:00Z"
        })
        mock_table.update.return_value.eq.return_value.execute.return_value = Mock(data=[mock_response_data])
        mock_get_client.return_value = mock_client

        # Make request
        response = client.post("/scoring/configurations/custom", json=custom_request)

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "existing-config-123"
        assert data["therapist_id"] == "therapist-123"


class TestScoringConfigurationValidation:
    """Test scoring configuration request validation"""

    def test_scoring_configuration_request_validation(self):
        """Test Pydantic validation for ScoringConfigurationRequest"""
        # Valid request
        valid_data = {
            "configuration_name": "Valid Config",
            "weight_compliance": 0.40,
            "weight_symmetry": 0.25,
            "weight_effort": 0.20,
            "weight_game": 0.15,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334
        }

        config = ScoringConfigurationRequest(**valid_data)
        assert config.configuration_name == "Valid Config"
        assert config.weight_compliance == 0.40

    def test_scoring_configuration_request_invalid_main_weights(self):
        """Test validation fails when main weights don't sum to 1.0"""
        invalid_data = {
            "configuration_name": "Invalid Config",
            "weight_compliance": 0.50,  # Sum = 1.15, not 1.0
            "weight_symmetry": 0.30,
            "weight_effort": 0.25,
            "weight_game": 0.10,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334
        }

        with pytest.raises(ValueError, match="Main weights must sum to 1.0"):
            ScoringConfigurationRequest(**invalid_data)

    def test_scoring_configuration_request_invalid_compliance_weights(self):
        """Test validation fails when compliance sub-weights don't sum to 1.0"""
        invalid_data = {
            "configuration_name": "Invalid Config",
            "weight_compliance": 0.40,
            "weight_symmetry": 0.25,
            "weight_effort": 0.20,
            "weight_game": 0.15,
            "weight_completion": 0.5,   # Sum = 1.1, not 1.0
            "weight_intensity": 0.3,
            "weight_duration": 0.3
        }

        with pytest.raises(ValueError, match="Compliance weights must sum to 1.0"):
            ScoringConfigurationRequest(**invalid_data)

    def test_scoring_configuration_request_with_therapist_patient(self):
        """Test valid request with therapist and patient IDs"""
        valid_data = {
            "configuration_name": "Custom Config",
            "weight_compliance": 0.40,
            "weight_symmetry": 0.25,
            "weight_effort": 0.20,
            "weight_game": 0.15,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334,
            "therapist_id": "therapist-123",
            "patient_id": "patient-456"
        }

        config = ScoringConfigurationRequest(**valid_data)
        assert config.therapist_id == "therapist-123"
        assert config.patient_id == "patient-456"


class TestSingleSourceOfTruthAPI:
    """Test that API endpoints enforce single source of truth"""

    @pytest.fixture
    def client(self):
        """FastAPI test client"""
        return TestClient(app)

    @patch("api.routes.scoring_config.get_supabase_client")
    def test_test_weights_endpoint_shows_consistency(self, mock_get_client, client):
        """Test /scoring/test-weights endpoint shows metricsDefinitions.md consistency"""
        # Setup mock to return default weights
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Make request
        response = client.get("/scoring/test-weights")

        # Verify response structure
        assert response.status_code == 200
        data = response.json()

        # Should show metricsDefinitions.md weights as reference
        assert "metricsDefinitions_weights" in data
        assert "current_active_weights" in data
        assert "weights_valid" in data

        # Verify metricsDefinitions.md reference weights
        metrics_weights = data["metricsDefinitions_weights"]
        assert metrics_weights["w_compliance"] == 0.400
        assert metrics_weights["w_symmetry"] == 0.250
        assert metrics_weights["w_effort"] == 0.200
        assert metrics_weights["w_game"] == 0.150


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
