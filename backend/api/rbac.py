"""
RBAC (Role-Based Access Control) for EMG C3D Analyzer
Simple pragmatic implementation with hardcoded permissions
"""
from functools import wraps
from typing import Dict, List, Callable, Any
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database.supabase_client import get_supabase_client

security = HTTPBearer()

# Hardcoded permissions for 3 roles (KISS approach)
PERMISSIONS: Dict[str, List[str]] = {
    'ADMIN': [
        'all',  # Admin has full access
        'scoring:write',
        'settings:write', 
        'users:manage',
        'reports:all',
        'audit:read'
    ],
    'THERAPIST': [
        'patients:own',
        'sessions:write',
        'sessions:own',
        'notes:write',
        'reports:own',
        'upload:c3d'
    ],
    'RESEARCHER': [
        'reports:read',
        'analytics:read', 
        'export:anonymized',
        'sessions:read_anonymized'
    ]
}


async def get_current_user_role(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """Extract user role from Supabase JWT token"""
    try:
        token = credentials.credentials
        supabase = get_supabase_client()
        
        # Get user from token
        user = supabase.auth.get_user(token)
        if not user.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        
        # Get role from user_profiles table
        profile = supabase.table('user_profiles').select('role').eq('id', user.user.id).single().execute()
        
        if not profile.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User profile not found"
            )
        
        return profile.data['role']
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )


def can_access(role: str, permission: str) -> bool:
    """Check if role has access to permission"""
    if not role:
        return False
    
    # Admin has full access
    if role == 'ADMIN':
        return True
    
    # Check specific permissions
    role_permissions = PERMISSIONS.get(role, [])
    return permission in role_permissions


def require_permission(required_permission: str):
    """Decorator to require specific permission for endpoint access"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # Get role from dependency injection
            role = None
            for arg in args:
                if hasattr(arg, '__annotations__'):
                    # Look for role parameter injected by FastAPI
                    if 'role' in str(arg):
                        role = arg
                        break
            
            if not role:
                # Fallback: extract from request if not injected
                credentials = kwargs.get('credentials')
                if credentials:
                    role = await get_current_user_role(credentials)
            
            if not role or not can_access(role, required_permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied. Required: {required_permission}"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def require_role(*allowed_roles: str):
    """Decorator to require specific roles for endpoint access"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            role = await get_current_user_role()
            
            if role not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


class RBACChecker:
    """Helper class for RBAC operations"""
    
    @staticmethod
    async def log_action(
        user_id: str,
        user_role: str,
        action: str,
        table_name: str,
        record_id: str = None,
        changes: dict = None,
        ip_address: str = None
    ):
        """Log action to audit trail"""
        try:
            supabase = get_supabase_client()
            
            audit_entry = {
                'user_id': user_id,
                'user_role': user_role,
                'action': action,
                'table_name': table_name,
                'record_id': record_id,
                'changes': changes,
                'ip_address': ip_address
            }
            
            supabase.table('audit_log').insert(audit_entry).execute()
            
        except Exception as e:
            # Don't fail the request if audit logging fails
            print(f"Audit logging failed: {e}")
    
    @staticmethod
    def get_user_permissions(role: str) -> List[str]:
        """Get all permissions for a role"""
        return PERMISSIONS.get(role, [])
    
    @staticmethod
    def has_permission(role: str, permission: str) -> bool:
        """Check if role has specific permission"""
        return can_access(role, permission)


# Convenience functions for common checks
async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require admin role"""
    role = await get_current_user_role(credentials)
    if role != 'ADMIN':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return role


async def require_therapist_or_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require therapist or admin role"""
    role = await get_current_user_role(credentials)
    if role not in ['THERAPIST', 'ADMIN']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Therapist or admin access required"
        )
    return role


async def get_current_user_with_role(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user ID and role"""
    try:
        token = credentials.credentials
        supabase = get_supabase_client()
        
        user = supabase.auth.get_user(token)
        if not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        profile = supabase.table('user_profiles').select('role').eq('id', user.user.id).single().execute()
        
        return {
            'user_id': user.user.id,
            'role': profile.data['role'] if profile.data else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")