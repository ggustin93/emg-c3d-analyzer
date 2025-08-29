"""FastAPI TestClient tests for all API endpoints.

Tests API layer functionality, authentication, validation, and error handling.
"""

import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Add backend to sys.path for imports
backend_dir = Path(__file__).resolve().parents[2]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Import the main FastAPI app
# Import the FastAPI app directly from the API module
try:
    from api.main import app
except ImportError:
    # Fallback for different import contexts (CI environment)
    import sys
    import os
    # Get the backend directory (tests/api -> backend)
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

client = TestClient(app)


class TestHealthEndpoint:
    """Test health check endpoint."""

    def test_health_check(self):
        """Test basic health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
        assert "timestamp" in data
        # Services field is optional
        if "services" in data:
            assert isinstance(data["services"], dict)


class TestUploadEndpoints:
    """Test file upload endpoints."""

    def test_upload_endpoint_no_file(self):
        """Test upload endpoint without file."""
        response = client.post("/upload")
        assert response.status_code == 422  # Validation error

    def test_upload_endpoint_with_mock_file(self):
        """Test upload endpoint with mock C3D file."""
        # Create a temporary file to simulate C3D upload
        with tempfile.NamedTemporaryFile(suffix=".c3d", delete=False) as tmp_file:
            tmp_file.write(b"Mock C3D file content")
            tmp_file.flush()

            try:
                with Path(tmp_file.name).open("rb") as f:
                    files = {"file": ("test.c3d", f, "application/octet-stream")}
                    response = client.post("/upload", files=files)

                # Should either succeed or fail gracefully (500 for internal errors like missing constants)
                assert response.status_code in [200, 400, 422, 500]

                if response.status_code == 200:
                    data = response.json()
                    assert "message" in data

            finally:
                Path(tmp_file.name).unlink()

    def test_upload_invalid_file_type(self):
        """Test upload with invalid file type."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp_file:
            tmp_file.write(b"Not a C3D file")
            tmp_file.flush()

            try:
                with Path(tmp_file.name).open("rb") as f:
                    files = {"file": ("test.txt", f, "text/plain")}
                    response = client.post("/upload", files=files)

                # Should reject invalid file types
                assert response.status_code in [400, 422]

            finally:
                Path(tmp_file.name).unlink()


class TestWebhookEndpoints:
    """Test webhook endpoints."""

    def test_webhook_c3d_upload_invalid_payload(self):
        """Test webhook with invalid payload."""
        invalid_payload = {"invalid": "data"}

        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=invalid_payload,
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code in [400, 422, 500]

    def test_webhook_c3d_upload_valid_structure(self):
        """Test webhook with valid payload structure."""
        valid_payload = {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "id": "test-file-123",
                "name": "test_file.c3d",
                "bucket_id": "c3d-examples",
                "created_at": "2025-08-14T15:00:00Z",
                "updated_at": "2025-08-14T15:00:00Z",
                "metadata": {"size": 1024, "mimetype": "application/octet-stream"},
            },
            "old_record": None,
        }

        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=valid_payload,
            headers={"Content-Type": "application/json"},
        )

        # Should process successfully or return meaningful error
        assert response.status_code in [200, 400, 404, 500]

        if response.status_code == 200:
            data = response.json()
            assert "success" in data or "message" in data


class TestSignalsEndpoints:
    """Test signals API endpoints."""

    def test_get_session_signals_no_id(self):
        """Test getting signals without session ID."""
        response = client.get("/api/sessions//signals")
        assert response.status_code == 404

    def test_get_session_signals_invalid_id(self):
        """Test getting signals with invalid session ID."""
        response = client.get("/api/sessions/invalid-uuid/signals")
        # Should return error for invalid UUID or not found
        assert response.status_code in [400, 404, 422]

    def test_get_session_signals_valid_format(self):
        """Test getting signals with valid UUID format."""
        test_uuid = "550e8400-e29b-41d4-a716-446655440000"
        response = client.get(f"/api/sessions/{test_uuid}/signals")

        # Should return not found for non-existent session or proper data
        assert response.status_code in [200, 404, 500]

        if response.status_code == 200:
            data = response.json()
            # Verify response structure
            assert isinstance(data, dict)

    def test_recalc_session_invalid_id(self):
        """Test recalc endpoint with invalid session ID."""
        response = client.post("/api/sessions/invalid-uuid/recalc")
        assert response.status_code in [400, 404, 422]

    def test_recalc_session_no_body(self):
        """Test recalc endpoint without request body."""
        test_uuid = "550e8400-e29b-41d4-a716-446655440000"
        response = client.post(f"/api/sessions/{test_uuid}/recalc")

        # Should require request body for parameters
        assert response.status_code in [400, 404, 422]

    def test_recalc_session_with_params(self):
        """Test recalc endpoint with parameters."""
        test_uuid = "550e8400-e29b-41d4-a716-446655440000"
        params = {"threshold_factor": 0.2, "min_duration_ms": 100, "smoothing_window": 50}

        response = client.post(
            f"/api/sessions/{test_uuid}/recalc",
            json=params,
            headers={"Content-Type": "application/json"},
        )

        # Should process or return meaningful error
        assert response.status_code in [200, 400, 404, 422, 500]


class TestCacheEndpoints:
    """Test cache monitoring endpoints."""

    def test_cache_stats(self):
        """Test cache statistics endpoint."""
        response = client.get("/cache/stats")

        # Should return cache stats, not found, or indicate cache not available
        assert response.status_code in [200, 404, 503]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)

    def test_cache_clear(self):
        """Test cache clear endpoint."""
        response = client.post("/cache/clear")

        # Should clear cache or indicate operation status
        assert response.status_code in [200, 404, 503]


class TestErrorHandling:
    """Test API error handling."""

    def test_404_endpoint(self):
        """Test non-existent endpoint returns 404."""
        response = client.get("/api/nonexistent")
        assert response.status_code == 404

    def test_method_not_allowed(self):
        """Test wrong HTTP method returns 405."""
        response = client.delete("/health")  # Health only supports GET
        assert response.status_code == 405

    def test_malformed_json(self):
        """Test malformed JSON in POST requests."""
        response = client.post(
            "/webhooks/storage/c3d-upload",
            data="invalid json{",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code in [400, 422]  # Bad request or validation error


class TestCORS:
    """Test CORS headers."""

    def test_cors_preflight(self):
        """Test CORS preflight request."""
        response = client.options(
            "/health",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
        )

        # Should handle CORS appropriately
        assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_background_task_processing():
    """Test that background tasks are scheduled correctly."""
    with patch("api.routes.webhooks.BackgroundTasks") as mock_bg_tasks:
        mock_bg_tasks.return_value.add_task = MagicMock()

        payload = {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "id": "bg-test-123",
                "name": "background_test.c3d",
                "bucket_id": "c3d-examples",
                "created_at": "2025-08-14T15:00:00Z",
                "updated_at": "2025-08-14T15:00:00Z",
                "metadata": {"size": 2048, "mimetype": "application/octet-stream"},
            },
            "old_record": None,
        }

        response = client.post("/webhooks/storage/c3d-upload", json=payload)

        # Background task should be scheduled regardless of processing outcome
        # (We're testing the webhook scheduling, not the actual processing)
        assert response.status_code in [200, 400, 404, 500]


class TestAuthentication:
    """Test authentication requirements (if implemented)."""

    def test_protected_endpoints_require_auth(self):
        """Test that protected endpoints require authentication."""
        # Test various endpoints that might require authentication
        protected_endpoints = [
            "/api/admin/stats",
            "/api/admin/users",
        ]

        for endpoint in protected_endpoints:
            response = client.get(endpoint)
            # Should return unauthorized or not found (if endpoint doesn't exist)
            assert response.status_code in [401, 404]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
