"""Shared test configuration and fixtures.

This module provides a single source of truth for FastAPI app imports
across all test files, eliminating code duplication and import complexity.

Additionally provides robust C3D sample file management to ensure reliable
testing with actual C3D data across all test scenarios.
"""

import os
import sys
import shutil
import importlib.util
from pathlib import Path
from typing import List, Optional, Generator
import pytest

# Configure test environment settings before any imports
# Disable file hash deduplication for testing to allow repeatable E2E tests
os.environ.setdefault("ENABLE_FILE_HASH_DEDUPLICATION", "false")


def get_fastapi_app():
    """Get FastAPI app with robust import handling.
    
    Returns:
        FastAPI: The application instance
        
    Raises:
        ImportError: If the app cannot be imported after all attempts
    """
    # Method 1: Simple direct import (works in most cases)
    try:
        from api.main import app
        return app
    except ImportError as e:
        # Method 2: Explicit path-based import for CI/test environments
        try:
            backend_dir = Path(__file__).parent.parent  # tests -> backend
            api_main_path = backend_dir / "api" / "main.py"
            
            if api_main_path.exists():
                spec = importlib.util.spec_from_file_location("api.main", api_main_path)
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                    return module.app
                else:
                    raise ImportError("Could not create module spec")
            else:
                raise ImportError(f"api/main.py not found at {api_main_path}")
                
        except Exception as fallback_error:
            # Comprehensive error with context
            raise ImportError(
                f"Could not import FastAPI app after all attempts:\n"
                f"  Direct import error: {e}\n"
                f"  Fallback import error: {fallback_error}\n"
                f"  Backend directory: {Path(__file__).parent.parent}\n"
                f"  Working directory: {Path.cwd()}\n"
                f"  Python path: {sys.path[:3]}"
            ) from e


# Create the app instance once for all tests
# This will be imported by all test files
app = get_fastapi_app()


# =====================================================
# C3D Sample File Management
# =====================================================

class TestSampleManager:
    """
    Centralized manager for C3D sample files.
    
    Ensures reliable access to sample files across all tests with fallback
    location resolution and automatic copying when needed.
    """
    
    SAMPLE_FILENAME = "Ghostly_Emg_20230321_17-50-17-0881.c3d"
    
    @classmethod
    def get_primary_sample_path(cls) -> Path:
        """Get the primary backend test samples path."""
        return Path(__file__).parent / "samples" / cls.SAMPLE_FILENAME
    
    @classmethod
    def get_fallback_locations(cls) -> List[Path]:
        """Get list of fallback locations to search for sample files."""
        project_root = Path(__file__).resolve().parents[2]
        
        return [
            # Frontend samples (most likely to exist)
            project_root / "frontend" / "public" / "samples" / cls.SAMPLE_FILENAME,
            project_root / "frontend" / "src" / "tests" / "samples" / cls.SAMPLE_FILENAME,
            project_root / "frontend" / "build" / "samples" / cls.SAMPLE_FILENAME,
            # Backend samples
            project_root / "backend" / "tests" / "samples" / cls.SAMPLE_FILENAME,
        ]
    
    @classmethod
    def ensure_sample_file_exists(cls) -> Path:
        """
        Ensure sample file exists in primary location, copying from fallback if needed.
        
        Returns:
            Path: Absolute path to the existing sample file
            
        Raises:
            FileNotFoundError: If no sample file can be found in any location
        """
        primary_path = cls.get_primary_sample_path()
        
        # Check if primary location already exists
        if primary_path.exists():
            return primary_path.resolve()
        
        # Ensure directory exists
        primary_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Search fallback locations
        for fallback_path in cls.get_fallback_locations():
            if fallback_path.exists():
                # Copy from fallback to primary location
                shutil.copy2(fallback_path, primary_path)
                print(f"✅ Sample file copied from {fallback_path} to {primary_path}")
                return primary_path.resolve()
        
        # No file found anywhere
        raise FileNotFoundError(
            f"Sample file '{cls.SAMPLE_FILENAME}' not found in any location.\n"
            f"Searched locations:\n" +
            f"  Primary: {primary_path}\n" +
            "\n".join(f"  Fallback: {loc}" for loc in cls.get_fallback_locations())
        )
    
    @classmethod
    def get_file_size(cls) -> int:
        """Get the expected file size of the sample file."""
        sample_path = cls.ensure_sample_file_exists()
        return sample_path.stat().st_size


@pytest.fixture
def sample_c3d_file() -> Path:
    """
    Provide path to C3D sample file, ensuring it exists.
    
    This fixture guarantees that a valid C3D sample file is available for testing,
    copying from fallback locations if necessary.
    
    Returns:
        Path: Absolute path to the sample C3D file
    """
    return TestSampleManager.ensure_sample_file_exists()


@pytest.fixture
def sample_c3d_info() -> dict:
    """
    Provide information about the sample C3D file.
    
    Returns:
        dict: File information including path, size, and metadata
    """
    sample_path = TestSampleManager.ensure_sample_file_exists()
    
    return {
        "path": sample_path,
        "filename": TestSampleManager.SAMPLE_FILENAME,
        "size": sample_path.stat().st_size,
        "exists": sample_path.exists(),
        "is_readable": os.access(sample_path, os.R_OK)
    }


# =====================================================
# Cleanup Fixtures for Supabase Storage and Database
# =====================================================

@pytest.fixture
def cleanup_supabase_test_files():
    """Fixture to clean up test files from Supabase Storage.
    
    Usage:
        Pass a list to track files to cleanup, then the fixture
        will automatically delete them after the test completes.
        
    Example:
        def test_something(cleanup_supabase_test_files):
            files_to_cleanup = cleanup_supabase_test_files
            # Upload a test file
            files_to_cleanup.append("bucket/path/to/file.c3d")
            # ... run test ...
            # Files will be automatically deleted after test
    """
    from database.supabase_client import get_supabase_client
    
    # List to track files that need cleanup
    files_to_cleanup: List[str] = []
    
    # Provide the list to the test
    yield files_to_cleanup
    
    # Cleanup after test completes
    if files_to_cleanup:
        try:
            client = get_supabase_client(use_service_key=True)
            
            # Group files by bucket for efficient cleanup
            files_by_bucket = {}
            for file_path in files_to_cleanup:
                # Parse bucket from path (format: bucket/path/to/file)
                if "/" in file_path:
                    parts = file_path.split("/", 1)
                    bucket = parts[0]
                    path = parts[1] if len(parts) > 1 else ""
                    
                    if bucket not in files_by_bucket:
                        files_by_bucket[bucket] = []
                    files_by_bucket[bucket].append(path)
            
            # Delete files from each bucket
            for bucket, paths in files_by_bucket.items():
                try:
                    result = client.storage.from_(bucket).remove(paths)
                    print(f"🧹 Cleaned {len(paths)} test files from bucket '{bucket}'")
                except Exception as e:
                    print(f"⚠️ Could not clean files from bucket '{bucket}': {e}")
                    
        except Exception as e:
            print(f"⚠️ Cleanup warning: Could not connect to Supabase: {e}")


@pytest.fixture
def cleanup_database_records():
    """Fixture to clean up test database records.
    
    Usage:
        Pass a list of session IDs to track, then the fixture
        will automatically delete all related records after the test.
        
    Example:
        def test_something(cleanup_database_records):
            sessions_to_cleanup = cleanup_database_records
            # Create a test session
            session_id = create_test_session()
            sessions_to_cleanup.append(session_id)
            # ... run test ...
            # Database records will be automatically deleted after test
    """
    from database.supabase_client import get_supabase_client
    
    # List to track session IDs that need cleanup
    sessions_to_cleanup: List[str] = []
    
    # Provide the list to the test
    yield sessions_to_cleanup
    
    # Cleanup after test completes
    if sessions_to_cleanup:
        try:
            client = get_supabase_client(use_service_key=True)
            
            for session_id in sessions_to_cleanup:
                try:
                    # Clean up in reverse dependency order
                    tables_to_clean = [
                        "performance_scores",
                        "emg_statistics", 
                        "bfr_monitoring",  # Correct table name (not bfr_monitoring_per_channel)
                        "session_settings",
                        # c3d_metadata and c3d_technical_data tables removed - data now in therapy_sessions JSONB
                        "therapy_sessions"  # Parent table last
                    ]
                    
                    for table in tables_to_clean:
                        try:
                            if table == "therapy_sessions":
                                result = client.table(table).delete().eq("id", session_id).execute()
                            else:
                                result = client.table(table).delete().eq("session_id", session_id).execute()
                            
                            if result.data:
                                print(f"🧹 Cleaned {len(result.data)} records from {table}")
                        except Exception as table_error:
                            # Table might not exist in all database schemas, which is expected
                            # Log it silently to avoid noise in test output
                            continue
                    
                    print(f"✅ Database cleanup completed for session {session_id}")
                    
                except Exception as e:
                    print(f"⚠️ Could not clean session {session_id}: {e}")
                    
        except Exception as e:
            print(f"⚠️ Database cleanup warning: {e}")


@pytest.fixture
def auto_cleanup_test_artifacts(cleanup_supabase_test_files, cleanup_database_records):
    """Combined fixture that provides both storage and database cleanup.
    
    Returns a tuple of (files_list, sessions_list) for tracking artifacts.
    
    Example:
        def test_complete_workflow(auto_cleanup_test_artifacts):
            files, sessions = auto_cleanup_test_artifacts
            
            # Track files to cleanup
            files.append("c3d-examples/test.c3d")
            
            # Track sessions to cleanup
            session_id = create_session()
            sessions.append(session_id)
            
            # Everything will be cleaned up automatically after test
    """
    return cleanup_supabase_test_files, cleanup_database_records


# =====================================================
# Shared Mock Fixtures for Testing
# =====================================================

@pytest.fixture
def mock_therapy_processor():
    """Shared fixture providing properly configured TherapySessionProcessor.
    
    This fixture follows the DRY principle by providing a single source of truth
    for processor mock configuration across all integration tests.
    
    Returns:
        TherapySessionProcessor: Processor with properly configured mocks
    """
    from unittest.mock import AsyncMock, MagicMock
    from uuid import uuid4
    from services.clinical.therapy_session_processor import TherapySessionProcessor
    
    # Configure performance service with async methods
    mock_performance_service = AsyncMock()
    mock_performance_service.calculate_session_performance.return_value = {
        "session_id": str(uuid4()),
        "scoring_config_id": str(uuid4()),  # Required field
        "overall_score": 85.0,
        "compliance_score": 88.0,
        "strength_score": 87.5,
        "endurance_score": 86.0
    }
    
    # Configure cache service with async methods
    mock_cache_service = AsyncMock()
    mock_cache_service.set_json.return_value = True
    mock_cache_service.set_session_analytics.return_value = True
    mock_cache_service.get_json.return_value = None  # Default: no cached data
    
    # Configure Supabase client with proper response structure
    # Critical: Must return error=None, not a MagicMock object
    mock_supabase_client = MagicMock()
    mock_table = MagicMock()
    
    # Create proper response object
    mock_response = MagicMock()
    mock_response.error = None  # Critical: Set to None, not MagicMock
    mock_response.data = [{"id": str(uuid4())}]  # Return sample data
    
    # Configure all table operations
    mock_table.upsert.return_value.execute.return_value = mock_response
    mock_table.insert.return_value.execute.return_value = mock_response
    mock_table.select.return_value.execute.return_value = mock_response
    mock_table.update.return_value.execute.return_value = mock_response
    mock_table.delete.return_value.execute.return_value = mock_response
    
    mock_supabase_client.table.return_value = mock_table
    
    # Create processor with all properly configured mocks
    processor = TherapySessionProcessor(
        c3d_processor=MagicMock(),
        emg_data_repo=MagicMock(),
        session_repo=MagicMock(),
        cache_service=mock_cache_service,
        performance_service=mock_performance_service,
        supabase_client=mock_supabase_client
    )
    
    # Add additional repository attributes that tests expect
    processor.patient_repo = MagicMock()
    processor.user_repo = MagicMock()
    
    return processor


# =====================================================
# Pytest Configuration Hooks
# =====================================================

def pytest_configure(config):
    """
    Pytest configuration hook to validate test setup.
    
    Ensures that critical test dependencies are available before
    running any tests.
    """
    try:
        # Validate sample file availability
        TestSampleManager.ensure_sample_file_exists()
        print(f"✅ Test configuration validated - sample file available")
        
    except FileNotFoundError as e:
        pytest.exit(f"❌ Test configuration failed: {e}")


def pytest_collection_modifyitems(config, items):
    """
    Modify test collection to add markers for better organization.
    
    This adds automatic markers to tests based on their location,
    enabling better test filtering and organization.
    """
    for item in items:
        # Add markers based on test location
        test_path = str(item.fspath)
        
        if "unit" in test_path:
            item.add_marker(pytest.mark.unit)
        elif "integration" in test_path:
            item.add_marker(pytest.mark.integration)
        elif "e2e" in test_path:
            item.add_marker(pytest.mark.e2e)
            
        if "webhook" in test_path:
            item.add_marker(pytest.mark.webhook)
        if "c3d" in test_path:
            item.add_marker(pytest.mark.c3d)
        if "clinical" in test_path:
            item.add_marker(pytest.mark.clinical)