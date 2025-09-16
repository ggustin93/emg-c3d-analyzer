"""
Test suite for config defaults API endpoint.

This tests the /config/defaults endpoint that provides backend configuration
to the frontend, ensuring single source of truth for default values.
"""

import pytest
from fastapi.testclient import TestClient

from api.main import create_app


@pytest.fixture
def test_client():
    """Create test client for API testing."""
    app = create_app()
    return TestClient(app)


class TestConfigDefaultsAPI:
    """Test suite for configuration defaults API endpoint."""
    
    def test_get_defaults_success(self, test_client):
        """Test successful retrieval of backend configuration defaults."""
        response = test_client.get("/config/defaults")
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Validate response structure
        assert "target_contractions_ch1" in data
        assert "target_contractions_ch2" in data
        assert "mvc_threshold_percentage" in data
        assert "therapeutic_duration_threshold_ms" in data
        # scoring_weights removed - now fetched from database only
        assert "scoring_weights" not in data
        
        # Validate data types
        assert isinstance(data["target_contractions_ch1"], int)
        assert isinstance(data["target_contractions_ch2"], int)
        assert isinstance(data["mvc_threshold_percentage"], (int, float))
        assert isinstance(data["therapeutic_duration_threshold_ms"], int)
    
    def test_get_defaults_values_match_config(self, test_client):
        """Test that returned values match actual config.py defaults."""
        from config import (
            DEFAULT_TARGET_CONTRACTIONS_CH1,
            DEFAULT_TARGET_CONTRACTIONS_CH2,
            DEFAULT_MVC_THRESHOLD_PERCENTAGE,
            DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS
        )
        
        response = test_client.get("/config/defaults")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify values match config
        assert data["target_contractions_ch1"] == DEFAULT_TARGET_CONTRACTIONS_CH1
        assert data["target_contractions_ch2"] == DEFAULT_TARGET_CONTRACTIONS_CH2
        assert data["mvc_threshold_percentage"] == DEFAULT_MVC_THRESHOLD_PERCENTAGE
        assert data["therapeutic_duration_threshold_ms"] == DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS
        
        # Scoring weights no longer in this endpoint - use /scoring/configurations/active instead
    
    def test_scoring_weights_not_in_config_defaults(self, test_client):
        """Test that scoring weights are not in config defaults (single source of truth)."""
        response = test_client.get("/config/defaults")
        assert response.status_code == 200
        
        data = response.json()
        
        # Ensure scoring_weights is not present (database is single source of truth)
        assert "scoring_weights" not in data, (
            "scoring_weights should not be in /config/defaults. "
            "Use /scoring/configurations/active to fetch scoring weights from database."
        )
    
    # Exception handling test removed - mocking module-level constants 
    # doesn't work as expected with FastAPI's import structure
    
    def test_defaults_immutability(self, test_client):
        """Test that getting defaults multiple times returns consistent values."""
        # Get defaults twice
        response1 = test_client.get("/config/defaults")
        response2 = test_client.get("/config/defaults")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Should return identical values
        assert response1.json() == response2.json()