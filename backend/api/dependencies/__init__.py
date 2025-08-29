"""API Dependencies Module.

======================

Dependency injection components for FastAPI routes.
Implements SOLID principles with clean dependency management.
"""

# Export service integration pending - clean domain separation maintained
from api.dependencies.services import get_c3d_processor, get_mvc_service
from api.dependencies.validation import get_processing_options, get_session_parameters

__all__ = [
    "get_c3d_processor",
    "get_mvc_service",
    "get_processing_options",
    "get_session_parameters",
    # "get_export_service" # Export service pending - domain-driven implementation planned
]
