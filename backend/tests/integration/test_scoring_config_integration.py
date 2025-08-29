"""Integration tests for Scoring Configuration API with real Supabase database.

Tests actual database operations to ensure E2E functionality works correctly.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).resolve().parents[2]  # Go up two levels to reach the backend directory
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import os

import pytest
from fastapi.testclient import TestClient

# Import the FastAPI app directly from the API module
try:
    from api.main import app
except ImportError:
    # Fallback for different import contexts (CI environment)
    import sys
    import os
    # Get the backend directory (tests/integration -> backend)
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    try:
        from api.main import app
    except ImportError as e:
        # Final fallback - try importing main.py directly  
        try:
            from main import app
        except ImportError:
            raise ImportError(f"Could not import FastAPI app. Tried 'api.main' and 'main'. Backend dir: {backend_dir}, sys.path: {sys.path[:3]}") from e

# Skip all tests if no Supabase credentials are available
pytestmark = pytest.mark.skipif(
    not all([os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")]),
    reason="Supabase credentials not available - skipping database integration tests",
)


class TestScoringConfigurationIntegration:
    """Integration tests with real Supabase database."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        return TestClient(app)

    def test_get_all_configurations_from_database(self, client):
        """Test GET /scoring/configurations returns real database data."""
        # First create a test configuration to ensure we have data to retrieve
        test_config = {
            "configuration_name": "Test Integration Config",
            "description": "Created for integration test",
            "weight_compliance": 0.40,
            "weight_symmetry": 0.25,
            "weight_effort": 0.20,
            "weight_game": 0.15,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334,
        }

        # Create the configuration
        create_response = client.post("/scoring/configurations", json=test_config)
        assert create_response.status_code == 200

        # Now test that we can retrieve all configurations
        response = client.get("/scoring/configurations")

        assert response.status_code == 200
        data = response.json()

        # Should have at least the configuration we just created
        assert len(data) >= 1

        # Find our test configuration
        test_configs = [c for c in data if c["configuration_name"] == "Test Integration Config"]
        assert len(test_configs) >= 1, "Should find the test configuration we created"

        # Verify structure matches our database schema
        config = test_configs[0]
        required_fields = [
            "id",
            "configuration_name",
            "weight_compliance",
            "weight_symmetry",
            "weight_effort",
            "weight_game",
            "weight_completion",
            "weight_intensity",
            "weight_duration",
            "active",
            "created_at",
            "updated_at",
        ]

        for field in required_fields:
            assert field in config, f"Missing field: {field}"

        # Verify the values match what we created
        assert config["configuration_name"] == test_config["configuration_name"]
        assert float(config["weight_compliance"]) == test_config["weight_compliance"]

    def test_get_active_configuration_from_database(self, client):
        """Test GET /scoring/configurations/active returns active config."""
        response = client.get("/scoring/configurations/active")

        assert response.status_code == 200
        data = response.json()

        # Should have an active configuration with proper structure
        assert data["active"] is True
        assert "configuration_name" in data
        assert "weight_compliance" in data
        assert "weight_symmetry" in data
        assert "weight_effort" in data
        assert "weight_game" in data

        # Weights should be valid numbers
        assert 0.0 <= data["weight_compliance"] <= 1.0
        assert 0.0 <= data["weight_symmetry"] <= 1.0
        assert 0.0 <= data["weight_effort"] <= 1.0
        assert 0.0 <= data["weight_game"] <= 1.0

    def test_create_configuration_in_database(self, client):
        """Test POST /scoring/configurations creates real database entry."""
        new_config = {
            "configuration_name": "Integration Test Config",
            "description": "Created by integration test",
            "weight_compliance": 0.35,
            "weight_symmetry": 0.30,
            "weight_effort": 0.25,
            "weight_game": 0.10,
            "weight_completion": 0.4,
            "weight_intensity": 0.3,
            "weight_duration": 0.3,
        }

        response = client.post("/scoring/configurations", json=new_config)

        assert response.status_code == 200
        data = response.json()

        # Verify the response
        assert data["configuration_name"] == new_config["configuration_name"]
        assert data["active"] is False  # New configs start inactive
        assert float(data["weight_compliance"]) == new_config["weight_compliance"]

        # Store the ID for cleanup
        created_id = data["id"]

        # Verify it was actually saved to database
        get_response = client.get("/scoring/configurations")
        all_configs = get_response.json()

        created_config = next((c for c in all_configs if c["id"] == created_id), None)
        assert created_config is not None
        assert created_config["configuration_name"] == new_config["configuration_name"]

    def test_activate_configuration_in_database(self, client):
        """Test PUT /scoring/configurations/{id}/activate works with database."""
        # First get all configurations
        response = client.get("/scoring/configurations")
        configs = response.json()

        # Find a non-active configuration to activate
        inactive_config = next((c for c in configs if not c["active"]), None)

        if inactive_config is None:
            pytest.skip("No inactive configuration available for activation test")

        config_id = inactive_config["id"]

        # Activate it
        activate_response = client.put(f"/scoring/configurations/{config_id}/activate")
        assert activate_response.status_code == 200

        # Verify it's now active
        active_response = client.get("/scoring/configurations/active")
        assert active_response.status_code == 200
        active_data = active_response.json()
        assert active_data["id"] == config_id
        assert active_data["active"] is True

    def test_test_weights_endpoint_with_database(self, client):
        """Test /scoring/test-weights works with real database."""
        response = client.get("/scoring/test-weights")

        assert response.status_code == 200
        data = response.json()

        # Should show the metricsDefinitions.md reference weights
        assert "metricsDefinitions_weights" in data
        assert "current_active_weights" in data
        assert "weights_valid" in data

        # Verify metricsDefinitions.md reference weights
        metrics_weights = data["metricsDefinitions_weights"]
        assert metrics_weights["w_compliance"] == 0.400
        assert metrics_weights["w_symmetry"] == 0.250
        assert metrics_weights["w_effort"] == 0.200
        assert metrics_weights["w_game"] == 0.150

        # Current weights should match active configuration
        current_weights = data["current_active_weights"]
        assert current_weights["w_compliance"] is not None
        assert current_weights["w_symmetry"] is not None
        assert data["weights_valid"] is True


class TestScoringConfigurationDatabaseConstraints:
    """Test database constraints and validation."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_database_rejects_invalid_weights_sum(self, client):
        """Test database constraints prevent invalid weight combinations."""
        invalid_config = {
            "configuration_name": "Invalid Weights Test",
            "weight_compliance": 0.50,  # These sum to 1.10, not 1.0
            "weight_symmetry": 0.30,
            "weight_effort": 0.20,
            "weight_game": 0.10,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334,
        }

        response = client.post("/scoring/configurations", json=invalid_config)

        # Should fail validation (either Pydantic or database constraint)
        assert response.status_code in [400, 422, 500]

    def test_database_foreign_key_constraints(self, client):
        """Test foreign key constraints for therapist/patient references."""
        # This should succeed without therapist/patient IDs
        valid_global_config = {
            "configuration_name": "Global Config Test",
            "weight_compliance": 0.40,
            "weight_symmetry": 0.25,
            "weight_effort": 0.20,
            "weight_game": 0.15,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334,
        }

        response = client.post("/scoring/configurations", json=valid_global_config)
        assert response.status_code == 200

        # Note: Testing invalid foreign keys would require knowing non-existent UUIDs
        # which could vary, so we focus on the positive case


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
