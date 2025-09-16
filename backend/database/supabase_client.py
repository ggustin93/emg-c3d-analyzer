"""Supabase client configuration for the EMG C3D Analyzer
Provides centralized database connection management.

IMPORTANT: This project uses the SYNCHRONOUS Supabase Python client.
- All database operations are synchronous (no async/await needed)
- Service methods using this client should be regular functions, not async
- For testing, use Mock from unittest.mock, not AsyncMock
- This follows KISS principle - keeping it simple without unnecessary async complexity
"""

import logging
import os

# Load environment variables from .env file
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

# Global client instance
_supabase_client: Client | None = None


def get_supabase_client(use_service_key: bool = False, jwt_token: str | None = None) -> Client:
    """Get or create Supabase client instance.

    Args:
        use_service_key: If True, use service key for admin operations (bypasses RLS)
        jwt_token: User's JWT token for authenticated requests (respects RLS)

    Returns:
        Configured Supabase client

    Raises:
        ValueError: If environment variables are not set
    """
    global _supabase_client

    # If a JWT token is provided, create an authenticated client (don't cache it)
    if jwt_token:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set")
        
        try:
            # Create client with custom headers that include the user's JWT
            from supabase._sync.client import ClientOptions
            
            client = create_client(
                supabase_url, 
                supabase_key,
                options=ClientOptions(
                    headers={
                        'Authorization': f'Bearer {jwt_token}'
                    }
                )
            )
            logger.debug("Created authenticated Supabase client with user JWT headers")
            return client
        except Exception as e:
            logger.error(f"Failed to create authenticated Supabase client: {e!s}")
            raise

    if _supabase_client is None or use_service_key:
        # Get configuration from environment
        supabase_url = os.getenv("SUPABASE_URL")

        if use_service_key:
            supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
            key_type = "service"
        else:
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            key_type = "anon"

        # Enhanced logging for Coolify debugging
        logger.info(f"Attempting Supabase connection (key_type={key_type})...")
        logger.info(f"URL format check: {supabase_url[:30]}..." if supabase_url else "URL is None")
        logger.info(f"Key exists: {bool(supabase_key)}, Key length: {len(supabase_key) if supabase_key else 0}")

        if not supabase_url or not supabase_key:
            missing_key = "SUPABASE_SERVICE_KEY" if use_service_key else "SUPABASE_ANON_KEY"
            logger.error(f"Missing environment variables: URL={bool(supabase_url)}, {missing_key}={bool(supabase_key)}")
            raise ValueError(f"SUPABASE_URL and {missing_key} environment variables must be set")

        try:
            client = create_client(supabase_url, supabase_key)
            if not use_service_key:
                _supabase_client = client
            logger.info(f"Supabase client initialized successfully with {key_type} key")
            return client

        except Exception as e:
            # Enhanced error logging for debugging initialization issues
            logger.error(f"Failed to initialize Supabase client: {e!s}")
            logger.error(f"  URL: {supabase_url}")
            logger.error(f"  Key type: {key_type}")
            logger.error(f"  Key present: {'Yes' if supabase_key else 'No'}")
            logger.error(f"  Key length: {len(supabase_key) if supabase_key else 0}")
            
            # The "Invalid URL" error typically occurs during first import attempts
            # This is expected behavior and the system will retry successfully
            if "Invalid URL" in str(e):
                logger.info("Note: 'Invalid URL' during first initialization is expected - system will retry")
            
            raise

    return _supabase_client


def reset_client():
    """Reset the global client instance (mainly for testing)."""
    global _supabase_client
    _supabase_client = None


class SupabaseConnectionError(Exception):
    """Raised when Supabase connection fails."""


def test_connection() -> bool:
    """Test the Supabase connection.

    Returns:
        True if connection is successful, False otherwise
    """
    try:
        client = get_supabase_client()

        # Try a simple query to test the connection
        result = client.table("c3d_metadata").select("count", count="exact").limit(0).execute()

        logger.info("Supabase connection test successful")
        return True

    except Exception as e:
        logger.exception(f"Supabase connection test failed: {e!s}")
        return False
