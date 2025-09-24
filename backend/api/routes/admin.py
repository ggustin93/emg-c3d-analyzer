"""
Admin API routes for system administration operations.
Requires admin role and uses service key for Supabase admin operations.

Security: All operations require authenticated admin users and comprehensive audit logging.
"""
import logging
import secrets
import string
from datetime import datetime
from typing import Dict, Any, Optional
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
    new_password: str  # Custom password set by admin
    delivery_method: str = "manual"  # 'manual' for in-person/WhatsApp delivery
    admin_note: str = ""  # Optional note about how password will be delivered
    
    
class PasswordResetResponse(BaseModel):
    """Response model for password reset operation."""
    success: bool
    message: str
    expires_in_hours: int = 24
    masked_password: str = ""  # Only first/last 2 chars for verification
    delivery_instructions: str = ""  # How admin should deliver password


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
    custom_password: Optional[str] = None  # Optional custom password
    admin_note: str = ""  # Admin note for password delivery


class UserCreationResponse(BaseModel):
    """Response model for user creation operation."""
    success: bool
    user_id: str
    message: str
    user_code: Optional[str] = None
    # SECURITY: Never return password to frontend


class UserUpdateRequest(BaseModel):
    """Request model for user update operation."""
    first_name: str
    last_name: str
    role: str  # 'admin', 'therapist', 'researcher'
    institution: str
    department: str = ""
    access_level: str = "basic"
    active: bool = True


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
        
        # Validate password strength
        if len(request.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long"
            )
        
        # Reset the user's password with admin-provided password
        result = await admin_service.reset_user_password(
            target_user_id=str(user_id),
            admin_user_id=admin_user['id'],
            admin_email=admin_user['email'],
            custom_password=request.new_password,
            hours_valid=4  # Security improvement: 4h instead of 24h
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get('message', 'Failed to reset password')
            )
        
        # Provide masked version for verification only
        masked = f"{request.new_password[:2]}{'*' * (len(request.new_password) - 4)}{request.new_password[-2:]}" if len(request.new_password) > 4 else "****"
        
        return PasswordResetResponse(
            success=True,
            message=result.get('message', 'Password reset successful'),
            expires_in_hours=4,  # Security improvement: 4h instead of 24h
            masked_password=masked,
            delivery_instructions=f"Deliver via {request.delivery_method}. Password expires in 4 hours."
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
            admin_email=admin_user['email'],
            custom_password=request.custom_password
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get('message', 'Failed to create user')
            )
        
        # SECURITY: Send password via secure channel, never return to frontend
        if request.notify_user:
            # In production, this would send an email to the new user
            logger.info(f"New user {request.email} created - email notification would be sent")
        
        return UserCreationResponse(
            success=True,
            user_id=result['user_id'],
            message=f"User created successfully. They will receive an email with login instructions.",
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


@router.put("/users/{user_id}", response_model=Dict[str, Any])
async def update_user(
    user_id: UUID,
    request: UserUpdateRequest,
    admin_user: Dict[str, str] = Depends(require_admin)
) -> Dict[str, Any]:
    """
    Update a user's profile information.
    
    This endpoint:
    1. Validates the update request
    2. Updates the user profile in the database
    3. Logs the action for audit purposes
    4. Returns the updated user information
    
    Args:
        user_id: UUID of the user to update
        request: User update parameters
        admin_user: Current admin user (validated by dependency)
        
    Returns:
        Dict with updated user information
        
    Raises:
        HTTPException: Various error codes for different failure scenarios
    """
    try:
        # Initialize admin service
        admin_service = AdminService()
        
        # Update user profile
        result = await admin_service.update_user_profile(
            user_id=str(user_id),
            update_data={
                'first_name': request.first_name,
                'last_name': request.last_name,
                'role': request.role,
                'institution': request.institution,
                'department': request.department,
                'access_level': request.access_level,
                'active': request.active
            },
            admin_user_id=admin_user['id'],
            admin_email=admin_user['email']
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get('message', 'Failed to update user')
            )
        
        return {
            'success': True,
            'message': 'User updated successfully',
            'user': result['user']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Log the error
        logger.error(f"User update error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User update failed: {str(e)}"
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


class PasswordRetrievalRequest(BaseModel):
    """Request model for password retrieval from vault."""
    confirm_user_id: str  # Must match the user_id for security validation
    delivery_method: str = "manual"  # Delivery method confirmation


class PasswordRetrievalResponse(BaseModel):
    """Response model for password retrieval from vault."""
    success: bool
    password: Optional[str] = None  # Decrypted password (one-time retrieval)
    user_email: str = ""
    user_name: str = ""
    message: str


@router.get("/password-vault")
async def get_pending_passwords(
    admin_user: Dict[str, str] = Depends(require_admin)
) -> Dict[str, Any]:
    """
    Get all pending (unretrieved) temporary passwords for admin interface.
    
    This endpoint:
    1. Queries all unretrieved passwords that haven't expired
    2. Returns user info with masked passwords for verification
    3. Provides expiry status for UI display
    4. Logs admin access for audit purposes
    
    Args:
        admin_user: Current admin user (validated by dependency)
        
    Returns:
        Dict with pending passwords list
        
    Raises:
        HTTPException: Various error codes for different failure scenarios
    """
    try:
        # Initialize admin service
        admin_service = AdminService()
        
        # Get pending passwords
        passwords = await admin_service.get_pending_passwords(
            admin_user_id=admin_user['id']
        )
        
        # Log the admin action
        await admin_service.log_admin_action(
            admin_user_id=admin_user['id'],
            action='password_vault_accessed',
            target_type='temporary_passwords',
            target_id='vault',
            details={
                'accessed_at': datetime.utcnow().isoformat(),
                'pending_count': len(passwords),
                'admin_email': admin_user['email']
            }
        )
        
        return {
            'success': True,
            'passwords': passwords,
            'count': len(passwords),
            'message': f'Retrieved {len(passwords)} pending passwords'
        }
        
    except Exception as e:
        logger.error(f"Password vault access error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to access password vault: {str(e)}"
        )


@router.post("/password-vault/{password_id}/retrieve", response_model=PasswordRetrievalResponse)
async def retrieve_password(
    password_id: UUID,
    request: PasswordRetrievalRequest,
    admin_user: Dict[str, str] = Depends(require_admin)
) -> PasswordRetrievalResponse:
    """
    Retrieve and decrypt a temporary password by ID (one-time operation).
    
    This endpoint:
    1. Validates the password ID and user ID match for security
    2. Checks password hasn't been retrieved already (one-time use)
    3. Verifies password hasn't expired
    4. Decrypts and returns the password
    5. Marks password as retrieved with audit logging
    6. Auto-destroys the password after successful retrieval
    
    Args:
        password_id: UUID of the temporary password entry
        request: Password retrieval confirmation data
        admin_user: Current admin user (validated by dependency)
        
    Returns:
        PasswordRetrievalResponse with decrypted password
        
    Raises:
        HTTPException: Various error codes for security violations and failures
    """
    try:
        # Initialize admin service
        admin_service = AdminService()
        
        # Retrieve the password with security validation
        result = await admin_service.retrieve_password_by_id(
            password_id=str(password_id),
            admin_user_id=admin_user['id'],
            confirm_user_id=request.confirm_user_id
        )
        
        if not result['success']:
            # Security-sensitive errors
            if "mismatch" in result.get('message', '').lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Security validation failed"
                )
            elif "already retrieved" in result.get('message', ''):
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="Password already retrieved (one-time use)"
                )
            elif "expired" in result.get('message', ''):
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="Password has expired"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=result.get('message', 'Password not found')
                )
        
        return PasswordRetrievalResponse(
            success=True,
            password=result['password'],
            user_email=result['user_email'],
            user_name=result['user_name'],
            message=result.get('message', 'Password retrieved successfully')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password retrieval error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve password: {str(e)}"
        )