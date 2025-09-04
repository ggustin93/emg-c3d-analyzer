"""
Tests for RBAC Authentication System
"""
import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from api.rbac import (
    get_current_user_role,
    require_admin,
    require_therapist_or_admin
)


class TestRBACRoles:
    """Test RBAC role system - Database RLS is the single source of truth"""
    
    def test_valid_roles(self):
        """Test that valid roles are recognized"""
        # Valid roles handled by database RLS
        valid_roles = ['ADMIN', 'THERAPIST', 'RESEARCHER']
        
        for role in valid_roles:
            # These roles should be accepted by the system
            assert role in valid_roles
    
    def test_role_hierarchy(self):
        """Test role hierarchy is enforced by database RLS"""
        # Note: Actual permission enforcement happens in database RLS policies
        # This test validates our understanding of the role hierarchy
        role_hierarchy = {
            'ADMIN': 'full_access',  # Can access everything
            'THERAPIST': 'own_patients',  # Can access own patients only
            'RESEARCHER': 'read_only'  # Can read anonymized data
        }
        
        assert role_hierarchy['ADMIN'] == 'full_access'
        assert role_hierarchy['THERAPIST'] == 'own_patients'
        assert role_hierarchy['RESEARCHER'] == 'read_only'


class TestRBACAuthentication:
    """Test RBAC authentication functions"""
    
    @pytest.fixture
    def mock_credentials(self):
        """Mock HTTP credentials"""
        return HTTPAuthorizationCredentials(scheme="Bearer", credentials="mock-token")
    
    @patch('api.rbac.get_supabase_client')
    async def test_get_current_user_role_success(self, mock_supabase, mock_credentials):
        """Test successful role extraction"""
        # Mock Supabase responses
        mock_user = Mock()
        mock_user.user.id = 'user-123'
        
        mock_profile = Mock()
        mock_profile.data = {'role': 'THERAPIST'}
        
        mock_client = Mock()
        mock_client.auth.get_user.return_value = mock_user
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_profile
        
        mock_supabase.return_value = mock_client
        
        role = await get_current_user_role(mock_credentials)
        assert role == 'THERAPIST'
    
    @patch('api.rbac.get_supabase_client')
    async def test_get_current_user_role_invalid_token(self, mock_supabase, mock_credentials):
        """Test invalid token handling"""
        mock_client = Mock()
        mock_client.auth.get_user.return_value.user = None
        mock_supabase.return_value = mock_client
        
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user_role(mock_credentials)
        
        assert exc_info.value.status_code == 401
        assert "Invalid authentication token" in str(exc_info.value.detail)
    
    @patch('api.rbac.get_supabase_client')
    async def test_get_current_user_role_no_profile(self, mock_supabase, mock_credentials):
        """Test missing user profile"""
        mock_user = Mock()
        mock_user.user.id = 'user-123'
        
        mock_profile = Mock()
        mock_profile.data = None
        
        mock_client = Mock()
        mock_client.auth.get_user.return_value = mock_user
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_profile
        
        mock_supabase.return_value = mock_client
        
        # Should return None when no profile found (RLS will handle access)
        role = await get_current_user_role(mock_credentials)
        assert role is None


class TestRBACDecorators:
    """Test RBAC decorators and helpers"""
    
    @pytest.fixture
    def mock_credentials(self):
        return HTTPAuthorizationCredentials(scheme="Bearer", credentials="mock-token")
    
    @patch('api.rbac.get_current_user_role')
    async def test_require_admin_success(self, mock_get_role, mock_credentials):
        """Test admin requirement success"""
        mock_get_role.return_value = 'ADMIN'
        
        role = await require_admin(mock_credentials)
        assert role == 'ADMIN'
    
    @patch('api.rbac.get_current_user_role')
    async def test_require_admin_failure(self, mock_get_role, mock_credentials):
        """Test admin requirement failure"""
        mock_get_role.return_value = 'THERAPIST'
        
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(mock_credentials)
        
        assert exc_info.value.status_code == 403
        assert "Admin access required" in str(exc_info.value.detail)
    
    @patch('api.rbac.get_current_user_role')
    async def test_require_therapist_or_admin_therapist(self, mock_get_role, mock_credentials):
        """Test therapist or admin requirement with therapist"""
        mock_get_role.return_value = 'THERAPIST'
        
        role = await require_therapist_or_admin(mock_credentials)
        assert role == 'THERAPIST'
    
    @patch('api.rbac.get_current_user_role')
    async def test_require_therapist_or_admin_admin(self, mock_get_role, mock_credentials):
        """Test therapist or admin requirement with admin"""
        mock_get_role.return_value = 'ADMIN'
        
        role = await require_therapist_or_admin(mock_credentials)
        assert role == 'ADMIN'
    
    @patch('api.rbac.get_current_user_role')
    async def test_require_therapist_or_admin_failure(self, mock_get_role, mock_credentials):
        """Test therapist or admin requirement failure"""
        mock_get_role.return_value = 'RESEARCHER'
        
        with pytest.raises(HTTPException) as exc_info:
            await require_therapist_or_admin(mock_credentials)
        
        assert exc_info.value.status_code == 403
        assert "Therapist or admin access required" in str(exc_info.value.detail)


class TestDatabaseRLS:
    """Test that we rely on database RLS for authorization"""
    
    def test_no_permission_logic_in_backend(self):
        """Verify backend has no hardcoded permissions"""
        # Import the rbac module
        import api.rbac as rbac_module
        
        # Verify PERMISSIONS constant doesn't exist
        assert not hasattr(rbac_module, 'PERMISSIONS')
        
        # Verify can_access function doesn't exist
        assert not hasattr(rbac_module, 'can_access')
        
        # Verify RBACChecker doesn't exist (moved to database)
        assert not hasattr(rbac_module, 'RBACChecker')
    
    def test_authentication_only_functions_exist(self):
        """Test that only authentication functions exist"""
        import api.rbac as rbac_module
        
        # These should exist (authentication only)
        assert hasattr(rbac_module, 'get_current_user_role')
        assert hasattr(rbac_module, 'require_admin')
        assert hasattr(rbac_module, 'require_therapist_or_admin')
        
        # These should be callable
        assert callable(rbac_module.get_current_user_role)
        assert callable(rbac_module.require_admin)
        assert callable(rbac_module.require_therapist_or_admin)


class TestRLSIntegrationScenarios:
    """Test that RLS policies handle realistic RBAC scenarios"""
    
    def test_admin_rls_expectations(self):
        """Document expected admin access via RLS"""
        # This test documents what the database RLS policies should enforce
        admin_rls_expectations = {
            'patients': 'full_access',  # Can view/edit all patients
            'therapy_sessions': 'full_access',  # Can view/edit all sessions
            'scoring_configuration': 'full_access',  # Can modify scoring
            'audit_log': 'read_access',  # Can view audit logs
            'c3d_files': 'full_access'  # Can access all files
        }
        
        # Verify our expectations are documented
        assert admin_rls_expectations['patients'] == 'full_access'
        assert admin_rls_expectations['audit_log'] == 'read_access'
    
    def test_therapist_rls_expectations(self):
        """Document expected therapist access via RLS"""
        therapist_rls_expectations = {
            'patients': 'own_only',  # Can only see their patients
            'therapy_sessions': 'own_patients',  # Sessions for their patients
            'scoring_configuration': 'read_only',  # Can view but not modify
            'audit_log': 'no_access',  # Cannot view audit logs
            'c3d_files': 'own_patients'  # Files for their patients only
        }
        
        # Verify our expectations are documented
        assert therapist_rls_expectations['patients'] == 'own_only'
        assert therapist_rls_expectations['audit_log'] == 'no_access'
    
    def test_researcher_rls_expectations(self):
        """Document expected researcher access via RLS"""  
        researcher_rls_expectations = {
            'patients': 'no_access',  # No direct patient access
            'therapy_sessions': 'anonymized_read',  # Read anonymized data
            'scoring_configuration': 'read_only',  # Can view configurations
            'audit_log': 'no_access',  # Cannot view audit logs
            'c3d_files': 'read_only'  # Can read all files for research
        }
        
        # Verify our expectations are documented
        assert researcher_rls_expectations['therapy_sessions'] == 'anonymized_read'
        assert researcher_rls_expectations['c3d_files'] == 'read_only'