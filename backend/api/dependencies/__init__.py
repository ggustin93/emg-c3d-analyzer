"""API Dependencies Module.
======================

Dependency injection components for FastAPI routes.
Implements SOLID principles with clean dependency management.
"""

# from .services import get_c3d_processor, get_mvc_service, get_export_service # TODO: Restore when export service is implemented
from backend.api.dependencies.services import get_c3d_processor, get_mvc_service
from backend.api.dependencies.validation import get_processing_options, get_session_parameters

__all__ = [
    "get_c3d_processor",
    "get_mvc_service",
    "get_processing_options",
    "get_session_parameters",
    # "get_export_service" # TODO: Restore when export service is implemented
]
