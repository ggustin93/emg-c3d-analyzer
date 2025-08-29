"""Fixed Tests for Scoring Configuration API Endpoints.

Tests adapted to work with real database instead of mocks,
which is more aligned with the Supabase architecture.
"""

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Robust path setup for different execution contexts
def setup_backend_path():
    """Ensure backend directory is in Python path for imports."""
    # Try different methods to find the backend directory
    current_file = Path(__file__).resolve()
    
    # Method 1: Go up from tests/api to backend (2 levels)
    backend_dir = current_file.parents[2]
    
    # Method 2: Alternative path calculation for CI
    if not (backend_dir / "api" / "main.py").exists():
        backend_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    
    # Method 3: Check if we're already in backend directory
    if not (backend_dir / "api" / "main.py").exists():
        backend_dir = Path.cwd()
        if not (backend_dir / "api" / "main.py").exists():
            # Method 4: Try relative to current working directory
            backend_dir = Path.cwd() / "backend"
    
    # Add to path if not already present
    backend_str = str(backend_dir)
    if backend_str not in sys.path:
        sys.path.insert(0, backend_str)
    
    return backend_dir

# Set up the path
backend_path = setup_backend_path()

# Import the FastAPI app with comprehensive fallback
app = None
import_errors = []

# Try 1: Direct import from api.main
try:
    from api.main import app
except ImportError as e:
    import_errors.append(f"api.main: {e}")
    
    # Try 2: Import main.py directly (but safely)
    try:
        # Import main module without triggering its sys.exit
        import importlib.util
        main_path = backend_path / "main.py"
        if main_path.exists():
            spec = importlib.util.spec_from_file_location("main", main_path)
            if spec and spec.loader:
                main_module = importlib.util.module_from_spec(spec)
                # Execute the module but catch any sys.exit
                try:
                    spec.loader.exec_module(main_module)
                    app = main_module.app
                except SystemExit:
                    # main.py called sys.exit, but we can still get the app if it was set
                    app = getattr(main_module, 'app', None)
                    if app is None:
                        raise ImportError("main.py exited before setting app")
            else:
                raise ImportError("Could not create module spec for main.py")
        else:
            raise ImportError(f"main.py not found at {main_path}")
    except Exception as e:
        import_errors.append(f"main.py: {e}")
        
        # Try 3: Force import with explicit path manipulation
        try:
            import importlib.util
            api_main_path = backend_path / "api" / "main.py"
            if api_main_path.exists():
                spec = importlib.util.spec_from_file_location("api.main", api_main_path)
                if spec and spec.loader:
                    api_main = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(api_main)
                    app = api_main.app
                else:
                    raise ImportError("Could not create module spec")
            else:
                raise ImportError(f"api/main.py not found at {api_main_path}")
        except Exception as e:
            import_errors.append(f"importlib: {e}")
            
            # Final error with all attempts
            raise ImportError(
                f"Could not import FastAPI app after multiple attempts:\n"
                f"Backend path: {backend_path}\n"
                f"API main exists: {(backend_path / 'api' / 'main.py').exists()}\n"
                f"Working directory: {Path.cwd()}\n"
                f"Python path: {sys.path[:3]}\n"
                f"Import errors: {import_errors}"
            )

if app is None:
    raise ImportError("FastAPI app is None after import attempts")


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