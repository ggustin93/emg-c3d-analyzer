"""Shared Services Components
============================

Common components and patterns shared across all domain services.
Prevents circular dependencies and provides consistent interfaces.

Author: EMG C3D Analyzer Team
Date: 2025-08-27
"""

from .repositories import AbstractRepository, RepositoryError

__all__ = [
    "AbstractRepository",
    "RepositoryError"
]