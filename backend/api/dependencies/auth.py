"""
Simplified authentication dependencies.
JWT validation only - all authorization handled by RLS.

Following KISS principle: Keep authentication simple, let database handle authorization.
"""
from typing import Dict, Optional
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database.supabase_client import get_supabase_client

# Single security scheme for all endpoints
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, str]:
    """
    Extract and validate JWT token.
    Returns user data or raises 401.
    
    No role checking - RLS handles all authorization.
    This is a thin authentication layer only.
    
    Returns:
        dict: User info with id, email, and token for RLS
    
    Raises:
        HTTPException: 401 if token is invalid
    """
    try:
        token = credentials.credentials
        supabase = get_supabase_client()
        
        # Validate token with Supabase
        user_response = supabase.auth.get_user(token)
        
        if not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        
        # Return minimal user info needed
        # Token is passed through for RLS enforcement
        return {
            'id': user_response.user.id,
            'email': user_response.user.email,
            'token': token  # Critical: Pass token for RLS
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Any other error is an auth failure
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, str]]:
    """
    Optional authentication for endpoints that work with or without auth.
    
    Returns:
        dict: User info if authenticated, None otherwise
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


# That's it! No role checking, no complex logic.
# Trust Supabase and RLS for all authorization decisions.