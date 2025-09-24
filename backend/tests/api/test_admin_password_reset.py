"""
Tests for admin password reset functionality.
Validates secure password generation and API endpoint behavior.
"""
import json
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from api.main import app
from services.admin.admin_service import AdminService


class TestAdminPasswordReset:
    """Test suite for admin password reset functionality."""
    
    def test_password_generation(self):
        """Test that temporary passwords are generated securely."""
        admin_service = AdminService()
        
        # Generate multiple passwords to test randomness
        passwords = [admin_service.generate_temporary_password() for _ in range(10)]
        
        # Check all passwords are unique
        assert len(set(passwords)) == 10, "Passwords should be unique"
        
        # Check password format
        for password in passwords:
            assert password.startswith("Temp-"), "Password should start with 'Temp-'"
            assert len(password) >= 16, "Password should be at least 16 characters"
            # Check for various character types
            password_parts = password.replace("Temp-", "").replace("-", "")
            assert any(c.isupper() for c in password_parts), "Should contain uppercase"
            assert any(c.islower() for c in password_parts), "Should contain lowercase"
            assert any(c.isdigit() for c in password_parts), "Should contain digits"
    
    @patch('api.routes.admin.get_supabase_client')
    @patch('api.dependencies.auth.get_supabase_client')
    def test_password_reset_endpoint_unauthorized(self, mock_auth_client, mock_admin_client):
        """Test that non-admin users cannot reset passwords."""
        client = TestClient(app)
        
        # Mock non-admin user
        mock_auth = MagicMock()
        mock_auth.auth.get_user.return_value.user = MagicMock(
            id='user123',
            email='user@example.com'
        )
        mock_auth_client.return_value = mock_auth
        
        # Mock user profile query - not an admin
        mock_admin = MagicMock()
        mock_admin.table().select().eq().single().execute.return_value.data = {
            'role': 'therapist'  # Not admin
        }
        mock_admin_client.return_value = mock_admin
        
        # Try to reset password
        response = client.post(
            "/admin/users/target-user-id/reset-password",
            headers={"Authorization": "Bearer test_token"},
            json={"notify_user": False}
        )
        
        assert response.status_code == 403
        assert "Admin access required" in response.json()["detail"]
    
    @patch('services.admin.admin_service.get_supabase_client')
    @patch('api.routes.admin.get_supabase_client')
    @patch('api.dependencies.auth.get_supabase_client')
    def test_password_reset_endpoint_success(self, mock_auth_client, mock_route_client, mock_service_client):
        """Test successful password reset by admin."""
        client = TestClient(app)
        
        # Mock admin user authentication
        mock_auth = MagicMock()
        mock_auth.auth.get_user.return_value.user = MagicMock(
            id='admin123',
            email='admin@example.com'
        )
        mock_auth_client.return_value = mock_auth
        
        # Mock admin role check
        mock_route = MagicMock()
        mock_route.table().select().eq().single().execute.return_value.data = {
            'role': 'admin'  # Is admin
        }
        mock_route_client.return_value = mock_route
        
        # Mock service layer Supabase client
        mock_service = MagicMock()
        mock_service.auth.admin.update_user_by_id.return_value.user = MagicMock(id='target-user-id')
        mock_service.table().insert().execute.return_value.data = [{'id': 'audit123'}]
        mock_service_client.return_value = mock_service
        
        # Reset password
        response = client.post(
            "/admin/users/550e8400-e29b-41d4-a716-446655440000/reset-password",
            headers={"Authorization": "Bearer test_token"},
            json={"notify_user": False}
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Validate response structure
        assert result["success"] is True
        assert "temporary_password" in result
        assert result["temporary_password"].startswith("Temp-")
        assert "message" in result
        assert result["expires_in_hours"] == 24
        
        # Verify Supabase admin API was called
        mock_service.auth.admin.update_user_by_id.assert_called_once()
        
        # Verify audit log was created
        mock_service.table().insert.assert_called_once()
    
    def test_admin_service_initialization(self):
        """Test that AdminService initializes with service key."""
        with patch('services.admin.admin_service.get_supabase_client') as mock_client:
            admin_service = AdminService()
            
            # Verify service key was requested
            mock_client.assert_called_once_with(use_service_key=True)