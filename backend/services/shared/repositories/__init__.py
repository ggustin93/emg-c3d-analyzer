"""Shared Repository Components.
=============================

Common repository patterns and base classes shared across all domains.
Prevents circular imports and provides consistent repository interfaces.

Author: EMG C3D Analyzer Team
Date: 2025-08-27
"""

from services.shared.repositories.base import AbstractRepository, RepositoryError

__all__ = ["AbstractRepository", "RepositoryError"]
