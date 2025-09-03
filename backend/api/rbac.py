"""
RBAC (Role-Based Access Control) for EMG C3D Analyzer

Simplified authentication layer that validates JWT tokens and extracts user roles.
All authorization is handled by Supabase database RLS (Row Level Security) policies.

The backend serves as a thin authentication layer - database RLS is the single 
source of truth for permission enforcement.
"""
from typing import Dict, Optional
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database.supabase_client import get_supabase_client

security = HTTPBearer()


async def get_current_user_role(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[str]:
    """
    Extract user role from Supabase JWT token.
    
    This function only handles authentication (JWT validation) and role extraction.
    Authorization is handled by database RLS policies.
    """
    try:
        token = credentials.credentials
        supabase = get_supabase_client()
        
        # Validate JWT token and get user
        user = supabase.auth.get_user(token)
        if not user.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        
        # Get role from user_profiles table
        # Note: If user can't access this, RLS will handle the authorization
        profile = supabase.table('user_profiles').select('role').eq('id', user.user.id).single().execute()
        
        if not profile.data:
            # Return None if no profile found - RLS will handle access control
            return None
        
        return profile.data['role']
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )


async def get_current_user_with_role(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, str]:
    """
    Get current user ID and role from JWT token.
    
    Returns both user_id and role for endpoints that need user context.
    Authorization is still handled by database RLS policies.
    """
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


# Note: Audit logging is now handled by database triggers and RLS policies
# No separate RBACChecker class needed - database is the single source of truth


# Convenience functions for role-based dependency injection
# Note: These functions only validate authentication and extract roles.
# Actual authorization (what resources users can access) is handled by database RLS policies.

async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Require admin role for endpoint access.
    
    This provides basic role checking, but fine-grained authorization 
    (like which specific records can be accessed) is handled by RLS policies.
    """
    role = await get_current_user_role(credentials)
    if role != 'ADMIN':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return role


async def require_therapist_or_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Require therapist or admin role for endpoint access.
    
    This provides basic role checking, but fine-grained authorization 
    (like which specific patients/sessions can be accessed) is handled by RLS policies.
    """
    role = await get_current_user_role(credentials)
    if role not in ['THERAPIST', 'ADMIN']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Therapist or admin access required"
        )
    return role