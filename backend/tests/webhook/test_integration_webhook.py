"""
Integration tests for the complete webhook processing workflow
Tests end-to-end processing from webhook receipt to database storage
"""
import pytest
import json
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import FastAPI

from ...api.webhooks import router as webhook_router
from ...services.webhook_service import WebhookService
from ...services.metadata_service import MetadataService
from ...services.cache_service import CacheService


@pytest.fixture
def app():
    """Create FastAPI test app with webhook router"""
    app = FastAPI()
    app.include_router(webhook_router)
    return app


@pytest.fixture
def client(app):
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_services():
    """Mock all external services for integration testing"""
    with patch('backend.api.webhooks.WebhookService') as mock_webhook, \
         patch('backend.api.webhooks.MetadataService') as mock_metadata, \
         patch('backend.api.webhooks.CacheService') as mock_cache, \
         patch('backend.api.webhooks.settings') as mock_settings:
        
        # Configure mocks
        mock_webhook_instance = AsyncMock()
        mock_metadata_instance = AsyncMock()
        mock_cache_instance = AsyncMock()
        
        mock_webhook.return_value = mock_webhook_instance
        mock_metadata.return_value = mock_metadata_instance
        mock_cache.return_value = mock_cache_instance
        
        # Configure settings mock (no webhook secret by default)
        mock_settings.WEBHOOK_SECRET = None
        mock_settings.PROCESSING_VERSION = "v2.1.0"
        
        # Mock return values - use async mock returns
        mock_webhook_instance.calculate_file_hash.return_value = "abc123def456"
        mock_metadata_instance.get_by_file_hash.return_value = None
        mock_metadata_instance.create_metadata_entry.return_value = "12345678-1234-1234-1234-123456789abc"
        mock_cache_instance.get_cached_analysis.return_value = None
        
        yield {
            'webhook': mock_webhook_instance,
            'metadata': mock_metadata_instance,
            'cache': mock_cache_instance,
            'settings': mock_settings
        }


class TestWebhookIntegration:
    """Integration tests for complete webhook workflow"""
    
    def test_successful_c3d_upload_processing(self, client, mock_services):
        """Test successful processing of C3D upload webhook"""
        payload = {
            "eventType": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            "objectName": "P005/session1/test_file.c3d",
            "objectSize": 1024000,
            "contentType": "application/octet-stream",
            "timestamp": "2025-08-11T10:30:00Z",
            "metadata": {"patient_id": "P005"}
        }
        
        response = client.post("/webhooks/storage/c3d-upload", json=payload)
        
        assert response.status_code == 200
        result = response.json()
        
        assert result["success"] is True
        assert "processing initiated" in result["message"].lower()
        assert "processing_id" in result
    
    def test_webhook_ignores_non_c3d_files(self, client, mock_services):
        """Test that webhook ignores non-C3D files"""
        payload = {
            "eventType": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            "objectName": "document.pdf",
            "objectSize": 1024000,
            "contentType": "application/pdf",
            "timestamp": "2025-08-11T10:30:00Z"
        }
        
        response = client.post("/webhooks/storage/c3d-upload", json=payload)
        
        assert response.status_code == 200
        result = response.json()
        
        assert result["success"] is True
        assert "ignoring non-c3d file" in result["message"].lower()
    
    def test_webhook_ignores_wrong_event_type(self, client, mock_services):
        """Test that webhook ignores non-upload events"""
        payload = {
            "eventType": "ObjectDeleted:Delete",
            "bucket": "c3d-examples",
            "objectName": "test_file.c3d",
            "objectSize": 1024000,
            "contentType": "application/octet-stream",
            "timestamp": "2025-08-11T10:30:00Z"
        }
        
        response = client.post("/webhooks/storage/c3d-upload", json=payload)
        
        assert response.status_code == 200
        result = response.json()
        
        assert result["success"] is True
        assert "ignoring event type" in result["message"].lower()
    
    def test_webhook_rejects_wrong_bucket(self, client, mock_services):
        """Test that webhook rejects files from wrong bucket"""
        payload = {
            "eventType": "ObjectCreated:Post",
            "bucket": "wrong-bucket",
            "objectName": "test_file.c3d",
            "objectSize": 1024000,
            "contentType": "application/octet-stream",
            "timestamp": "2025-08-11T10:30:00Z"
        }
        
        response = client.post("/webhooks/storage/c3d-upload", json=payload)
        
        assert response.status_code == 200
        result = response.json()
        
        assert result["success"] is False
        assert "invalid bucket" in result["message"].lower()
    
    def test_webhook_signature_verification(self, client, mock_services):
        """Test webhook signature verification when secret is configured"""
        # Configure webhook secret in our existing mock
        mock_services['settings'].WEBHOOK_SECRET = "test_secret"
        
        payload = {
            "eventType": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            "objectName": "test_file.c3d",
            "objectSize": 1024000,
            "contentType": "application/octet-stream",
            "timestamp": "2025-08-11T10:30:00Z"
        }
        
        # Request without signature should fail
        response = client.post("/webhooks/storage/c3d-upload", json=payload)
        assert response.status_code == 401
    
    def test_cached_file_processing(self, client, mock_services):
        """Test processing when file already exists in cache"""
        # Mock existing metadata
        mock_services['metadata'].get_by_file_hash.return_value = {
            "id": "existing-meta-uuid",
            "file_path": "P005/session1/test_file.c3d",
            "processing_status": "completed"
        }
        
        # Mock cached results
        mock_services['cache'].get_cached_analysis.return_value = {
            "id": "cached-result-uuid",
            "analytics_data": {"test": "cached_data"}
        }
        
        payload = {
            "eventType": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            "objectName": "P005/session1/test_file.c3d",
            "objectSize": 1024000,
            "contentType": "application/octet-stream",
            "timestamp": "2025-08-11T10:30:00Z"
        }
        
        response = client.post("/webhooks/storage/c3d-upload", json=payload)
        
        assert response.status_code == 200
        result = response.json()
        
        assert result["success"] is True
        assert "retrieved from cache" in result["message"].lower()
        
        # Verify cache hit was incremented
        mock_services['cache'].increment_cache_hits.assert_called_once()
    
    def test_error_handling_service_failure(self, client, mock_services):
        """Test error handling when services fail"""
        # Mock service failure
        mock_services['webhook'].calculate_file_hash.side_effect = Exception("Service unavailable")
        
        payload = {
            "eventType": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            "objectName": "test_file.c3d",
            "objectSize": 1024000,
            "contentType": "application/octet-stream",
            "timestamp": "2025-08-11T10:30:00Z"
        }
        
        response = client.post("/webhooks/storage/c3d-upload", json=payload)
        
        assert response.status_code == 500
        result = response.json()
        
        assert "processing error" in result["detail"].lower()
    
    def test_get_processing_status_success(self, client, mock_services):
        """Test successful retrieval of processing status"""
        valid_uuid = "12345678-1234-1234-1234-123456789abc"
        
        # Mock metadata
        mock_services['metadata'].get_by_id.return_value = {
            "id": valid_uuid,
            "processing_status": "completed",
            "file_path": "P005/test.c3d",
            "created_at": "2025-08-11T10:30:00Z",
            "processed_at": "2025-08-11T10:35:00Z",
            "file_hash": "abc123def456"
        }
        
        # Mock cached results
        mock_services['cache'].get_cached_analysis.return_value = {
            "analytics_data": {"channels": 4},
            "compliance_scores": {"left": 85, "right": 90}
        }
        
        response = client.get(f"/webhooks/storage/status/{valid_uuid}")
        
        assert response.status_code == 200
        result = response.json()
        
        assert result["processing_id"] == valid_uuid
        assert result["status"] == "completed"
        assert "analysis_results" in result
        assert "compliance_scores" in result
    
    def test_get_processing_status_not_found(self, client, mock_services):
        """Test processing status for non-existent ID"""
        valid_uuid = "12345678-1234-1234-1234-123456789abc"
        mock_services['metadata'].get_by_id.return_value = None
        
        response = client.get(f"/webhooks/storage/status/{valid_uuid}")
        
        assert response.status_code == 404
        result = response.json()
        
        assert "not found" in result["detail"].lower()
    
    def test_get_processing_status_invalid_uuid(self, client, mock_services):
        """Test processing status with invalid UUID format"""
        response = client.get("/webhooks/storage/status/invalid-uuid-format")
        
        assert response.status_code == 400
        result = response.json()
        
        assert "invalid" in result["detail"].lower()


class TestServiceIntegration:
    """Integration tests for service interactions"""
    
    @pytest.mark.asyncio
    async def test_metadata_service_resolution_patterns(self):
        """Test that metadata service applies frontend-consistent resolution"""
        service = MetadataService()
        
        # Test patient ID resolution
        result = service._resolve_patient_id(
            file_path="P005/session1/test.c3d",
            c3d_metadata={"player_name": "P007"},
            storage_metadata={"patient_id": "P008"}
        )
        
        # Should prioritize subfolder pattern
        assert result == "P005"
        
        # Test without subfolder
        result = service._resolve_patient_id(
            file_path="test.c3d",
            c3d_metadata={"player_name": "P007"},
            storage_metadata={"patient_id": "P008"}
        )
        
        # Should use C3D metadata
        assert result == "P007"
    
    @pytest.mark.asyncio
    async def test_cache_service_metrics_extraction(self):
        """Test that cache service properly extracts clinical metrics"""
        service = CacheService()
        
        analysis_result = {
            "mvc_analysis": {"mvc_values": {"BicepsL": 100, "BicepsR": 95}},
            "contractions": [
                {"quality_flags": {"is_good": True}},
                {"quality_flags": {"is_good": False}},
                {"quality_flags": {"is_good": True}}
            ],
            "compliance_scores": {"left": 85, "right": 90},
            "temporal_stats": {"mean_rms": 45.2}
        }
        
        metrics = service._extract_clinical_metrics(analysis_result)
        
        assert metrics["mvc_values"] == {"BicepsL": 100, "BicepsR": 95}
        assert metrics["total_contractions_count"] == 3
        assert metrics["good_contractions_count"] == 2
        assert metrics["compliance_scores"] == {"left": 85, "right": 90}


if __name__ == "__main__":
    pytest.main([__file__, "-v"])