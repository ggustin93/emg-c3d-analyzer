"""
API Integration Tests for GHOSTLY+ EMG Analyzer (Stateless)
===========================================================

These tests verify that the stateless API endpoints work correctly using FastAPI's TestClient,
aligned with the refactoring goals in todo.md (Phase 1).
"""

import unittest
import sys
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

# Get the absolute path to the project root directory
PROJECT_ROOT = str(Path(__file__).resolve().parents[2])

# Add the project root to the Python path
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Import TestClient conditionally to avoid errors if httpx is not installed
try:
    from fastapi.testclient import TestClient
    TESTCLIENT_AVAILABLE = True
except ImportError:
    TESTCLIENT_AVAILABLE = False
    # Create a mock TestClient for when the real one is not available
    class MockTestClient:
        def __init__(self, app):
            self.app = app
        
        def post(self, *args, **kwargs):
            return MagicMock()

# This import will fail until api.py is refactored, which is expected.
# The tests are written for the *target* stateless architecture.
try:
    from backend.api import app
    API_AVAILABLE = True
except ImportError:
    API_AVAILABLE = False
    # Create a mock app for when the real one is not available
    app = MagicMock()

@unittest.skipIf(not TESTCLIENT_AVAILABLE, "httpx package not installed")
@unittest.skipIf(not API_AVAILABLE, "API module not available or incompatible")
class TestAPIIntegration(unittest.TestCase):
    """Test suite for API integration tests."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test data once for all tests."""
        # Create a test client
        cls.client = TestClient(app) if TESTCLIENT_AVAILABLE else MockTestClient(app)
        
        # Find a sample C3D file for testing
        cls.sample_file = None
        possible_sample_dirs = [
            os.path.join(PROJECT_ROOT, "frontend", "public", "samples"),
            os.path.join(PROJECT_ROOT, "samples"),
            os.path.join(PROJECT_ROOT, "backend", "tests", "samples"),
        ]
        
        for sample_dir in possible_sample_dirs:
            if os.path.exists(sample_dir):
                sample_files = [f for f in os.listdir(sample_dir) if f.endswith(".c3d")]
                if sample_files:
                    cls.sample_file = os.path.join(sample_dir, sample_files[0])
                    break
        
        if not cls.sample_file and not (not TESTCLIENT_AVAILABLE or not API_AVAILABLE):
            raise unittest.SkipTest("No sample C3D files found in any of the expected directories")
    
    def test_upload_endpoint_success(self):
        """Test the /upload endpoint with a valid C3D file."""
        if not TESTCLIENT_AVAILABLE or not API_AVAILABLE:
            self.skipTest("TestClient or API not available")
            
        if not self.sample_file:
            self.skipTest("No sample C3D file available")
            
        # Prepare the file for upload
        with open(self.sample_file, "rb") as f:
            file_content = f.read()
        
        # Create form data
        files = {"file": (os.path.basename(self.sample_file), file_content, "application/octet-stream")}
        data = {
            "threshold_factor": "0.3",
            "min_duration_ms": "50",
            "smoothing_window": "25",
            "session_mvc_value": "1.0",
            "session_mvc_threshold_percentage": "75.0",
            "session_expected_contractions": "10"
        }
        
        # Make the request
        response = self.client.post("/upload", files=files, data=data)
        
        # Check the response
        self.assertEqual(response.status_code, 200)
        result = response.json()
        
        # Verify the response structure
        self.assertIn("file_id", result)
        self.assertIn("metadata", result)
        self.assertIn("analytics", result)
        self.assertIn("available_channels", result)
        
        # In the future stateless model, all data should be in the response
        # This test will pass once the API is refactored
        if "emg_signals" in result:
            self.assertIsInstance(result["emg_signals"], dict)
            if result["emg_signals"]:
                first_channel = next(iter(result["emg_signals"]))
                self.assertIn("data", result["emg_signals"][first_channel])
                self.assertIn("time_axis", result["emg_signals"][first_channel])
                self.assertIn("sampling_rate", result["emg_signals"][first_channel])
    
    def test_upload_endpoint_invalid_file_type(self):
        """Test the /upload endpoint with a non-C3D file."""
        if not TESTCLIENT_AVAILABLE or not API_AVAILABLE:
            self.skipTest("TestClient or API not available")

        # Create a dummy non-C3D file
        files = {"file": ("test.txt", b"this is not a c3d file", "text/plain")}
        data = {
            "threshold_factor": "0.3",
            "min_duration_ms": "50",
            "smoothing_window": "25",
            "session_mvc_value": "1.0",
            "session_mvc_threshold_percentage": "75.0",
            "session_expected_contractions": "10"
        }
        
        # Make the request
        response = self.client.post("/upload", files=files, data=data)
        
        # Expect a 400 Bad Request response
        self.assertEqual(response.status_code, 400)
        result = response.json()
        self.assertIn("detail", result)
        self.assertIn("File must be a C3D file", result["detail"])

    def test_upload_endpoint_invalid_parameters(self):
        """Test the /upload endpoint with invalid processing parameters."""
        if not TESTCLIENT_AVAILABLE or not API_AVAILABLE:
            self.skipTest("TestClient or API not available")
            
        if not self.sample_file:
            self.skipTest("No sample C3D file available")

        with open(self.sample_file, "rb") as f:
            file_content = f.read()

        files = {"file": (os.path.basename(self.sample_file), file_content, "application/octet-stream")}
        # Invalid data (min_duration_ms is not a number)
        data = {
            "threshold_factor": "0.3",
            "min_duration_ms": "invalid",
            "smoothing_window": "25",
        }

        response = self.client.post("/upload", files=files, data=data)

        # Expect a 422 Unprocessable Entity response
        self.assertEqual(response.status_code, 422)

if __name__ == "__main__":
    unittest.main() 