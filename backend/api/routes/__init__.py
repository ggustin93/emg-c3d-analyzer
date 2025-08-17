"""
API Routes Module
================

Modular route definitions following SOLID principles.
Each route module has single responsibility.
"""

# Route modules available for import
# Import individual modules as needed to avoid circular imports

__all__ = [
    "health",
    "upload", 
    "analysis",
    "export",
    "mvc",
    "signals",
    "webhooks",
    "cache_monitoring"
]