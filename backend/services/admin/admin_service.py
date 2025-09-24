"""
Admin service for system administration operations.
Uses service key for Supabase admin operations.

Security: Service key operations are isolated here and never exposed to frontend.
"""
import logging
import secrets
import string
from datetime import datetime
from typing import Dict, Any, List, Optional

from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class AdminService:
    """Service for admin operations requiring elevated privileges."""
    
    def __init__(self):
        """Initialize admin service with service key client."""
        # Use service key for admin operations (bypasses RLS)
        self.supabase = get_supabase_client(use_service_key=True)
        
    def generate_temporary_password(self, length: int = 16) -> str:
        """
        Generate a cryptographically secure temporary password.
        
        Format: Temp-[random]-[random]
        Includes uppercase, lowercase, digits, and special characters.
        
        Args:
            length: Total length of the password
            
        Returns:
            Secure temporary password string
        """
        # Character sets for password generation
        uppercase = string.ascii_uppercase
        lowercase = string.ascii_lowercase
        digits = string.digits
        special = "!@#$%"
        
        # Ensure at least one character from each set
        password_chars = [
            secrets.choice(uppercase),
            secrets.choice(lowercase),
            secrets.choice(digits),
            secrets.choice(special)
        ]
        
        # Fill the rest with random characters from all sets
        all_chars = uppercase + lowercase + digits + special
        remaining_length = length - 4  # We already have 4 chars
        
        for _ in range(remaining_length):
            password_chars.append(secrets.choice(all_chars))
        
        # Shuffle the characters
        secrets.SystemRandom().shuffle(password_chars)
        
        # Format as Temp-XXXX-XXXX-XXXX
        password_str = ''.join(password_chars)
        
        # Split into chunks for readability
        chunks = [password_str[i:i+4] for i in range(0, len(password_str), 4)]
        formatted = f"Temp-{'-'.join(chunks)}"
        
        return formatted
    
    async def create_user_with_profile(
        self,
        email: str,
        first_name: str,
        last_name: str,
        role: str,
        institution: str,
        department: str,
        access_level: str,
        admin_user_id: str,
        admin_email: str
    ) -> Dict[str, Any]:
        """
        Create a new user with auth entry and profile.
        
        Args:
            email: User email address
            first_name: User first name
            last_name: User last name
            role: User role (admin, therapist, researcher)
            institution: User institution
            department: User department
            access_level: User access level
            admin_user_id: ID of admin creating the user
            admin_email: Email of admin creating the user
            
        Returns:
            Dict with success status, user_id, temporary_password, and message
        """
        try:
            # Generate temporary password
            temp_password = self.generate_temporary_password()
            
            # Generate user code
            user_code = f"{role.upper()[0]}{secrets.randbelow(1000):03d}"
            
            # Create auth user with service key
            auth_response = self.supabase.auth.admin.create_user({
                'email': email,
                'password': temp_password,
                'email_confirmed': True,
                'user_metadata': {
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': role,
                    'institution': institution,
                    'department': department,
                    'created_by': admin_email,
                    'created_at': datetime.utcnow().isoformat()
                }
            })
            
            if not auth_response or not auth_response.user:
                return {
                    'success': False,
                    'message': 'Failed to create auth user'
                }
            
            user_id = auth_response.user.id
            
            # Update user_profiles with additional data (trigger creates basic record)
            profile_update = self.supabase.table('user_profiles').update({
                'first_name': first_name,
                'last_name': last_name,
                'role': role,
                'institution': institution,
                'department': department,
                'access_level': access_level,
                'user_code': user_code,
                'active': True,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', user_id).execute()
            
            # Log the admin action
            await self.log_admin_action(
                admin_user_id=admin_user_id,
                action='user_created',
                target_type='user_profiles',
                target_id=user_id,
                details={
                    'email': email,
                    'role': role,
                    'institution': institution,
                    'department': department,
                    'created_by': admin_email
                }
            )
            
            return {
                'success': True,
                'user_id': user_id,
                'temporary_password': temp_password,
                'user_code': user_code,
                'message': 'User created successfully'
            }
            
        except Exception as e:
            logger.error(f"Failed to create user: {str(e)}")
            
            # Try to cleanup if auth user was created but profile update failed
            if 'user_id' in locals():
                try:
                    self.supabase.auth.admin.delete_user(user_id)
                except:
                    pass
            
            return {
                'success': False,
                'message': f'Failed to create user: {str(e)}'
            }
    
    async def reset_user_password(
        self,
        target_user_id: str,
        new_password: str,
        admin_user_id: str,
        admin_email: str
    ) -> bool:
        """
        Reset a user's password using Supabase admin API.
        
        Args:
            target_user_id: UUID of the user whose password to reset
            new_password: New temporary password
            admin_user_id: ID of the admin performing the action
            admin_email: Email of the admin (for logging)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Use Supabase admin API to update the user's password
            # This requires service role key which we have
            response = self.supabase.auth.admin.update_user_by_id(
                uid=target_user_id,
                attributes={
                    'password': new_password,
                    'email_confirmed': True,  # Ensure they can login
                    'user_metadata': {
                        'password_reset_by': admin_email,
                        'password_reset_at': datetime.utcnow().isoformat(),
                        'requires_password_change': True
                    }
                }
            )
            
            return response.user is not None
            
        except Exception as e:
            logger.error(f"Failed to reset password via Supabase admin: {str(e)}")
            return False
    
    async def log_admin_action(
        self,
        admin_user_id: str,
        action: str,
        target_type: str,
        target_id: str,
        details: Dict[str, Any]
    ) -> bool:
        """
        Log an admin action to the audit log.
        
        Args:
            admin_user_id: UUID of the admin performing the action
            action: Type of action performed
            target_type: Type of target (e.g., 'user_profiles')
            target_id: UUID of the target
            details: Additional details about the action
            
        Returns:
            True if logged successfully
        """
        try:
            # Insert audit log entry
            result = self.supabase.table('audit_log').insert({
                'user_id': admin_user_id,
                'user_role': 'admin',
                'action': action,
                'table_name': target_type,
                'record_id': target_id,
                'changes': details,
                'created_at': datetime.utcnow().isoformat()
            }).execute()
            
            return result.data is not None
            
        except Exception as e:
            logger.error(f"Failed to log admin action: {str(e)}")
            # Don't fail the operation if logging fails
            return False
    
    async def get_audit_logs_for_target(
        self,
        target_type: str,
        target_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get audit logs for a specific target.
        
        Args:
            target_type: Type of target (table name)
            target_id: UUID of the target
            limit: Maximum number of entries to return
            
        Returns:
            List of audit log entries
        """
        try:
            result = self.supabase.table('audit_log') \
                .select('*') \
                .eq('table_name', target_type) \
                .eq('record_id', target_id) \
                .order('created_at', desc=True) \
                .limit(limit) \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Failed to fetch audit logs: {str(e)}")
            return []
    
    async def get_user_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user information for admin operations.
        
        Args:
            user_id: UUID of the user
            
        Returns:
            User information dict or None if not found
        """
        try:
            # Get user profile
            profile_result = self.supabase.table('user_profiles') \
                .select('*') \
                .eq('id', user_id) \
                .single() \
                .execute()
            
            if not profile_result.data:
                return None
            
            # Get auth user info using admin API
            auth_user = self.supabase.auth.admin.get_user_by_id(user_id)
            
            return {
                'profile': profile_result.data,
                'auth': {
                    'email': auth_user.user.email if auth_user.user else None,
                    'created_at': auth_user.user.created_at if auth_user.user else None,
                    'last_sign_in': auth_user.user.last_sign_in_at if auth_user.user else None,
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get user info: {str(e)}")
            return None