"""Shared Services Components.
============================

Common components and patterns shared across all domain services.
Prevents circular dependencies and provides consistent interfaces.

"""

from services.shared.repositories import AbstractRepository, RepositoryError

__all__ = ["AbstractRepository", "RepositoryError"]
