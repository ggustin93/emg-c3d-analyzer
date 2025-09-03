"""
Tests for RBAC Authentication System
"""
import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from api.rbac import (
    get_current_user_role,
    can_access,
    require_admin,
    require_therapist_or_admin,
    get_current_user_with_role,
    RBACChecker,
    PERMISSIONS
)


class TestRBACPermissions:
    """Test RBAC permission system"""
    
    def test_permissions_structure(self):
        """Test that permissions are properly structured"""
        assert 'ADMIN' in PERMISSIONS
        assert 'THERAPIST' in PERMISSIONS
        assert 'RESEARCHER' in PERMISSIONS
        
        # Admin should have 'all' permission
        assert 'all' in PERMISSIONS['ADMIN']
        
        # Therapist should have patient and session permissions
        assert 'patients:own' in PERMISSIONS['THERAPIST']
        assert 'sessions:write' in PERMISSIONS['THERAPIST']
        
        # Researcher should have read-only permissions
        assert 'reports:read' in PERMISSIONS['RESEARCHER']
        assert 'analytics:read' in PERMISSIONS['RESEARCHER']
    
    def test_can_access_admin(self):
        """Test admin can access everything"""
        assert can_access('ADMIN', 'scoring:write')
        assert can_access('ADMIN', 'users:manage')
        assert can_access('ADMIN', 'anything:random')  # Admin has full access
    
    def test_can_access_therapist(self):
        """Test therapist permissions"""
        assert can_access('THERAPIST', 'patients:own')
        assert can_access('THERAPIST', 'sessions:write')
        assert not can_access('THERAPIST', 'users:manage')
        assert not can_access('THERAPIST', 'scoring:write')
    
    def test_can_access_researcher(self):
        """Test researcher permissions"""
        assert can_access('RESEARCHER', 'reports:read')
        assert can_access('RESEARCHER', 'analytics:read')
        assert not can_access('RESEARCHER', 'sessions:write')
        assert not can_access('RESEARCHER', 'patients:own')
    
    def test_can_access_invalid_role(self):
        """Test invalid role returns False"""
        assert not can_access('INVALID_ROLE', 'anything')
        assert not can_access(None, 'anything')
        assert not can_access('', 'anything')


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
        
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user_role(mock_credentials)
        
        assert exc_info.value.status_code == 403
        assert "User profile not found" in str(exc_info.value.detail)


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


class TestRBACChecker:
    """Test RBACChecker utility class"""
    
    def test_get_user_permissions(self):
        """Test getting user permissions"""
        admin_permissions = RBACChecker.get_user_permissions('ADMIN')
        assert 'all' in admin_permissions
        assert 'scoring:write' in admin_permissions
        
        therapist_permissions = RBACChecker.get_user_permissions('THERAPIST')
        assert 'patients:own' in therapist_permissions
        assert 'sessions:write' in therapist_permissions
        
        researcher_permissions = RBACChecker.get_user_permissions('RESEARCHER')
        assert 'reports:read' in researcher_permissions
        assert 'analytics:read' in researcher_permissions
        
        invalid_permissions = RBACChecker.get_user_permissions('INVALID')
        assert invalid_permissions == []
    
    def test_has_permission(self):
        """Test permission checking"""
        assert RBACChecker.has_permission('ADMIN', 'anything')
        assert RBACChecker.has_permission('THERAPIST', 'patients:own')
        assert not RBACChecker.has_permission('THERAPIST', 'users:manage')
        assert RBACChecker.has_permission('RESEARCHER', 'reports:read')
        assert not RBACChecker.has_permission('RESEARCHER', 'sessions:write')
    
    @patch('api.rbac.get_supabase_client')
    async def test_log_action_success(self, mock_supabase):
        """Test audit logging success"""
        mock_client = Mock()
        mock_client.table.return_value.insert.return_value.execute.return_value = None
        mock_supabase.return_value = mock_client
        
        # Should not raise exception
        await RBACChecker.log_action(
            user_id='user-123',
            user_role='ADMIN',
            action='CREATE',
            table_name='patients',
            record_id='patient-456',
            changes={'name': 'John Doe'},
            ip_address='192.168.1.1'
        )
        
        # Verify audit entry was inserted
        mock_client.table.assert_called_with('audit_log')
        mock_client.table.return_value.insert.assert_called_once()
    
    @patch('api.rbac.get_supabase_client')
    @patch('builtins.print')  # Mock print to capture error logs
    async def test_log_action_failure(self, mock_print, mock_supabase):
        """Test audit logging failure handling"""
        mock_client = Mock()
        mock_client.table.return_value.insert.return_value.execute.side_effect = Exception("DB Error")
        mock_supabase.return_value = mock_client
        
        # Should not raise exception even if logging fails
        await RBACChecker.log_action(
            user_id='user-123',
            user_role='ADMIN',
            action='CREATE',
            table_name='patients'
        )
        
        # Verify error was logged
        mock_print.assert_called_once()
        assert "Audit logging failed" in str(mock_print.call_args[0][0])


class TestIntegrationScenarios:
    """Test realistic RBAC scenarios"""
    
    def test_admin_workflow(self):
        """Test admin can access all features"""
        admin_permissions = PERMISSIONS['ADMIN']
        
        # Admin should access scoring configuration
        assert 'scoring:write' in admin_permissions
        
        # Admin should manage users  
        assert 'users:manage' in admin_permissions
        
        # Admin should access all reports
        assert 'reports:all' in admin_permissions
        
        # Admin should read audit logs
        assert 'audit:read' in admin_permissions
    
    def test_therapist_workflow(self):
        """Test therapist permissions match workflow"""
        therapist_permissions = PERMISSIONS['THERAPIST']
        
        # Therapist should manage their patients
        assert 'patients:own' in therapist_permissions
        
        # Therapist should create and modify sessions
        assert 'sessions:write' in therapist_permissions
        assert 'sessions:own' in therapist_permissions
        
        # Therapist should add notes
        assert 'notes:write' in therapist_permissions
        
        # Therapist should upload C3D files
        assert 'upload:c3d' in therapist_permissions
        
        # Therapist should see own reports
        assert 'reports:own' in therapist_permissions
        
        # Therapist should NOT manage users or global settings
        assert 'users:manage' not in therapist_permissions
        assert 'scoring:write' not in therapist_permissions
    
    def test_researcher_workflow(self):
        """Test researcher permissions match workflow"""  
        researcher_permissions = PERMISSIONS['RESEARCHER']
        
        # Researcher should read reports and analytics
        assert 'reports:read' in researcher_permissions
        assert 'analytics:read' in researcher_permissions
        
        # Researcher should export anonymized data
        assert 'export:anonymized' in researcher_permissions
        assert 'sessions:read_anonymized' in researcher_permissions
        
        # Researcher should NOT write anything
        write_permissions = [p for p in researcher_permissions if 'write' in p]
        assert len(write_permissions) == 0
        
        # Researcher should NOT manage users or settings
        assert 'users:manage' not in researcher_permissions
        assert 'scoring:write' not in researcher_permissions