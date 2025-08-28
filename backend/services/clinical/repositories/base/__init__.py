"""Base Repository Components
=========================

Common interfaces and error handling for all domain repositories.
"""

from .abstract_repository import AbstractRepository, RepositoryError

__all__ = ["AbstractRepository", "RepositoryError"]
