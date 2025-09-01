"""Shared test configuration and fixtures.

This module provides a single source of truth for FastAPI app imports
across all test files, eliminating code duplication and import complexity.
"""

import os
import sys
import importlib.util
from pathlib import Path


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