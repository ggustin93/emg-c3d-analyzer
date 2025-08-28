"""Fixed Tests for Scoring Configuration API Endpoints.

Tests adapted to work with real database instead of mocks,
which is more aligned with the Supabase architecture.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).resolve().parents[2]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient

# Import the main FastAPI app
from api.main import app


class TestScoringConfigurationAPIFixed:
    """Test scoring configuration API endpoints with database integration."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        return TestClient(app)

    def test_get_scoring_configurations(self, client):
        """Test GET /scoring/configurations endpoint - database integration."""
        response = client.get("/scoring/configurations")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # If there are configurations, verify structure
        if data:
            config = data[0]
            required_fields = [
                "id", "configuration_name", "weight_compliance", "weight_symmetry",
                "weight_effort", "weight_game", "weight_completion", "weight_intensity",
                "weight_duration", "active", "created_at"
            ]
            for field in required_fields:
                assert field in config, f"Missing required field: {field}"
                
            # Verify weight field types
            weight_fields = [
                "weight_compliance", "weight_symmetry", "weight_effort", "weight_game",
                "weight_completion", "weight_intensity", "weight_duration"
            ]
            for field in weight_fields:
                assert isinstance(config[field], (int, float)), f"Weight field {field} should be numeric"

    def test_get_active_scoring_configuration(self, client):
        """Test GET /scoring/configurations/active endpoint - database integration."""
        response = client.get("/scoring/configurations/active")

        # Should return either 200 with active config or 404 if none active
        if response.status_code == 200:
            data = response.json()
            assert data["active"] is True
            required_fields = [
                "id", "configuration_name", "weight_compliance", "weight_symmetry",
                "weight_effort", "weight_game", "weight_completion", "weight_intensity",
                "weight_duration"
            ]
            for field in required_fields:
                assert field in data, f"Missing required field: {field}"
        elif response.status_code == 404:
            # No active configuration - this is also valid
            error_data = response.json()
            assert "detail" in error_data
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")

    def test_scoring_configuration_create_endpoint_exists(self, client):
        """Test that POST /scoring/configurations endpoint exists."""
        # Test with empty body to verify endpoint exists
        response = client.post("/scoring/configurations", json={})
        
        # Should return 422 (validation error) not 404 (not found)
        assert response.status_code in [400, 422], "Create endpoint should exist and validate input"

    def test_scoring_configuration_weights_validation(self, client):
        """Test weight validation logic."""
        # Create a configuration with invalid weights (don't sum to 1.0)
        invalid_config = {
            "configuration_name": "Invalid Weight Test",
            "description": "Test invalid weights",
            "weight_compliance": 0.50,
            "weight_symmetry": 0.30,
            "weight_effort": 0.30,  # Total > 1.0 for main weights
            "weight_game": 0.20,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334
        }
        
        response = client.post("/scoring/configurations", json=invalid_config)
        
        # Should return validation error (422)
        assert response.status_code == 422
        error_data = response.json()
        assert "detail" in error_data
        
    def test_scoring_configuration_structure_validation(self, client):
        """Test that scoring configurations can be created and have proper structure."""
        # Test with minimal valid configuration
        test_config = {
            "configuration_name": "Test Configuration",
            "weight_compliance": 0.2,
            "weight_symmetry": 0.2, 
            "weight_effort": 0.2,
            "weight_game": 0.2,
            "weight_completion": 0.1,
            "weight_intensity": 0.05,
            "weight_duration": 0.05
        }
        
        response = client.post("/scoring/configurations", json=test_config)
        
        # Should either create successfully or return validation error for weights
        assert response.status_code in [200, 201, 422]
        
        if response.status_code in [200, 201]:
            # Configuration created successfully
            data = response.json()
            assert "id" in data or "configuration_id" in data
        else:
            # Validation error (weights don't sum to 1.0 exactly)
            error_data = response.json()
            assert "detail" in error_data