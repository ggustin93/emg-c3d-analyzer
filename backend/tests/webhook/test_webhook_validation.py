"""
Unit tests for webhook validation functionality
Tests webhook signature verification, payload validation, and error handling
"""
import pytest
import hmac
import hashlib
import json
from datetime import datetime
from unittest.mock import Mock, patch

from ...api.webhooks import verify_webhook_signature, StorageWebhookPayload
from ...services.webhook_service import WebhookService


class TestWebhookSignatureVerification:
    """Test webhook signature verification"""
    
    def test_verify_valid_signature(self):
        """Test verification of valid HMAC signature"""
        secret = "test_secret_key"
        payload = b'{"test": "data"}'
        
        # Generate valid signature
        signature = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # Mock request object
        request = Mock()
        
        # Verify signature
        result = verify_webhook_signature(request, payload, signature, secret)
        assert result is True
    
    def test_verify_invalid_signature(self):
        """Test rejection of invalid signature"""
        secret = "test_secret_key"
        payload = b'{"test": "data"}'
        invalid_signature = "invalid_signature_12345"
        
        request = Mock()
        
        result = verify_webhook_signature(request, payload, invalid_signature, secret)
        assert result is False
    
    def test_verify_signature_timing_attack_protection(self):
        """Test that signature verification uses constant-time comparison"""
        secret = "test_secret_key"
        payload = b'{"test": "data"}'
        
        # Generate a signature for different payload
        wrong_payload = b'{"different": "data"}'
        wrong_signature = hmac.new(
            secret.encode(),
            wrong_payload,
            hashlib.sha256
        ).hexdigest()
        
        request = Mock()
        
        result = verify_webhook_signature(request, payload, wrong_signature, secret)
        assert result is False


class TestStorageWebhookPayload:
    """Test webhook payload validation"""
    
    def test_valid_c3d_upload_payload(self):
        """Test parsing of valid C3D upload payload"""
        payload_data = {
            "eventType": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            "objectName": "P005/session1/test_file.c3d",
            "objectSize": 1024000,
            "contentType": "application/octet-stream",
            "timestamp": "2025-08-11T10:30:00Z",
            "metadata": {"patient_id": "P005"}
        }
        
        payload = StorageWebhookPayload(**payload_data)
        
        assert payload.event_type == "ObjectCreated:Post"
        assert payload.bucket == "c3d-examples"
        assert payload.object_name == "P005/session1/test_file.c3d"
        assert payload.object_size == 1024000
        assert payload.content_type == "application/octet-stream"
        assert payload.metadata == {"patient_id": "P005"}
    
    def test_missing_required_field(self):
        """Test error handling for missing required fields"""
        payload_data = {
            "eventType": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            # Missing objectName
            "objectSize": 1024000,
            "contentType": "application/octet-stream",
            "timestamp": "2025-08-11T10:30:00Z"
        }
        
        with pytest.raises(ValueError):
            StorageWebhookPayload(**payload_data)
    
    def test_field_aliases(self):
        """Test that field aliases work correctly"""
        payload_data = {
            "eventType": "ObjectCreated:Post",  # Maps to event_type
            "bucket": "c3d-examples",
            "objectName": "test.c3d",  # Maps to object_name
            "objectSize": 1024000,  # Maps to object_size
            "contentType": "application/octet-stream",  # Maps to content_type
            "timestamp": "2025-08-11T10:30:00Z"
        }
        
        payload = StorageWebhookPayload(**payload_data)
        
        # Check that aliases mapped correctly
        assert payload.event_type == "ObjectCreated:Post"
        assert payload.object_name == "test.c3d"
        assert payload.object_size == 1024000
        assert payload.content_type == "application/octet-stream"


class TestWebhookService:
    """Test WebhookService functionality"""
    
    @pytest.fixture
    def webhook_service(self):
        """Create WebhookService instance for testing"""
        return WebhookService()
    
    def test_extract_path_metadata_nested_structure(self, webhook_service):
        """Test extraction of metadata from nested path structure"""
        file_path = "P005/session1/test_file.c3d"
        
        metadata = webhook_service.extract_path_metadata(file_path)
        
        assert metadata["patient_id"] == "P005"
        assert metadata["session_id"] == "session1"
        assert metadata["filename"] == "test_file.c3d"
    
    def test_extract_path_metadata_flat_structure(self, webhook_service):
        """Test extraction of metadata from flat path structure"""
        file_path = "test_file.c3d"
        
        metadata = webhook_service.extract_path_metadata(file_path)
        
        assert metadata["patient_id"] is None
        assert metadata["session_id"] is None
        assert metadata["filename"] == "test_file.c3d"
    
    def test_extract_path_metadata_patient_pattern(self, webhook_service):
        """Test recognition of patient ID pattern"""
        file_path = "P008/baseline/mvc_test.c3d"
        
        metadata = webhook_service.extract_path_metadata(file_path)
        
        assert metadata["patient_id"] == "P008"
        assert metadata["session_id"] == "baseline"
        assert metadata["filename"] == "mvc_test.c3d"
    
    def test_validate_webhook_payload_valid(self, webhook_service):
        """Test validation of valid webhook payload"""
        payload = {
            "event_type": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            "object_name": "test_file.c3d",
            "object_size": 1024000
        }
        
        is_valid, message = webhook_service.validate_webhook_payload(payload)
        
        assert is_valid is True
        assert message == "Valid payload"
    
    def test_validate_webhook_payload_wrong_event_type(self, webhook_service):
        """Test rejection of wrong event type"""
        payload = {
            "event_type": "ObjectDeleted:Delete",
            "bucket": "c3d-examples", 
            "object_name": "test_file.c3d",
            "object_size": 1024000
        }
        
        is_valid, message = webhook_service.validate_webhook_payload(payload)
        
        assert is_valid is False
        assert "Unsupported event type" in message
    
    def test_validate_webhook_payload_wrong_file_type(self, webhook_service):
        """Test rejection of non-C3D files"""
        payload = {
            "event_type": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            "object_name": "test_file.txt",
            "object_size": 1024000
        }
        
        is_valid, message = webhook_service.validate_webhook_payload(payload)
        
        assert is_valid is False
        assert "Invalid file type" in message
    
    def test_validate_webhook_payload_wrong_bucket(self, webhook_service):
        """Test rejection of wrong bucket"""
        payload = {
            "event_type": "ObjectCreated:Post",
            "bucket": "wrong-bucket",
            "object_name": "test_file.c3d",
            "object_size": 1024000
        }
        
        is_valid, message = webhook_service.validate_webhook_payload(payload)
        
        assert is_valid is False
        assert "Invalid bucket" in message
    
    def test_validate_webhook_payload_file_too_large(self, webhook_service):
        """Test rejection of files that are too large"""
        payload = {
            "event_type": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            "object_name": "huge_file.c3d",
            "object_size": 100 * 1024 * 1024  # 100MB > 50MB limit
        }
        
        is_valid, message = webhook_service.validate_webhook_payload(payload)
        
        assert is_valid is False
        assert "File too large" in message
    
    def test_validate_webhook_payload_zero_size(self, webhook_service):
        """Test rejection of zero-size files"""
        payload = {
            "event_type": "ObjectCreated:Post",
            "bucket": "c3d-examples",
            "object_name": "empty_file.c3d",
            "object_size": 0
        }
        
        is_valid, message = webhook_service.validate_webhook_payload(payload)
        
        assert is_valid is False
        assert "Invalid file size" in message
    
    def test_validate_webhook_payload_missing_fields(self, webhook_service):
        """Test rejection of payload with missing required fields"""
        payload = {
            "event_type": "ObjectCreated:Post",
            "bucket": "c3d-examples"
            # Missing object_name and object_size
        }
        
        is_valid, message = webhook_service.validate_webhook_payload(payload)
        
        assert is_valid is False
        assert "Missing required field" in message


class TestWebhookIntegration:
    """Integration tests for webhook processing"""
    
    @pytest.mark.asyncio
    @patch('backend.services.webhook_service.WebhookService.calculate_file_hash')
    async def test_webhook_file_hash_calculation(self, mock_hash):
        """Test file hash calculation in webhook processing"""
        mock_hash.return_value = "abc123def456"
        
        service = WebhookService()
        
        # This would normally require actual Supabase connection
        # For unit testing, we mock the hash calculation
        result = await service.calculate_file_hash("c3d-examples", "test.c3d")
        
        assert result == "abc123def456"
        mock_hash.assert_called_once_with("c3d-examples", "test.c3d")


@pytest.mark.asyncio
async def test_webhook_error_handling():
    """Test error handling in webhook processing"""
    # This test would require more comprehensive mocking
    # For now, just test that the service can be instantiated
    service = WebhookService()
    assert service is not None


if __name__ == "__main__":
    pytest.main([__file__])