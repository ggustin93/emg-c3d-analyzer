"""Supabase client configuration for the EMG C3D Analyzer
Provides centralized database connection management.
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


def get_supabase_client(use_service_key: bool = False) -> Client:
    """Get or create Supabase client instance.

    Args:
        use_service_key: If True, use service key for admin operations (bypasses RLS)

    Returns:
        Configured Supabase client

    Raises:
        ValueError: If environment variables are not set
    """
    global _supabase_client

    if _supabase_client is None or use_service_key:
        # Get configuration from environment
        supabase_url = os.getenv("SUPABASE_URL")

        if use_service_key:
            supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
            key_type = "service"
        else:
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            key_type = "anon"

        if not supabase_url or not supabase_key:
            missing_key = "SUPABASE_SERVICE_KEY" if use_service_key else "SUPABASE_ANON_KEY"
            raise ValueError(f"SUPABASE_URL and {missing_key} environment variables must be set")

        try:
            client = create_client(supabase_url, supabase_key)
            if not use_service_key:
                _supabase_client = client
            logger.info(f"Supabase client initialized successfully with {key_type} key")
            return client

        except Exception as e:
            logger.exception(f"Failed to initialize Supabase client: {e!s}")
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
