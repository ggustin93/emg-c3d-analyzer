"""
Admin service for system administration operations.
Uses service key for Supabase admin operations.

Security: Service key operations are isolated here and never exposed to frontend.
"""
import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import base64
from cryptography.fernet import Fernet

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
        admin_email: str,
        custom_password: Optional[str] = None
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
            # Use custom password if provided, otherwise generate temporary password
            temp_password = custom_password if custom_password else self.generate_temporary_password()
            
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
            
            # Create user_profiles record with additional data
            profile_data = {
                'id': user_id,
                'first_name': first_name,
                'last_name': last_name,
                'role': role,
                'institution': institution,
                'department': department,
                'access_level': access_level,
                'user_code': user_code,
                'active': True,  # Auto-validate users upon creation
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            profile_insert = self.supabase.table('user_profiles').insert(profile_data).execute()
            
            if not profile_insert.data:
                # If profile creation fails, clean up the auth user
                try:
                    self.supabase.auth.admin.delete_user(user_id)
                except Exception as cleanup_error:
                    logger.error(f"Failed to cleanup auth user {user_id} after profile creation failure: {cleanup_error}")
                
                return {
                    'success': False,
                    'message': 'Failed to create user profile'
                }
            
            # Store temporary password for admin retrieval (if not custom password)
            password_stored = False
            if not custom_password:
                store_result = await self.store_temporary_password_for_admin(
                    user_id=user_id,
                    user_email=email,
                    user_first_name=first_name,
                    user_last_name=last_name,
                    password=temp_password,
                    admin_user_id=admin_user_id
                )
                password_stored = store_result['success']
            
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
                    'created_by': admin_email,
                    'password_stored_for_retrieval': password_stored
                }
            )
            
            return {
                'success': True,
                'user_id': user_id,
                'temporary_password': temp_password if custom_password else None,  # Only return if custom
                'user_code': user_code,
                'password_stored': password_stored,
                'message': 'User created successfully' + (' - Check Password Vault for retrieval' if password_stored else '')
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
    
    async def update_user_profile(self, user_id: str, update_data: Dict[str, Any], admin_user_id: str, admin_email: str) -> Dict[str, Any]:
        """
        Update a user's profile information.
        
        Args:
            user_id: UUID of the user to update
            update_data: Data to update
            admin_user_id: ID of admin performing the update
            admin_email: Email of admin performing the update
            
        Returns:
            Dict with success status and updated user data
        """
        try:
            # Update user profile in database
            result = self.supabase.table('user_profiles').update({
                **update_data,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', user_id).execute()
            
            if not result.data:
                return {
                    'success': False,
                    'message': 'User not found for update'
                }
            
            updated_user = result.data[0]
            
            # Log the admin action
            await self.log_admin_action(
                admin_user_id=admin_user_id,
                action='user_profile_updated',
                target_type='user_profiles',
                target_id=user_id,
                details={
                    'updated_fields': list(update_data.keys()),
                    'updated_by': admin_email,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
            
            return {
                'success': True,
                'user': updated_user,
                'message': 'User profile updated successfully'
            }
            
        except Exception as e:
            logger.error(f"Failed to update user profile: {str(e)}")
            return {
                'success': False,
                'message': f'Failed to update user profile: {str(e)}'
            }
    
    async def reset_user_password(
        self,
        target_user_id: str,
        admin_user_id: str,
        admin_email: str,
        custom_password: str = None,
        hours_valid: int = 4
    ) -> Dict[str, Any]:
        """
        Reset a user's password and store it securely for admin retrieval.
        
        Args:
            target_user_id: UUID of the user whose password to reset
            admin_user_id: ID of the admin performing the action
            admin_email: Email of the admin (for logging)
            custom_password: Custom password (optional, otherwise generates new one)
            hours_valid: Hours until vault password expires (default 4)
            
        Returns:
            Dict with success status and operation details
        """
        try:
            # Get user info first
            user_info = await self.get_user_info(target_user_id)
            if not user_info:
                return {
                    'success': False,
                    'message': 'User not found'
                }
            
            # Generate or use provided password
            new_password = custom_password if custom_password else self.generate_temporary_password()
            
            # Update password via Supabase admin API
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
            
            if not response.user:
                return {
                    'success': False,
                    'message': 'Failed to reset password via Supabase'
                }
            
            # Store password for admin retrieval (if not custom)
            password_stored = False
            if not custom_password:
                profile = user_info['profile']
                store_result = await self.store_temporary_password_for_admin(
                    user_id=target_user_id,
                    user_email=user_info['auth']['email'],
                    user_first_name=profile['first_name'],
                    user_last_name=profile['last_name'],
                    password=new_password,
                    admin_user_id=admin_user_id,
                    hours_valid=hours_valid
                )
                password_stored = store_result['success']
            
            # Log the admin action
            await self.log_admin_action(
                admin_user_id=admin_user_id,
                action='password_reset',
                target_type='user_profiles',
                target_id=target_user_id,
                details={
                    'reset_by': admin_email,
                    'reset_at': datetime.utcnow().isoformat(),
                    'password_stored_for_retrieval': password_stored,
                    'custom_password_used': custom_password is not None
                }
            )
            
            return {
                'success': True,
                'password_stored': password_stored,
                'temporary_password': new_password if custom_password else None,  # Only return if custom
                'message': 'Password reset successfully' + (' - Check Password Vault for retrieval' if password_stored else '')
            }
            
        except Exception as e:
            logger.error(f"Failed to reset password: {str(e)}")
            return {
                'success': False,
                'message': f'Failed to reset password: {str(e)}'
            }
    
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
    
    def _generate_encryption_key(self) -> bytes:
        """Generate a new encryption key for password storage."""
        return Fernet.generate_key()
    
    def _encrypt_password(self, password: str, key: bytes) -> str:
        """Encrypt a password using Fernet symmetric encryption."""
        fernet = Fernet(key)
        encrypted = fernet.encrypt(password.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    
    def _decrypt_password(self, encrypted_password: str, key: bytes) -> str:
        """Decrypt a password using Fernet symmetric encryption."""
        fernet = Fernet(key)
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_password.encode())
        decrypted = fernet.decrypt(encrypted_bytes)
        return decrypted.decode()
    
    def _create_masked_password(self, password: str) -> str:
        """Create a masked version of the password showing only first and last 2 characters."""
        if len(password) <= 4:
            return "*" * len(password)
        return password[:2] + "*" * (len(password) - 4) + password[-2:]
    
    async def store_temporary_password_for_admin(
        self,
        user_id: str,
        user_email: str,
        user_first_name: str,
        user_last_name: str,
        password: str,
        admin_user_id: str,
        hours_valid: int = 4
    ) -> Dict[str, Any]:
        """
        Store an encrypted temporary password for admin retrieval.
        
        Args:
            user_id: UUID of the user the password is for
            user_email: Email of the user
            user_first_name: First name of the user
            user_last_name: Last name of the user  
            password: Plain text password to store
            admin_user_id: UUID of admin storing the password
            hours_valid: Hours until password expires (default 24)
            
        Returns:
            Dict with success status and password ID
        """
        try:
            # Generate encryption key and encrypt password
            encryption_key = self._generate_encryption_key()
            encrypted_password = self._encrypt_password(password, encryption_key)
            
            # Create masked password for display
            masked_password = self._create_masked_password(password)
            
            # Calculate expiry time
            expires_at = datetime.utcnow() + timedelta(hours=hours_valid)
            
            # Store in database with encryption key embedded in encrypted field
            # Format: base64(key) + ":" + encrypted_password
            key_and_password = base64.urlsafe_b64encode(encryption_key).decode() + ":" + encrypted_password
            
            result = self.supabase.table('temporary_passwords').insert({
                'user_id': user_id,
                'user_email': user_email,
                'user_first_name': user_first_name,
                'user_last_name': user_last_name,
                'password_encrypted': key_and_password,
                'masked_password': masked_password,
                'delivery_method': 'manual',
                'expires_at': expires_at.isoformat(),
                'created_by': admin_user_id,
                'admin_note': f'Password for {user_first_name} {user_last_name} ({user_email})'
            }).execute()
            
            if not result.data:
                return {
                    'success': False,
                    'message': 'Failed to store temporary password'
                }
            
            password_id = result.data[0]['id']
            
            # Log the admin action
            await self.log_admin_action(
                admin_user_id=admin_user_id,
                action='temporary_password_created',
                target_type='temporary_passwords',
                target_id=password_id,
                details={
                    'user_email': user_email,
                    'expires_at': expires_at.isoformat(),
                    'delivery_method': 'manual'
                }
            )
            
            return {
                'success': True,
                'password_id': password_id,
                'expires_at': expires_at.isoformat(),
                'message': 'Temporary password stored successfully'
            }
            
        except Exception as e:
            logger.error(f"Failed to store temporary password: {str(e)}")
            return {
                'success': False,
                'message': f'Failed to store temporary password: {str(e)}'
            }
    
    async def get_pending_passwords(self, admin_user_id: str) -> List[Dict[str, Any]]:
        """
        Get all pending (unretrieved) temporary passwords for admin interface.
        
        Args:
            admin_user_id: UUID of requesting admin (for authorization)
            
        Returns:
            List of pending password entries with user info
        """
        try:
            # Query unretrieved passwords that haven't expired
            result = self.supabase.table('temporary_passwords') \
                .select('id, user_id, user_email, user_first_name, user_last_name, masked_password, delivery_method, created_at, expires_at') \
                .is_('retrieved_at', 'null') \
                .gt('expires_at', datetime.utcnow().isoformat()) \
                .order('created_at', desc=True) \
                .execute()
            
            if not result.data:
                return []
            
            # Format response for frontend
            pending_passwords = []
            for password_entry in result.data:
                pending_passwords.append({
                    'id': password_entry['id'],
                    'user_id': password_entry['user_id'],
                    'user_email': password_entry['user_email'],
                    'user_name': f"{password_entry['user_first_name']} {password_entry['user_last_name']}",
                    'masked_password': password_entry['masked_password'],
                    'delivery_method': password_entry['delivery_method'],
                    'created_at': password_entry['created_at'],
                    'expires_at': password_entry['expires_at'],
                    'retrieved': False
                })
            
            return pending_passwords
            
        except Exception as e:
            logger.error(f"Failed to get pending passwords: {str(e)}")
            return []
    
    async def retrieve_password_by_id(
        self,
        password_id: str,
        admin_user_id: str,
        confirm_user_id: str
    ) -> Dict[str, Any]:
        """
        Retrieve and decrypt a temporary password by ID (one-time operation).
        
        Args:
            password_id: UUID of the temporary password entry
            admin_user_id: UUID of admin retrieving the password
            confirm_user_id: UUID to confirm this is for the right user
            
        Returns:
            Dict with decrypted password or error message
        """
        try:
            # Get the password entry
            result = self.supabase.table('temporary_passwords') \
                .select('*') \
                .eq('id', password_id) \
                .single() \
                .execute()
            
            if not result.data:
                return {
                    'success': False,
                    'message': 'Password not found'
                }
            
            password_entry = result.data
            
            # Security checks
            if password_entry['user_id'] != confirm_user_id:
                return {
                    'success': False,
                    'message': 'User ID mismatch - security violation'
                }
            
            if password_entry['retrieved_at']:
                return {
                    'success': False,
                    'message': 'Password already retrieved'
                }
            
            # Check expiry
            expires_at = datetime.fromisoformat(password_entry['expires_at'].replace('Z', '+00:00'))
            if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
                return {
                    'success': False,
                    'message': 'Password has expired'
                }
            
            # Decrypt password
            key_and_password = password_entry['password_encrypted']
            key_b64, encrypted_password = key_and_password.split(':', 1)
            encryption_key = base64.urlsafe_b64decode(key_b64.encode())
            
            decrypted_password = self._decrypt_password(encrypted_password, encryption_key)
            
            # Mark as retrieved (one-time use)
            self.supabase.table('temporary_passwords') \
                .update({
                    'retrieved_at': datetime.utcnow().isoformat(),
                    'retrieved_by': admin_user_id
                }) \
                .eq('id', password_id) \
                .execute()
            
            # Log the admin action
            await self.log_admin_action(
                admin_user_id=admin_user_id,
                action='temporary_password_retrieved',
                target_type='temporary_passwords',
                target_id=password_id,
                details={
                    'user_email': password_entry['user_email'],
                    'retrieved_at': datetime.utcnow().isoformat(),
                    'delivery_method': password_entry['delivery_method']
                }
            )
            
            return {
                'success': True,
                'password': decrypted_password,
                'user_email': password_entry['user_email'],
                'user_name': f"{password_entry['user_first_name']} {password_entry['user_last_name']}",
                'message': 'Password retrieved successfully'
            }
            
        except Exception as e:
            logger.error(f"Failed to retrieve password: {str(e)}")
            return {
                'success': False,
                'message': f'Failed to retrieve password: {str(e)}'
            }