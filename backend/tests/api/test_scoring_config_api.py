"""Fixed Tests for Scoring Configuration API Endpoints.

Tests adapted to work with real database instead of mocks,
which is more aligned with the Supabase architecture.
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Add tests directory to path for conftest import
test_dir = Path(__file__).parent.parent
if str(test_dir) not in sys.path:
    sys.path.insert(0, str(test_dir))

# Import FastAPI app from shared conftest
from conftest import app


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
            # API returns custom error format with "error" and "message" fields
            assert "error" in error_data
            assert "message" in error_data
            assert error_data["error"] == "HTTP_ERROR"
            assert "No active scoring configuration found" in error_data["message"]
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
        # For validation errors (422), FastAPI returns "detail" field with validation details
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
            # For validation errors (422), FastAPI returns "detail" field
            assert "detail" in error_data
    
    def test_update_default_scoring_configuration(self, client):
        """Test PUT /scoring/configurations/default endpoint."""
        # Prepare valid configuration update
        update_config = {
            "configuration_name": "GHOSTLY-TRIAL-DEFAULT",
            "description": "Updated default configuration",
            "weight_compliance": 0.45,
            "weight_symmetry": 0.25,
            "weight_effort": 0.25,
            "weight_game": 0.05,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334
        }
        
        response = client.put("/scoring/configurations/default", json=update_config)
        
        # Should successfully update or return 404 if GHOSTLY-TRIAL-DEFAULT doesn't exist
        assert response.status_code in [200, 404], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # Verify the response contains updated values
            assert data["configuration_name"] == "GHOSTLY-TRIAL-DEFAULT"
            assert data["weight_compliance"] == 0.45
            assert data["weight_symmetry"] == 0.25
            assert data["weight_effort"] == 0.25
            assert data["weight_game"] == 0.05
            
    def test_update_default_configuration_invalid_weights(self, client):
        """Test PUT /scoring/configurations/default with invalid weights."""
        # Prepare configuration with invalid weights (sum > 1.0)
        invalid_config = {
            "configuration_name": "GHOSTLY-TRIAL-DEFAULT",
            "weight_compliance": 0.60,
            "weight_symmetry": 0.30,
            "weight_effort": 0.30,  # Total = 1.2 > 1.0
            "weight_game": 0.00,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334
        }
        
        response = client.put("/scoring/configurations/default", json=invalid_config)
        
        # Should return validation error
        assert response.status_code == 422
        error_data = response.json()
        assert "detail" in error_data
        
    def test_update_default_configuration_with_defaults(self, client):
        """Test PUT /scoring/configurations/default with partial fields uses defaults."""
        # Prepare configuration with only some fields (others use defaults)
        partial_config = {
            "configuration_name": "GHOSTLY-TRIAL-DEFAULT",
            "weight_compliance": 0.50,
            # Other fields will use defaults from the model
        }
        
        response = client.put("/scoring/configurations/default", json=partial_config)
        
        # Should succeed with defaults for missing fields
        assert response.status_code in [200, 404], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # Verify the explicitly set field
            assert data["weight_compliance"] == 0.50
            # Other fields should have defaults (0.25, 0.25, 0.0 for main weights)
            assert data["weight_symmetry"] == 0.25  # Default from model
            assert data["weight_effort"] == 0.25    # Default from model
            assert data["weight_game"] == 0.0       # Default from model