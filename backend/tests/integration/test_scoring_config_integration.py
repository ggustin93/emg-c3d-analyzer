"""Integration tests for Scoring Configuration API with real Supabase database.

Tests actual database operations to ensure E2E functionality works correctly.
"""

import os
import pytest
from fastapi.testclient import TestClient

# Import FastAPI app
from main import app

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
        from config import ScoringDefaults
        test_config = {
            "configuration_name": "Test Integration Config",
            "description": "Created for integration test",
            "weight_compliance": ScoringDefaults.WEIGHT_COMPLIANCE,
            "weight_symmetry": ScoringDefaults.WEIGHT_SYMMETRY,
            "weight_effort": ScoringDefaults.WEIGHT_EFFORT,
            "weight_game": ScoringDefaults.WEIGHT_GAME,
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
        # First, create a test configuration to ensure we have something to activate
        from config import ScoringDefaults
        test_config = {
            "configuration_name": "Test Activation Config",
            "description": "Created for activation test",
            "weight_compliance": ScoringDefaults.WEIGHT_COMPLIANCE,
            "weight_symmetry": ScoringDefaults.WEIGHT_SYMMETRY,
            "weight_effort": ScoringDefaults.WEIGHT_EFFORT,
            "weight_game": ScoringDefaults.WEIGHT_GAME,
            "weight_completion": 0.333,
            "weight_intensity": 0.333,
            "weight_duration": 0.334,
        }
        
        # Create the test configuration (will be inactive by default)
        create_response = client.post("/scoring/configurations", json=test_config)
        assert create_response.status_code == 200
        created_config = create_response.json()
        config_id = created_config["id"]
        
        # Verify it was created as inactive
        assert created_config["active"] is False

        # Now activate it
        activate_response = client.put(f"/scoring/configurations/{config_id}/activate")
        assert activate_response.status_code == 200

        # Verify it's now active
        active_response = client.get("/scoring/configurations/active")
        assert active_response.status_code == 200
        active_data = active_response.json()
        assert active_data["id"] == config_id
        assert active_data["active"] is True



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
        from config import ScoringDefaults
        # This should succeed without therapist/patient IDs
        valid_global_config = {
            "configuration_name": "Global Config Test",
            "weight_compliance": ScoringDefaults.WEIGHT_COMPLIANCE,
            "weight_symmetry": ScoringDefaults.WEIGHT_SYMMETRY,
            "weight_effort": ScoringDefaults.WEIGHT_EFFORT,
            "weight_game": ScoringDefaults.WEIGHT_GAME,
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
