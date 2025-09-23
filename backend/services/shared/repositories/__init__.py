"""Shared Repository Components.
=============================

Common repository patterns and base classes shared across all domains.
Prevents circular imports and provides consistent repository interfaces.

"""

from services.shared.repositories.base import AbstractRepository, RepositoryError

__all__ = ["AbstractRepository", "RepositoryError"]
