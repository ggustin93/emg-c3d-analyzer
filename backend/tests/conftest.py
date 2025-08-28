"""
Pytest configuration for backend tests
Loads environment variables and sets up test fixtures
"""
import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

# Load environment variables from .env file for tests
backend_dir = Path(__file__).parent.parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Ensure test environment is properly configured"""
    # Verify essential environment variables are loaded
    required_vars = ["SUPABASE_URL", "SUPABASE_ANON_KEY"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        pytest.skip(f"Missing required environment variables: {missing_vars}")

    yield

    # Cleanup after tests (if needed)
