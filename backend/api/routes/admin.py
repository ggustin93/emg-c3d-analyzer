"""
Admin API routes for system administration operations.
Requires admin role and uses service key for Supabase admin operations.

Security: All operations require authenticated admin users and comprehensive audit logging.
"""
import logging
import secrets
import string
from datetime import datetime
from typing import Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from api.dependencies.auth import get_current_user
from database.supabase_client import get_supabase_client
from services.admin.admin_service import AdminService

router = APIRouter()


class PasswordResetRequest(BaseModel):
    """Request model for password reset operation."""
    notify_user: bool = False  # Optional: send email notification
    
    
class PasswordResetResponse(BaseModel):
    """Response model for password reset operation."""
    success: bool
    temporary_password: str
    message: str
    expires_in_hours: int = 24


class UserCreationRequest(BaseModel):
    """Request model for user creation operation."""
    email: str
    first_name: str
    last_name: str
    role: str  # 'admin', 'therapist', 'researcher'
    institution: str
    department: str = ""
    access_level: str = "basic"
    notify_user: bool = False


class UserCreationResponse(BaseModel):
    """Response model for user creation operation."""
    success: bool
    user_id: str
    temporary_password: str
    message: str
    user_code: str = None


async def require_admin(user: Dict[str, str] = Depends(get_current_user)) -> Dict[str, str]:
    """
    Dependency to require admin role for protected endpoints.
    
    Args:
        user: Current authenticated user from JWT
        
    Returns:
        User dict if admin
        
    Raises:
        HTTPException: 403 if not admin
    """
    # Get user role from Supabase using their token
    supabase = get_supabase_client(jwt_token=user['token'])
    
    try:
        # Query user_profiles table for role
        result = supabase.table('user_profiles').select('role').eq('id', user['id']).single().execute()
        
        if not result.data or result.data.get('role') != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
            
        return user
        
    except Exception as e:
        if "403" not in str(e):  # Not a forbidden error
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to verify admin role: {str(e)}"
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


@router.post("/users/{user_id}/reset-password", response_model=PasswordResetResponse)
async def reset_user_password(
    user_id: UUID,
    request: PasswordResetRequest,
    admin_user: Dict[str, str] = Depends(require_admin)
) -> PasswordResetResponse:
    """
    Reset a user's password with a temporary password.
    
    This endpoint:
    1. Generates a secure temporary password
    2. Updates the user's password using Supabase admin API
    3. Logs the action for audit purposes
    4. Returns the temporary password for the admin to share
    
    Args:
        user_id: UUID of the user whose password to reset
        request: Password reset options
        admin_user: Current admin user (validated by dependency)
        
    Returns:
        PasswordResetResponse with temporary password
        
    Raises:
        HTTPException: Various error codes for different failure scenarios
    """
    try:
        # Initialize admin service with service key
        admin_service = AdminService()
        
        # Generate secure temporary password
        temp_password = admin_service.generate_temporary_password()
        
        # Reset the user's password
        success = await admin_service.reset_user_password(
            target_user_id=str(user_id),
            new_password=temp_password,
            admin_user_id=admin_user['id'],
            admin_email=admin_user['email']
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reset password"
            )
        
        # Log the admin action
        await admin_service.log_admin_action(
            admin_user_id=admin_user['id'],
            action="password_reset",
            target_type="user_profiles",
            target_id=str(user_id),
            details={
                "method": "temporary_password",
                "notify_user": request.notify_user,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        return PasswordResetResponse(
            success=True,
            temporary_password=temp_password,
            message=f"Password reset successful. Share this temporary password securely with the user.",
            expires_in_hours=24
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Log the error
        logger.error(f"Password reset error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset failed: {str(e)}"
        )


@router.post("/users", response_model=UserCreationResponse)
async def create_user(
    request: UserCreationRequest,
    admin_user: Dict[str, str] = Depends(require_admin)
) -> UserCreationResponse:
    """
    Create a new user with auth entry and profile.
    
    This endpoint:
    1. Generates a secure temporary password
    2. Creates auth user with service key
    3. Ensures user_profiles record is created
    4. Logs the action for audit purposes
    5. Returns user info with temporary password
    
    Args:
        request: User creation parameters
        admin_user: Current admin user (validated by dependency)
        
    Returns:
        UserCreationResponse with user ID and temporary password
        
    Raises:
        HTTPException: Various error codes for different failure scenarios
    """
    try:
        # Initialize admin service with service key
        admin_service = AdminService()
        
        # Create user with profile
        result = await admin_service.create_user_with_profile(
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name,
            role=request.role,
            institution=request.institution,
            department=request.department,
            access_level=request.access_level,
            admin_user_id=admin_user['id'],
            admin_email=admin_user['email']
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get('message', 'Failed to create user')
            )
        
        return UserCreationResponse(
            success=True,
            user_id=result['user_id'],
            temporary_password=result['temporary_password'],
            message=f"User created successfully. Share this temporary password securely with the user.",
            user_code=result.get('user_code')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Log the error
        logger.error(f"User creation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User creation failed: {str(e)}"
        )


@router.get("/users/{user_id}/audit-log")
async def get_user_audit_log(
    user_id: UUID,
    limit: int = 50,
    admin_user: Dict[str, str] = Depends(require_admin)
) -> Dict[str, Any]:
    """
    Get audit log entries for a specific user.
    
    Args:
        user_id: UUID of the user to get audit logs for
        limit: Maximum number of entries to return
        admin_user: Current admin user
        
    Returns:
        Dict with audit log entries
    """
    try:
        admin_service = AdminService()
        
        logs = await admin_service.get_audit_logs_for_target(
            target_type="user_profiles",
            target_id=str(user_id),
            limit=limit
        )
        
        return {
            "success": True,
            "count": len(logs),
            "audit_logs": logs
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch audit logs: {str(e)}"
        )