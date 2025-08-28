"""API Routes Module
================

Modular route definitions following SOLID principles.
Each route module has single responsibility.
"""

# Route modules available for import
# Import individual modules as needed to avoid circular imports

__all__ = [
    "analysis",
    "cache_monitoring",
    "export",
    "health",
    "mvc",
    "signals",
    "upload",
    "webhooks"
]
